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

# --- Importer les helpers/utilitaires applicatifs (déjà présents dans votre projet) ---
# IMPORTANT: ces modules existent côté serveur ou utils. Ils doivent rester factorisés.
# - Ne pas réécrire ici les appels réseau ou fonctions de bas niveau.
from utils.fetchers import db_manager, fetch_unpaywall_pdf_url, fetch_article_details
from utils.ai_processors import call_ollama_api, get_screening_prompt, get_full_extraction_prompt
from utils.file_handlers import sanitize_filename, extract_text_from_pdf
from utils.notifications import send_project_notification
from utils.helpers import http_get_with_retries

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
def get_prompt_from_db(prompt_name: str) -> str:
    """Récupère un template de prompt depuis la base via SQLAlchemy.
       Fournit un fallback minimal si indisponible."""
    session = Session()
    try:
        row = session.execute(
            text("SELECT template FROM prompts WHERE name = :name"),
            {"name": prompt_name}
        ).scalar_one_or_none()
        if row:
            return row
    except Exception as e:
        logger.error(f"Erreur get_prompt_from_db: {e}", exc_info=True)
    finally:
        session.close()

    # Fallbacks minimaux
    if prompt_name == 'screening_prompt':
        return (
            "En tant qu'assistant de recherche spécialisé, analysez cet article et déterminez sa pertinence.\n\n"
            "Titre: {title}\n\nRésumé: {abstract}\n\nSource: {database_source}\n\n"
            "Répondez UNIQUEMENT en JSON: {\"relevance_score\": 0-10, "
            "\"decision\": \"À inclure\"|\"À exclure\", \"justification\": \"...\"}"
        )
    if prompt_name == 'full_extraction_prompt':
        return (
            "ROLE: Assistant expert. Répondez UNIQUEMENT avec un JSON valide.\n"
            "TEXTE À ANALYSER:\n---\n{text}\n---\nSOURCE: {database_source}\n"
            "{\n\"type_etude\":\"...\",\"population\":\"...\",\"intervention\":\"...\","
            "\"resultats_principaux\":\"...\",\"limites\":\"...\",\"methodologie\":\"...\"\n}"
        )
    if prompt_name == 'synthesis_prompt':
        return (
            "Contexte: {project_description}\n"
            "Résumés:\n---\n{data_for_prompt}\n---\n"
            "Réponds en JSON: {\"relevance_evaluation\":[],\"main_themes\":[],"
            "\"key_findings\":[],\"methodologies_used\":[],\"synthesis_summary\":\"\",\"research_gaps\":[]}"
        )
    return ""


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
            prompt = get_full_extraction_prompt(
                text_for_analysis,
                article.get("database_source", "unknown"),
                custom_grid_id
            )
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
            prompt = get_screening_prompt(
                article.get("title", ""),
                article.get("abstract", ""),
                article.get("database_source", "unknown")
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
        template = get_prompt_from_db('synthesis_prompt')
        prompt = template.format(project_description=project_description, data_for_prompt=data_for_prompt)

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
            send_project_notification(project_id, 'analysis_failed', 'Pas assez de données pour la méta-analyse (au moins 2 scores requis).')
            return

        arr = np.array(scores, dtype=float)
        mean_score = float(np.mean(arr))
        std_dev = float(np.std(arr, ddof=1))
        n = len(arr)
        std_err = std_dev / math.sqrt(n)
        ci_low, ci_high = stats.t.interval(0.95, df=n - 1, loc=mean_score, scale=std_err)

        analysis_result = {
            "mean_score": mean_score, "std_dev": std_dev,
            "confidence_interval": [float(ci_low), float(ci_high)], "n_articles": n
        }

        pdir = PROJECTS_DIR / project_id
        pdir.mkdir(exist_ok=True)
        plot_path = str(pdir / 'meta_analysis_plot.png')
        fig, ax = plt.subplots(figsize=(10, 6))
        ax.hist(arr, bins=10, alpha=0.7, color='skyblue', edgecolor='black')
        ax.axvline(mean_score, color='red', linestyle='--', linewidth=2, label=f'Moyenne: {mean_score:.2f}')
        ax.set_xlabel('Score de Pertinence')
        ax.set_ylabel("Nombre d'Articles")
        ax.set_title('Distribution des Scores de Pertinence')
        ax.legend()
        plt.savefig(plot_path, bbox_inches='tight')
        plt.close(fig)

        update_project_status(project_id, "completed", analysis_result=analysis_result, analysis_plot_path=plot_path)
        send_project_notification(project_id, 'analysis_completed', 'Méta-analyse terminée.')
    except Exception as e:
        logger.error(f"Erreur run_meta_analysis_task: {e}", exc_info=True)
        update_project_status(project_id, "failed")
    finally:
        session.close()

def run_descriptive_stats_task(project_id: str):
    """Statistiques descriptives basées sur les données extraites (si présentes)."""
    update_project_status(project_id, "generating_analysis")
    session = Session()
    try:
        rows = session.execute(text("""
        SELECT extracted_data FROM extractions WHERE project_id = :pid AND extracted_data IS NOT NULL
        """), {"pid": project_id}).fetchall()
        if not rows:
            update_project_status(project_id, "failed")
            send_project_notification(project_id, 'analysis_failed', "Aucune donnée d'extraction disponible pour les statistiques descriptives.")
            return

        records = []
        for r in rows:
            try:
                data = json.loads(r['extracted_data'])
                if isinstance(data, dict):
                    records.append(data)
            except Exception:
                continue

        if not records:
            update_project_status(project_id, "failed")
            send_project_notification(project_id, 'analysis_failed', "Impossible de parser les données extraites pour les statistiques descriptives.")
            return

        df = pd.json_normalize(records)
        pdir = PROJECTS_DIR / project_id
        pdir.mkdir(exist_ok=True)
        plot_paths = {}

        if 'methodologie.type_etude' in df.columns:
            s = df['methodologie.type_etude'].value_counts()
            fig, ax = plt.subplots(figsize=(10, 6))
            s.plot(kind='bar', ax=ax)
            ax.set_title("Répartition des Types d'Études")
            ax.set_ylabel("Nombre d'Articles")
            plt.xticks(rotation=45, ha='right')
            plot_path = str(pdir / 'study_types.png')
            plt.savefig(plot_path, bbox_inches='tight')
            plt.close(fig)
            plot_paths['study_types'] = plot_path

        summary_stats = {"total_articles": int(len(df)), "available_fields": list(df.columns)}
        update_project_status(project_id, "completed", analysis_result=summary_stats,
                              analysis_plot_path=json.dumps(plot_paths) if plot_paths else None)
        send_project_notification(project_id, 'analysis_completed', 'Statistiques descriptives générées.')
    except Exception as e:
        logger.error(f"Erreur run_descriptive_stats_task: {e}", exc_info=True)
        update_project_status(project_id, "failed")
    finally:
        session.close()

def run_atn_score_task(project_id: str):
    """Calcule un score ATN (Alliance Thérapeutique Numérique) simple à partir du JSON extrait."""
    update_project_status(project_id, "generating_analysis")
    session = Session()
    try:
        rows = session.execute(text("""
            SELECT pmid, title, extracted_data
            FROM extractions
            WHERE project_id = :pid AND extracted_data IS NOT NULL
        """), {"pid": project_id}).mappings().all()
        if not rows:
            update_project_status(project_id, "failed")
            send_project_notification(project_id, 'analysis_failed', "Aucune donnée d'extraction disponible pour le calcul du score ATN.")
            return

        scores = []
        for r in rows:
            try:
                data = json.loads(r['extracted_data'])
                s = 0
                text_blob = json.dumps(data, ensure_ascii=False).lower()
                if 'alliance' in text_blob or 'therapeutic' in text_blob:
                    s += 3
                if any(k in text_blob for k in ['numérique', 'digital', 'app', 'plateforme', 'ia']):
                    s += 3
                if any(k in text_blob for k in ['patient', 'soignant', 'développeur']):
                    s += 2
                if any(k in text_blob for k in ['empathie', 'adherence', 'confiance']):
                    s += 2
                scores.append({"pmid": r['pmid'], "title": r['title'], "atn_score": min(s, 10)})
            except Exception:
                continue

        # Aucun score calculable
        if not scores:
            update_project_status(project_id, "failed")
            send_project_notification(project_id, 'analysis_failed', "Aucun score ATN calculable à partir des données extraites.")
            return

        mean_atn = float(np.mean([s['atn_score'] for s in scores]))
        analysis_result = {
            "atn_scores": scores,
            "mean_atn": mean_atn,
            "total_articles_scored": len(scores)
        }

        pdir = PROJECTS_DIR / project_id
        pdir.mkdir(exist_ok=True)
        plot_path = str(pdir / 'atn_scores.png')

        # Génération du plot uniquement si des scores existent (déjà garanti ci-dessus)
        fig, ax = plt.subplots(figsize=(10, 6))
        atn_values = [s['atn_score'] for s in scores]
        ax.hist(atn_values, bins=11, range=(-0.5, 10.5), alpha=0.7, color='green', edgecolor='black')
        ax.set_xlabel('Score ATN')
        ax.set_ylabel("Nombre d'Articles")
        ax.set_title('Distribution des Scores ATN')
        ax.set_xticks(range(0, 11))
        plt.savefig(plot_path, bbox_inches='tight')
        plt.close(fig)

        update_project_status(project_id, "completed", analysis_result=analysis_result, analysis_plot_path=plot_path)
        send_project_notification(project_id, 'analysis_completed', 'Score ATN calculé.')
    except Exception as e:
        logger.error(f"Erreur run_atn_score_task: {e}", exc_info=True)
        update_project_status(project_id, "failed")
        # Option UX minimale: notifier l'échec inattendu aussi
        send_project_notification(project_id, 'analysis_failed', f"Erreur inattendue lors du calcul du score ATN: {e}")
    finally:
        session.close()


def import_pdfs_from_zotero_task(project_id, pmids, zotero_user_id, zotero_api_key):
    """Importe des PDF depuis Zotero, en les écrivant dans le dossier du projet."""
    logger.info(f"🔄 Import Zotero démarré pour {len(pmids)} IDs...")
    successful_pmids = []

    try:
        from pyzotero import zotero
        zot = zotero.Zotero(zotero_user_id, 'user', zotero_api_key)

        # Test connexion
        try:
            zot.key_info()
        except Exception as e:
            send_project_notification(project_id, 'zotero_import_failed', 'Échec connexion Zotero.')
            return

        pdir = PROJECTS_DIR / project_id
        pdir.mkdir(exist_ok=True)

        for aid in pmids:
            try:
                queries = [aid, f"PMID:{aid}"]
                if '/' in aid and aid.startswith('10.'):
                    queries.append(f'doi:"{aid}"')
                found_item = None
                for q in queries:
                    items = zot.items(q=q, limit=5)
                    if items:
                        found_item = items
                        break
                if not found_item:
                    continue

                attachments = zot.children(found_item['key'])
                for att in attachments:
                    if att.get('data', {}).get('contentType') == 'application/pdf':
                        pdf_content = zot.file(att['key'])
                        out = pdir / (sanitize_filename(aid) + ".pdf")
                        with open(out, 'wb') as f:
                            f.write(pdf_content)
                        successful_pmids.append(aid)
                        break
                time.sleep(0.4)
            except Exception as e:
                logger.warning(f"Erreur Zotero pour {aid}: {e}")
                continue

        send_project_notification(
            project_id,
            'zotero_import_completed',
            f'Import Zotero terminé: {len(successful_pmids)}/{len(pmids)} PDF importés',
            {'successful_count': len(successful_pmids), 'total_count': len(pmids)}
        )
    except Exception as e:
        logger.error(f"Erreur critique import Zotero: {e}", exc_info=True)
        send_project_notification(project_id, 'zotero_import_failed', f'Échec import Zotero: {e}')


def fetch_online_pdf_task(project_id, article_ids):
    """Cherche et télécharge des PDF OA via Unpaywall à partir des DOI en base."""
    logger.info(f"🌐 Recherche OA via Unpaywall pour {len(article_ids)} IDs...")
    session = Session()
    successful = []
    try:
        rows = session.execute(text(f"""
            SELECT article_id, doi FROM search_results
            WHERE project_id = :pid AND article_id = ANY(:ids)
        """), {"pid": project_id, "ids": article_ids}).mappings().all()
        session.close()

        pdir = PROJECTS_DIR / project_id
        pdir.mkdir(exist_ok=True)

        for r in rows:
            aid = r['article_id']
            doi = r['doi']
            if not doi:
                continue
            try:
                pdf_url = fetch_unpaywall_pdf_url(doi)
                if not pdf_url:
                    continue
                resp = http_get_with_retries(pdf_url, timeout=30)
                if getattr(resp, "status_code", 0) == 200 and \
                   resp.headers.get("Content-Type", "").lower().startswith("application/pdf"):
                    out = pdir / (sanitize_filename(aid) + ".pdf")
                    with open(out, "wb") as f:
                        f.write(resp.content)
                    successful.append(aid)
                time.sleep(0.3)
            except Exception as e:
                logger.warning(f"Erreur OA pour {aid}: {e}")
                continue

        send_project_notification(
            project_id,
            'fetch_online_completed',
            f'Recherche OA terminée: {len(successful)}/{len(article_ids)} PDF trouvés',
            {'successful_count': len(successful), 'total_count': len(article_ids)}
        )
    except Exception as e:
        logger.error(f"Erreur critique fetch_online_pdf_task: {e}", exc_info=True)
        send_project_notification(project_id, 'fetch_online_failed', f'Erreur: {e}')


def index_project_pdfs_task(project_id: str):
    """Indexe tous les PDF du projet avec ChromaDB et embeddings (RAG)."""
    logger.info(f"📚 Indexation PDF pour projet {project_id}")
    try:
        pdir = PROJECTS_DIR / project_id
        chroma_client = chromadb.PersistentClient(path=str(pdir / "chroma_db"))
        collection_name = f"project_{project_id}"

        # Reset collection si existe
        try:
            chroma_client.delete_collection(collection_name)
        except Exception:
            pass
        collection = chroma_client.create_collection(collection_name)

        pdf_files = list(pdir.glob("*.pdf"))
        if not pdf_files:
            send_project_notification(project_id, 'indexing_failed', 'Aucun PDF trouvé.')
            return

        # Splitter local (simple)
        from langchain.text_splitter import RecursiveCharacterTextSplitter
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP,
            length_function=len,
        )

        all_documents, all_metadatas, all_ids = [], [], []
        successful_files = 0
        total_filtered = 0

        for pf in pdf_files:
            article_id = pf.stem
            try:
                txt = extract_text_from_pdf(pf)
                if not txt or len(txt.strip()) < 50:
                    continue
                chunks = splitter.split_text(txt)
                keep, seen = [], set()
                for i, ch in enumerate(chunks):
                    c = (ch or "").strip()
                    if len(c) < MIN_CHUNK_LEN:
                        continue
                    h = hash(c)
                    if h in seen:
                        continue
                    seen.add(h)
                    keep.append(c)
                    all_metadatas.append({"article_id": article_id, "chunk_id": len(keep)-1, "source": pf.name})
                    all_ids.append(f"{article_id}_chunk_{len(keep)-1}")
                all_documents.extend(keep)
                total_filtered += len(chunks) - len(keep)
                successful_files += 1
            except Exception as e:
                logger.warning(f"Erreur traitement PDF {pf}: {e}")

        if not all_documents:
            send_project_notification(project_id, 'indexing_failed', 'Aucun contenu textuel indexable.')
            return

        # Embeddings
        if embedding_model is None:
            send_project_notification(project_id, 'indexing_failed', "Modèle d'embedding non disponible.")
            return

        vectors = embedding_model.encode(all_documents, batch_size=EMBED_BATCH, show_progress_bar=False).tolist()
        collection.add(documents=all_documents, metadatas=all_metadatas, ids=all_ids, embeddings=vectors)

        # Marquer indexation
        session = Session()
        try:
            session.execute(text("UPDATE projects SET indexed_at = :ts WHERE id = :pid"),
                            {"ts": datetime.now().isoformat(), "pid": project_id})
            session.commit()
        finally:
            session.close()

        send_project_notification(project_id, 'indexing_completed',
                                  f'Indexation terminée: {len(all_documents)} chunks, {successful_files}/{len(pdf_files)} PDF')
    except Exception as e:
        logger.error(f"Erreur index_project_pdfs_task: {e}", exc_info=True)
        send_project_notification(project_id, 'indexing_failed', f'Erreur: {e}')


def answer_chat_question_task(project_id: str, question: str, profile: dict):
    """RAG: répond à une question basée sur les PDFs indexés via embeddings."""
    logger.info(f"💬 Question RAG pour projet {project_id}")
    try:
        pdir = PROJECTS_DIR / project_id
        chroma_path = pdir / "chroma_db"
        if not chroma_path.exists():
            return {"answer": "❌ Corpus non indexé. Lancez l'indexation.", "sources": []}

        chroma_client = chromadb.PersistentClient(path=str(chroma_path))
        collection_name = f"project_{project_id}"
        try:
            collection = chroma_client.get_collection(collection_name)
        except Exception:
            return {"answer": "❌ Collection introuvable. Ré-indexation requise.", "sources": []}

        if embedding_model is None:
            return {"answer": "❌ Modèle d'embedding indisponible sur le worker.", "sources": []}

        if USE_QUERY_EMBED:
            qv = embedding_model.encode([question], convert_to_numpy=True).tolist()
            results = collection.query(query_embeddings=qv, n_results=5)
        else:
            results = collection.query(query_texts=[question], n_results=5)

        if not results.get('documents') or not results['documents']:
            return {"answer": "❌ Aucun document pertinent trouvé.", "sources": []}

        chunks = results['documents']
        metas = results['metadatas']
        context = "\n\n".join([f"Source: {m['source']} (Article: {m['article_id']})\n{c}" for c, m in zip(chunks, metas)])

        rag_prompt = (
            "Tu es un assistant de recherche. Réponds à la question suivante UNIQUEMENT avec le contexte fourni.\n"
            f"Question: {question}\n\nContexte:\n{context}\n\n"
            "- Réponds précisément et cite les ID d'articles.\n- Dis si l'info manque.\nRéponse:"
        )
        answer = call_ollama_api(rag_prompt, profile.get('synthesis_model', 'llama3.1:8b'))
        sources = list({f"Article: {m['article_id']}" for m in metas})

        # Sauvegarder l'historique du chat
        session = Session()
        try:
            ts = datetime.now().isoformat()
            session.execute(text("""
                INSERT INTO chat_messages (id, project_id, role, content, timestamp)
                VALUES (:id, :pid, 'user', :c, :ts)
            """), {"id": str(uuid.uuid4()), "pid": project_id, "c": question, "ts": ts})
            session.execute(text("""
                INSERT INTO chat_messages (id, project_id, role, content, sources, timestamp)
                VALUES (:id, :pid, 'assistant', :c, :s, :ts)
            """), {"id": str(uuid.uuid4()), "pid": project_id, "c": answer, "s": json.dumps(sources), "ts": ts})
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"Erreur sauvegarde chat: {e}", exc_info=True)
        finally:
            session.close()

        return {"answer": answer, "sources": sources}
    except Exception as e:
        logger.error(f"Erreur answer_chat_question_task: {e}", exc_info=True)
        return {"answer": f"❌ Erreur: {e}", "sources": []}


def import_from_zotero_file_task(project_id, zotero_json_data):
    """Importe des articles + PDF depuis un export CSL JSON Zotero (user/group auto)."""
    if not zotero_json_data:
        send_project_notification(project_id, 'zotero_import_failed', 'Fichier Zotero vide.')
        return

    # Déduction bibliothèque
    try:
        first_uri = zotero_json_data.get('id', '')
        parts = first_uri.split('/')
        library_type_raw = parts[3]  # 'users' ou 'groups'
        library_id = parts[4]
        library_type = 'user' if library_type_raw == 'users' else 'group'

        from pyzotero import zotero
        zot = zotero.Zotero(library_id, library_type, os.getenv('ZOTERO_API_KEY'))
        zot.key_info()
    except Exception as e:
        send_project_notification(project_id, 'zotero_import_failed', 'Échec connexion Zotero.')
        return

    # Insertion d'articles dans search_results
    session = Session()
    try:
        for item in zotero_json_data:
            aid = item.get('DOI', item.get('PMID', item.get('id', str(uuid.uuid4()))))
            title = item.get('title', 'Titre inconnu')
            abstract = item.get('abstract', '')
            exists = session.execute(text("""
                SELECT 1 FROM search_results WHERE project_id = :pid AND article_id = :aid
            """), {"pid": project_id, "aid": aid}).fetchone()
            if exists:
                continue
            session.execute(text("""
                INSERT INTO search_results (id, project_id, article_id, title, abstract, database_source, created_at)
                VALUES (:id, :pid, :aid, :title, :abs, 'zotero_file', :ts)
            """), {
                "id": str(uuid.uuid4()), "pid": project_id, "aid": aid,
                "title": title, "abs": abstract, "ts": datetime.now().isoformat()
            })
        session.commit()
    except Exception as e:
        session.rollback()
        logger.error(f"Erreur insertion Zotero JSON: {e}", exc_info=True)
    finally:
        session.close()

    # Téléchargement des PDF attachés
    pdir = PROJECTS_DIR / project_id
    pdir.mkdir(exist_ok=True)
    successful = 0
    for item in zotero_json_data:
        key_uri = item.get('id')
        key = key_uri.split('/')[-1] if key_uri else None
        aid = item.get('DOI', item.get('PMID', key))
        if not key:
            continue
        try:
            attachments = zot.children(key)
            for att in attachments:
                if att.get('data', {}).get('contentType') == 'application/pdf':
                    content = zot.file(att['key'])
                    out = pdir / (sanitize_filename(aid) + ".pdf")
                    with open(out, 'wb') as f:
                        f.write(content)
                    successful += 1
                    break
            time.sleep(0.4)
        except Exception as e:
            logger.warning(f"Erreur import PDF Zotero key {key}: {e}")

    send_project_notification(
        project_id,
        'zotero_import_completed',
        f'Import Fichier Zotero terminé: {successful}/{len(zotero_json_data)} PDF importés'
    )


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
