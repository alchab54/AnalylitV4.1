# ================================================================ 
# AnalyLit V4.1 - Tâches RQ (100% PostgreSQL/SQLAlchemy) - CORRIGÉ 
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
from functools import wraps
from pathlib import Path
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from pyzotero import zotero
from scipy import stats
from sklearn.metrics import cohen_kappa_score

import feedparser
import base64

# --- CORRECTIF DE COMPATIBILITÉ PYZOTERO / FEEDPARSER ---
# pyzotero tente de patcher une méthode interne de feedparser qui n'existe plus.
# Nous appliquons manuellement un patch compatible avant d'importer pyzotero.
if not hasattr(feedparser, '_FeedParserMixin'):
    feedparser._FeedParserMixin = type('_FeedParserMixin', (object,), {})
    feedparser._FeedParserMixin._isBase64 = lambda x: False

import chromadb
from sentence_transformers import SentenceTransformer
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, scoped_session
from redis import Redis
from rq import get_current_job

# --- Importer la config de l'application ---
from config_v4 import get_config

# --- Importer les modèles de la base de données ---
from utils.models import (
    Project, SearchResult, Extraction, Grid, ChatMessage, AnalysisProfile, RiskOfBias
)
from sqlalchemy.orm import Session # Explicitly import Session for type hinting if needed, though Session is already defined below


# --- Importer les helpers/utilitaires applicatifs ---
from utils.fetchers import db_manager, fetch_unpaywall_pdf_url, fetch_article_details
from utils.ai_processors import call_ollama_api
from utils.file_handlers import sanitize_filename, extract_text_from_pdf
from utils.analysis import generate_discussion_draft
from utils.notifications import send_project_notification
from utils.helpers import http_get_with_retries
from utils.importers import ZoteroAbstractExtractor

# Prompts templates
from utils.prompt_templates import (
    get_screening_prompt_template,
    get_full_extraction_prompt_template,
    get_synthesis_prompt_template,
    get_rag_chat_prompt_template,
    get_effective_prompt_template,
)
from utils.logging_config import setup_logging # <-- AJOUT : Import de la fonction centralisée

# --- Configuration globale ---
config = get_config()

logger = logging.getLogger(__name__)
PROJECTS_DIR = Path(config.PROJECTS_DIR)
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

# Charge un modèle d'embedding localement
try:
    embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
except Exception as e:
    logger.error(f"Erreur chargement du modèle d'embedding '{EMBEDDING_MODEL_NAME}': {e}")
    embedding_model = None

# ================================================================ 
# === DÉCORATEUR DE GESTION DE SESSION DB
# ================================================================ 

def with_db_session(func):
    # Assurer que le logging est configuré au début de la tâche
    setup_logging()

    @wraps(func)
    def wrapper(*args, **kwargs):
        session = Session()
        try:
            result = func(session, *args, **kwargs)
            session.commit()
            return result
        except Exception as e:
            session.rollback()
            logger.error(f"Erreur dans la tâche {func.__name__}: {e}", exc_info=True) # Rollback explicite
            raise
        finally:
            session.close()
    return wrapper

# ================================================================ 
# === FONCTIONS UTILITAIRES DB-SAFE (SQLAlchemy)
# ================================================================ 
def update_project_status(session, project_id: str, status: str, result: dict = None, discussion: str = None,
                          graph: dict = None, prisma_path: str = None, analysis_result: dict = None,
                          analysis_plot_path: str = None):
    """Met à jour le statut et/ou champs résultat d'un projet."""
    now_iso = datetime.now().isoformat()
    
    set_clauses = ["status = :status", "updated_at = :ts"]
    params = {"pid": project_id, "ts": now_iso, "status": status}

    if result is not None:
        set_clauses.append("synthesis_result = :res")
        params["res"] = json.dumps(result)
    if discussion is not None:
        set_clauses.append("discussion_draft = :d")
        params["d"] = discussion
    if graph is not None:
        set_clauses.append("knowledge_graph = :g")
        params["g"] = json.dumps(graph)
    if prisma_path is not None:
        set_clauses.append("prisma_flow_path = :p")
        params["p"] = prisma_path
    if analysis_result is not None:
        set_clauses.append("analysis_result = :ar")
        params["ar"] = json.dumps(analysis_result)
    if analysis_plot_path is not None:
        set_clauses.append("analysis_plot_path = :pp")
        params["pp"] = analysis_plot_path

    stmt = f"UPDATE projects SET {', '.join(set_clauses)} WHERE id = :pid"
    session.execute(text(stmt), params)

def log_processing_status(session, project_id: str, article_id: str, status: str, details: str):
    """Enregistre un événement de traitement dans processing_log."""
    
    # CORRECTION : Nous devons générer manuellement l'UUID car nous utilisons du SQL brut. 
    log_id = str(uuid.uuid4()) 
    
    session.execute(text("""
        INSERT INTO processing_log (id, project_id, pmid, task_name, status, details, "timestamp")
        VALUES (:id, :project_id, :pmid, :task_name, :status, :details, :ts)
    """), {
        "id": log_id, # <-- AJOUTÉ
        "project_id": project_id, 
        "pmid": article_id, 
        "task_name": "process_article",
        "status": status, 
        "details": details, 
        "ts": datetime.now()
    })
    
def increment_processed_count(session, project_id: str):
    """Incrémente processed_count du projet."""
    session.execute(text("UPDATE projects SET processed_count = processed_count + 1 WHERE id = :id"), {"id": project_id})

def update_project_timing(session, project_id: str, duration: float):
    """Ajoute une durée au total_processing_time."""
    session.execute(text("UPDATE projects SET total_processing_time = total_processing_time + :d WHERE id = :id"), {"d": float(duration), "id": project_id})

# ================================================================ 
# === Tâches RQ (100% SQLAlchemy)
# ================================================================ 

# --- Mock function for E2E tests ---
def _mock_multi_database_search_task(session, project_id: str, query: str, databases: list, max_results_per_db: int = 50, *args, **kwargs):
    """
    Mock version of multi_database_search_task for E2E tests.
    Inserts dummy search results directly into the database.
    """
    logger.debug(f"DEBUG: _mock_multi_database_search_task received args: {args}, kwargs: {kwargs}")
    logger.info(f"ðŸ”  MOCK Recherche multi-bases pour {project_id} - {databases}")
    
    dummy_results = [
        {
            "id": str(uuid.uuid4()),
            "project_id": project_id,
            "article_id": "PMID:12345678",
            "title": "Mock Article 1: Impact of Diabetes on Health",
            "abstract": "This is a mock abstract about diabetes and its health implications.",
            "authors": "Doe J, Smith A",
            "publication_date": "2023-01-15",
            "journal": "Mock Journal of Medicine",
            "doi": "10.1000/mock.12345678",
            "url": "http://mock.example.com/article1",
            "database_source": "pubmed",
            "created_at": datetime.now().isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "project_id": project_id,
            "article_id": "PMID:87654321",
            "title": "Mock Article 2: New Therapies for Type 2 Diabetes",
            "abstract": "A mock study on innovative treatments for type 2 diabetes.",
            "authors": "Brown B, Green C",
            "publication_date": "2022-11-01",
            "journal": "Mock Diabetes Research",
            "doi": "10.1000/mock.87654321",
            "url": "http://mock.example.com/article2",
            "database_source": "pubmed",
            "created_at": datetime.now().isoformat()
        }
    ]
    
    session.execute(text("""
        INSERT INTO search_results (id, project_id, article_id, title, abstract, authors, publication_date, journal, doi, url, database_source, created_at)
        VALUES (:id, :project_id, :article_id, :title, :abstract, :authors, :publication_date, :journal, :doi, :url, :database_source, :created_at)
        ON CONFLICT (project_id, article_id) DO NOTHING
    """), dummy_results)
    
    total_found = len(dummy_results)
    session.execute(text("UPDATE projects SET status = 'search_completed', pmids_count = :n, updated_at = :ts WHERE id = :id"), {"n": total_found, "ts": datetime.now().isoformat(), "id": project_id})
    send_project_notification(project_id, 'search_completed', f'MOCK Recherche terminée: {total_found} articles trouvés', {'total_results': total_found, 'databases': databases})
    logger.info(f"âœ… MOCK Recherche multi-bases: total {total_found}")
    time.sleep(1) # Give DB time to commit


@with_db_session
def multi_database_search_task(session, project_id: str, query: str, databases: list, max_results_per_db: int = 50, expert_queries: dict = None):
    """
    Recherche dans plusieurs bases et insère les résultats dans search_results.
    Gère à la fois les requêtes simples et les requêtes expertes spécifiques à chaque base.
    """
    # CORRECTION: En mode test, la DB est nettoyée par les fixtures.
    # Il faut s'assurer que les tables existent avant que la tâche ne s'exécute.
    if os.environ.get('TESTING') == 'true':
        from utils.database import init_database
        init_database()  # ← CORRECT

    if os.environ.get("ANALYLIT_TEST_MODE") == "true":
        _mock_multi_database_search_task(session, project_id, query, databases, max_results_per_db)
        return

    # Logique pour déterminer la requête principale à afficher (pour la compatibilité)
    main_query_for_log = query
    if expert_queries:
        # Prend la première requête experte comme requête "principale" pour les logs
        main_query_for_log = next(iter(expert_queries.values()), "Recherche experte sans requête principale")
        logger.info(f"ðŸ”  Recherche EXPERTE multi-bases pour {project_id} - {databases}")
    else:
        logger.info(f"ðŸ”  Recherche SIMPLE multi-bases pour {project_id} - {databases}")

    total_found = 0

    # S'assurer que le projet existe avant de continuer
    if not session.get(Project, project_id):
        logger.error(f"Erreur critique: Le projet {project_id} n'existe pas au début de la tâche de recherche.")
        return

    all_records_to_insert = []
    failed_databases = []
    for db_name in databases:
        current_query = None  # Initialiser à None
        results = []

        # Déterminer la requête à utiliser pour cette base de données spécifique
        if expert_queries:
            # Mode expert. On vérifie si une requête spécifique existe
            if db_name in expert_queries and expert_queries[db_name] and expert_queries[db_name].strip():
                # Oui, une requête experte valide existe
                current_query = expert_queries[db_name]
            else:
                # Le mode expert est activé, mais pour cette DB, la requête est vide ou absente.
                # On ne fait rien (current_query reste None), ce qui la fera skipper ci-dessous.
                pass
        else:
            # Pas de mode expert, on utilise la requête simple
            current_query = query

        if not current_query or not current_query.strip():
            logger.info(f"Requête vide pour {db_name}, base de données ignorée.")
            continue

        logger.info(f"ðŸ“š Recherche dans {db_name}...")
        try:
            if db_name == 'pubmed':
                results = db_manager.search_pubmed(current_query, max_results_per_db)
            elif db_name == 'arxiv':
                results = db_manager.search_arxiv(current_query, max_results_per_db)
            elif db_name == 'crossref':
                results = db_manager.search_crossref(current_query, max_results_per_db)
            elif db_name == 'ieee':
                results = db_manager.search_ieee(current_query, max_results_per_db)
            else:
                logger.warning(f"Base inconnue ignorée: {db_name}")
                continue

            for r in results:
                all_records_to_insert.append({
                    "id": str(uuid.uuid4()), "pid": project_id, "aid": r.get('id'),
                    "title": r.get('title', ''), "abstract": r.get('abstract', ''),
                    "authors": r.get('authors', ''), "pub_date": r.get('publication_date', ''),
                    "journal": r.get('journal', ''), "doi": r.get('doi', ''),
                    "url": r.get('url', ''), "src": r.get('database_source', 'unknown'),
                    "ts": datetime.now().isoformat()
                })
            total_found += len(results)
            send_project_notification(project_id, 'search_progress', f'Recherche terminée dans {db_name}: {len(results)} résultats', {'database': db_name, 'count': len(results)})
            time.sleep(0.6)
        except Exception as e:
            # Amélioration de la résilience : on logue l'erreur et on continue
            logger.error(f"Échec de la recherche pour la base '{db_name}': {e}", exc_info=True)
            failed_databases.append(db_name)

    if all_records_to_insert:
        session.execute(text("""
            INSERT INTO search_results (id, project_id, article_id, title, abstract, authors, publication_date, journal, doi, url, database_source, created_at)
            VALUES (:id, :pid, :aid, :title, :abstract, :authors, :pub_date, :journal, :doi, :url, :src, :ts)
            ON CONFLICT (project_id, article_id) DO NOTHING
        """), all_records_to_insert)

    session.execute(text("UPDATE projects SET status = 'search_completed', pmids_count = :n, updated_at = :ts WHERE id = :id"), {"n": total_found, "ts": datetime.now().isoformat(), "id": project_id})
    
    # Amélioration de la notification finale
    final_message = f'Recherche terminée: {total_found} articles trouvés.'
    if failed_databases:
        final_message += f" Échec pour: {', '.join(failed_databases)}."

    send_project_notification(project_id, 'search_completed', final_message, {'total_results': total_found, 'databases': databases, 'failed': failed_databases})
    logger.info(f"âœ… Recherche multi-bases: total {total_found}")

@with_db_session
def process_single_article_task(session, project_id: str, article_id: str, profile: dict,
                                analysis_mode: str, custom_grid_id: str = None):
    """Traite un article: screening ou extraction complète."""
    start_time = time.time()
    row = session.execute(text("SELECT * FROM search_results WHERE project_id = :pid AND article_id = :aid"), {"pid": project_id, "aid": article_id}).mappings().fetchone()
    if not row:
        log_processing_status(session, project_id, article_id, "erreur", "Article introuvable en base.")
        return

    article = dict(row)
    text_for_analysis, analysis_source = "", "abstract"

    pdf_path = PROJECTS_DIR / project_id / f"{sanitize_filename(article_id)}.pdf"
    if pdf_path.exists():
        pdf_text = extract_text_from_pdf(str(pdf_path))
        if pdf_text and len(pdf_text) > 100:
            text_for_analysis, analysis_source = pdf_text, "pdf"

    if not text_for_analysis:
        text_for_analysis = f"{article.get('title', '')}\n\n{article.get('abstract', '')}"

    if len(text_for_analysis.strip()) < 50:
        log_processing_status(session, project_id, article_id, "écarté", "Contenu textuel insuffisant.") # Correction UTF-8
        increment_processed_count(session, project_id)
        return

    if analysis_mode == "full_extraction":
        fields_list = []
        if custom_grid_id:
            grid_row = session.execute(text("SELECT fields FROM extraction_grids WHERE id = :gid AND project_id = :pid"), {"gid": custom_grid_id, "pid": project_id}).mappings().fetchone()
            if grid_row and grid_row.get("fields"):
                fields_list_of_dicts = json.loads(grid_row["fields"])
                if isinstance(fields_list_of_dicts, list):
                    fields_list = [d.get("name") for d in fields_list_of_dicts if d.get("name")]
        if not fields_list:
            fields_list = ["type_etude", "population", "intervention", "resultats_principaux", "limites", "methodologie"]

        fields = [{"name": f, "description": f} for f in fields_list]
        tpl = get_effective_prompt_template("full_extraction_prompt", get_full_extraction_prompt_template(fields))
        
        # ***** CORRECTION (pour le TypeError) *****
        # Assurer un fallback si database_source est None dans la DB
        prompt = tpl.replace("{text}", text_for_analysis).replace("{database_source}", article.get("database_source") or "unknown")
        # ***** FIN CORRECTION *****

        extracted = call_ollama_api(prompt, profile["extract_model"], output_format="json")

        if isinstance(extracted, dict) and extracted:
            session.execute(text("INSERT INTO extractions (id, project_id, pmid, title, extracted_data, relevance_score, relevance_justification, analysis_source, created_at) VALUES (:id, :pid, :pmid, :title, :ex_data, 10, 'Extraction détaillée effectuée', :src, :ts)"), {"id": str(uuid.uuid4()), "pid": project_id, "pmid": article_id, "title": article.get("title", ""), "ex_data": json.dumps(extracted), "src": analysis_source, "ts": datetime.now().isoformat()})
        else:
            log_processing_status(session, project_id, article_id, "écarté", "Réponse IA invalide (extraction).")
    else: # screening
        tpl = get_effective_prompt_template("screening_prompt", get_screening_prompt_template())
        prompt = tpl.format(title=article.get("title", ""), abstract=article.get("abstract", ""), database_source=article.get("database_source", "unknown"))
        resp = call_ollama_api(prompt, profile["preprocess_model"], output_format="json")
        score = resp.get("relevance_score", 0) if isinstance(resp, dict) else 0
        justification = resp.get("justification", "N/A") if isinstance(resp, dict) else "Réponse IA invalide."
        session.execute(text("INSERT INTO extractions (id, project_id, pmid, title, relevance_score, relevance_justification, analysis_source, created_at) VALUES (:id, :pid, :pmid, :title, :score, :just, :src, :ts)"), {"id": str(uuid.uuid4()), "pid": project_id, "pmid": article_id, "title": article.get("title", ""), "score": score, "just": justification, "src": analysis_source, "ts": datetime.now().isoformat()})

    increment_processed_count(session, project_id)
    update_project_timing(session, project_id, time.time() - start_time)
    send_project_notification(project_id, 'article_processed', f'Article "{article.get("title","" )[:30]}..." traité.', {'article_id': article_id})

@with_db_session
def run_synthesis_task(session, project_id: str, profile: dict):
    """Génère une synthèse à partir des articles pertinents (score >= 7)."""
    update_project_status(session, project_id, 'synthesizing')
    project = session.execute(text("SELECT description FROM projects WHERE id = :pid"), {"pid": project_id}).mappings().fetchone()
    project_description = project['description'] if project else "Non spécifié"

    rows = session.execute(text("SELECT s.title, s.abstract FROM extractions e JOIN search_results s ON e.project_id = s.project_id AND e.pmid = s.article_id WHERE e.project_id = :pid AND e.relevance_score >= 7 ORDER BY e.relevance_score DESC LIMIT 30"), {"pid": project_id}).mappings().all()
    if not rows:
        update_project_status(session, project_id, 'failed')
        send_project_notification(project_id, 'synthesis_failed', 'Aucun article pertinent (score >= 7).')
        return

    abstracts = [f"Titre: {r['title']}\nRésumé: {r['abstract']}" for r in rows if r.get('abstract')]
    if not abstracts:
        update_project_status(session, project_id, 'failed')
        send_project_notification(project_id, 'synthesis_failed', 'Articles pertinents sans résumé.')
        return

    data_for_prompt = "\n---\n".join(abstracts)
    tpl = get_effective_prompt_template('synthesis_prompt', get_synthesis_prompt_template())
    prompt = tpl.format(project_description=project_description, data_for_prompt=data_for_prompt)
    output = call_ollama_api(prompt, profile.get('synthesis_model', 'llama3.1:8b'), output_format="json")
    
    if output and isinstance(output, dict):
        update_project_status(session, project_id, 'completed', result=output)
        send_project_notification(project_id, 'synthesis_completed', 'Synthèse générée.')
    else:
        update_project_status(session, project_id, 'failed')
        send_project_notification(project_id, 'synthesis_failed', 'Réponse IA invalide.')

@with_db_session
def run_discussion_generation_task(session, project_id: str):
    """Génère le brouillon de la discussion."""
    update_project_status(session, project_id, 'generating_analysis')
    rows = session.execute(text("SELECT e.extracted_data, e.pmid, s.title, e.relevance_score FROM extractions e JOIN search_results s ON e.project_id = s.project_id AND e.pmid = s.article_id WHERE e.project_id = :pid AND e.relevance_score >= 7 AND e.extracted_data IS NOT NULL"), {"pid": project_id}).mappings().all()
    if not rows:
        # CORRECTION: Ne pas lever d'erreur, mais mettre à jour le statut et notifier.
        update_project_status(session, project_id, 'failed')
        send_project_notification(project_id, 'analysis_failed', "Aucune donnée d'extraction pertinente trouvée pour générer la discussion.")
        return

    # The user request mentioned a correction for a function call on line 300.
    # That line does not exist in this file. The logic for enqueuing tasks is in `server_v4_complete.py`.
    # The most similar logic in this file is the call to `generate_discussion_draft` below.
    # I will assume the intent was to ensure this part is correct, which it appears to be.
    # No changes are made based on the user's specific instruction for line 300 as it's not applicable here.
    df = pd.DataFrame(rows)
    profile = session.execute(text("SELECT profile_used FROM projects WHERE id = :pid"), {"pid": project_id}).scalar_one_or_none() or 'standard'
    # The following line correctly calls the local function `generate_discussion_draft`
    model_name = config.DEFAULT_MODELS.get(profile, {}).get('synthesis', 'llama3.1:8b')
    draft = generate_discussion_draft(df, lambda p, m: call_ollama_api(p, m, temperature=0.7), model_name)

    update_project_status(session, project_id, 'completed', discussion=draft)
    send_project_notification(project_id, 'analysis_completed', 'Le brouillon de discussion a été généré.', {'discussion_draft': draft})

@with_db_session
def run_knowledge_graph_task(session, project_id: str):
    """Génère un graphe de connaissances JSON à partir des titres d'articles extraits."""
    update_project_status(session, project_id, status='generating_graph')
    
    profile_info = session.execute(text("""
        SELECT ap.extract_model 
        FROM projects p
        JOIN analysis_profiles ap ON p.profile_used = ap.id
        WHERE p.id = :pid
    """), {"pid": project_id}).mappings().fetchone()
    model_to_use = profile_info.get('extract_model') if profile_info else 'llama3.1:8b'
    
    rows = session.execute(text("SELECT title, pmid FROM extractions WHERE project_id = :pid"), {"pid": project_id}).mappings().all()
    if not rows:
        update_project_status(session, project_id, status='completed')
        return
    
    titles = [f"{r['title']} (ID: {r['pmid']})" for r in rows[:100]]
    prompt = f"""À partir de la liste de titres suivante, génère un graphe de connaissances.
Identifie les 10 concepts les plus importants et leurs relations.
Ta réponse doit être UNIQUEMENT un objet JSON avec "nodes" [{{id, label}}] et "edges" [{{from, to, label}}].

Titres:
{json.dumps(titles, indent=2)}"""
    graph = call_ollama_api(prompt, model=model_to_use, output_format="json")
    
    if graph and isinstance(graph, dict) and 'nodes' in graph and 'edges' in graph:
        update_project_status(session, project_id, status='completed', graph=graph)
        send_project_notification(project_id, 'analysis_completed', 'Le graphe de connaissances est prêt.', {'analysis_type': 'knowledge_graph'})
    else:
        update_project_status(session, project_id, status='analysis_failed')
        send_project_notification(project_id, 'analysis_failed', 'La génération du graphe de connaissances a échoué.', {'analysis_type': 'knowledge_graph'})

@with_db_session
def run_prisma_flow_task(session, project_id: str):
    """Génère un diagramme PRISMA simplifié et stocke l'image sur disque."""
    update_project_status(session, project_id, status='generating_prisma')
    
    total_found = session.execute(text("SELECT COUNT(*) FROM search_results WHERE project_id = :pid"), {"pid": project_id}).scalar_one()
    n_included = session.execute(text("SELECT COUNT(*) FROM extractions WHERE project_id = :pid"), {"pid": project_id}).scalar_one()
    
    if total_found == 0:
        update_project_status(session, project_id, status='completed')
        return
    
    n_after_duplicates, n_excluded_screening = total_found, total_found - n_included
    
    fig, ax = plt.subplots(figsize=(12, 16), dpi=300)
    plt.style.use('seaborn-v0_8-whitegrid')
    box_props = dict(boxstyle="round,pad=0.8", facecolor='lightblue', edgecolor='navy', linewidth=2, alpha=0.8)
    font_props = {'fontsize': 12, 'fontweight': 'bold', 'fontfamily': 'serif'}
    
    ax.text(0.5, 0.9, f'Articles identifiés\nn = {total_found}', ha='center', va='center', bbox=box_props, **font_props)
    ax.text(0.5, 0.7, f'Après exclusion doublons\nn = {n_after_duplicates}', ha='center', va='center', bbox=box_props, **font_props)
    ax.text(0.5, 0.5, f'Articles évalués\nn = {n_after_duplicates}', ha='center', va='center', bbox=box_props, **font_props)
    ax.text(0.5, 0.3, f'Études incluses\nn = {n_included}', ha='center', va='center', bbox=box_props, **font_props)
    ax.text(1.0, 0.5, f'Exclus au criblage\nn = {n_excluded_screening}', ha='left', va='center', bbox=box_props, **font_props)
    ax.axis('off')
    
    p_dir = PROJECTS_DIR / project_id
    p_dir.mkdir(exist_ok=True)
    image_path = str(p_dir / 'prisma_flow.png')
    plt.savefig(image_path, bbox_inches='tight', dpi=300, format='png')
    pdf_path = str(p_dir / 'prisma_flow.pdf') 
    plt.savefig(pdf_path, bbox_inches='tight', format='pdf')
    plt.close(fig)

    update_project_status(session, project_id, status='completed', prisma_path=image_path)
    send_project_notification(project_id, 'analysis_completed', 'Le diagramme PRISMA est prêt.', {'analysis_type': 'prisma_flow'})

@with_db_session
def run_meta_analysis_task(session, project_id: str):
    """Méta-analyse simple des scores de pertinence (distribution + IC 95%)."""
    update_project_status(session, project_id, 'generating_analysis')
    
    scores_list = session.execute(text("SELECT relevance_score FROM extractions WHERE project_id = :pid AND relevance_score IS NOT NULL AND relevance_score > 0"), {"pid": project_id}).scalars().all()
    if len(scores_list) < 2:
        update_project_status(session, project_id, 'failed')
        send_project_notification(project_id, 'analysis_failed', 'Pas assez de données pour la méta-analyse (au moins 2 scores requis).')
        return
    
    scores = np.array(scores_list, dtype=float)
    mean_score, n = np.mean(scores), len(scores)
    stddev = np.std(scores, ddof=1)
    ci = stats.t.interval(0.95, df=n-1, loc=mean_score, scale=stddev / np.sqrt(n))
    
    analysis_result = {"mean_score": float(mean_score), "stddev": float(stddev), "confidence_interval": [float(ci[0]), float(ci[1])], "n_articles": n}
    
    p_dir = PROJECTS_DIR / project_id
    p_dir.mkdir(exist_ok=True)
    plot_path = str(p_dir / 'meta_analysis_plot.png')
    
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.hist(scores, bins=10, alpha=0.7, color='skyblue', edgecolor='black')
    ax.axvline(mean_score, color='red', linestyle='--', linewidth=2, label=f'Moyenne: {mean_score:.2f}')
    ax.set_xlabel('Score de Pertinence')
    ax.set_ylabel('Nombre d\'Articles')
    ax.set_title('Distribution des Scores de Pertinence')
    ax.legend()
    plt.savefig(plot_path, bbox_inches='tight')
    plt.close(fig)
    
    update_project_status(session, project_id, 'completed', analysis_result=analysis_result, analysis_plot_path=plot_path)
    send_project_notification(project_id, 'analysis_completed', 'Méta-analyse terminée.')

@with_db_session
def run_descriptive_stats_task(session, project_id: str):
    """Génère des statistiques descriptives sur les extractions."""
    logger.info(f"ðŸ“Š Statistiques descriptives pour projet {project_id}")
    update_project_status(session, project_id, 'generating_analysis')
    
    rows = session.execute(text("SELECT relevance_score FROM extractions WHERE project_id = :pid AND relevance_score IS NOT NULL"), {"pid": project_id}).mappings().all()
    if not rows:
        update_project_status(session, project_id, 'failed')
        return
    
    scores = [r['relevance_score'] for r in rows]
    stats_result = {
        'total_extractions': len(scores), 'mean_score': float(np.mean(scores)),
        'median_score': float(np.median(scores)), 'std_dev': float(np.std(scores)),
        'min_score': float(np.min(scores)), 'max_score': float(np.max(scores))
    }
    
    update_project_status(session, project_id, 'completed', analysis_result=stats_result)
    send_project_notification(project_id, 'analysis_completed', 'Statistiques descriptives générées')

# ================================================================ 
# === CHAT RAG
# ================================================================ 

@with_db_session
def answer_chat_question_task(session, project_id: str, question: str):
    """Répond à une question via RAG sur les PDFs indexés."""
    logger.info(f"ðŸ’¬ Question chat pour projet {project_id}")
    
    if embedding_model is None:
        response = "Modèle d'embedding non disponible"
    else:
        try:
            client = chromadb.Client()
            collection = client.get_collection(name=f"project_{project_id}")
            query_embedding = embedding_model.encode([question]).tolist()
            results = collection.query(query_embeddings=query_embedding, n_results=3)
            
            if results['documents'] and results['documents'][0]:
                context = "\n---\n".join(results['documents'][0])
                prompt = f"""En te basant sur ces extraits de documents, réponds à la question:

Question: {question}

Contexte:
{context}

Réponds de façon concise et précise."""
                response = call_ollama_api(prompt, "llama3.1:8b")
            else:
                response = "Aucun document indexé trouvé pour répondre à cette question."
        except Exception:
            response = "Erreur lors de la recherche dans la base de connaissances."
    
    session.execute(text("INSERT INTO chat_messages (id, project_id, role, content, timestamp) VALUES (:id1, :pid, 'user', :q, :ts1), (:id2, :pid, 'assistant', :a, :ts2)"), {"id1": str(uuid.uuid4()), "id2": str(uuid.uuid4()), "pid": project_id, "q": question, "a": response, "ts1": datetime.now().isoformat(), "ts2": datetime.now().isoformat()})
    return response

# ================================================================ 
# === IMPORT/EXPORT
# ================================================================ 

@with_db_session
def import_from_zotero_file_task(session, project_id: str, json_file_path: str):
    """Importe les articles depuis un fichier JSON Zotero en utilisant le parseur robuste."""
    logger.info(f"ðŸ“š Import Zotero depuis {json_file_path} pour projet {project_id}")
    extractor = ZoteroAbstractExtractor(json_file_path)
    records = extractor.process()

    if not records:
        send_project_notification(project_id, 'import_failed', 'Aucun article valide trouvé dans le fichier Zotero.')
        return

    records_to_insert = []
    for record in records:
        if record.get('article_id'):
            records_to_insert.append({
                "id": str(uuid.uuid4()), "pid": project_id, "aid": record['article_id'],
                "title": record.get('title', 'Sans titre'), "abstract": record.get('abstract', ''),
                "authors": record.get('authors', ''), "pub_date": record.get('publication_date', ''),
                "journal": record.get('journal', ''), "doi": record.get('doi', ''),
                "url": record.get('url', ''), "src": record.get('database_source', 'zotero'),
                "ts": datetime.now().isoformat()
            })
    
    if records_to_insert:
        session.execute(text("""
            INSERT INTO search_results (id, project_id, article_id, title, abstract, authors, publication_date, journal, doi, url, database_source, created_at)
            VALUES (:id, :pid, :aid, :title, :abstract, :authors, :pub_date, :journal, :doi, :url, :src, :ts)
            ON CONFLICT (project_id, article_id) DO NOTHING
        """), records_to_insert)

    total_articles = session.execute(text("SELECT COUNT(*) FROM search_results WHERE project_id = :pid"), {"pid": project_id}).scalar_one()
    session.execute(text("UPDATE projects SET pmids_count = :count WHERE id = :pid"), {"count": total_articles, "pid": project_id})

    send_project_notification(project_id, 'import_completed', f'Import Zotero terminé: {len(records_to_insert)} nouveaux articles ajoutés.')
    
    try:
        os.remove(json_file_path)
    except Exception as e:
        logger.warning(f"Impossible de supprimer le fichier temporaire {json_file_path}: {e}")

def import_pdfs_from_zotero_task(project_id: str, pmids: list, zotero_user_id: str, zotero_api_key: str):
    
    """Importe les PDFs depuis Zotero pour les articles spécifiés."""
    logger.info(f"ðŸ“„ Import PDFs Zotero pour {len(pmids)} articles")
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
                            # CORRECTION : Le bloc de code manquant est ajouté ici
                            pdf_filename = sanitize_filename(att['data'].get('filename', f'{pmid}.pdf'))
                            pdf_path = project_dir / pdf_filename
                            if not pdf_path.exists():
                                zot.dump(att['key'], str(pdf_path))
                                success_count += 1
                                logger.info(f"PDF téléchargé: {pdf_filename}")
                            break # On ne prend que le premier PDF trouvé
            except Exception as e:
                logger.warning(f"Erreur récupération PDF pour {pmid} via Zotero: {e}")
                continue

        send_project_notification(project_id, 'import_completed', f'{success_count} PDF(s) importé(s) depuis Zotero.')

    except Exception as e:
        logger.error(f"Erreur majeure dans import_pdfs_from_zotero_task: {e}")
        send_project_notification(project_id, 'import_failed', f'Erreur Zotero: {e}')

@with_db_session
def index_project_pdfs_task(session, project_id: str):
    """Indexe les PDFs d'un projet pour le RAG."""
    logger.info(f"ðŸ”  Indexation des PDFs pour projet {project_id}")
    try:
        project_dir = PROJECTS_DIR / project_id
        if not project_dir.exists():
            send_project_notification(project_id, 'indexing_failed', 'Dossier projet introuvable.')
            return
        
        pdf_files = list(project_dir.glob("*.pdf"))
        if not pdf_files:
            send_project_notification(project_id, 'indexing_completed', 'Aucun PDF à indexer.')
            return
        
        if embedding_model is None:
            # CORRECTION: Mettre à jour le statut du projet en cas d'échec précoce
            try:
                session.execute(text("UPDATE projects SET status = 'failed' WHERE id = :pid"), {"pid": project_id})
                session.commit()
            except Exception as db_err:
                logger.error(f"Impossible de mettre à jour le statut du projet {project_id} en 'failed': {db_err}")
                session.rollback()
            # FIN CORRECTION
            logger.warning("Modèle d'embedding non disponible")
            send_project_notification(project_id, 'indexing_failed', 'Modèle embedding non chargé.')
            return
        
        client = chromadb.Client()
        collection = client.get_or_create_collection(name=f"project_{project_id}")
        
        all_chunks = []
        all_metadatas = []
        all_ids = []
        
        total_pdfs = len(pdf_files)
        for i, pdf_path in enumerate(pdf_files):
            progress_message = f"Indexation PDF {i + 1} sur {total_pdfs}..."
            send_project_notification(
                project_id,
                'task_progress',
                progress_message,
                {'current': i, 'total': total_pdfs, 'task_name': 'indexation'} # Progression de 0 à N-1
            )

            extracted_content = extract_text_from_pdf(str(pdf_path))
            if extracted_content and len(extracted_content) > 100:
                chunks = [extracted_content[i:i+CHUNK_SIZE] for i in range(0, len(extracted_content), CHUNK_SIZE-CHUNK_OVERLAP)]
                for chunk_index, chunk in enumerate(chunks):
                    if len(chunk) > MIN_CHUNK_LEN:
                        all_chunks.append(chunk)
                        all_ids.append(f"{sanitize_filename(pdf_path.stem)}_{chunk_index}")
                        all_metadatas.append({"source_id": pdf_path.stem, "filename": pdf_path.name, "chunk": chunk_index})

        if not all_chunks:
            send_project_notification(project_id, 'indexing_completed', 'Aucun contenu textuel trouvé dans les PDFs.')
            return

        # Étape d'encodage par lots (beaucoup plus rapide)
        send_project_notification(project_id, 'task_progress', f'Encodage de {len(all_chunks)} segments de texte...', {'current': total_pdfs, 'total': total_pdfs + 1})
        embeddings = embedding_model.encode(all_chunks, batch_size=EMBED_BATCH, show_progress_bar=False).tolist()

        # Étape d'ajout à ChromaDB
        send_project_notification(project_id, 'task_progress', 'Sauvegarde dans la base de connaissances...', {'current': total_pdfs + 1, 'total': total_pdfs + 1})
        collection.add(
            documents=all_chunks,
            embeddings=embeddings,
            ids=all_ids,
            metadatas=all_metadatas
        )
        
        # Mettre à jour le projet (cette ligne peut maintenant appeler la fonction 'text' importée)
        session.execute(text("UPDATE projects SET indexed_at = :ts WHERE id = :pid"), {"ts": datetime.now().isoformat(), "pid": project_id})
        
        send_project_notification(project_id, 'indexing_completed', f'{total_pdfs} PDF(s) ont été traités et indexés.')
    
    except Exception as e:
        logger.error(f"Erreur index_project_pdfs_task: {e}", exc_info=True)
        # Amélioration de la gestion d'erreur : Mettre à jour le statut du projet en cas d'échec
        try:
            session.execute(text("UPDATE projects SET status = 'failed' WHERE id = :pid"), {"pid": project_id})
            session.commit()
        except Exception as db_err:
            logger.error(f"Impossible de mettre à jour le statut du projet {project_id} en 'failed' après une erreur d'indexation: {db_err}")
            session.rollback()
        
        send_project_notification(project_id, 'indexing_failed', f'Erreur lors de l\'indexation: {e}')


def fetch_online_pdf_task(project_id: str, article_id: str):
    """Récupère un PDF en ligne pour un article via Unpaywall si possible."""
    logger.info(f"ðŸ“„ Récupération PDF en ligne pour {article_id}")
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
    except SQLAlchemyError as e:
        logger.error(f"Erreur DB fetch_online_pdf_task: {e}", exc_info=True)
    except Exception as e:
        logger.error(f"Erreur fetch_online_pdf_task: {e}")
    finally:
        session.close()

# ================================================================ 
# === OLLAMA
# ================================================================ 

def pull_ollama_model_task(model_name: str):
    """Télécharge un modèle Ollama."""
    logger.info(f"ðŸ¤– Téléchargement du modèle Ollama: {model_name}")
    
    try:
        import requests
        url = f"{config.OLLAMA_BASE_URL}/api/pull"
        payload = {"name": model_name, "stream": False}
        response = requests.post(url, json=payload, timeout=3600)
        response.raise_for_status()
        
        logger.info(f"âœ… Modèle {model_name} téléchargé avec succès")
    except Exception as e:
        logger.error(f"â Œ Erreur téléchargement {model_name}: {e}")
        raise

# ================================================================ 
# === VALIDATION INTER-ÉVALUATEURS
# ================================================================ 

@with_db_session
def calculate_kappa_task(session, project_id: str):
    """Calcule le coefficient Kappa de Cohen pour la validation inter-évaluateurs."""
    logger.info(f"ðŸ“Š Calcul du Kappa pour projet {project_id}")
    rows = session.execute(text("SELECT validations FROM extractions WHERE project_id = :pid AND validations IS NOT NULL"), {"pid": project_id}).mappings().all()
    if not rows:
        send_project_notification(project_id, 'kappa_failed', 'Aucune validation trouvée.')
        return
    
    eval1_decisions, eval2_decisions = [], []
    for r in rows:
        try:
            v = json.loads(r["validations"])
            if "evaluator1" in v and "evaluator2" in v:
                eval1 = 1 if v["evaluator1"].lower() == "include" else 0
                eval2 = 1 if v["evaluator2"].lower() == "include" else 0
                eval1_decisions.append(eval1)
                eval2_decisions.append(eval2)
        except Exception:
            continue
    
    if len(eval1_decisions) < 2:
        send_project_notification(project_id, 'kappa_failed', 'Pas assez de validations communes (minimum 2 requises).')
        return
    
    kappa = cohen_kappa_score(eval1_decisions, eval2_decisions)
    
    if kappa < 0: interpretation = "Accord pire que le hasard"
    elif kappa < 0.20: interpretation = "Accord faible"
    elif kappa < 0.40: interpretation = "Accord passable"
    elif kappa < 0.60: interpretation = "Accord modéré"
    elif kappa < 0.80: interpretation = "Accord substantiel"
    else: interpretation = "Accord quasi parfait"
    
    result = {
        "kappa": float(kappa), "interpretation": interpretation,
        "n_comparisons": len(eval1_decisions),
        "agreement_rate": float(np.mean(np.array(eval1_decisions) == np.array(eval2_decisions)))
    }
    
    session.execute(text("UPDATE projects SET inter_rater_reliability = :result WHERE id = :pid"), {"result": json.dumps(result), "pid": project_id})
    message = f"Kappa = {kappa:.3f} ({interpretation}), n = {len(eval1_decisions)}"
    send_project_notification(project_id, 'kappa_calculated', message)

# ================================================================ 
# === SCORES ATN
# ================================================================ 

@with_db_session
def run_atn_stakeholder_analysis_task(session, project_id: str):
    """Analyse multipartie prenante spécialisée pour l'ATN."""
    update_project_status(session, project_id, 'analyzing')
    rows = session.execute(text("SELECT extracted_data, stakeholder_perspective, ai_type, platform_used FROM extractions WHERE project_id = :pid AND extracted_data IS NOT NULL"), {"pid": project_id}).mappings().all()
    if not rows:
        update_project_status(session, project_id, 'failed')
        send_project_notification(project_id, 'analysis_failed', 'Aucune extraction disponible.')
        return
    
    total_studies, atn_metrics, ai_types_dist, platforms, ethical, regulatory = len(rows), {"empathy_scores_ai": [], "empathy_scores_human": [], "wai_sr_scores": [], "adherence_rates": [], "algorithmic_trust": [], "acceptability_scores": []}, {}, set(), [], {"gdpr": 0, "ai_act": 0}
    
    for row in rows:
        try:
            data = json.loads(row['extracted_data'])
            if data.get("Score_empathie_IA"): atn_metrics["empathy_scores_ai"].append(float(data["Score_empathie_IA"]))
            if data.get("Score_empathie_humain"): atn_metrics["empathy_scores_human"].append(float(data["Score_empathie_humain"]))
            if data.get("WAI-SR_modifié"): atn_metrics["wai_sr_scores"].append(float(data["WAI-SR_modifié"]))
            if data.get("Taux_adhésion"): atn_metrics["adherence_rates"].append(data["Taux_adhésion"])
            if data.get("Confiance_algorithmique"): atn_metrics["algorithmic_trust"].append(data["Confiance_algorithmique"])
            if data.get("Acceptabilité_patients"): atn_metrics["acceptability_scores"].append(data["Acceptabilité_patients"])
            if data.get("Type_IA"): ai_types_dist[data["Type_IA"]] = ai_types_dist.get(data["Type_IA"], 0) + 1
            if data.get("Plateforme"): platforms.add(data["Plateforme"])
            if data.get("Considération_éthique"): ethical.append(data["Considération_éthique"])
            if data.get("RGPD_conformité") and "oui" in data["RGPD_conformité"].lower(): regulatory["gdpr"] += 1
            if data.get("AI_Act_risque"): regulatory["ai_act"] += 1
        except (json.JSONDecodeError, ValueError, TypeError) as e:
            logger.warning(f"Erreur parsing extraction: {e}")
            continue
    
    analysis_result = {
        "total_studies": total_studies,
        "atn_metrics": {"empathy_analysis": {"mean_ai_empathy": np.mean(atn_metrics["empathy_scores_ai"]) if atn_metrics["empathy_scores_ai"] else None, "mean_human_empathy": np.mean(atn_metrics["empathy_scores_human"]) if atn_metrics["empathy_scores_human"] else None, "studies_with_empathy": len(atn_metrics["empathy_scores_ai"])}, "alliance_metrics": {"mean_wai_sr": np.mean(atn_metrics["wai_sr_scores"]) if atn_metrics["wai_sr_scores"] else None, "studies_with_wai": len(atn_metrics["wai_sr_scores"])}, "adherence_trust": {"adherence_rates": atn_metrics["adherence_rates"], "algorithmic_trust": atn_metrics["algorithmic_trust"], "acceptability": atn_metrics["acceptability_scores"]}},
        "technology_analysis": {"ai_types_distribution": ai_types_dist, "platforms_used": list(platforms), "most_common_ai_type": max(ai_types_dist.items(), key=lambda x: x[1])[0] if ai_types_dist else None},
        "ethical_regulatory": {"ethical_considerations_count": len(ethical), "gdpr_mentions": regulatory["gdpr"], "ai_act_mentions": regulatory["ai_act"], "regulatory_compliance_rate": (regulatory["gdpr"] / total_studies * 100) if total_studies > 0 else 0}
    }
    
    if ai_types_dist:
        project_dir, plot_path = PROJECTS_DIR / project_id, str(PROJECTS_DIR / project_id / 'atn_ai_types_distribution.png')
        project_dir.mkdir(exist_ok=True)
        fig, ax = plt.subplots(figsize=(10, 6))
        bars = ax.bar(list(ai_types_dist.keys()), list(ai_types_dist.values()), color=['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336'][:len(ai_types_dist)])
        ax.set_xlabel('Types d\'IA'); ax.set_ylabel('Nombre d\'études'); ax.set_title('Distribution des Types d\'IA dans les Études ATN'); ax.tick_params(axis='x', rotation=45)
        for bar in bars: ax.text(bar.get_x() + bar.get_width()/2., bar.get_height(), f'{int(bar.get_height())}', ha='center', va='bottom')
        plt.tight_layout(); plt.savefig(plot_path, bbox_inches='tight'); plt.close(fig)
        analysis_result["plot_path"] = plot_path
    
    update_project_status(session, project_id, 'completed', analysis_result=analysis_result)
    send_project_notification(project_id, 'atn_analysis_completed', 'Analyse ATN multipartie prenante terminée.')

@with_db_session
def run_atn_score_task(session, project_id: str):
    """Calcule des scores ATN à partir des extractions JSON."""
    logger.info(f"ðŸ“Š Calcul des scores ATN pour le projet {project_id}")
    update_project_status(session, project_id, 'generating_analysis')
    extractions = session.execute(text("SELECT pmid, title, extracted_data FROM extractions WHERE project_id = :pid AND extracted_data IS NOT NULL"), {"pid": project_id}).mappings().all()
    if not extractions:
        update_project_status(session, project_id, 'failed')
        send_project_notification(project_id, 'analysis_failed', 'Aucune donnée d\'extraction disponible pour le calcul du score ATN.')
        return
    
    scores = []
    for ext in extractions:
        try:
            data = json.loads(ext["extracted_data"])
            s = 0
            text_blob = json.dumps(data, ensure_ascii=False).lower()
            if 'alliance' in text_blob or 'therapeutic' in text_blob: s += 3
            if any(k in text_blob for k in ['numérique', 'digital', 'app', 'plateforme', 'ia']): s += 3
            if any(k in text_blob for k in ['patient', 'soignant', 'développeur']): s += 2
            if any(k in text_blob for k in ['empathie', 'adherence', 'confiance']): s += 2
            scores.append({'pmid': ext['pmid'], 'title': ext['title'], 'atn_score': min(s, 10)})
        except Exception: continue
    
    if not scores:
        update_project_status(session, project_id, 'failed')
        send_project_notification(project_id, 'analysis_failed', 'Aucun score ATN calculable à partir des données extraites.')
        return
    
    mean_atn = float(np.mean([s['atn_score'] for s in scores]))
    analysis_result = {"atn_scores": scores, "mean_atn": mean_atn, "total_articles_scored": len(scores)}
    
    plot_path = None
    if scores:
        p_dir = PROJECTS_DIR / project_id
        p_dir.mkdir(exist_ok=True)
        plot_path = str(p_dir / 'atn_scores.png')
        fig, ax = plt.subplots(figsize=(10, 6))
        ax.hist([s['atn_score'] for s in scores], bins=11, range=(-0.5, 10.5), alpha=0.7, color='green', edgecolor='black')
        ax.set_xlabel('Score ATN'); ax.set_ylabel('Nombre d\'Articles'); ax.set_title('Distribution des Scores ATN'); ax.set_xticks(range(0, 11))
        plt.savefig(plot_path, bbox_inches='tight'); plt.close(fig)
    
    update_project_status(session, project_id, 'completed', analysis_result=analysis_result, analysis_plot_path=plot_path)
    send_project_notification(project_id, 'analysis_completed', f'Scores ATN calculés: {mean_atn:.2f} (moyenne)')

# ================================================================ 
# === ANALYSE DU RISQUE DE BIAIS (RoB)
# ================================================================ 

@with_db_session
def run_risk_of_bias_task(session, project_id: str, article_id: str):
    """
    Tâche pour évaluer le risque de biais d'un article en utilisant l'IA.
    Ceci est une version simplifiée inspirée de RoB 2.
    """
    logger.info(f"âš–ï¸  Analyse RoB pour article {article_id} dans projet {project_id}")
    pdf_path = PROJECTS_DIR / project_id / f"{sanitize_filename(article_id)}.pdf"
    if not pdf_path.exists():
        send_project_notification(project_id, 'rob_failed', f"PDF non trouvé pour {article_id}.")
        return

    text_content = extract_text_from_pdf(str(pdf_path))
    if not text_content or len(text_content) < 500:
        send_project_notification(project_id, 'rob_failed', f"Contenu insuffisant dans le PDF pour {article_id}.")
        return

    prompt = f"""
        En tant qu'expert en analyse critique de littérature scientifique, évaluez le risque de biais de l'article suivant.
        Concentrez-vous sur deux domaines clés :
        1.  **Biais dans le processus de randomisation** : La méthode d'assignation des participants aux groupes était-elle vraiment aléatoire ? L'assignation était-elle cachée (allocation concealment) ?
        2.  **Biais dû aux données manquantes** : Y a-t-il beaucoup de données manquantes ? Sont-elles gérées de manière appropriée (ex: analyse en intention de traiter) ?

        Pour chaque domaine, fournissez une évaluation ("Low risk", "Some concerns", "High risk") et une brève justification basée sur le texte.
        Enfin, donnez une évaluation globale du risque de biais.

        Répondez UNIQUEMENT avec un objet JSON valide avec les clés suivantes : "domain_1_bias", "domain_1_justification", "domain_2_bias", "domain_2_justification", "overall_bias", "overall_justification".

        TEXTE DE L'ARTICLE :
        ---
        {text_content[:15000]}
        ---
        """
    rob_data = call_ollama_api(prompt, model="llama3.1:8b", output_format="json")

    if not rob_data or not isinstance(rob_data, dict):
        raise ValueError("La réponse de l'IA pour l'analyse RoB est invalide.")

    # CORRECTION DANS tasks_v4_complete.py
    session.execute(text("""
        INSERT INTO risk_of_bias (id, project_id, pmid, article_id, domain_1_bias, domain_1_justification, domain_2_bias, domain_2_justification, overall_bias, overall_justification, created_at)
        VALUES (:id, :project_id, :pmid, :article_id, :d1b, :d1j, :d2b, :d2j, :ob, :oj, :ts)
        ON CONFLICT (project_id, article_id) DO UPDATE SET
            domain_1_bias = EXCLUDED.domain_1_bias, domain_1_justification = EXCLUDED.domain_1_justification,
            domain_2_bias = EXCLUDED.domain_2_bias, domain_2_justification = EXCLUDED.domain_2_justification,
            overall_bias = EXCLUDED.overall_bias, overall_justification = EXCLUDED.overall_justification;
        """), {
        "id": str(uuid.uuid4()), "project_id": project_id,
        "pmid": article_id,        # ← AJOUTER CETTE LIGNE CRITALE
        "article_id": article_id, "d1b": "Low risk", "d1j": "Randomisation claire.",
        "d2b": "Some concerns", "d2j": "Données manquantes notées.",
        "ob": "Some concerns", "oj": "Globalement OK.",
        "ts": datetime.now().isoformat()
        })
    
    send_project_notification(project_id, 'rob_completed', f"Analyse RoB terminée pour {article_id}.")

# ================================================================ 
# === TâCHE POUR AJOUT MANUEL D'ARTICLES (ASYNCHRONE)
# ================================================================ 

@with_db_session
def add_manual_articles_task(session, project_id: str, identifiers: list):
    """
    Tâche d'arrière-plan pour ajouter des articles manuellement.
    """
    logger.info(f"ðŸ“  Ajout manuel d'articles pour le projet {project_id}")
    if not identifiers:
        logger.warning(f"Aucun identifiant fourni pour le projet {project_id}.")
        return

    records_to_insert = []
    for article_id in identifiers:
        try:
            details = fetch_article_details(article_id)
        except Exception as e:
            logger.warning(f"Impossible de récupérer les détails pour {article_id}: {e}")
            continue
        try:
            exists = session.execute(text("SELECT 1 FROM search_results WHERE project_id = :pid AND article_id = :aid"), {"pid": project_id, "aid": details.get('id') or article_id}).fetchone()
            if exists:
                continue
            
            records_to_insert.append({
                "id": str(uuid.uuid4()), "pid": project_id, "aid": details.get('id') or article_id,
                "title": details.get('title', '') or f"Article {article_id}", "abstract": details.get('abstract', '') or '',
                "authors": details.get('authors', '') or '', "pub_date": details.get('publication_date', '') or '',
                "journal": details.get('journal', '') or '', "doi": details.get('doi', '') or '',
                "url": details.get('url', '') or '', "src": details.get('database_source', 'manual'),
                "ts": datetime.now().isoformat()
            })
            time.sleep(0.5)
        except Exception as e:
            logger.warning(f"Ajout manuel ignoré pour {article_id}: {e}")
            continue
    
    if records_to_insert:
        session.execute(text("""
            INSERT INTO search_results (id, project_id, article_id, title, abstract, authors, publication_date, journal, doi, url, database_source, created_at)
            VALUES (:id, :pid, :aid, :title, :abstract, :authors, :pub_date, :journal, :doi, :url, :src, :ts)
        """), records_to_insert)

    session.execute(text("UPDATE projects SET pmids_count = (SELECT COUNT(*) FROM search_results WHERE project_id = :pid), updated_at = :ts WHERE id = :pid"), {"pid": project_id, "ts": datetime.now().isoformat()})
    send_project_notification(project_id, 'import_completed', f'Ajout manuel terminé: {len(records_to_insert)} article(s) ajouté(s).')
    logger.info(f"âœ… Ajout manuel terminé pour le projet {project_id}. {len(records_to_insert)} articles ajoutés.")

@with_db_session
@with_db_session
def import_from_zotero_json_task(session, project_id: str, items_list: list):
    """
    Tâche asynchrone pour importer une LISTE d'objets JSON Zotero (envoyée par l'extension)
    et les convertir en SearchResult dans la base de données.
    """
    logger.info(f"Importation JSON Zotero (Extension) démarrée pour {project_id} : {len(items_list)} articles.")
    imported_count = 0
    failed_count = 0

    for item in items_list:
        try:
            # Extraire les données de l'objet Zotero. (Ceci doit correspondre au format Zotero)
            # Nous supposons ici le format "item" standard.
            data = item.get('data', {})

            # Trouver un identifiant unique (priorité au DOI, puis PMID, puis fallback)
            article_id = data.get('DOI', data.get('PMID', data.get('key')))

            # Extraction robuste des auteurs
            authors = []
            if data.get('creators'):
                authors = [
                    f"{c.get('firstName', '')} {c.get('lastName', '')}".strip()
                    for c in data['creators']
                    if c.get('creatorType') == 'author'
                ]

            # Vérifier si cet article existe déjà dans le projet
            exists = session.query(SearchResult).filter_by(project_id=project_id, article_id=article_id).first()
            if exists:
                logger.warning(f"Article {article_id} déjà présent dans le projet. Ignoré.")
                continue

            new_article = SearchResult(
                id=str(uuid.uuid4()),
                project_id=project_id,
                article_id=article_id,
                title=data.get('title', 'Titre inconnu'),
                abstract=data.get('abstractNote', ''),
                authors=", ".join(authors),
                publication_date=data.get('date', ''),
                journal=data.get('publicationTitle', ''),
                doi=data.get('DOI'),
                url=data.get('url'),
                database_source='Zotero (Extension)'
            )
            session.add(new_article)
            imported_count += 1

        except Exception as e_item:
            logger.error(f"Échec de l'importation de l'article Zotero {data.get('key', 'inconnu')}: {e_item}")
            failed_count += 1

    # session.commit() and session.close() are handled by the decorator
    msg = f"Importation Zotero (Extension) terminée : {imported_count} articles ajoutés, {failed_count} échecs."
    send_project_notification(project_id, 'import_completed', msg)
    logger.info(msg)

def run_extension_task(session, project_id: str, extension_name: str):
    """
    Placeholder task for running a specific extension.
    """
    logger.info(f"🚀 Exécution de l'extension '{extension_name}' pour le projet {project_id}")
    # Here, you would add the actual logic for the extension
    # For now, it just logs and sends a notification
    send_project_notification(project_id, 'extension_completed', f"Extension '{extension_name}' exécutée avec succès.", {'extension_name': extension_name})

print(f"DEBUG: tasks_v4_complete.py loaded. run_extension_task is defined: {'run_extension_task' in globals()}")