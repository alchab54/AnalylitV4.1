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
    update_project_status(project_id, 'synthesizing')
    session = Session()
    try:
        # Récupérer la description du projet
        project = session.execute(text(
            "SELECT description FROM projects WHERE id = :pid"
        ), {"pid": project_id}).mappings().fetchone()
        
        project_description = project['description'] if project else "Non spécifié"
        
        # Récupérer les articles pertinents
        rows = session.execute(text("""
            SELECT s.title, s.abstract FROM extractions e 
            JOIN search_results s ON e.project_id = s.project_id AND e.pmid = s.article_id
            WHERE e.project_id = :pid AND e.relevance_score >= 7
            ORDER BY e.relevance_score DESC LIMIT 30
        """), {"pid": project_id}).mappings().all()
        
        if not rows:
            update_project_status(project_id, 'failed')
            send_project_notification(project_id, 'synthesis_failed', 'Aucun article pertinent (score >= 7).')
            return
        
        # Préparer les données pour le prompt
        abstracts = [f"Titre: {r['title']}\\nRésumé: {r['abstract']}" for r in rows if r.get('abstract')]
        
        if not abstracts:
            update_project_status(project_id, 'failed')
            send_project_notification(project_id, 'synthesis_failed', 'Articles pertinents sans résumé.')
            return
        
        data_for_prompt = "\\n---\\n".join(abstracts)
        
        # Générer la synthèse via l'IA
        base_tpl = get_synthesis_prompt_template()
        tpl = get_effective_prompt_template('synthesis_prompt', base_tpl)
        prompt = tpl.format(
            project_description=project_description,
            data_for_prompt=data_for_prompt
        )
        
        output = call_ollama_api(prompt, profile.get('synthesis_model', 'llama3.1:8b'), output_format="json")
        
        if output and isinstance(output, dict):
            update_project_status(project_id, 'completed', result=output)
            send_project_notification(project_id, 'synthesis_completed', 'Synthèse générée.')
        else:
            update_project_status(project_id, 'failed')
            send_project_notification(project_id, 'synthesis_failed', 'Réponse IA invalide.')
            
    except Exception as e:
        logger.error(f"Erreur run_synthesis_task: {e}", exc_info=True)
        update_project_status(project_id, 'failed')
        send_project_notification(project_id, 'synthesis_failed', f'Erreur: {e}')
    finally:
        session.close()

def run_discussion_generation_task(project_id: str):
    """Génère une section Discussion basée sur la synthèse et la liste d'articles."""
    session = Session()
    try:
        # Récupérer la synthèse existante et le profil
        proj = session.execute(text(
            "SELECT synthesis_result, profile_used FROM projects WHERE id = :pid"
        ), {"pid": project_id}).mappings().fetchone()
        
        if not proj or not proj.get('synthesis_result'):
            return
        
        # Récupérer les articles extraits
        extr = session.execute(text(
            "SELECT pmid, title FROM extractions WHERE project_id = :pid"
        ), {"pid": project_id}).mappings().all()
        
        # Récupérer le modèle de synthèse
        profile_row = session.execute(text(
            "SELECT synthesis_model FROM analysis_profiles WHERE id = :id"
        ), {"id": proj.get('profile_used', 'standard')}).mappings().fetchone()
        
        model_name = profile_row.get('synthesis_model') if profile_row else 'llama3.1:8b'
        
        try:
            synthesis_data = json.loads(proj['synthesis_result'])
        except Exception:
            synthesis_data = {}
        
        article_list = "\\n".join([f"- {e['title']} (ID: {e['pmid']})" for e in extr])
        
        prompt = f"""En tant que chercheur, rédige une section Discussion académique en te basant sur le résumé de synthèse et la liste d'articles ci-dessous.

---
{json.dumps(synthesis_data, indent=2)}
---

Articles Inclus:
---
{article_list}
---

La discussion doit synthétiser les apports, analyser les perspectives, explorer les divergences et suggérer des pistes de recherche futures en citant les sources."""
        
        discussion_text = call_ollama_api(prompt, model_name)
        
        if discussion_text:
            update_project_status(project_id, status='completed', discussion=discussion_text)
            send_project_notification(project_id, 'analysis_completed', 'Discussion générée.')
            
    except Exception as e:
        logger.error(f"Erreur run_discussion_generation_task: {e}", exc_info=True)
    finally:
        session.close()

def run_knowledge_graph_task(project_id: str):
    """Génère un graphe de connaissances JSON à partir des titres d'articles extraits."""
    update_project_status(project_id, status='generating_graph')
    session = Session()
    try:
        # Récupérer le profil et modèle
        profile_key_row = session.execute(text(
            "SELECT profile_used FROM projects WHERE id = :pid"
        ), {"pid": project_id}).mappings().fetchone()
        
        profile_key = profile_key_row.get('profile_used') if profile_key_row else 'standard'
        
        profile_row = session.execute(text(
            "SELECT extract_model FROM analysis_profiles WHERE id = :id"
        ), {"id": profile_key}).mappings().fetchone()
        
        model_to_use = profile_row.get('extract_model') if profile_row else 'llama3.1:8b'
        
        # Récupérer les titres d'articles
        rows = session.execute(text(
            "SELECT title, pmid FROM extractions WHERE project_id = :pid"
        ), {"pid": project_id}).mappings().all()
        
        if not rows:
            update_project_status(project_id, status='completed')
            return
        
        titles = [f"{r['title']} (ID: {r['pmid']})" for r in rows[:100]]  # Limiter à 100
        
        prompt = f"""À partir de la liste de titres suivante, génère un graphe de connaissances. 
Identifie les 10 concepts les plus importants et leurs relations.
Ta réponse doit être UNIQUEMENT un objet JSON avec "nodes" [{{id, label}}] et "edges" [{{from, to, label}}].

Titres:
{json.dumps(titles, indent=2)}"""
        
        graph = call_ollama_api(prompt, model=model_to_use, output_format="json")
        
        if graph and isinstance(graph, dict) and 'nodes' in graph and 'edges' in graph:
            update_project_status(project_id, status='completed', graph=graph)
        else:
            update_project_status(project_id, status='completed')
            
    except Exception as e:
        logger.error(f"Erreur run_knowledge_graph_task: {e}", exc_info=True)
        update_project_status(project_id, status='completed')
    finally:
        session.close()

def run_prisma_flow_task(project_id: str):
    """Génère un diagramme PRISMA simplifié et stocke l'image sur disque."""
    update_project_status(project_id, status='generating_prisma')
    session = Session()
    try:
        # Compter les articles
        total_found = session.execute(text(
            "SELECT COUNT(*) FROM search_results WHERE project_id = :pid"
        ), {"pid": project_id}).scalar_one()
        
        n_included = session.execute(text(
            "SELECT COUNT(*) FROM extractions WHERE project_id = :pid"
        ), {"pid": project_id}).scalar_one()
        
        if total_found == 0:
            update_project_status(project_id, status='completed')
            return
        
        n_after_duplicates = total_found
        n_excluded_screening = n_after_duplicates - n_included
        
        # Créer le diagramme
        fig, ax = plt.subplots(figsize=(8, 10))
        box = dict(boxstyle="round,pad=0.5", facecolor='lightblue', alpha=0.7)
        
        ax.text(0.5, 0.9, f'Articles identifiés\\nn = {total_found}', ha='center', va='center', bbox=box)
        ax.text(0.5, 0.7, f'Après exclusion doublons\\nn = {n_after_duplicates}', ha='center', va='center', bbox=box)
        ax.text(0.5, 0.5, f'Articles évalués\\nn = {n_after_duplicates}', ha='center', va='center', bbox=box)
        ax.text(0.5, 0.3, f'Études incluses\\nn = {n_included}', ha='center', va='center', bbox=box)
        ax.text(1.0, 0.5, f'Exclus au criblage\\nn = {n_excluded_screening}', ha='left', va='center', bbox=box)
        
        ax.axis('off')
        
        # Sauvegarder
        p_dir = PROJECTS_DIR / project_id
        p_dir.mkdir(exist_ok=True)
        image_path = str(p_dir / 'prisma_flow.png')
        
        plt.savefig(image_path, bbox_inches='tight')
        plt.close(fig)
        
        update_project_status(project_id, status='completed', prisma_path=image_path)
        send_project_notification(project_id, 'analysis_completed', 'Diagramme PRISMA généré.')
        
    except Exception as e:
        logger.error(f"Erreur run_prisma_flow_task: {e}", exc_info=True)
        update_project_status(project_id, status='completed')
    finally:
        session.close()

def run_meta_analysis_task(project_id: str):
    """Méta-analyse simple des scores de pertinence (distribution + IC 95%)."""
    update_project_status(project_id, 'generating_analysis')
    session = Session()
    try:
        # Récupérer les scores de pertinence (optimisé avec .scalars.all())
        scores_list = session.execute(text("""
            SELECT relevance_score FROM extractions 
            WHERE project_id = :pid AND relevance_score IS NOT NULL AND relevance_score > 0
        """), {"pid": project_id}).scalars().all()
        
        if len(scores_list) < 2:
            update_project_status(project_id, 'failed')
            send_project_notification(project_id, 'analysis_failed', 
                                    'Pas assez de données pour la méta-analyse (au moins 2 scores requis).')
            return
        
        scores = np.array(scores_list, dtype=float)
        mean_score = np.mean(scores)
        stddev = np.std(scores, ddof=1)
        n = len(scores)
        stderr = stddev / np.sqrt(n)
        ci = stats.t.interval(0.95, df=n-1, loc=mean_score, scale=stderr)
        
        analysis_result = {
            "mean_score": float(mean_score),
            "stddev": float(stddev),
            "confidence_interval": [float(ci[0]), float(ci[1])],
            "n_articles": n
        }
        
        # Créer le graphique
        p_dir = PROJECTS_DIR / project_id
        p_dir.mkdir(exist_ok=True)
        plot_path = str(p_dir / 'meta_analysis_plot.png')
        
        fig, ax = plt.subplots(figsize=(10, 6))
        ax.hist(scores, bins=10, alpha=0.7, color='skyblue', edgecolor='black')
        ax.axvline(mean_score, color='red', linestyle='--', linewidth=2, 
                  label=f'Moyenne: {mean_score:.2f}')
        ax.set_xlabel('Score de Pertinence')
        ax.set_ylabel('Nombre d\'Articles')
        ax.set_title('Distribution des Scores de Pertinence')
        ax.legend()
        
        plt.savefig(plot_path, bbox_inches='tight')
        plt.close(fig)
        
        update_project_status(project_id, 'completed', 
                            analysis_result=analysis_result, 
                            analysis_plot_path=plot_path)
        send_project_notification(project_id, 'analysis_completed', 'Méta-analyse terminée.')
        
    except Exception as e:
        logger.error(f"Erreur run_meta_analysis_task: {e}", exc_info=True)
        update_project_status(project_id, 'failed')
        send_project_notification(project_id, 'analysis_failed', f'Erreur: {e}')
    finally:
        session.close()

def run_descriptive_stats_task(project_id: str):
    """Statistiques descriptives basées sur les données extraites si présentes."""
    update_project_status(project_id, 'generating_analysis')
    session = Session()
    try:
        # Récupérer les données extraites
        rows = session.execute(text("""
            SELECT extracted_data FROM extractions 
            WHERE project_id = :pid AND extracted_data IS NOT NULL
        """), {"pid": project_id}).mappings().all()
        
        if not rows:
            update_project_status(project_id, 'failed')
            send_project_notification(project_id, 'analysis_failed', 
                                    'Aucune donnée d\'extraction disponible pour les statistiques descriptives.')
            return
        
        # Parser les données JSON
        records = []
        for r in rows:
            try:
                data = json.loads(r['extracted_data'])
                if isinstance(data, dict):
                    records.append(data)
            except Exception:
                continue
        
        if not records:
            update_project_status(project_id, 'failed')
            send_project_notification(project_id, 'analysis_failed', 
                                    'Impossible de parser les données extraites pour les statistiques descriptives.')
            return
        
        # Créer un DataFrame pour l'analyse
        df = pd.json_normalize(records)
        
        p_dir = PROJECTS_DIR / project_id
        p_dir.mkdir(exist_ok=True)
        plot_paths = {}
        
        # Exemple: histogramme des types d'étude si présents
        if 'methodologie.type_etude' in df.columns:
            s = df['methodologie.type_etude'].value_counts()
            fig, ax = plt.subplots(figsize=(10, 6))
            s.plot(kind='bar', ax=ax)
            ax.set_title('Répartition des Types d\'Études')
            ax.set_ylabel('Nombre d\'Articles')
            plt.xticks(rotation=45, ha='right')
            
            plot_path = str(p_dir / 'study_types.png')
            plt.savefig(plot_path, bbox_inches='tight')
            plt.close(fig)
            plot_paths['study_types'] = plot_path
        
        # Statistiques résumées
        summary_stats = {
            "total_articles": int(len(df)),
            "available_fields": list(df.columns)
        }
        
        update_project_status(project_id, 'completed', 
                            analysis_result=summary_stats,
                            analysis_plot_path=json.dumps(plot_paths) if plot_paths else None)
        send_project_notification(project_id, 'analysis_completed', 'Statistiques descriptives générées.')
        
    except Exception as e:
        logger.error(f"Erreur run_descriptive_stats_task: {e}", exc_info=True)
        update_project_status(project_id, 'failed')
        send_project_notification(project_id, 'analysis_failed', f'Erreur: {e}')
    finally:
        session.close()

# ================================================================
# === CHAT RAG (Version finale avec profil)
# ================================================================

def answer_chat_question_task(project_id: str, question: str, profile: dict, topk: int = 5):
    """RAG simple basé sur abstracts (ou index plus tard), avec historique en DB."""
    logger.info(f"💬 Question RAG pour projet {project_id}: {question[:80]}...")
    try:
        # Récupération d’un contexte minimal depuis les abstracts
        session = Session()
        try:
            docs = session.execute(text("""
                SELECT title, abstract FROM search_results
                WHERE project_id = :pid
                ORDER BY created_at DESC
                LIMIT :k
            """), {"pid": project_id, "k": int(topk)}).mappings().all()
        finally:
            session.close()

        context = "\n\n---\n\n".join(
            [f"Titre: {d.get('title','')}\nRésumé: {d.get('abstract','')}" for d in docs if d.get('abstract')]
        )

        if not context.strip():
            answer = "Aucun document indexé ne contient d'information exploitable pour cette question."
            sources = []
        else:
            base_tpl = get_rag_chat_prompt_template()
            tpl = get_effective_prompt_template("rag_chat_prompt", base_tpl)
            rag_prompt = tpl.format(context=context, question=question)
            model_name = profile.get('synthesis_model', 'llama3.1:8b')
            answer_text = call_ollama_api(rag_prompt, model_name)
            answer = answer_text if isinstance(answer_text, str) else str(answer_text)
            sources = [d.get('title','') for d in docs[:3]]

        # Sauvegarder l’historique
        session = Session()
        try:
            ts = datetime.now().isoformat()
            session.execute(text("""
                INSERT INTO chat_messages (id, project_id, role, content, timestamp)
                VALUES (:id, :pid, :role, :content, :ts)
            """), {"id": str(uuid.uuid4()), "pid": project_id, "role": "user", "content": question, "ts": ts})
            session.execute(text("""
                INSERT INTO chat_messages (id, project_id, role, content, sources, timestamp)
                VALUES (:id, :pid, :role, :content, :sources, :ts)
            """), {"id": str(uuid.uuid4()), "pid": project_id, "role": "assistant",
                   "content": answer, "sources": json.dumps(sources), "ts": ts})
            session.commit()
        finally:
            session.close()

        send_project_notification(project_id, 'analysis_completed', 'Réponse de chat générée.')
        return {"answer": answer, "sources": sources}
    except Exception as e:
        logger.error(f"Erreur answer_chat_question_task: {e}", exc_info=True)
        send_project_notification(project_id, 'analysis_failed', f'Erreur RAG: {e}')
        return {"answer": f"Erreur: {e}", "sources": []}

# ================================================================
# === ZOTERO: IMPORT À PARTIR D'UN FICHIER CSL JSON (fusion des fonctions manquantes)
# ================================================================

def import_from_zotero_file_task(project_id: str, json_file_path: str):
    """Importe les articles depuis un fichier JSON Zotero exporté."""
    logger.info(f"📚 Import Zotero file pour projet {project_id}: {json_file_path}")
    session = Session()
    try:
        with open(json_file_path, 'r', encoding='utf-8') as f:
            zotero_data = json.load(f)
        
        if not isinstance(zotero_data, list):
            logger.error("Le fichier JSON doit contenir une liste d'articles")
            send_project_notification(project_id, 'import_failed', 'Format JSON invalide')
            return
        
        imported_count = 0
        for item in zotero_data:
            try:
                title = item.get('title', '')
                abstract = item.get('abstractNote', '')
                authors = ', '.join([f"{a.get('firstName', '')} {a.get('lastName', '')}" 
                                   for a in item.get('creators', [])])
                doi = item.get('DOI', '')
                url = item.get('url', '')
                
                article_id = doi or f"zotero_{item.get('key', str(uuid.uuid4()))}"
                
                # Vérifier si l'article n'existe pas déjà
                exists = session.execute(text("""
                    SELECT 1 FROM search_results WHERE project_id = :pid AND article_id = :aid
                """), {"pid": project_id, "aid": article_id}).fetchone()
                
                if not exists:
                    session.execute(text("""
                        INSERT INTO search_results (
                            id, project_id, article_id, title, abstract, authors, 
                            doi, url, database_source, created_at
                        ) VALUES (
                            :id, :pid, :aid, :title, :abstract, :authors,
                            :doi, :url, 'zotero', :ts
                        )
                    """), {
                        "id": str(uuid.uuid4()),
                        "pid": project_id,
                        "aid": article_id,
                        "title": title,
                        "abstract": abstract,
                        "authors": authors,
                        "doi": doi,
                        "url": url,
                        "ts": datetime.now().isoformat()
                    })
                    imported_count += 1
            except Exception as e:
                logger.warning(f"Erreur import article: {e}")
                continue
        
        session.commit()
        
        # Mettre à jour le compteur du projet
        session.execute(text("""
            UPDATE projects SET pmids_count = (
                SELECT COUNT(*) FROM search_results WHERE project_id = :pid
            ) WHERE id = :pid
        """), {"pid": project_id})
        session.commit()
        
        send_project_notification(project_id, 'import_completed', 
                                f'Import Zotero terminé: {imported_count} articles ajoutés')
        
        # Nettoyer le fichier temporaire
        try:
            os.remove(json_file_path)
        except Exception:
            pass
            
    except Exception as e:
        session.rollback()
        logger.error(f"Erreur import_from_zotero_file_task: {e}", exc_info=True)
        send_project_notification(project_id, 'import_failed', f'Erreur import Zotero: {e}')
    finally:
        session.close()

def import_pdfs_from_zotero_task(project_id: str, pmids: list, zotero_user_id: str, zotero_api_key: str):
    """Importe les PDFs depuis Zotero pour les articles spécifiés."""
    logger.info(f"📄 Import PDFs Zotero pour {len(pmids)} articles")
    try:
        from pyzotero import zotero
        zot = zotero.Zotero(zotero_user_id, 'user', zotero_api_key)
        
        project_dir = PROJECTS_DIR / project_id
        project_dir.mkdir(exist_ok=True)
        
        success_count = 0
        for pmid in pmids:
            try:
                # Recherche basique dans Zotero
                items = zot.items(q=pmid, limit=5)
                if items:
                    # Prendre le premier résultat
                    item = items[0]
                    attachments = zot.children(item['key'])
                    
                    for att in attachments:
                        if att.get('data', {}).get('contentType') == 'application/pdf':
                            # Télécharger le PDF
                            pdf_content = zot.file(att['key'])
                            if pdf_content:
                                filename = sanitize_filename(pmid) + '.pdf'
                                pdf_path = project_dir / filename
                                with open(pdf_path, 'wb') as f:
                                    f.write(pdf_content)
                                success_count += 1
                                break
                    if success_count > len([p for p in pmids if p == pmid]) - 1:
                        break
            except Exception as e:
                logger.warning(f"Erreur téléchargement PDF pour {pmid}: {e}")
                continue
        
        send_project_notification(project_id, 'pdf_import_completed', 
                                f'Import PDF Zotero: {success_count}/{len(pmids)} réussis')
                                
    except Exception as e:
        logger.error(f"Erreur import_pdfs_from_zotero_task: {e}", exc_info=True)
        send_project_notification(project_id, 'pdf_import_failed', f'Erreur import PDF: {e}')

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

def run_atn_score_task_improved(project_id: str):
    """Calcule des scores ATN simples à partir des extractions JSON (version améliorée)."""
    logger.info(f"📊 Calcul des scores ATN pour le projet {project_id}")
    update_project_status(project_id, 'generating_analysis')
    session = Session()
    try:
        extractions = session.execute(text("""
            SELECT pmid, title, extracted_data FROM extractions
            WHERE project_id = :pid AND extracted_data IS NOT NULL
        """), {"pid": project_id}).mappings().all()
        
        if not extractions:
            update_project_status(project_id, 'failed')
            send_project_notification(project_id, 'analysis_failed', 
                                    'Aucune donnée d\'extraction disponible pour le calcul du score ATN.')
            return
        
        scores = []
        for ext in extractions:
            try:
                data = json.loads(ext["extracted_data"])
                # Simulation du calcul ATN: nombre de champs non vides * 2
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
                
                scores.append({
                    'pmid': ext['pmid'],
                    'title': ext['title'],
                    'atn_score': min(s, 10)
                })
            except Exception:
                continue
        
        if not scores:
            update_project_status(project_id, 'failed')
            send_project_notification(project_id, 'analysis_failed', 
                                    'Aucun score ATN calculable à partir des données extraites.')
            return
        
        mean_atn = float(np.mean([s['atn_score'] for s in scores]))
        
        analysis_result = {
            "atn_scores": scores,
            "mean_atn": mean_atn,
            "total_articles_scored": len(scores)
        }
        
        # Créer le graphique si des scores existent
        p_dir = PROJECTS_DIR / project_id
        p_dir.mkdir(exist_ok=True)
        plot_path = str(p_dir / 'atn_scores.png')
        
        if scores:
            fig, ax = plt.subplots(figsize=(10, 6))
            atn_values = [s['atn_score'] for s in scores]
            ax.hist(atn_values, bins=11, range=(-0.5, 10.5), alpha=0.7, color='green', edgecolor='black')
            ax.set_xlabel('Score ATN')
            ax.set_ylabel('Nombre d\'Articles')
            ax.set_title('Distribution des Scores ATN')
            ax.set_xticks(range(0, 11))
            
            plt.savefig(plot_path, bbox_inches='tight')
            plt.close(fig)
        
        update_project_status(project_id, 'completed', 
                            analysis_result=analysis_result,
                            analysis_plot_path=plot_path if scores else None)
        send_project_notification(project_id, 'analysis_completed', 
                                f'Scores ATN calculés: {mean_atn:.2f} (moyenne)')
        
    except Exception as e:
        logger.error(f"Erreur run_atn_score_task: {e}", exc_info=True)
        update_project_status(project_id, 'failed')
        send_project_notification(project_id, 'analysis_failed', f'Erreur: {e}')
    finally:
        session.close()

# IMPORTANT: Remplacer run_atn_score_task existant par run_atn_score_task_improved
# et renommer la fonction
def run_atn_score_task(project_id: str):
    """Délègue vers la version améliorée."""
    return run_atn_score_task_improved(project_id)
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
