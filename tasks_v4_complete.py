# ================================================================
# AnalyLit V4.1 - Tâches RQ (Finalisé et 100% PostgreSQL/SQLAlchemy)
# ================================================================

import os
import io
import time
import json
import uuid
import math
import logging
import random
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from scipy import stats
from sklearn.metrics import cohen_kappa_score

import chromadb
from sentence_transformers import SentenceTransformer

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, scoped_session

from redis import Redis
from rq import get_current_job

# --- Importer la config de l'application ---
from config_v4 import get_config

# --- Importer les helpers/utilitaires applicatifs (factorisés) ---
# IMPORTANT: ces modules existent côté serveur ou utils. Ils doivent rester factorisés.
# - Ne pas réécrire ici les appels réseau ou fonctions de bas niveau.
from utils.fetchers import db_manager, fetch_unpaywall_pdf_url, fetch_article_details
from utils.ai_processors import call_ollama_api  # on n’utilise plus les anciens helpers de prompt
from utils.file_handlers import sanitize_filename, extract_text_from_pdf
from utils.notifications import send_project_notification
from utils.helpers import http_get_with_retries

# Prompts “forts” + override DB
from utils.prompt_templates import (
    get_screening_prompt_template,
    get_full_extraction_prompt_template,
    get_synthesis_prompt_template,
    get_rag_chat_prompt_template,
    get_effective_prompt_template,
)

# --- Configuration globale ---
config = get_config()
logger = logging.getLogger(__name__)

PROJECTS_DIR = Path(config.PROJECTS_DIR)  # cohérent avec le serveur
PROJECTS_DIR.mkdir(parents=True, exist_ok=True)

# --- Base de Données (SQLAlchemy Uniquement) ---
engine = create_engine(config.DATABASE_URL, pool_pre_ping=True)
SessionFactory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Session = scoped_session(SessionFactory)

# --- Embeddings / Vector store (RAG) ---
EMBEDDING_MODEL_NAME = getattr(config, "EMBEDDING_MODEL", "all-MiniLM-L6-v2")
EMBED_BATCH = getattr(config, "EMBED_BATCH", 32)
MIN_CHUNK_LEN = getattr(config, "MIN_CHUNK_LEN", 250)
USE_QUERY_EMBED = getattr(config, "USE_QUERY_EMBED", True)
CHUNK_SIZE = getattr(config, "CHUNK_SIZE", 1200)
CHUNK_OVERLAP = getattr(config, "CHUNK_OVERLAP", 200)

# Charge un modèle d'embedding localement, partagé par le worker
try:
    embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
except Exception as e:
    logger.error(f"Erreur chargement du modèle d'embedding '{EMBEDDING_MODEL_NAME}': {e}")
    embedding_model = None

# ================================================================
# === FONCTIONS UTILITAIRES DB-SAFE (SQLAlchemy)
# ================================================================

def update_project_status(project_id: str, status: str, result: dict = None, discussion: str = None,
                          graph: dict = None, prisma_path: str = None, analysis_result: dict = None,
                          analysis_plot_path: str = None):
    """Met à jour le statut et/ou champs résultat d'un projet (transaction unique)."""
    session = Session()
    try:
        now_iso = datetime.now().isoformat()
        params = {"pid": project_id, "ts": now_iso, "status": status}
        if result is not None:
            stmt = "UPDATE projects SET status = :status, synthesis_result = :res, updated_at = :ts WHERE id = :pid"
            params["res"] = json.dumps(result)
        elif discussion is not None:
            stmt = "UPDATE projects SET discussion_draft = :d, updated_at = :ts WHERE id = :pid"
            params["d"] = discussion
        elif graph is not None:
            stmt = "UPDATE projects SET knowledge_graph = :g, updated_at = :ts WHERE id = :pid"
            params["g"] = json.dumps(graph)
        elif prisma_path is not None:
            stmt = "UPDATE projects SET prisma_flow_path = :p, updated_at = :ts WHERE id = :pid"
            params["p"] = prisma_path
        elif analysis_result is not None:
            stmt = (
                "UPDATE projects SET status = :status, analysis_result = :ar, "
                "analysis_plot_path = :pp, updated_at = :ts WHERE id = :pid"
            )
            params["ar"] = json.dumps(analysis_result)
            params["pp"] = analysis_plot_path
        else:
            stmt = "UPDATE projects SET status = :status, updated_at = :ts WHERE id = :pid"
        session.execute(text(stmt), params)
        session.commit()
    except Exception as e:
        session.rollback()
        logger.error(f"Erreur update_project_status: {e}", exc_info=True)
        raise
    finally:
        session.close()

def log_processing_status(session, project_id: str, article_id: str, status: str, details: str):
    """Enregistre un événement de traitement dans processing_log (utilise la session fournie)."""
    session.execute(text("""
        INSERT INTO processing_log (project_id, pmid, status, details, "timestamp")
        VALUES (:project_id, :pmid, :status, :details, :ts)
    """), {"project_id": project_id, "pmid": article_id, "status": status, "details": details, "ts": datetime.now()})

def increment_processed_count(session, project_id: str):
    """Incrémente processed_count du projet (utilise la session fournie)."""
    session.execute(text("UPDATE projects SET processed_count = processed_count + 1 WHERE id = :id"),
                    {"id": project_id})

def update_project_timing(session, project_id: str, duration: float):
    """Ajoute une durée au total_processing_time (utilise la session fournie)."""
    session.execute(text("""
        UPDATE projects SET total_processing_time = total_processing_time + :d WHERE id = :id
    """), {"d": float(duration), "id": project_id})

# ================================================================
# === TÂCHES RQ (100% SQLAlchemy)
# ================================================================

def multi_database_search_task(project_id: str, query: str, databases: list, max_results_per_db: int = 50):
    """Recherche dans plusieurs bases et insère les résultats dans search_results."""
    logger.info(f"🔍 Recherche multi-bases pour {project_id} - {databases}")
    total_found = 0
    session = Session()
    try:
        for db_name in databases:
            logger.info(f"📚 Recherche dans {db_name}...")
            results = []
            try:
                if db_name == 'pubmed':
                    results = db_manager.search_pubmed(query, max_results_per_db)
                elif db_name == 'arxiv':
                    results = db_manager.search_arxiv(query, max_results_per_db)
                elif db_name == 'crossref':
                    results = db_manager.search_crossref(query, max_results_per_db)
                elif db_name == 'ieee':
                    results = db_manager.search_ieee(query, max_results_per_db)
                else:
                    logger.warning(f"Base inconnue ignorée: {db_name}")
                    results = []

                for r in results:
                    session.execute(text("""
                        INSERT INTO search_results (
                            id, project_id, article_id, title, abstract, authors,
                            publication_date, journal, doi, url, database_source, created_at
                        )
                        VALUES (:id, :pid, :aid, :title, :abstract, :authors,
                                :pub_date, :journal, :doi, :url, :src, :ts)
                        ON CONFLICT (project_id, article_id) DO NOTHING
                    """), {
                        "id": str(uuid.uuid4()),
                        "pid": project_id,
                        "aid": r.get('id'),
                        "title": r.get('title', ''),
                        "abstract": r.get('abstract', ''),
                        "authors": r.get('authors', ''),
                        "pub_date": r.get('publication_date', ''),
                        "journal": r.get('journal', ''),
                        "doi": r.get('doi', ''),
                        "url": r.get('url', ''),
                        "src": r.get('database_source', 'unknown'),
                        "ts": datetime.now().isoformat()
                    })
                session.commit()
                total_found += len(results)

                send_project_notification(project_id, 'search_progress',
                    f'Recherche terminée dans {db_name}: {len(results)} résultats',
                    {'database': db_name, 'count': len(results)})
                time.sleep(0.6)
            except Exception as e:
                session.rollback()
                logger.error(f"Erreur dans la recherche {db_name}: {e}", exc_info=True)

        session.execute(text("""
            UPDATE projects SET status = 'search_completed', pmids_count = :n, updated_at = :ts WHERE id = :id
        """), {"n": total_found, "ts": datetime.now().isoformat(), "id": project_id})
        session.commit()

        send_project_notification(project_id, 'search_completed',
                                  f'Recherche terminée: {total_found} articles trouvés',
                                  {'total_results': total_found, 'databases': databases})
        logger.info(f"✅ Recherche multi-bases: total {total_found}")
    except Exception as e:
        session.rollback()
        logger.error(f"Erreur critique multi_database_search_task: {e}", exc_info=True)
        session.execute(text("UPDATE projects SET status = 'search_failed', updated_at = :ts WHERE id = :id"),
                        {"ts": datetime.now().isoformat(), "id": project_id})
        session.commit()
        send_project_notification(project_id, 'search_failed', f'Erreur lors de la recherche: {e}')
    finally:
        session.close()

def process_single_article_task(project_id: str, article_id: str, profile: dict,
                                analysis_mode: str, custom_grid_id: str = None):
    """Traite un article: screening ou extraction complète. Transaction atomique."""
    start_time = time.time()
    session = Session()
    try:
        row = session.execute(text("""
            SELECT * FROM search_results WHERE project_id = :pid AND article_id = :aid
        """), {"pid": project_id, "aid": article_id}).mappings().fetchone()
        if not row:
            log_processing_status(session, project_id, article_id, "erreur", "Article introuvable en base.")
            session.commit()
            return

        article = dict(row)
        text_for_analysis = ""
        analysis_source = "abstract"

        # Préférence: PDF si disponible
        pdf_path = PROJECTS_DIR / project_id / f"{sanitize_filename(article_id)}.pdf"
        if pdf_path.exists():
            pdf_text = extract_text_from_pdf(str(pdf_path))
            if pdf_text and len(pdf_text) > 100:
                text_for_analysis = pdf_text
                analysis_source = "pdf"

        if not text_for_analysis:
            title = article.get("title", "") or ""
            abstract = article.get("abstract", "") or ""
            text_for_analysis = f"{title}\n\n{abstract}"

        if len(text_for_analysis.strip()) < 50:
            log_processing_status(session, project_id, article_id, "écarté", "Contenu textuel insuffisant.")
            session.commit()
            return

        if analysis_mode == "full_extraction":
            # Charger une grille si custom_grid_id, sinon fallback simple: champs génériques
            fields_list = []
            if custom_grid_id:
                try:
                    grid_row = session.execute(text("""
                        SELECT fields FROM extraction_grids WHERE id = :gid AND project_id = :pid
                    """), {"gid": custom_grid_id, "pid": project_id}).mappings().fetchone()
                    if grid_row and grid_row.get("fields"):
                        parsed = json.loads(grid_row["fields"])
                        if isinstance(parsed, list):
                            fields_list = parsed
                except Exception as e:
                    logger.warning(f"Grille custom invalide: {e}")

            if not fields_list:
                # Fallback minimal si aucune grille custom
                fields_list = ["type_etude", "population", "intervention",
                               "resultats_principaux", "limites", "methodologie"]

            fields = [{"name": f, "description": f} for f in fields_list]
            base_tpl = get_full_extraction_prompt_template(fields)
            tpl = get_effective_prompt_template("full_extraction_prompt", base_tpl)
            prompt = tpl.replace("{text}", text_for_analysis)

            extracted = call_ollama_api(prompt, profile["extract_model"], output_format="json")
            if isinstance(extracted, dict) and extracted:
                session.execute(text("""
                    INSERT INTO extractions (
                        id, project_id, pmid, title, extracted_data, relevance_score,
                        relevance_justification, analysis_source, created_at
                    ) VALUES (:id, :pid, :pmid, :title, :ex_data, 10,
                              'Extraction détaillée effectuée', :src, :ts)
                """), {
                    "id": str(uuid.uuid4()),
                    "pid": project_id,
                    "pmid": article_id,
                    "title": article.get("title", ""),
                    "ex_data": json.dumps(extracted),
                    "src": analysis_source,
                    "ts": datetime.now().isoformat()
                })
            else:
                log_processing_status(session, project_id, article_id, "écarté", "Réponse IA invalide (extraction).")
        else:
            # screening
            base_tpl = get_screening_prompt_template()
            tpl = get_effective_prompt_template("screening_prompt", base_tpl)
            prompt = tpl.format(
                title=article.get("title", ""),
                abstract=article.get("abstract", ""),
                database_source=article.get("database_source", "unknown")
            )

            resp = call_ollama_api(prompt, profile["preprocess_model"], output_format="json")
            score = resp.get("relevance_score", 0) if isinstance(resp, dict) else 0
            justification = resp.get("justification", "N/A") if isinstance(resp, dict) else "Réponse IA invalide."

            session.execute(text("""
                INSERT INTO extractions (
                    id, project_id, pmid, title, relevance_score,
                    relevance_justification, analysis_source, created_at
                ) VALUES (:id, :pid, :pmid, :title, :score, :just, :src, :ts)
            """), {
                "id": str(uuid.uuid4()),
                "pid": project_id,
                "pmid": article_id,
                "title": article.get("title", ""),
                "score": score,
                "just": justification,
                "src": analysis_source,
                "ts": datetime.now().isoformat()
            })

        # Compteurs projet + timing
        increment_processed_count(session, project_id)
        update_project_timing(session, project_id, time.time() - start_time)
        session.commit()

        send_project_notification(project_id, 'article_processed',
                                  f'Article "{article.get("title","")[:30]}..." traité.',
                                  {'article_id': article_id})
    except Exception as e:
        session.rollback()
        logger.error(f"Erreur process_single_article_task [{article_id}]: {e}", exc_info=True)
        # log d'erreur dans une transaction séparée
        try:
            with Session() as s2:
                log_processing_status(s2, project_id, article_id, "erreur", str(e))
                s2.commit()
        except Exception:
            pass
    finally:
        session.close()

def run_synthesis_task(project_id: str, profile: dict):
    """Génère une synthèse à partir des articles pertinents (score >= 7)."""
    update_project_status(project_id, "synthesizing")
    session = Session()
    try:
        project = session.execute(
            text("SELECT description FROM projects WHERE id = :pid"),
            {"pid": project_id}
        ).mappings().fetchone()
        project_description = project["description"] if project else "Non spécifié"

        rows = session.execute(text("""
            SELECT s.title, s.abstract
            FROM extractions e
            JOIN search_results s ON e.project_id = s.project_id AND e.pmid = s.article_id
            WHERE e.project_id = :pid AND e.relevance_score >= 7
            ORDER BY e.relevance_score DESC
            LIMIT 30
        """), {"pid": project_id}).mappings().all()

        if not rows:
            update_project_status(project_id, "failed")
            send_project_notification(project_id, 'synthesis_failed', 'Aucun article pertinent (score >= 7).')
            return

        abstracts = [f"Titre: {r['title']}\nRésumé: {r['abstract']}" for r in rows if r.get('abstract')]
        if not abstracts:
            update_project_status(project_id, "failed")
            send_project_notification(project_id, 'synthesis_failed', "Articles pertinents sans résumé.")
            return

        data_for_prompt = "\n\n---\n\n".join(abstracts)
        base_tpl = get_synthesis_prompt_template()
        tpl = get_effective_prompt_template('synthesis_prompt', base_tpl)
        prompt = tpl.format(project_description=project_description, data_for_prompt=data_for_prompt)

        output = call_ollama_api(prompt, profile.get('synthesis_model', 'llama3.1:8b'), output_format="json")
        if output and isinstance(output, dict):
            update_project_status(project_id, "completed", result=output)
            send_project_notification(project_id, 'synthesis_completed', 'Synthèse générée.')
        else:
            update_project_status(project_id, "failed")
            send_project_notification(project_id, 'synthesis_failed', "Réponse IA invalide.")
    except Exception as e:
        logger.error(f"Erreur run_synthesis_task: {e}", exc_info=True)
        update_project_status(project_id, "failed")
        send_project_notification(project_id, 'synthesis_failed', f"Erreur: {e}")
    finally:
        session.close()

def run_discussion_generation_task(project_id: str):
    """Génère une section 'Discussion' basée sur la synthèse et la liste d'articles."""
    session = Session()
    try:
        proj = session.execute(text("""
            SELECT synthesis_result, profile_used FROM projects WHERE id = :pid
        """), {"pid": project_id}).mappings().fetchone()
        if not proj or not proj.get("synthesis_result"):
            return

        extr = session.execute(text("""
            SELECT pmid, title FROM extractions WHERE project_id = :pid
        """), {"pid": project_id}).mappings().all()

        profile_row = session.execute(text("""
            SELECT synthesis_model FROM analysis_profiles WHERE id = :id
        """), {"id": (proj.get('profile_used') or 'standard')}).mappings().fetchone()
        model_name = (profile_row.get('synthesis_model') if profile_row else 'llama3.1:8b')

        try:
            synthesis_data = json.loads(proj['synthesis_result'])
        except Exception:
            synthesis_data = {}

        article_list = "\n".join([f"- {e['title']} (ID: {e['pmid']})" for e in extr])

        prompt = (
            "En tant que chercheur, rédige une section 'Discussion' académique en te basant sur le résumé de synthèse\n"
            "et la liste d'articles ci-dessous.\n\n"
            f"---\n{json.dumps(synthesis_data, indent=2)}\n---\n"
            f"Articles Inclus:\n---\n{article_list}\n---\n"
            "La discussion doit synthétiser les apports, analyser les perspectives, explorer les divergences et suggérer "
            "des pistes de recherche futures en citant les sources."
        )

        discussion_text = call_ollama_api(prompt, model_name)
        if discussion_text:
            update_project_status(project_id, status="completed", discussion=discussion_text)
            send_project_notification(project_id, 'analysis_completed', 'Discussion générée.')
    except Exception as e:
        logger.error(f"Erreur run_discussion_generation_task: {e}", exc_info=True)
    finally:
        session.close()

def run_knowledge_graph_task(project_id: str):
    """Génère un graphe de connaissances JSON à partir des titres d'articles extraits."""
    update_project_status(project_id, status="generating_graph")
    session = Session()
    try:
        profile_key_row = session.execute(text("""
            SELECT profile_used FROM projects WHERE id = :pid
        """), {"pid": project_id}).mappings().fetchone()
        profile_key = profile_key_row.get('profile_used') if profile_key_row else 'standard'

        profile_row = session.execute(text("""
            SELECT extract_model FROM analysis_profiles WHERE id = :id
        """), {"id": profile_key}).mappings().fetchone()
        model_to_use = profile_row.get('extract_model') if profile_row else 'llama3.1:8b'

        rows = session.execute(text("""
            SELECT title, pmid FROM extractions WHERE project_id = :pid
        """), {"pid": project_id}).mappings().all()
        if not rows:
            update_project_status(project_id, status="completed")
            return

        titles = [f"{r['title']} (ID: {r['pmid']})" for r in rows][:100]
        prompt = (
            "À partir de la liste de titres suivante, génère un graphe de connaissances. "
            "Identifie les 10 concepts les plus importants et leurs relations.\n"
            'Ta réponse doit être UNIQUEMENT un objet JSON avec "nodes" (id, label) et "edges" (from, to, label).\n'
            f"Titres : {json.dumps(titles, indent=2)}"
        )

        graph = call_ollama_api(prompt, model=model_to_use, output_format="json")
        if graph and isinstance(graph, dict) and "nodes" in graph and "edges" in graph:
            update_project_status(project_id, status="completed", graph=graph)
        else:
            update_project_status(project_id, status="completed")
    except Exception as e:
        logger.error(f"Erreur run_knowledge_graph_task: {e}", exc_info=True)
        update_project_status(project_id, status="completed")
    finally:
        session.close()

def run_prisma_flow_task(project_id: str):
    """Génère un diagramme PRISMA simplifié et stocke l'image sur disque."""
    update_project_status(project_id, status="generating_prisma")
    session = Session()
    try:
        total_found = session.execute(text("""
            SELECT COUNT(*) FROM search_results WHERE project_id = :pid
        """), {"pid": project_id}).scalar_one()

        n_included = session.execute(text("""
            SELECT COUNT(*) FROM extractions WHERE project_id = :pid
        """), {"pid": project_id}).scalar_one()

        if total_found == 0:
            update_project_status(project_id, status="completed")
            return

        n_after_duplicates = total_found
        n_excluded_screening = n_after_duplicates - n_included

        fig, ax = plt.subplots(figsize=(8, 10))
        box = dict(boxstyle='round,pad=0.5', fc='lightblue', alpha=0.7)

        ax.text(0.5, 0.9, f'Articles identifiés (n = {total_found})', ha='center', va='center', bbox=box)
        ax.text(0.5, 0.7, f'Après exclusion doublons (n = {n_after_duplicates})', ha='center', va='center', bbox=box)
        ax.text(0.5, 0.5, f'Articles évalués (n = {n_after_duplicates})', ha='center', va='center', bbox=box)
        ax.text(0.5, 0.3, f'Études incluses (n = {n_included})', ha='center', va='center', bbox=box)
        ax.text(1.0, 0.5, f'Exclus au criblage (n = {n_excluded_screening})', ha='left', va='center', bbox=box)
        ax.axis('off')

        pdir = PROJECTS_DIR / project_id
        pdir.mkdir(exist_ok=True)
        image_path = str(pdir / 'prisma_flow.png')
        plt.savefig(image_path, bbox_inches='tight')
        plt.close(fig)

        update_project_status(project_id, status="completed", prisma_path=image_path)
        send_project_notification(project_id, 'analysis_completed', 'Diagramme PRISMA généré.')
    except Exception as e:
        logger.error(f"Erreur run_prisma_flow_task: {e}", exc_info=True)
        update_project_status(project_id, status="completed")
    finally:
        session.close()

def run_meta_analysis_task(project_id: str):
    """Méta-analyse simple des scores de pertinence (distribution + IC 95%)."""
    update_project_status(project_id, "generating_analysis")
    session = Session()
    try:
        scores = session.execute(text("""
            SELECT relevance_score FROM extractions
            WHERE project_id = :pid AND relevance_score IS NOT NULL AND relevance_score > 0
        """), {"pid": project_id}).scalars().all()

        if len(scores) < 2:
            update_project_status(project_id, "failed")
            send_project_notification(project_id, 'analysis_failed', 'Pas assez de données pour une méta-analyse.')
            return

        scores_arr = np.array(scores, dtype=float)
        mean_score = float(np.mean(scores_arr))
        std_score = float(np.std(scores_arr, ddof=1))
        n = len(scores_arr)

        # Intervalle de confiance 95% sur la moyenne (approx t de Student)
        se = std_score / math.sqrt(n)
        t_crit = float(stats.t.ppf(0.975, df=n-1)) if n > 1 else 0.0
        ci_low = float(mean_score - t_crit * se)
        ci_high = float(mean_score + t_crit * se)

        # Visualisation simple (histogramme)
        fig, ax = plt.subplots(figsize=(8, 5))
        ax.hist(scores_arr, bins=min(20, max(5, n // 2)), color='#2980b9', alpha=0.7, edgecolor='white')
        ax.axvline(mean_score, color='red', linestyle='--', label=f"Moyenne = {mean_score:.2f}")
        ax.set_title('Distribution des scores de pertinence')
        ax.set_xlabel('Score IA')
        ax.set_ylabel('Fréquence')
        ax.legend()

        pdir = PROJECTS_DIR / project_id
        pdir.mkdir(exist_ok=True)
        plot_path = str(pdir / 'meta_analysis_hist.png')
        plt.savefig(plot_path, bbox_inches='tight')
        plt.close(fig)

        result = {
            "n_articles": n,
            "mean_score": mean_score,
            "std_score": std_score,
            "confidence_interval": [ci_low, ci_high],
        }
        update_project_status(project_id, status="completed", analysis_result=result, analysis_plot_path=plot_path)
        send_project_notification(project_id, 'analysis_completed', 'Méta-analyse terminée.')
    except Exception as e:
        logger.error(f"Erreur run_meta_analysis_task: {e}", exc_info=True)
        update_project_status(project_id, "failed")
        send_project_notification(project_id, 'analysis_failed', f'Erreur: {e}')
    finally:
        session.close()

def run_descriptive_stats_task(project_id: str):
    """Statistiques descriptives simples des scores de pertinence et sauvegarde d’un boxplot."""
    update_project_status(project_id, "generating_analysis")
    session = Session()
    try:
        scores = session.execute(text("""
            SELECT relevance_score FROM extractions
            WHERE project_id = :pid AND relevance_score IS NOT NULL AND relevance_score > 0
        """), {"pid": project_id}).scalars().all()

        if len(scores) < 1:
            update_project_status(project_id, "failed")
            send_project_notification(project_id, 'analysis_failed', 'Aucune donnée pour statistiques descriptives.')
            return

        scores_arr = np.array(scores, dtype=float)
        result = {
            "count": int(scores_arr.size),
            "mean": float(np.mean(scores_arr)),
            "median": float(np.median(scores_arr)),
            "min": float(np.min(scores_arr)),
            "max": float(np.max(scores_arr)),
            "std": float(np.std(scores_arr, ddof=1)) if scores_arr.size > 1 else 0.0,
            "q1": float(np.percentile(scores_arr, 25)),
            "q3": float(np.percentile(scores_arr, 75)),
        }

        # Boxplot
        fig, ax = plt.subplots(figsize=(6, 5))
        ax.boxplot(scores_arr, vert=True, patch_artist=True,
                   boxprops=dict(facecolor='#1abc9c', color='#16a085'),
                   medianprops=dict(color='red'))
        ax.set_title('Scores de pertinence - Statistiques descriptives')
        ax.set_ylabel('Score IA')

        pdir = PROJECTS_DIR / project_id
        pdir.mkdir(exist_ok=True)
        plot_path = str(pdir / 'descriptive_stats_boxplot.png')
        plt.savefig(plot_path, bbox_inches='tight')
        plt.close(fig)

        update_project_status(project_id, status="completed", analysis_result=result, analysis_plot_path=plot_path)
        send_project_notification(project_id, 'analysis_completed', 'Statistiques descriptives générées.')
    except Exception as e:
        logger.error(f"Erreur run_descriptive_stats_task: {e}", exc_info=True)
        update_project_status(project_id, "failed")
        send_project_notification(project_id, 'analysis_failed', f'Erreur: {e}')
    finally:
        session.close()

# ================================================================
# === CHAT RAG (Version finale avec profil)
# ================================================================

def answer_chat_question_task(project_id: str, question: str, profile: dict, top_k: int = 5):
    """
    RAG: répond à une question basée sur les PDFs indexés via embeddings.
    --- CORRECTION ---
    Signature mise à jour pour accepter le 'profile'.
    - Recherche sémantique dans un index Chroma par projet
    - Construction d’un prompt robuste via get_rag_chat_prompt_template (override DB si présent)
    - Utilisation du modèle de synthèse défini par le profil
    - Persistance de l’historique des échanges dans chat_messages
    """
    logger.info(f"💬 Question RAG pour projet {project_id}")
    try:
        # 1) Charger/initialiser la collection Chroma du projet
        client = chromadb.Client()
        collection_name = f"project_{project_id}"
        collection = client.get_or_create_collection(name=collection_name)

        # 2) Vérifier la disponibilité des embeddings
        if embedding_model is None:
            logger.warning("Modèle d'embedding indisponible")
            return {"answer": "Embedding indisponible sur le worker.", "sources": []}

        # 3) Encoder la question et interroger l’index
        q_emb = embedding_model.encode([question]).tolist()
        results = collection.query(query_embeddings=[q_emb], n_results=max(1, int(top_k)))

        docs = results.get("documents", [[]])
        metadatas = results.get("metadatas", [[]])

        # 4) Construire le contexte et la liste des sources
        context_parts, sources = [], []
        for i, d in enumerate(docs):
            if not d:
                continue
            context_parts.append(d)
            md = metadatas[i] if i < len(metadatas) else {}
            src = md.get("source_id") or md.get("pmid") or md.get("article_id") or md.get("title") or f"doc_{i+1}"
            sources.append(src)

        context = "\n\n---\n\n".join(context_parts) if context_parts else ""

        # 5) Construire le prompt RAG (avec override DB si présent)
        base_tpl = get_rag_chat_prompt_template()
        tpl = get_effective_prompt_template("rag_chat_prompt", base_tpl)
        rag_prompt = tpl.format(context=context, question=question)

        # 6) Choisir le modèle depuis le profil (fallback: llama3.1:8b)
        model_name = (profile or {}).get('synthesis_model', 'llama3.1:8b')

        # 7) Appel LLM via Ollama
        answer_text = call_ollama_api(rag_prompt, model_name)
        answer = answer_text if isinstance(answer_text, str) else str(answer_text)

        # 8) Sauvegarder l’historique dans PostgreSQL
        session = Session()
        try:
            ts = datetime.now().isoformat()
            # Message utilisateur
            session.execute(text("""
                INSERT INTO chat_messages (id, project_id, role, content, timestamp)
                VALUES (:id, :pid, 'user', :c, :ts)
            """), {"id": str(uuid.uuid4()), "pid": project_id, "c": question, "ts": ts})
            # Réponse assistant
            session.execute(text("""
                INSERT INTO chat_messages (id, project_id, role, content, sources, timestamp)
                VALUES (:id, :pid, 'assistant', :c, :s, :ts)
            """), {"id": str(uuid.uuid4()), "pid": project_id, "c": answer, "s": json.dumps(sources), "ts": ts})
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"Erreur sauvegarde historique chat: {e}", exc_info=True)
        finally:
            session.close()

        return {"answer": answer, "sources": sources}
    except Exception as e:
        logger.error(f"Erreur answer_chat_question_task: {e}", exc_info=True)
        return {"answer": f"❌ Erreur: {e}", "sources": []}

# ================================================================
# === ZOTERO: IMPORT À PARTIR D'UN FICHIER CSL JSON (fusion des fonctions manquantes)
# ================================================================

def import_from_zotero_file_task(project_id: str, json_file_path: str):
    """Importe des références depuis un fichier JSON Zotero."""
    logger.info(f"📚 Import fichier Zotero pour projet {project_id}: {json_file_path}")
    try:
        from utils.importers import ZoteroAbstractExtractor
        extractor = ZoteroAbstractExtractor(json_file_path)
        records = extractor.process()

        session = Session()
        try:
            imported_count = 0
            for record in records:
                session.execute(text("""
                    INSERT INTO search_results (
                        id, project_id, article_id, title, abstract, authors,
                        publication_date, journal, doi, url, database_source, created_at
                    ) VALUES (:id, :pid, :aid, :title, :abstract, :authors,
                              :pub_date, :journal, :doi, :url, :src, :ts)
                    ON CONFLICT (project_id, article_id) DO NOTHING
                """), {
                    "id": str(uuid.uuid4()),
                    "pid": project_id,
                    "aid": record.get('article_id', f"zotero_{imported_count}"),
                    "title": record.get('title', ''),
                    "abstract": record.get('abstract', ''),
                    "authors": record.get('authors', ''),
                    "pub_date": record.get('publication_date', ''),
                    "journal": record.get('journal', ''),
                    "doi": record.get('doi', ''),
                    "url": record.get('url', ''),
                    "src": record.get('database_source', 'zotero_import'),
                    "ts": datetime.now().isoformat()
                })
                imported_count += 1
            session.commit()
            send_project_notification(project_id, 'search_completed',
                                      f'{imported_count} références importées depuis Zotero')
        finally:
            session.close()
    except Exception as e:
        logger.error(f"Erreur import_from_zotero_file_task: {e}")
        send_project_notification(project_id, 'import_failed', f'Erreur import Zotero: {e}')

def import_pdfs_from_zotero_task(project_id: str, api_key: str, library_id: str):
    """Importe des PDFs depuis Zotero (simulation/placeholder)."""
    logger.info(f"📚 Import Zotero PDFs pour projet {project_id}")
    try:
        # Simulation d'import Zotero (à implémenter si nécessaire via pyzotero)
        send_project_notification(project_id, 'pdf_upload_completed', 'Import Zotero simulé (à implémenter)')
    except Exception as e:
        logger.error(f"Erreur import_pdfs_from_zotero_task: {e}")

# ================================================================
# === INDEXATION & RÉCUPÉRATION PDF (fusion des fonctions manquantes)
# ================================================================

def index_project_pdfs_task(project_id: str):
    """Indexe les PDFs d'un projet pour le RAG (simulation d'indexation ChromaDB)."""
    logger.info(f"🔍 Indexation des PDFs pour projet {project_id}")
    try:
        project_dir = PROJECTS_DIR / project_id
        if not project_dir.exists():
            return
        pdf_files = list(project_dir.glob("*.pdf"))
        if not pdf_files:
            return

        if embedding_model is None:
            logger.warning("Modèle d'embedding non disponible")
            return

        # Simulation d'indexation (à adapter pour stocker dans ChromaDB avec embeddings et métadonnées)
        indexed_count = 0
        client = chromadb.Client()
        collection = client.get_or_create_collection(name=f"project_{project_id}")

        for pdf_path in pdf_files:
            text = extract_text_from_pdf(str(pdf_path))
            if text and len(text) > 100:
                # Découpage simple en un seul chunk pour cette simulation
                emb = embedding_model.encode([text]).tolist()
                doc_id = sanitize_filename(pdf_path.stem)
                collection.add(documents=[text], embeddings=[emb], ids=[doc_id],
                               metadatas=[{"source_id": doc_id, "filename": pdf_path.name}])
                indexed_count += 1

        session = Session()
        try:
            session.execute(text("""
                UPDATE projects SET indexed_at = :ts WHERE id = :pid
            """), {"ts": datetime.now().isoformat(), "pid": project_id})
            session.commit()
        finally:
            session.close()

        send_project_notification(project_id, 'indexing_completed', f'{indexed_count} PDFs indexés')
    except Exception as e:
        logger.error(f"Erreur index_project_pdfs_task: {e}")

def fetch_online_pdf_task(project_id: str, article_id: str):
    """Récupère un PDF en ligne pour un article via Unpaywall si possible."""
    logger.info(f"📄 Récupération PDF en ligne pour {article_id}")
    session = Session()
    try:
        article = session.execute(text("""
            SELECT doi, url FROM search_results
            WHERE project_id = :pid AND article_id = :aid
        """), {"pid": project_id, "aid": article_id}).mappings().fetchone()
        if not article:
            return

        pdf_url = None
        if article.get("doi"):
            pdf_url = fetch_unpaywall_pdf_url(article["doi"])

        if pdf_url:
            response = http_get_with_retries(pdf_url, timeout=60)
            if response and response.headers.get('content-type', '').startswith('application/pdf'):
                project_dir = PROJECTS_DIR / project_id
                project_dir.mkdir(exist_ok=True)
                pdf_path = project_dir / f"{sanitize_filename(article_id)}.pdf"
                pdf_path.write_bytes(response.content)
                send_project_notification(project_id, 'pdf_upload_completed', f'PDF récupéré pour {article_id}')
                return

        send_project_notification(project_id, 'pdf_fetch_failed', f'PDF non trouvé pour {article_id}')
    except Exception as e:
        logger.error(f"Erreur fetch_online_pdf_task: {e}")
    finally:
        session.close()

# ================================================================
# === OLLAMA (fusion des fonctions manquantes)
# ================================================================

def pull_ollama_model_task(model_name: str):
    """Télécharge un modèle Ollama."""
    logger.info(f"🤖 Téléchargement du modèle Ollama: {model_name}")
    try:
        import requests
        url = f"{config.OLLAMA_BASE_URL}/api/pull"
        payload = {"name": model_name, "stream": False}
        response = requests.post(url, json=payload, timeout=3600)
        response.raise_for_status()
        logger.info(f"✅ Modèle {model_name} téléchargé avec succès")
    except Exception as e:
        logger.error(f"❌ Erreur téléchargement {model_name}: {e}")
        raise

# ================================================================
# === SCORES ATN (fusion des fonctions manquantes)
# ================================================================

def run_atn_score_task(project_id: str):
    """Calcule des scores ATN simples à partir des extractions JSON (simulation)."""
    logger.info(f"📊 Calcul des scores ATN pour le projet {project_id}")
    session = Session()
    try:
        extractions = session.execute(text("""
            SELECT id, extracted_data FROM extractions
            WHERE project_id = :pid AND extracted_data IS NOT NULL
        """), {"pid": project_id}).mappings().all()
        if not extractions:
            return

        total_score = 0
        count = 0
        for ext in extractions:
            try:
                data = json.loads(ext["extracted_data"])
                # Simulation du calcul ATN: nombre de champs non vides * 2
                score = len([v for v in data.values() if v and str(v).strip()]) * 2
                total_score += score
                count += 1
            except Exception:
                continue

        if count > 0:
            mean_atn = total_score / count
            result = {
                "total_articles": count,
                "mean_atn": mean_atn,
                "total_articles_scored": count
            }
            update_project_status(project_id, "completed", analysis_result=result)
            send_project_notification(project_id, 'analysis_completed',
                                      f'Scores ATN calculés: {mean_atn:.2f} (moyenne)')
    except Exception as e:
        logger.error(f"Erreur run_atn_score_task: {e}")
        update_project_status(project_id, "failed")
    finally:
        session.close()

# ================================================================
# === KAPPA (déjà présent et conservé)
# ================================================================

def calculate_kappa_task(project_id: str):
    """Calcule le coefficient Kappa de Cohen entre evaluator_1 et evaluator_2 stockés dans extractions.validations."""
    session = Session()
    try:
        rows = session.execute(text("""
            SELECT validations FROM extractions
            WHERE project_id = :pid AND validations IS NOT NULL
        """), {"pid": project_id}).mappings().all()

        r1, r2 = [], []
        for r in rows:
            try:
                v = json.loads(r["validations"])
                if "evaluator_1" in v and "evaluator_2" in v:
                    r1.append(v["evaluator_1"])
                    r2.append(v["evaluator_2"])
            except Exception:
                continue

        if len(r1) < 5:
            result_text = f"Pas assez de données communes ({len(r1)}) pour un calcul de Kappa fiable."
        else:
            kappa = float(cohen_kappa_score(r1, r2))
            result_text = f"Coefficient Kappa de Cohen : {kappa:.3f} (basé sur {len(r1)} articles)"

        session.execute(text("""
            UPDATE projects SET inter_rater_reliability = :k WHERE id = :pid
        """), {"k": result_text, "pid": project_id})
        session.commit()
        send_project_notification(project_id, 'kappa_calculated', result_text)
        logger.info(f"Kappa calculé: {result_text}")
    except Exception as e:
        session.rollback()
        logger.error(f"Erreur calculate_kappa_task: {e}", exc_info=True)
        send_project_notification(project_id, 'error', f"Erreur lors du calcul du Kappa: {e}")
    finally:
        session.close()
