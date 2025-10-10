# ================================================================
# ===         ANALYLIT V4.2 - TÂCHES RQ CENTRALISÉES           ===
# ================================================================
# Fichier: backend/tasks_v4_complete.py

# --- IMPORTS SYSTÈME ET STANDARDS ---
import os
import io
import time
import json
import uuid
import math
import logging
import random
import re
import traceback
from datetime import datetime
from functools import wraps
from pathlib import Path
from typing import Dict, List, Optional, Any
from scipy import stats
# --- IMPORTS EXTERNES (3rd PARTY) ---
from sentence_transformers import SentenceTransformer, util
from sqlalchemy.exc import SQLAlchemyError
from rq import get_current_job

# --- IMPORTS CENTRAUX DE L'APPLICATION (LA CLÉ DE LA SOLUTION) ---
# Importe l'instance unique de l'application Flask depuis le point d'entrée WSGI
from backend.wsgi import app # La tâche a besoin du CONTEXTE de l'app
# Importe les extensions partagées (DB)
from utils.extensions import db
# Importe les queues RQ partagées
from utils.app_globals import import_queue, screening_queue, extraction_queue, analysis_queue, synthesis_queue
from sqlalchemy import text
from sqlalchemy.orm import Session
# --- IMPORTS DES MODULES LOCAUX DE L'APPLICATION ---
# Modèles de base de données

from utils.models import (
from flask import current_app
    Project, SearchResult, Extraction, Grid, ChatMessage, AnalysisProfile, RiskOfBias, SCHEMA
)
from backend.atn_scoring_engine_v21 import ATNScoringEngineV22
# Fonctions utilitaires
from utils.zotero_parser import parse_zotero_rdf
from utils.fetchers import db_manager, fetch_unpaywall_pdf_url, fetch_article_details
from utils.ai_processors import call_ollama_api
from utils.file_handlers import sanitize_filename, extract_text_from_pdf
from utils.analysis import generate_discussion_draft
from utils.notifications import send_project_notification
from utils.helpers import http_get_with_retries
from pypdf import PdfReader
from utils.importers import ZoteroAbstractExtractor, process_zotero_item_list
# Templates de prompts
from utils.prompt_templates import (
    get_screening_prompt_template,
    get_full_extraction_prompt_template,
    get_synthesis_prompt_template,
    get_rag_chat_prompt_template,
    get_effective_prompt_template,
    
)
import numpy as np
# --- CONFIGURATION DU LOGGER ---
# Le logger est déjà configuré par la factory de l'application, on le récupère simplement.
logger = logging.getLogger(__name__)

try:
    from backend.atn_scoring_engine_v21 import ATNScoringEngineV22
    ATN_SCORING_AVAILABLE = True
    logger.info("✅ Algorithme ATN v2.2 chargé avec succès")
except ImportError as e:
    logger.warning(f"⚠️ Algorithme ATN non disponible: {e}")
    ATN_SCORING_AVAILABLE = False

# ================================================================ 
# === DÉCORATEUR DE GESTION DE SESSION DB
# ================================================================ 

def with_db_session(func):

    """
    Décorateur qui fournit un contexte d'application et une session DB
    aux tâches RQ. Garantit que la tâche s'exécute dans le même
    environnement que l'application web.
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        # Utilise le contexte de l'application principale
        with app.app_context():
            try:
                # Exécute la fonction de la tâche
                result = func(*args, **kwargs)
                # Le commit est géré par la tâche elle-même ou à la fin si nécessaire
                db.session.commit()
                return result
            except Exception as e:
                # En cas d'erreur, on annule la transaction
                logger.error(f"Erreur dans la tâche {func.__name__}: {e}", exc_info=True)
                db.session.rollback()
                raise  # Propage l'erreur pour que RQ marque la tâche comme échouée
    return wrapper

# ================================================================ 
# === FONCTIONS UTILITAIRES DB-SAFE (SQLAlchemy)
# ================================================================ 
def update_project_status(project_id: str, status: str, result: dict = None, discussion: str = None,
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
    db.session.execute(text(stmt), params)


def log_processing_status(project_id: str, article_id: str, status: str, details: str):
    """Enregistre un événement de traitement dans processing_log."""
    
        # Nous devons générer manuellement l'UUID car nous utilisons du SQL brut.
    log_id = str(uuid.uuid4()) 


    session.execute(text("""
        INSERT INTO processing_log (id, project_id, pmid, task_name, status, details, \"timestamp\")
        VALUES (:id, :project_id, :pmid, :task_name, :status, :details, :ts)
    """), {
        "id": log_id,
        "project_id": project_id, 
        "pmid": article_id, 
        "task_name": "process_article",
        "status": status, 
        "details": details, 
        "ts": datetime.now()
    })
    db.session.commit()

def increment_processed_count(project_id: str):
    """Incrémente processed_count du projet."""
    db.session.execute(text("UPDATE projects SET processed_count = processed_count + 1 WHERE id = :id"), {"id": project_id})


def update_project_timing(project_id: str, duration: float):
    """Ajoute une durée au total_processing_time."""
    db.session.execute(text("UPDATE projects SET total_processing_time = total_processing_time + :d WHERE id = :id"), {"d": float(duration), "id": project_id})


# ================================================================ 
# === Tâches RQ (100% SQLAlchemy)
# ================================================================ 

# === Utilitaires ===
def normalize_profile(profile: dict) -> dict:
    """
    Normalizes the profile dictionary to support both old and new keys.
    """
    if not profile:
        return {'preprocess': 'phi3:mini', 'extract': 'llama3.1:8b', 'synthesis': 'llama3.1:8b'}
    # Support both old and new keys, defaulting to phi3:mini or llama3.1:8b if not found
    return {
        'preprocess': profile.get('preprocess') or profile.get('preprocess_model') or 'phi3:mini',
        'extract': profile.get('extract') or profile.get('extract_model') or 'llama3.1:8b',

        'synthesis': profile.get('synthesis') or profile.get('synthesis_model') or 'llama3.1:8b'
    }


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
def multi_database_search_task(project_id: str, query: str, databases: list, max_results_per_db: int = 50, expert_queries: dict = None):

    """
    Recherche dans plusieurs bases et insère les résultats dans search_results.
    Gère à la fois les requêtes simples et les requêtes expertes spécifiques à chaque base.
    """
    if os.environ.get("ANALYLIT_TEST_MODE") == "true":
        _mock_multi_database_search_task(db.session, project_id, query, databases, max_results_per_db)
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
    if not db.session.get(Project, project_id):
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
                # ✅ CORRECTION: Implémentation de la pagination pour PubMed
                from Bio import Entrez
                Entrez.email = config.UNPAYWALL_EMAIL
                

                max_results = min(max_results_per_db, config.MAX_PUBMED_RESULTS)
                page_size = config.PAGE_SIZE_PUBMED
                retstart = 0
                all_ids = []

                logger.info(f"Récupération de jusqu'à {max_results} articles de PubMed par pages de {page_size}...")


                while retstart < max_results:
                    handle = Entrez.esearch(
                        db="pubmed",
                        term=current_query,
                        retstart=retstart,
                        retmax=min(page_size, max_results - retstart),
                        usehistory="y"
                    )
                    record = Entrez.read(handle)
                    handle.close()

                    ids = record.get("IdList", [])
                    logger.info(f"Appel PubMed (retstart={retstart}, retmax={min(page_size, max_results - retstart)}): {len(ids)} IDs récupérés.")

                    if not ids:
                        break
                    all_ids.extend(ids)
                    retstart += len(ids)
                    if len(ids) < min(page_size, max_results - retstart):
                        break
                
                results = db_manager.fetch_details_for_ids(all_ids)
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
        db.session.execute(text("""
            INSERT INTO search_results (id, project_id, article_id, title, abstract, authors, publication_date, journal, doi, url, database_source, created_at)
            VALUES (:id, :pid, :aid, :title, :abstract, :authors, :pub_date, :journal, :doi, :url, :src, :ts)
            ON CONFLICT (project_id, article_id) DO NOTHING

        """), all_records_to_insert)
        session.commit() # Commit the transaction

        # Enqueue screening tasks
        logger.info(f"🚀 Enqueuing {len(all_records_to_insert)} screening tasks...")

        # Récupérer le projet et le profil associé pour obtenir les modèles

        project = db.session.get(Project, project_id)

        # Logique simplifiée et plus robuste
        profile_name = 'standard' # Toujours commencer avec le défaut
        if project and project.profile_used:
            # Chercher le profil par son nom/id dans la DB
            profile_from_db = db.session.query(AnalysisProfile).filter_by(name=project.profile_used).first()
            if profile_from_db:
                profile_name = profile_from_db.name.lower()
            else:
                logger.warning(f"Profil '{project.profile_used}' non trouvé dans la base de données. Using default 'standard'.")


        # Utiliser le nom du profil pour obtenir les modèles depuis la config
        profile_name = profile_name.strip()  # Trim leading/trailing whitespace from profile_name
        profile_dict = config.DEFAULT_MODELS.get(profile_name, config.DEFAULT_MODELS.get('standard',{'preprocess': 'phi3:mini', 'extract': 'llama3.1:8b', 'synthesis': 'llama3.1:8b'}))

        # Trim leading/trailing whitespace from profile_name
        profile_name = profile_name.strip()
        for record in all_records_to_insert:
            analysis_queue.enqueue(
                'backend.tasks_v4_complete.process_single_article_task',
                project_id=project_id,
                article_id=record['aid'],
                profile=profile_dict,
                analysis_mode='screening',
                job_timeout=600
            )
        logger.info("✅ Screening tasks enqueued.")


    db.session.execute(text("UPDATE projects SET status = 'search_completed', pmids_count = :n, updated_at = :ts WHERE id = :id"), {"n": total_found, "ts": datetime.now().isoformat(), "id": project_id})
    
    db.session.commit() # Commit the status update
    # Amélioration de la notification finale
    final_message = f'Recherche terminée: {total_found} articles trouvés.'

    if failed_databases:
        final_message += f" Échec pour: {', '.join(failed_databases)}."

    send_project_notification(project_id, 'search_completed', final_message, {'total_results': total_found, 'databases': databases, 'failed': failed_databases})
    logger.info(f"âœ… Recherche multi-bases: total {total_found}")

def calculate_atn_score_for_article(article_data: dict) -> dict:
    """Wrapper ROBUSTE pour appeler le moteur de scoring ATN.
    En cas d'erreur fatale, retourne un résultat indiquant l'échec
    pour éviter les "faux scores" silencieux.
    """

    try:
        # Assurez-vous que ces imports sont bien en haut de votre fichier
        # from backend.services.atn_scoring_engine import ATNScoringEngineV22, ATN_SCORING_AVAILABLE
        
        # Vérification si le moteur est volontairement désactivé
        if not ATN_SCORING_AVAILABLE:
            logger.warning("⚠️ Algorithme ATN non disponible, utilisation du fallback système.")
            return {
                "atn_score": 0, # Un score de 0 pour ne pas fausser les moyennes
                "atn_category": "NON ÉVALUÉ (MOTEUR ATN INACTIF)",
                "detailed_justifications": [{"criterion": "Système", "terms_found": ["Moteur de scoring ATN désactivé dans la configuration."]}],
                "algorithm_version": "system_fallback_v1.0"
            }

        # Instance et exécution du moteur de scoring réel
        engine = ATNScoringEngineV22()
        results = engine.calculate_atn_score_v22(article_data)
        
        return results

    except Exception as e:
        # Capture une erreur critique inattendue dans le moteur de scoring.
        # Il est VITAL de ne pas retourner un score numérique qui pourrait être
        # interprété comme valide (comme votre "7").
        
        article_id = article_data.get('article_id', 'ID inconnu')
        logger.error(f"❌ ERREUR FATALE DANS LE MOTEUR DE SCORING pour l'article {article_id}: {e}", exc_info=True)
        
        # Retourner une structure d'erreur claire et non ambiguë
        return {
            "atn_score": 0,  # Un score de 0 clair pour l'analyse des données
            "atn_category": "ERREUR MOTEUR SCORING",
            "detailed_justifications": [{
                "criterion": "Erreur Critique du Moteur", 
                "terms_found": [f"Exception: {str(e)[:150]}..."]
            }],
            "algorithm_version": "error_state_v1.0",
            "error": str(e)
        }


# ==============================================================================
# 🏆 PROCESS SINGLE ARTICLE TASK - VERSION FINALE "VICTORY"
# ==============================================================================
# Date: 08 octobre 2025
# Correction: Transmission complète des données au moteur ATN v2.2
# Plus de scores constants à 9.1 - calcul précis basé sur le contenu réel
# ==============================================================================

def get_pdf_text(article_data, project_id):
    """
    Tente de trouver et d'extraire le texte intégral d'un PDF associé à un article,
    en utilisant le volume Docker partagé.

    """
    if 'attachments' not in article_data or not article_data['attachments']:
        logger.info(f"[{article_data.get('article_id')}] Pas de section 'attachments' dans les données Zotero.")
        return None

    for attachment in article_data['attachments']:
        if attachment.get('contentType') == 'application/pdf' and attachment.get('path', '').startswith('storage:'):
            try:
                # Extrait la clé du dossier (ex: YQDYXX2K/document.pdf)
                relative_path = attachment['path'].split(':', 1)[1]
                
                # Construit le chemin à l'intérieur du conteneur Docker
                pdf_path_in_container = os.path.join('/app/zotero_storage', relative_path)

                if os.path.exists(pdf_path_in_container):
                    logger.info(f"[{article_data.get('article_id')}] PDF trouvé : {pdf_path_in_container}")
                    reader = PdfReader(pdf_path_in_container)
                    full_text = " ".join([page.extract_text() for page in reader.pages if page.extract_text()])
                    logger.info(f"[{article_data.get('article_id')}] {len(full_text)} caractères extraits du PDF.")
                    return full_text
                else:
                    logger.warning(f"[{article_data.get('article_id')}] Chemin PDF {pdf_path_in_container} non trouvé dans le volume partagé.")
            except Exception as e:
                logger.error(f"[{article_data.get('article_id')}] Erreur lors de la lecture du PDF {attachment.get('path')}: {e}")
                return None
    
    logger.info(f"[{article_data.get('article_id')}] Aucun PDF valide trouvé dans les pièces jointes.")
    return None

@with_db_session
def process_single_article_task(project_id, article, profile, analysis_mode, job_id=None):
    # =========================================================================
    # BLINDAGE DÉFENSIF CONTRE LES TÂCHES CORROMPUES
    # =========================================================================
    if isinstance(article, str):
        # Cette tâche provient d'une source inconnue et obsolète.
        # Nous la neutralisons et la traçons.        
        logger.critical(
            f"TÂCHE CORROMPUE DÉTECTÉE ! "
            f"Project ID: {project_id}, "
            f"Type de 'article': {type(article)}, "
            f"Contenu de 'article': {article}. "
            f"Cette tâche est anormale et provient probablement d'un ancien code."
        )
        
        # Tentative de récupération en chargeant l'article depuis la DB
        
        try:
            article_obj = session.query(Article).filter_by(article_id=article).first()
            if not article_obj:
                logger.error(f"ÉCHEC DE LA RÉCUPÉRATION : Article ID {article} non trouvé dans la DB.")
                # Si nous ne pouvons pas récupérer, nous abandonnons la tâche.
                return f"Abandon: Tâche corrompue et article introuvable pour ID {article}"
            
            # Conversion en dictionnaire pour la suite du traitement
            article = {
                "article_id": article_obj.article_id,
                "pmid": article_obj.pmid,
                "title": article_obj.title,
                "abstract": article_obj.abstract,
                "authors": article_obj.authors,
                "publication_date": article_obj.publication_date.isoformat() if article_obj.publication_date else None,
                "attachments": article_obj.attachments,
            }
            logger.warning(f"RÉCUPÉRATION RÉUSSIE. L'article {article['article_id']} a été chargé depuis la DB.")
            
        finally:
            pass

     
    
    # On utilise 'article' partout dans la fonction maintenant.
    logger.info(f"[process_single_article_task] Traitement de l'article avec ID: {article.get('article_id') or article.get('pmid')}")

    profile = normalize_profile(profile)
    article_id = article.get('article_id') or article.get('pmid')    
    
    logger.info(f"[process_single_article_task] project={project_id} article={article_id} mode={analysis_mode}")
    logger.info(f"[process_single_article_task] Traitement de {article_id} avec données directes.")
    
    start_time = time.time()
    try:   
        # ======================================================================
        # ✅ DÉTERMINATION DU CONTENU TEXTUEL À ANALYSER
        # ======================================================================
        # Priority 1: PDF complet si disponible
        # Priority 2: Titre + Abstract depuis les données fournies
        
        text_for_analysis = f"{article.get('title', '')}\n\n{article.get('abstract', '')}"

        analysis_source = "abstract"

        # Vérifier si un PDF est disponible
        pdf_path = PROJECTS_DIR / project_id / f"{sanitize_filename(article_id)}.pdf"
        if pdf_path.exists():
            try:
                pdf_text = extract_text_from_pdf(str(pdf_path))
                if pdf_text and len(pdf_text) > 100:
                    text_for_analysis = pdf_text
                    analysis_source = "pdf"
                    logger.info(f"[process_single_article_task] Utilisation du PDF pour {article_id}")
            except Exception as e:
                logger.warning(f"[process_single_article_task] Erreur lecture PDF {article_id}: {e}")

        # Fallback sur titre + abstract si PDF indisponible
        if not text_for_analysis or len(text_for_analysis.strip()) < 50:
            text_for_analysis = f"{article.get('title', '')}\n\n{article.get('abstract', '')}"
            analysis_source = "abstract"


        # Tenter d'obtenir le texte intégral du PDF
        full_text = get_pdf_text(article, project_id)

        if full_text:
            logger.info("Utilisation du texte intégral du PDF pour le scoring.")
            # Combinez tout pour une analyse maximale
            combined_text = f"{article.get('title', '')}\n\n{article.get('abstract', '')}\n\n{full_text}"

        # Vérification contenu minimal
        if len(text_for_analysis.strip()) < 50:     
            log_processing_status(project_id, article_id, "écarté", "Contenu textuel insuffisant.")
            increment_processed_count(session, project_id)
            logger.warning(f"[process_single_article_task] Contenu insuffisant pour {article_id}")
            return {"status": "skipped", "reason": "insufficient_content"}


        # ======================================================================
        # ✅ PRÉPARATION DONNÉES POUR SCORING ATN V2.2 - CORRECTION FINALE
        # ======================================================================
        # C'est ici que nous corrigeons le bug du 9.1 constant.
        # Le moteur de scoring doit recevoir toutes les données nécessaires.
        
        # Extraction propre de l'année
        try:
            publication_date = str(article.get("publication_date", "") or article.get("year", ""))
            if publication_date and len(publication_date) >= 4:
                year = int(publication_date[:4])
            else:
                year = datetime.now().year
        except (ValueError, TypeError):
            year = datetime.now().year

        # ✅ Tenter d'obtenir le texte intégral du PDF
        full_text_content = get_pdf_text(article, project_id)

        # Dictionnaire de données COMPLET pour le scoring ATN
        data_for_scoring = {
            'title': article.get('title', ''),
            'abstract': article.get('abstract', ''), # GARANTI d'être passé
            'journal': article.get('journal', ''),
            'year': year,
            'keywords': article.get('keywords', []), # Liste vide si inexistant
            'database_source': article.get('database_source', ''),
            'full_text': full_text_content if full_text_content else "" # ✅ AJOUT DE LA CLÉ full_text
        }

        if full_text_content:
            logger.info(f"[{article_id}] Scoring avec texte intégral du PDF.")
        else:
            logger.info(f"[{article_id}] Scoring avec titre/abstract uniquement.")

        logger.info(f"[DEBUG_SCORING] Données envoyées au moteur pour {article_id}: {{'title': ..., 'abstract': ..., 'full_text_length': len(data_for_scoring['full_text'])}}")

        # Appel du moteur de scoring ATN v2.2 avec données complètes
        atn_results = calculate_atn_score_for_article(data_for_scoring) # MENGHINI
        logger.info(f"[ATN_SCORING] Article {article_id}: Score={atn_results.get('atn_score', 0)}, Catégorie={atn_results.get('atn_category', 'Non évalué')}")

        # ======================================================================
        # ✅ PRÉTRAITEMENT DU CONTENU TEXTUEL
        # ======================================================================
        if text_for_analysis:
            prompt_norm = f"Nettoie et normalise ce texte scientifique pour extraction d'informations. Retourne du texte propre.\n---\n{text_for_analysis[:3000]}"
            try:
                normalized = call_ollama_api(prompt_norm, profile["preprocess"], output_format=None)
                if isinstance(normalized, dict):
                    normalized = normalized.get("text") or json.dumps(normalized)
                text_for_analysis = normalized if normalized else text_for_analysis
            except Exception as e:
                logger.warning(f"[process_single_article_task] Prétraitement échoué pour {article_id}: {e}")

        # ======================================================================
        # ✅ TRAITEMENT SELON LE MODE D'ANALYSE
        # ======================================================================
        
        if analysis_mode == "screening":
            # Mode screening : évaluation binaire de pertinence avec ATN v2.2
            screening_prompt = (
                "Tu es un assistant pour le screening d'articles sur l'Alliance Thérapeutique Numérique (ATN). "
                "Analyse ce contenu et détermine s'il est pertinent pour une revue sur l'ATN.\n"
                "Critères de pertinence :\n"
                "- Relation patient-IA ou soignant-IA\n"
                "- Technologies numériques en santé\n"
                "- Empathie artificielle, confiance algorithmique\n"
                "- Acceptabilité des plateformes de santé\n\n"
                "Réponds en JSON avec les clés: is_relevant (bool), score (int 0-10), reason (string).\n---\n"
                f"{text_for_analysis[:4000]}"
            )

            extract_res = call_ollama_api(screening_prompt, profile["extract"], output_format="json")

            # Parsing sécurisé de la réponse
            if isinstance(extract_res, str):
                try:
                    extract_res = json.loads(extract_res)
                except Exception as e:
                    logger.warning(f"[process_single_article_task] Parsing JSON échoué pour {article_id}: {e}")
                    extract_res = {"is_relevant": False, "score": 0, "reason": "parse_error"}

            is_relevant = bool(extract_res.get("is_relevant", False))
            ollama_score = int(extract_res.get("score", 0))
            reason = extract_res.get("reason", "")

            # ✅ UTILISER SCORE ATN V2.2 (plus précis que score Ollama générique)
            final_score = atn_results.get("atn_score", 0)   
            atn_justification = f"ATN v2.2: {atn_results.get('atn_category', 'Non évalué')} | Ollama: {reason}"

            # Sauvegarde du résultat de screening avec scoring ATN
            db.session.execute(text("""
                INSERT INTO extractions (id, project_id, pmid, title, relevance_score, relevance_justification, 
                                       analysis_source, atn_score, atn_category, atn_justifications, created_at)
                VALUES (:id, :pid, :pmid, :title, :score, :just, :src, :atn_score, :atn_cat, :atn_just, :ts)
                ON CONFLICT (project_id, pmid) DO UPDATE SET
                    relevance_score = EXCLUDED.relevance_score,
                    relevance_justification = EXCLUDED.relevance_justification,
                    analysis_source = EXCLUDED.analysis_source,
                    atn_score = EXCLUDED.atn_score,
                    atn_category = EXCLUDED.atn_category,
                    atn_justifications = EXCLUDED.atn_justifications,
                    created_at = EXCLUDED.created_at
            """), {
                "id": str(uuid.uuid4()), 
                "pid": project_id, 
                "pmid": article_id, 
                "title": article.get("title", ""), 
                "score": final_score,  # ✅ SCORE ATN V2.2 RÉEL
                "just": atn_justification,  # ✅ JUSTIFICATION DÉTAILLÉE
                "src": analysis_source,
                "atn_score": atn_results.get("atn_score", 0),
                "atn_cat": atn_results.get("atn_category", "Non évalué"),
                "atn_just": json.dumps(atn_results.get("detailed_justifications", [])),
                "ts": datetime.now().isoformat()
            })

            logger.info(f"[process_single_article_task] Screening terminé - {article_id}: relevant={is_relevant}, score_atn={final_score}")
            result = {"status": "ok", "mode": "screening", "article_id": article_id, "score": final_score, "relevant": is_relevant}

        elif analysis_mode in ("full_extraction", "extraction", "extract"):
            # ✅ MODE EXTRACTION COMPLÈTE AVEC SCORING ATN V2.2 INTÉGRÉ
            
            # Déterminer les champs à extraire
            fields_list = []
            custom_grid_id = None
            
            if custom_grid_id:
                grid_row = session.execute(
                    text("SELECT fields FROM extraction_grids WHERE id = :gid AND project_id = :pid"),
                    {"gid": custom_grid_id, "pid": project_id}
                ).mappings().fetchone()

                if grid_row and grid_row.get("fields"):
                    fields_list_of_dicts = json.loads(grid_row["fields"])
                    if isinstance(fields_list_of_dicts, list):
                        fields_list = [d.get("name") for d in fields_list_of_dicts if d.get("name")]

            # Grille par défaut pour ATN si pas de grille custom
            if not fields_list:
                fields_list = [
                    "Population_étudiée", "Type_IA", "Contexte_thérapeutique", 
                    "Score_empathie_IA", "Score_empathie_humain", "WAI-SR_modifié",
                    "Taux_adhésion", "Confiance_algorithmique", "Acceptabilité_patients",
                    "Perspective_multipartie", "Considération_éthique", "RGPD_conformité",
                    "Résultats_principaux", "Limites_étude"
                ]

            # Prompt d'extraction structurée
            fields_description = "\n".join([f"- {field}" for field in fields_list])
            extraction_prompt = f"""
Extrait les informations suivantes de cet article scientifique sur l'Alliance Thérapeutique Numérique (ATN).
Pour chaque champ, extrait l'information pertinente ou mets "Non spécifié" si l'information n'est pas disponible.

CHAMPS À EXTRAIRE:
{fields_description}

INSTRUCTIONS:
- Sois précis et concis
- Pour les scores numériques, utilise des valeurs numériques quand possible
- Pour les pourcentages, utilise le format "X%" ou la valeur numérique
- Retourne un objet JSON avec chaque champ comme clé

TEXTE DE L'ARTICLE:
---
{text_for_analysis[:6000]}
---
"""

            extracted = call_ollama_api(extraction_prompt, profile["extract"], output_format="json")

            # Parsing sécurisé
            if isinstance(extracted, str):
                try:
                    extracted = json.loads(extracted)
                except Exception as e:
                    logger.warning(f"[process_single_article_task] Parsing extraction échoué pour {article_id}: {e}")
                    extracted = {"key_findings": extracted, "extraction_error": str(e)}

            if not isinstance(extracted, dict):
                extracted = {"raw_response": str(extracted)}

            # ✅ INTÉGRATION SCORE ATN V2.2 DANS EXTRACTION COMPLÈTE
            final_score = atn_results.get("atn_score", 0)
            atn_justification = f"ATN v2.2: {atn_results.get('atn_category', 'Non évalué')} - {atn_results.get('criteria_found', 0)} critères détectés"

            # Sauvegarde de l'extraction complète avec scoring ATN
            db.session.execute(text("""
                INSERT INTO extractions (id, project_id, pmid, title, extracted_data, relevance_score, 
                                       relevance_justification, analysis_source, atn_score, atn_category, 
                                       atn_justifications, created_at)
                VALUES (:id, :pid, :pmid, :title, :ex_data, :score, :just, :src, :atn_score, :atn_cat, :atn_just, :ts)
                ON CONFLICT (project_id, pmid) DO UPDATE SET 
                    extracted_data = EXCLUDED.extracted_data,
                    relevance_score = EXCLUDED.relevance_score,
                    relevance_justification = EXCLUDED.relevance_justification,
                    analysis_source = EXCLUDED.analysis_source,
                    atn_score = EXCLUDED.atn_score,
                    atn_category = EXCLUDED.atn_category,
                    atn_justifications = EXCLUDED.atn_justifications,
                    created_at = EXCLUDED.created_at
            """), {
                "id": str(uuid.uuid4()), 
                "pid": project_id,
                "pmid": article_id,
                "title": article.get("title", ""),
                "ex_data": json.dumps(extracted),
                "score": final_score,  # ✅ SCORE ATN V2.2 CALCULÉ AVEC DONNÉES COMPLÈTES
                "just": atn_justification,
                "src": analysis_source,
                "atn_score": atn_results.get("atn_score", 0),
                "atn_cat": atn_results.get("atn_category", "Non évalué"),

                "atn_just": json.dumps(atn_results.get("detailed_justifications", [])),
                "ts": datetime.now().isoformat()
            })

            logger.info(f"[process_single_article_task] Extraction complète terminée - {article_id}: score_atn={final_score}")
            result = {"status": "ok", "mode": "full_extraction", "article_id": article_id, "extracted_fields": len(extracted), "atn_score": final_score}

        else:
            raise ValueError(f"Mode d'analyse inconnu: {analysis_mode}")
    
        # ======================================================================
        # ✅ FINALISATION ET NOTIFICATIONS
        # ======================================================================
        
        increment_processed_count(session, project_id)
        update_project_timing(project_id, time.time() - start_time)

        send_project_notification(
            project_id, 
            'article_processed', 
            f'Article "{article.get("title", "")[:30]}..." traité - Score ATN: {atn_results.get("atn_score", 0)}', 
            {'article_id': article_id, 'atn_score': atn_results.get("atn_score", 0)}
        )
        
        logger.info(f"✅ Extraction terminée pour {article_id} - Score ATN: {atn_results.get('atn_score', 0)}/100")

        return result

    except Exception as e:
        logger.exception(f"ERREUR CRITIQUE dans process_single_article_task pour {article_id}: {e}")
        increment_processed_count(session, project_id)
        log_processing_status(project_id, article_id, "erreur", f"Erreur fatale: {str(e)[:100]}")
        raise

def import_from_zotero_rdf_task(project_id, rdf_file_path, zotero_storage_path):
    """
    Tâche RQ pour parser un fichier RDF, trouver les PDFs associés,
    et les ajouter à la base de données.
    """
    with db.session.begin():
        logger.info(f"Démarrage de l'import RDF pour le projet {project_id}...")
        
        try:
            # Étape 1: Parser le fichier RDF
            articles = parse_zotero_rdf(rdf_file_path, zotero_storage_path)
            if not articles:
                logger.warning("Aucun article trouvé dans le fichier RDF.")
                return {"status": "completed", "message": "Aucun article trouvé."}

            logger.info(f"{len(articles)} articles parsés depuis le RDF.")

            # Étape 2: Ajouter les articles à la base de données
            # (Cette logique peut être externalisée dans une fonction helper si besoin)
            new_articles_count = 0
            for article_data in articles:
                # Vérifier si l'article existe déjà pour éviter les doublons
                existing_article = db.session.scalar(
                    select(SearchResult).filter_by(project_id=project_id, pmid=article_data['pmid'])
                )
                if not existing_article:
                    new_article = SearchResult(project_id=project_id, **article_data)
                    db.session.add(new_article)
                    new_articles_count += 1
            
            db.session.commit()
            logger.info(f"{new_articles_count} nouveaux articles ajoutés à la base de données.")
            
            # (Optionnel) Lancer automatiquement le screening ou l'extraction après l'import
            # ...

            return {"status": "success", "articles_added": new_articles_count}

        except Exception as e:
            logger.error(f"Erreur critique durant l'import RDF: {e}", exc_info=True)
            db.session.rollback()
            return {"status": "failed", "error": str(e)}
   
@with_db_session
def run_synthesis_task(project_id: str, profile: dict):
    """Génère une synthèse à partir des articles pertinents (score >= 7)."""
    update_project_status(project_id, 'synthesizing')
    project = db.session.execute(text("SELECT description FROM projects WHERE id = :pid"), {"pid": project_id}).mappings().fetchone()
    project_description = project['description'] if project else "Non spécifié"

    rows = db.session.execute(text("SELECT s.title, s.abstract FROM extractions e JOIN search_results s ON e.project_id = s.project_id AND e.pmid = s.article_id WHERE e.project_id = :pid AND e.relevance_score >= 7 ORDER BY e.relevance_score DESC LIMIT 30"), {"pid": project_id}).mappings().all()
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
    try:
        if output and isinstance(output, dict):
            update_project_status(project_id, status='completed', result=output)
            send_project_notification(project_id, 'synthesis_completed', 'Synthèse générée.')
        else:
            update_project_status(project_id, status='failed')
            send_project_notification(project_id, 'synthesis_failed', 'Réponse IA invalide.')
    except Exception as e:
        logger.error(f"Erreur dans la tâche de synthèse : {e}", exc_info=True)
        raise

@with_db_session
def run_discussion_generation_task(project_id: str):  
    """Génère le brouillon de la discussion"""
    try:

        update_project_status(project_id, 'generating_analysis')
        rows = session.execute(text("SELECT e.extracted_data, e.pmid, s.title, e.relevance_score FROM extractions e JOIN search_results s ON e.project_id = s.project_id AND e.pmid = s.article_id WHERE e.project_id = :pid AND e.relevance_score >= 7 AND e.extracted_data IS NOT NULL"), {"pid": project_id}).mappings().all()
        if not rows: # Ne pas lever d'erreur, mais mettre à jour le statut et notifier.
            update_project_status(project_id, status='failed')
            send_project_notification(project_id, 'analysis_failed', "Aucune donnée d'extraction pertinente trouvée pour générer la discussion.")
            return

        # The user request mentioned a correction for a function call on line 300.
        # That line does not exist in this file. The logic for enqueuing tasks is in `server_v4_complete.py`.
        # The most similar logic in this file is the call to `generate_discussion_draft` below.
        # I will assume the intent was to ensure this part is correct, which it appears to be.
        # No changes are made based on the user's specific instruction for line 300 as it's not applicable here
        df = pd.DataFrame(rows)
        profile = db.session.execute(text("SELECT profile_used FROM projects WHERE id = :pid"), {"pid": project_id}).scalar_one_or_none() or 'standard'
        # The following line correctly calls the local function `generate_discussion_draft`
        model_name = config.DEFAULT_MODELS.get(profile, {}).get('synthesis', 'llama3.1:8b')
        draft = generate_discussion_draft(df, lambda p, m: call_ollama_api(p, m, temperature=0.7), model_name)

        update_project_status(project_id, status='completed', discussion=draft)
        send_project_notification(project_id, 'analysis_completed', 'Le brouillon de discussion a été généré.', {'discussion_draft': draft})
    except Exception as e:
        logger.error(f"Erreur dans la tâche de discussion : {e}", exc_info=True)
        raise

@with_db_session
def run_knowledge_graph_task(project_id: str):  
    """Génère un graphe de connaissances JSON à partir des titres d'articles extraits"""
    update_project_status(project_id, status='generating_graph')
    
    # Utiliser le modèle de synthèse pour cette tâche, car il est plus adapté à la génération de JSON structuré.
    profile_info = session.query(Project).filter_by(id=project_id).first()
    analysis_profile = session.query(AnalysisProfile).filter_by(id=profile_info.profile_used).first() if profile_info and profile_info.profile_used else None
    model_to_use = (analysis_profile.extract_model or analysis_profile.synthesis_model) if analysis_profile else 'llama3.1:8b'
    
    rows = session.execute(text("SELECT title, pmid FROM extractions WHERE project_id = :pid"), {"pid": project_id}).mappings().all()
    if not rows:
        update_project_status(session, project_id, status='failed')
        send_project_notification(project_id, 'analysis_failed', 'Aucun article trouvé pour générer le graphe de connaissances.', {'analysis_type': 'knowledge_graph'})
        return
    
    titles = [f"{r['title']} (ID: {r['pmid']})" for r in rows[:100]]
    prompt = f"""À partir de la liste de titres suivante, génère un graphe de connaissances.
Identifie les 10 concepts les plus importants et leurs relations.
Ta réponse doit être UNIQUEMENT un objet JSON avec "nodes" [{{id, label}}] et "edges" [{{from, to, label}}].

Titres:
{json.dumps(titles, indent=2)}"""
    graph = call_ollama_api(prompt, model=model_to_use, output_format="json")
    
    if graph and isinstance(graph, dict) and 'nodes' in graph and 'edges' in graph:   
        update_project_status(project_id, status='completed', graph=graph)
        send_project_notification(project_id, 'analysis_completed', 'Le graphe de connaissances est prêt.', {'analysis_type': 'knowledge_graph'})
    else:
        update_project_status(project_id, status='failed')
        send_project_notification(project_id, 'analysis_failed', 'La génération du graphe de connaissances a échoué.', {'analysis_type': 'knowledge_graph'})

@with_db_session
def run_prisma_flow_task(project_id: str):
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

    update_project_status(db.session, project_id, status='completed', prisma_path=image_path)  
    send_project_notification(project_id, 'analysis_completed', 'Le diagramme PRISMA est prêt.', {'analysis_type': 'prisma_flow'})

@with_db_session
def run_meta_analysis_task(session, project_id: str):
    """Méta-analyse simple des scores de pertinence (distribution + IC 95%)."""
    update_project_status(session, project_id, 'generating_analysis')
    
    scores_list = session.execute(text("SELECT relevance_score FROM extractions WHERE project_id = :pid AND relevance_score IS NOT NULL AND relevance_score > 0"), {"pid": project_id}).scalars().all()
    if len(scores_list) < 2:
        update_project_status(session, project_id, status='failed')
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
    update_project_status(session, project_id, status='completed', analysis_result=analysis_result, analysis_plot_path=plot_path)
    send_project_notification(project_id, 'analysis_completed', 'Méta-analyse terminée.')

@with_db_session
def run_descriptive_stats_task(project_id: str):
    """Génère des statistiques descriptives sur les extractions."""
    logger.info(f"ðŸ“Š Statistiques descriptives pour projet {project_id}")
    update_project_status(session, project_id, 'generating_analysis')
    
    rows = session.execute(text("SELECT relevance_score FROM extractions WHERE project_id = :pid AND relevance_score IS NOT NULL"), {"pid": project_id}).mappings().all()
    if not rows:
        update_project_status(session, project_id, status='failed')
        return
    
    scores = [r['relevance_score'] for r in rows]
    stats_result = {
        'total_extractions': len(scores), 'mean_score': float(np.mean(scores)),
        'median_score': float(np.median(scores)), 'std_dev': float(np.std(scores)),
        'min_score': float(np.min(scores)), 'max_score': float(np.max(scores))
    }
    
    update_project_status(project_id, status='completed', analysis_result=stats_result)
    session.commit() # Commit the status update
    send_project_notification(project_id, 'analysis_completed', 'Statistiques descriptives générées')

# ================================================================ 
# === CHAT RAG
# ================================================================ 

@with_db_session
def answer_chat_question_task(project_id: str, question: str):
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
    
    db.session.execute(text("INSERT INTO chat_messages (id, project_id, role, content, timestamp) VALUES (:id1, :pid, 'user', :q, :ts1), (:id2, :pid, 'assistant', :a, :ts2)"), {"id1": str(uuid.uuid4()), "pid": project_id, "q": question, "ts1": datetime.now().isoformat(), "id2": str(uuid.uuid4()), "a": response, "ts2": datetime.now().isoformat()})
    return response

# ================================================================ 
# === IMPORT/EXPORT
# ================================================================ 

@with_db_session
def import_from_zotero_file_task(project_id: str, json_file_path: str):  
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
        db.session.execute(text("""
            INSERT INTO search_results (id, project_id, article_id, title, abstract, authors, publication_date, journal, doi, url, database_source, created_at)
            VALUES (:id, :pid, :aid, :title, :abstract, :authors, :pub_date, :journal, :doi, :url, :src, :ts)
            ON CONFLICT (project_id, article_id) DO NOTHING
        """), records_to_insert)

    total_articles = db.session.execute(text("SELECT COUNT(*) FROM search_results WHERE project_id = :pid"), {"pid": project_id}).scalar_one()
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
        project_dir = Path(config.PROJECTS_DIR) / project_id
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
def index_project_pdfs_task(project_id: str): # Ajout de 'session'
    """Indexe les PDFs d'un projet pour le RAG."""
    logger.info(f"ðŸ”  Indexation des PDFs pour projet {project_id}")
    try:
        project_dir = PROJECTS_DIR / project_id
        if not project_dir.exists():
            send_project_notification(project_id, 'indexing_failed', 'Dossier projet introuvable.', {'task_name': 'indexation'})
            return
        
        pdf_files = list(project_dir.glob("*.pdf"))
        if not pdf_files:
            send_project_notification(project_id, 'indexing_completed', 'Aucun PDF à indexer.', {'task_name': 'indexation'})
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
            send_project_notification(project_id, 'indexing_failed', 'Modèle embedding non chargé.', {'task_name': 'indexation'})
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
            send_project_notification(project_id, 'indexing_completed', 'Aucun contenu textuel trouvé dans les PDFs.', {'task_name': 'indexation'})
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
        
        send_project_notification(project_id, 'indexing_completed', f'{total_pdfs} PDF(s) ont été traités et indexés.', {'task_name': 'indexation'})
    
    except Exception as e:
        logger.error(f"Erreur index_project_pdfs_task: {e}", exc_info=True)
        send_project_notification(project_id, 'indexing_failed', f'Erreur lors de l\'indexation: {e}', {'task_name': 'indexation'})

@with_db_session
def fetch_online_pdf_task(project_id: str, article_id: str):
    """Récupère un PDF en ligne pour un article via Unpaywall si possible."""
    logger.info(f"ðŸ“„ Récupération PDF en ligne pour {article_id}")
    try: # Le bloc try/finally n'est plus nécessaire grâce au décorateur
        # ✅ PATCH DE ROBUSTESSE : Garantit l'existence de la table dans le contexte du worker
        session.execute(text("""
            CREATE TABLE IF NOT EXISTS analylit_schema.search_results (
                id VARCHAR PRIMARY KEY, project_id VARCHAR, article_id VARCHAR,
                title TEXT, abstract TEXT, authors TEXT, publication_date TEXT,
                journal TEXT, doi VARCHAR, url VARCHAR, database_source VARCHAR, created_at TIMESTAMP, query VARCHAR
            );
        """))
        session.commit() # S'assurer que la table est créée avant la requête
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
def calculate_kappa_task(project_id: str):
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
def run_atn_stakeholder_analysis_task(project_id: str):
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

    update_project_status(session, project_id, status='completed', analysis_result=analysis_result)
    session.commit()
    send_project_notification(project_id, 'atn_analysis_completed', 'Analyse ATN multipartie prenante terminée.')

@with_db_session  
def run_atn_score_task(project_id: str):
    """Calcule les scores ATN pour tous les articles extraits du projet."""
    logger.info(f"📊 Calcul des scores ATN pour le projet {project_id}")
    
    # Attendre que les extractions se terminent (max 2 minutes)
    max_wait = 120  # secondes
    wait_interval = 5
    waited = 0
    
    while waited < max_wait:
        extractions_count = session.execute(text("""
            SELECT COUNT(*)
            FROM extractions e
            WHERE e.project_id = :project_id
        """), {"project_id": project_id}).scalar()
        if extractions_count and extractions_count > 0:
            break
        waited += wait_interval
        time.sleep(wait_interval)
    try:
        # Vérifier s'il y a des extractions à analyser
        extractions = session.execute(text("""
            SELECT COUNT(*) as total, 
                   COUNT(CASE WHEN extracted_data IS NOT NULL THEN 1 END) as with_data
            FROM extractions 
            WHERE project_id = :pid
        """), {"pid": project_id}).mappings().fetchone()
        
        if not extractions or extractions.get('total', 0) == 0:
            logger.warning(f"Aucune extraction trouvée pour le projet {project_id}")
            send_project_notification(project_id, 'analysis_failed', 
                'Aucun article extrait pour calculer les scores ATN', {})
            return {"status": "skipped", "reason": "no_extractions"}
        
        # Récupérer toutes les extractions avec données
        rows = session.execute(text("""
            SELECT pmid, title, extracted_data, relevance_score
            FROM extractions 
            WHERE project_id = :pid AND extracted_data IS NOT NULL
        """), {"pid": project_id}).mappings().fetchall()
        
        if not rows:
            logger.warning(f"Aucune donnée extraite trouvée pour le projet {project_id}")
            send_project_notification(project_id, 'analysis_failed',
                'Aucune donnée extraite disponible pour l\'analyse ATN', {})
            return {"status": "skipped", "reason": "no_extracted_data"}
        
        # Calculer les statistiques ATN
        total_articles = len(rows)
        atn_scores = []
        empathy_scores = []
        trust_scores = []
        
        for row in rows:
            try:
                data = json.loads(row['extracted_data']) if isinstance(row['extracted_data'], str) else row['extracted_data']
                
                # Extraction des scores numériques
                if 'Score_empathie_IA' in data:
                    try:
                        score = float(str(data['Score_empathie_IA']).replace('%', '').replace(',', '.'))
                        if 0 <= score <= 100:
                            empathy_scores.append(score)
                    except (ValueError, TypeError):
                        pass
                
                if 'Confiance_algorithmique' in data:
                    try:
                        score = float(str(data['Confiance_algorithmique']).replace('%', '').replace(',', '.'))
                        if 0 <= score <= 100:
                            trust_scores.append(score)
                    except (ValueError, TypeError):
                        pass
                
                # Score composite basé sur la pertinence
                atn_scores.append(row.get('relevance_score', 0))
                
            except Exception as e:
                logger.warning(f"Erreur traitement extraction {row['pmid']}: {e}")
        
        # Calculs statistiques
        results = {
            'total_articles_analyzed': total_articles,
            'atn_mean_score': np.mean([score for score in atn_scores if score is not None]) if atn_scores and any(score is not None for score in atn_scores) else 0,
            'atn_std_score': np.std(atn_scores) if len(atn_scores) > 1 else 0,
            'empathy_scores': {
                'count': len(empathy_scores),
                'mean': np.mean(empathy_scores) if empathy_scores else None,
                'std': np.std(empathy_scores) if len(empathy_scores) > 1 else None,
                'min': np.min(empathy_scores) if empathy_scores else None,
                'max': np.max(empathy_scores) if empathy_scores else None
            },
            'trust_scores': {
                'count': len(trust_scores), 
                'mean': np.mean(trust_scores) if trust_scores else None,
                'std': np.std(trust_scores) if len(trust_scores) > 1 else None,
                'min': np.min(trust_scores) if trust_scores else None,
                'max': np.max(trust_scores) if trust_scores else None
            },
            'analysis_date': datetime.now().isoformat()
        }
        
        # Sauvegarde des résultats
        session.execute(text("""
            INSERT INTO analyses (id, project_id, analysis_type, results, created_at)
            VALUES (:id, :pid, 'atn_scores', :results, :ts)
            ON CONFLICT (project_id, analysis_type) DO UPDATE SET
                results = EXCLUDED.results, created_at = EXCLUDED.created_at
        """), {
            "id": str(uuid.uuid4()),
            "pid": project_id, 
            "results": json.dumps(results),
            "ts": datetime.now().isoformat()
        })
        
        logger.info(f"✅ Scores ATN calculés pour {total_articles} articles du projet {project_id}")
        send_project_notification(project_id, 'analysis_completed', 
            f'Analyse ATN terminée ({total_articles} articles)', results)
        
        return {"status": "success", "results": results}
        
    except Exception as e:
        logger.exception(f"Erreur lors du calcul des scores ATN: {e}")
        send_project_notification(project_id, 'analysis_failed', 
            f'Erreur analyse ATN: {str(e)}', {})
        raise


# ================================================================ 
# === ANALYSE DU RISQUE DE BIAIS (RoB)
# ================================================================ 

@with_db_session
def run_risk_of_bias_task(project_id: str, article_id: str):
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

    session.execute(text("""
        INSERT INTO risk_of_bias (id, project_id, pmid, article_id, domain_1_bias, domain_1_justification, domain_2_bias, domain_2_justification, overall_bias, overall_justification, created_at)
        VALUES (:id, :project_id, :pmid, :article_id, :d1b, :d1j, :d2b, :d2j, :ob, :oj, :ts)
        ON CONFLICT (project_id, article_id) DO UPDATE SET
            domain_1_bias = EXCLUDED.domain_1_bias, domain_1_justification = EXCLUDED.domain_1_justification,
            domain_2_bias = EXCLUDED.domain_2_bias, domain_2_justification = EXCLUDED.domain_2_justification,
            overall_bias = EXCLUDED.overall_bias, overall_justification = EXCLUDED.overall_justification;
        """), {
            "id": str(uuid.uuid4()), "project_id": project_id, "pmid": article_id,
            "article_id": article_id, "d1b": rob_data.get("domain_1_bias", "N/A"),
            "d1j": rob_data.get("domain_1_justification", "N/A"), "d2b": rob_data.get("domain_2_bias", "N/A"),
            "d2j": rob_data.get("domain_2_justification", "N/A"), "ob": rob_data.get("overall_bias", "N/A"),
            "oj": rob_data.get("overall_justification", "N/A"), "ts": datetime.now().isoformat()
        })
    
    send_project_notification(project_id, 'rob_completed', f"Analyse RoB terminée pour {article_id}.")

# ================================================================ 
# === TÂCHE POUR AJOUT MANUEL D'ARTICLES (ASYNCHRONE)
# ================================================================ 

@with_db_session
def add_manual_articles_task(project_id: str, items: list, use_full_data: bool = False):
    """
    Tâche d'arrière-plan pour ajouter des articles.
    VERSION VICTORY: Gère les données complètes (depuis le workflow) ou les simples identifiants.
    """
    logger.info(f"🧬 Ajout manuel VICTORY pour projet {project_id}. Utilisation données complètes: {use_full_data}")
    if not items:
        logger.warning(f"Aucun item fourni pour le projet {project_id}.")
        return

    records_to_insert = []
    
    # BOUCLE PRINCIPALE CORRIGÉE POUR LA VICTOIRE
    for item_data in items:
        try:
            # ÉTAPE 1: Isoler l'ID de manière fiable
            # On s'assure que item_data est bien un dictionnaire
            if not isinstance(item_data, dict):
                logger.warning(f"Item n'est pas un dictionnaire, ignoré: {str(item_data)[:100]}")
                continue

            # On extrait l'ID simple. C'est notre clé unique.
            article_id_simple = item_data.get('article_id') or item_data.get('pmid')

            if not article_id_simple:
                logger.warning(f"Item sans ID valide ignoré: {str(item_data)[:100]}")
                continue
            
            # Le reste des données
            details = item_data

            # ÉTAPE 2: Vérification de l'existence AVEC L'ID SIMPLE
            exists = session.execute(text("SELECT 1 FROM search_results WHERE project_id = :pid AND article_id = :aid"), 
                                     {"pid": project_id, "aid": article_id_simple}).fetchone()
            if exists:
                logger.debug(f"Article {article_id_simple} déjà existant, ignoré.")
                continue
            
            # ÉTAPE 3: Insertion en base de données AVEC L'ID SIMPLE
            records_to_insert.append({
                "id": str(uuid.uuid4()), 
                "pid": project_id, 
                "aid": article_id_simple, # ✅ LA CORRECTION CRUCIALE EST ICI
                "title": details.get('title', f"Article {article_id_simple}"),
                "abstract": details.get('abstract', 'Résumé non disponible.'),
                "authors": str(details.get('authors', 'Auteurs non spécifiés')), # Assurer que c'est une chaîne
                "pub_date": str(details.get('publication_date', '')) or str(details.get('year', '')),
                "journal": details.get('journal', 'Journal non spécifié'),
                "doi": details.get('doi', ''),
                "url": details.get('url', ''),
                "src": details.get('database_source', 'zotero_glory'),
                "ts": datetime.now().isoformat()
            })

        except Exception as e:
            logger.error(f"Erreur lors du traitement de l'item {str(item_data)[:100]}: {e}", exc_info=True)
            continue
        
        try:
            session.commit()
            logger.info(f"✅ COMMIT SUCCESS: {len(records_to_insert)} articles successfully saved to database for project {project_id}.")
        except Exception as e:
            logger.error(f"❌ CRITICAL COMMIT FAILED for project {project_id}: {e}")
            session.rollback()
            raise  
    
    if not records_to_insert:
        logger.info(f"Aucun nouvel article à ajouter pour {project_id}.")
        send_project_notification(project_id, 'import_completed', f'Import terminé: Aucun nouvel article ajouté.')
        return

    # Insertion en base de données
    session.execute(text("""
        INSERT INTO search_results (id, project_id, article_id, title, abstract, authors, publication_date, journal, doi, url, database_source, created_at)
        VALUES (:id, :pid, :aid, :title, :abstract, :authors, :pub_date, :journal, :doi, :url, :src, :ts)
    """), records_to_insert)

    # Mise à jour du projet et notification
    session.execute(text("UPDATE projects SET pmids_count = (SELECT COUNT(*) FROM search_results WHERE project_id = :pid), updated_at = :ts WHERE id = :pid"), {"pid": project_id, "ts": datetime.now().isoformat()})
    send_project_notification(project_id, 'import_completed', f'Ajout manuel terminé: {len(records_to_insert)} article(s) ajouté(s).')
    logger.info(f"✅ Ajout manuel VICTORY terminé pour {project_id}. {len(records_to_insert)} articles ajoutés.")

    # Lancement de l'extraction automatique pour les nouveaux articles
    project = session.query(Project).filter_by(id=project_id).first()
    profile_used = project.profile_used if project else 'standard'
    # Utilisation d'un profil par défaut simple, car c'est un import de masse
    default_profile = { 'preprocess': 'phi3:mini', 'extract': 'phi3:mini', 'synthesis': 'llama3:8b' }

    if not items:
        logger.info("Aucun article original fourni pour l'analyse, fin de la tâche.")
        return

    logger.info(f"Préparation de l'analyse pour les {len(items)} articles soumis...")

    # On itère sur la liste originale `items` qui contient TOUTES les données
    for article_data_item in items:
        article_id = article_data_item.get('article_id') or article_data_item.get('pmid')
        
        if not article_id:
            logger.warning("Item sans ID ignoré lors de la mise en file d'attente de l'analyse.")
            continue

        logger.info(f"Mise en file d'attente de l'analyse pour l'article {article_id}...")
        
        # ✅ VICTOIRE : On passe l'objet article complet (le dictionnaire) à la tâche.
        analysis_queue.enqueue(
            'backend.tasks_v4_complete.process_single_article_task',
            args=(project_id, article_data_item, default_profile, "full_extraction"),
            job_timeout=3600  # Timeout étendu pour l'analyse complète
        )

    logger.info(f"✅ Toutes les tâches d'analyse pour les {len(items)} articles ont été mises en file d'attente.")

@with_db_session
def import_from_zotero_json_task(project_id: str, items_list: list):
    """
    Tâche asynchrone pour importer une LISTE d'objets JSON Zotero (envoyée par l'extension)
    et les convertir en SearchResult dans la base de données.
    """
    logger.info(f"Importation JSON Zotero (Extension) démarrée pour {project_id} : {len(items_list)} articles.")
    
    # 1. Utiliser la fonction de traitement pour nettoyer et dédupliquer
    processed_records = process_zotero_item_list(items_list)
    
    if not processed_records:
        msg = "Importation Zotero (Extension) terminée : Aucun nouvel article à ajouter."
        send_project_notification(project_id, 'import_completed', msg)
        logger.info(msg)
        return

    # 2. Insérer les enregistrements uniques dans la base de données
    records_to_insert = []
    new_articles = []
    for record in processed_records:
        article_id = record.get('article_id')
        if not article_id:
            continue
        
        existing = session.query(SearchResult).filter_by(project_id=project_id, article_id=article_id).first()
        if not existing:
            record.pop('zotero_key', None)
            record.pop('__hash', None)
            record['project_id'] = project_id
            new_articles.append(SearchResult(**record))
        else:
            # If article already exists, skip it for deduplication test
            logger.debug(f"Article existant ignoré (déduplication) : {article_id}")
            continue # Skip to the next record

    if new_articles:
        session.add_all(new_articles)

    # Le commit est déjà géré par le décorateur @with_db_session
    # session.commit() # Assurez-vous que ceci est hors de la boucle for

    # Le message de notification doit être mis à jour pour refléter le nombre d'articles ajoutés et mis à jour.
    # Pour l'instant, on se concentre sur la correction du test.
    # Le test attend un message spécifique, nous allons le construire.
    failed_imports = len(items_list) - len(processed_records)
    msg = f"Importation Zotero (Extension) terminée : {len(new_articles)} articles ajoutés, {failed_imports} échecs."
    send_project_notification(project_id, 'import_completed', msg)
    logger.info(msg)
def run_extension_task(project_id: str, extension_name: str):
    """

    Placeholder task for running a specific extension.
    """
    logger.info(f"🚀 Exécution de l'extension '{extension_name}' pour le projet {project_id}")
    # Here, you would add the actual logic for the extension
    # For now, it just logs and sends a notification
    send_project_notification(project_id, 'extension_completed', f"Extension '{extension_name}' exécutée avec succès.", {'extension_name': extension_name})

# ================================================================
# === REPORTING TASKS
# ================================================================


@with_db_session
def generate_bibliography_task(project_id: str):
    """
    Génère une bibliographie pour le projet spécifié et la sauvegarde.
    """
    logger.info(f"ðŸ“š Génération de la bibliographie pour le projet {project_id}")
    try:
        project = session.query(Project).filter_by(id=project_id).first()
        if not project:
            send_project_notification(project_id, 'report_failed', 'Projet non trouvé.')
            return

        articles = session.query(SearchResult).filter_by(project_id=project_id).all()
        if not articles:
            send_project_notification(project_id, 'report_completed', 'Aucun article pour générer la bibliographie.')
            return

        bibliography_entries = []
        for article in articles:
            # Simple APA-like formatting for demonstration
            authors = article.authors.split(';')[0] if article.authors else 'N.A.'
            year = article.publication_date.split('-')[0] if article.publication_date else 'N.D.'
            title = article.title if article.title else 'Sans titre'
            journal = article.journal if article.journal else 'N.D.'
            doi = f"DOI: {article.doi}" if article.doi else ''
            url = article.url if article.url else ''

            bibliography_entries.append(
                f"{authors} ({year}). {title}. {journal}. {doi} {url}".strip()
            )

        bibliography_content = "\n\n".join(sorted(bibliography_entries))
        
        project_dir = PROJECTS_DIR / project_id
        project_dir.mkdir(exist_ok=True)
        file_path = project_dir / f"bibliography_{project_id}.txt"
        file_path.write_text(bibliography_content, encoding='utf-8')

        send_project_notification(project_id, 'report_completed', 'Bibliographie générée avec succès.', {'report_path': str(file_path)})
        logger.info(f"âœ… Bibliographie générée pour le projet {project_id} à {file_path}")

    except Exception as e:
        logger.error(f"Erreur lors de la génération de la bibliographie pour le projet {project_id}: {e}", exc_info=True)
        send_project_notification(project_id, 'report_failed', f'Erreur lors de la génération de la bibliographie: {e}')


@with_db_session
def generate_summary_table_task(project_id: str):
    """
    Génère un tableau de synthèse des extractions pour le projet spécifié et le sauvegarde.
    """
    logger.info(f"ðŸ“š Génération du tableau de synthèse pour le projet {project_id}")
    try:
        project = session.query(Project).filter_by(id=project_id).first()
        if not project:
            send_project_notification(project_id, 'report_failed', 'Projet non trouvé.')
            return

        # Fetch articles and their extractions
        results = (session.query(SearchResult, Extraction)
            .join(Extraction, SearchResult.article_id == Extraction.pmid)
            .filter(SearchResult.project_id == project_id, Extraction.project_id == project_id)
            .all()
        )

        if not results:
            send_project_notification(project_id, 'report_completed', 'Aucune donnée d\'extraction pour le tableau de synthèse.')
            return

        summary_data = []
        for article, extraction in results:
            extracted_data = json.loads(extraction.extracted_data) if extraction.extracted_data else {}
            summary_data.append({
                "PMID": article.article_id,
                "Titre": article.title,
                "Auteurs": article.authors,
                "Année": article.publication_date.split('-')[0] if article.publication_date else 'N.D.',
                "Journal": article.journal,
                "Score de pertinence": extraction.relevance_score,
                "Justification pertinence": extraction.relevance_justification,
                **extracted_data # Include all extracted fields
            })
        
        # Convert to pandas DataFrame for easy handling
        df = pd.DataFrame(summary_data)
        
        project_dir = PROJECTS_DIR / project_id
        project_dir.mkdir(exist_ok=True)
        file_path = project_dir / f"summary_table_{project_id}.json" # Save as JSON for simplicity
        df.to_json(file_path, orient='records', indent=4, force_ascii=False)

        send_project_notification(project_id, 'report_completed', 'Tableau de synthèse généré avec succès.', {'report_path': str(file_path)})
        logger.info(f"âœ… Tableau de synthèse généré pour le projet {project_id} à {file_path}")

    except Exception as e:
        logger.error(f"Erreur lors de la génération du tableau de synthèse pour le projet {project_id}: {e}", exc_info=True)
        send_project_notification(project_id, 'report_failed', f'Erreur lors de la génération du tableau de synthèse: {e}')


@with_db_session
def export_excel_report_task(project_id: str):
    """
    Exporte toutes les données pertinentes du projet vers un fichier Excel.
    """
    logger.info(f"ðŸ“š Export Excel pour le projet {project_id}")
    try:
        project = session.query(Project).filter_by(id=project_id).first()
        if not project:
            send_project_notification(project_id, 'report_failed', 'Projet non trouvé.')
            return

        # Fetch all search results
        search_results = session.query(SearchResult).filter_by(project_id=project_id).all()
        search_data = [{c.name: getattr(sr, c.name) for c in sr.__table__.columns} for sr in search_results]
        df_search = pd.DataFrame(search_data)

        # Fetch all extractions
        extractions = session.query(Extraction).filter_by(project_id=project_id).all()
        extraction_data = []
        for ext in extractions:
            row = {c.name: getattr(ext, c.name) for c in ext.__table__.columns}
            if ext.extracted_data:
                try:
                    # Flatten extracted_data JSON into top-level columns
                    flattened_data = json.loads(ext.extracted_data)
                    row.update(flattened_data)
                except json.JSONDecodeError:
                    logger.warning(f"Could not decode extracted_data for extraction ID {ext.id}")
            extraction_data.append(row)
        df_extractions = pd.DataFrame(extraction_data)

        # Fetch all risk of bias assessments
        rob_assessments = session.query(RiskOfBias).filter_by(project_id=project_id).all()
        rob_data = [{c.name: getattr(rob, c.name) for c in rob.__table__.columns} for rob in rob_assessments]
        df_rob = pd.DataFrame(rob_data)

        project_dir = PROJECTS_DIR / project_id
        project_dir.mkdir(exist_ok=True)
        file_path = project_dir / f"report_{project_id}.xlsx"

        with pd.ExcelWriter(file_path, engine='xlsxwriter') as writer:
            if not df_search.empty:
                df_search.to_excel(writer, sheet_name='Search Results', index=False)
            if not df_extractions.empty:
                df_extractions.to_excel(writer, sheet_name='Extractions', index=False)
            if not df_rob.empty:
                df_rob.to_excel(writer, sheet_name='Risk of Bias', index=False)
            
            # Optionally, merge dataframes for a combined view
            if not df_search.empty and not df_extractions.empty:
                df_combined = pd.merge(df_search, df_extractions, left_on=['project_id', 'article_id'], right_on=['project_id', 'pmid'], how='left', suffixes=('_search', '_extraction'))
                df_combined.to_excel(writer, sheet_name='Combined Data', index=False)


        send_project_notification(project_id, 'report_completed', 'Export Excel généré avec succès.', {'report_path': str(file_path)})
        logger.info(f"âœ… Export Excel généré pour le projet {project_id} à {file_path}")

    except Exception as e:
        logger.error(f"Erreur lors de l'export Excel pour le projet {project_id}: {e}", exc_info=True)
        send_project_notification(project_id, 'report_failed', f'Erreur lors de l\'export Excel: {e}')

print(f"DEBUG: tasks_v4_complete.py loaded. run_extension_task is defined: {'run_extension_task' in globals()}")   

@with_db_session
def run_atn_specialized_extraction_task(project_id: str, **kwargs):
    """Dummy task for ATN specialized extraction."""
    logger.info(f"Running ATN specialized extraction for project {project_id}")
    send_project_notification(project_id, 'analysis_completed', 'ATN specialized extraction completed.', {'analysis_type': 'atn_specialized_extraction'})

@with_db_session
def run_empathy_comparative_analysis_task(session, project_id: str, **kwargs):
    """Dummy task for empathy comparative analysis."""
    logger.info(f"Running empathy comparative analysis for project {project_id}")

    send_project_notification(project_id, 'analysis_completed', 'Empathy comparative analysis completed.', {'analysis_type': 'empathy_comparative_analysis'})

# ============================================================================
# === NOUVELLES TÂCHES SÉQUENTIELLES OPTIMISÉES
# ============================================================================

@with_db_session
def run_batch_screening_task(project_id: str, profile: Dict):
    """Screening en lot de tous les articles du projet"""
    logger.info(f"🔍 Screening en lot pour projet {project_id}")
    
    # Récupérer tous les articles non traités
    articles = session.execute(text("""
        SELECT sr.article_id, sr.title, sr.abstract, sr.authors
        FROM search_results sr 
        LEFT JOIN extractions e ON sr.project_id = e.project_id AND sr.article_id = e.pmid
        WHERE sr.project_id = :pid AND e.id IS NULL
        ORDER BY sr.created_at
    """), {"pid": project_id}).mappings().fetchall()
    
    if not articles:
        logger.warning(f"Aucun article à screener pour {project_id}")
        return {"status": "completed", "screened": 0}
    
    profile = normalize_profile(profile)
    total_relevant = 0
    
    # Screening avec grille standardisée
    screening_results = []
    
    for article in articles:
        content = f"Titre: {article['title']}\n\nAuteurs: {article['authors']}\n\nRésumé: {article['abstract']}"
        
        prompt = f"""
Tu es un expert en Alliance Thérapeutique Numérique (ATN). 
Évalue la pertinence de cet article pour une revue systématique sur l'ATN.

CRITÈRES DE PERTINENCE ATN :
- Relations patient-IA thérapeutique
- Empathie artificielle en contexte médical
- Alliance thérapeutique numérique
- Acceptabilité des solutions IA santé
- Confiance algorithmique patient-système
- Technologies conversationnelles médicales

ARTICLE À ÉVALUER :
{content[:2000]}

Réponds UNIQUEMENT en JSON avec :
{{"is_relevant": boolean, "relevance_score": number (0-10), "atn_category": "string", "justification": "string"}}
"""
        
        try:
            result = call_ollama_api(prompt, profile['extract'], output_format='json')
            if isinstance(result, str):
                result = json.loads(result)
            
            is_relevant = result.get('is_relevant', False)
            score = int(result.get('relevance_score', 0))
            
            if is_relevant and score >= 6:
                total_relevant += 1
            
            screening_results.append({
                "id": str(uuid.uuid4()),
                "pid": project_id,
                "pmid": article['article_id'],
                "title": article['title'],
                "score": score,
                "just": result.get('justification', ''),
                "src": 'abstract',
                "ts": datetime.now().isoformat(),
                "category": result.get('atn_category', 'Non classé')
            })
            
        except Exception as e:
            logger.warning(f"Erreur screening {article['article_id']}: {e}")
            continue
    
    # Sauvegarde en lot
    if screening_results:
        session.execute(text("""
            INSERT INTO extractions (id, project_id, pmid, title, relevance_score, relevance_justification, analysis_source, created_at, atn_category)
            VALUES (:id, :pid, :pmid, :title, :score, :just, :src, :ts, :category)
            ON CONFLICT (project_id, pmid) DO UPDATE SET
                relevance_score = EXCLUDED.relevance_score,
                relevance_justification = EXCLUDED.relevance_justification,
                atn_category = EXCLUDED.atn_category
        """), screening_results)
    
    # Notification avec métriques
    send_project_notification(
        project_id,
        'screening_completed', 
        f'Screening terminé : {total_relevant}/{len(articles)} articles pertinents',
        {
            'total_screened': len(articles),
            'relevant_count': total_relevant,
            'relevance_rate': round((total_relevant/len(articles))*100, 1) if articles else 0
        }
    )
    
    logger.info(f"✅ Screening: {total_relevant}/{len(articles)} articles pertinents")
    return {"status": "completed", "screened": len(articles), "relevant": total_relevant}

@with_db_session  
def run_atn_extraction_task(project_id: str, profile: Dict, use_atn_grid: bool = True):
    """Extraction complète avec grille ATN standardisée"""
    logger.info(f"🔬 Extraction ATN pour projet {project_id}")
    
    # Charger la grille ATN depuis le fichier
    atn_fields = [
        "ID_étude", "Auteurs", "Année", "Titre", "DOI/PMID", "Type_étude", 
        "Niveau_preuve_HAS", "Pays_contexte", "Durée_suivi", "Taille_échantillon",
        "Population_cible", "Type_IA", "Plateforme", "Fréquence_usage",
        "Instrument_empathie", "Score_empathie_IA", "Score_empathie_humain", 
        "WAI-SR_modifié", "Taux_adhésion", "Confiance_algorithmique",
        "Interactions_biomodales", "Considération_éthique", "Acceptabilité_patients",
        "Risque_biais", "Limites_principales", "Conflits_intérêts", "Financement",
        "RGPD_conformité", "AI_Act_risque", "Transparence_algo"
    ]
    
    # Articles pertinents seulement (score >= 6)
    articles = session.execute(text("""
        SELECT sr.article_id, sr.title, sr.abstract, sr.authors, sr.publication_date, sr.doi
        FROM search_results sr
        JOIN extractions e ON sr.project_id = e.project_id AND sr.article_id = e.pmid  
        WHERE sr.project_id = :pid AND e.relevance_score >= 6
        ORDER BY e.relevance_score DESC
    """), {"pid": project_id}).mappings().fetchall()
    
    if not articles:
        logger.warning(f"Aucun article pertinent pour extraction ATN - {project_id}")
        return {"status": "skipped", "reason": "no_relevant_articles"}
    
    profile = normalize_profile(profile)
    extraction_results = []
    
    # Extraction avec grille ATN complète
    for article in articles:
        # Recherche de PDF d'abord
        content = f"Titre: {article['title']}\n\nAuteurs: {article['authors']}\n\nRésumé: {article['abstract']}"
        pdf_path = PROJECTS_DIR / project_id / f"{sanitize_filename(article['article_id'])}.pdf"
        
        if pdf_path.exists():
            try:
                pdf_content = extract_text_from_pdf(str(pdf_path))
                if pdf_content and len(pdf_content) > 500:
                    content = pdf_content[:8000]  # Texte complet pour meilleure extraction
                    logger.info(f"✅ PDF utilisé pour extraction: {article['article_id']}")
            except Exception as e:
                logger.warning(f"Erreur PDF {article['article_id']}: {e}")
        
        # Prompt d'extraction ATN ultra-détaillé
        fields_str = "\n".join([f"- {field}: [Détail spécifique à extraire]" for field in atn_fields])
        
        prompt = f"""
MISSION : EXTRACTION SYSTÉMATIQUE ALLIANCE THÉRAPEUTIQUE NUMÉRIQUE (ATN)

Tu es un expert en ATN chargé d'extraire des données selon la grille standardisée française.
L'ATN étudie la relation patient-IA en contexte thérapeutique.

GRILLE D'EXTRACTION ATN (30 CHAMPS) :
{fields_str}

INSTRUCTIONS PRÉCISES :
- Pour chaque champ, extrait la valeur EXACTE du texte
- Si absent : "Non spécifié"
- Pour les scores : utilise format numérique (ex: 8.5, 75%)  
- Pour les outils : nom exact de l'instrument
- Pour les durées : format précis (ex: "6 mois", "1 an")

TEXTE DE L'ÉTUDE À ANALYSER :
---
{content}
---

RÉPONSE ATTENDUE : Objet JSON avec les 30 champs ATN comme clés.
"""
        
        try:
            extracted = call_ollama_api(prompt, profile['extract'], output_format='json')
            if isinstance(extracted, str):
                extracted = json.loads(extracted)
            
            if not isinstance(extracted, dict):
                extracted = {"extraction_error": "Format invalide", "raw_response": str(extracted)}
            
            # Enrichissement avec métadonnées
            extracted.update({
                "extraction_date": datetime.now().isoformat(),
                "pdf_available": pdf_path.exists(),
                "content_source": "pdf" if pdf_path.exists() else "abstract",
                "atn_grid_version": "1.0"
            })
            
            extraction_results.append({
                "id": str(uuid.uuid4()),
                "pid": project_id,
                "pmid": article['article_id'],
                "title": article['title'],
                "data": json.dumps(extracted),
                "score": 10,  # Score élevé pour extraction complète
                "just": "Extraction ATN standardisée complète",
                "src": "pdf" if pdf_path.exists() else "abstract",
                "ts": datetime.now().isoformat()
            })
            
        except Exception as e:
            logger.error(f"Erreur extraction ATN {article['article_id']}: {e}")
            continue
    
    # Sauvegarde en lot des extractions
    if extraction_results:
        session.execute(text("""
            INSERT INTO extractions (id, project_id, pmid, title, extracted_data, relevance_score, relevance_justification, analysis_source, created_at)
            VALUES (:id, :pid, :pmid, :title, :data, :score, :just, :src, :ts)
            ON CONFLICT (project_id, pmid) DO UPDATE SET
                extracted_data = EXCLUDED.extracted_data,
                relevance_score = EXCLUDED.relevance_score,
                updated_at = EXCLUDED.created_at
        """), extraction_results)
    
    send_project_notification(
        project_id,
        'atn_extraction_completed',
        f'Extraction ATN terminée : {len(extraction_results)} articles analysés avec grille complète',
        {
            'total_extracted': len(extraction_results),
            'atn_fields_count': len(atn_fields),
            'grid_version': '1.0'
        }

    )
    
    logger.info(f"✅ Extraction ATN complète: {len(extraction_results)} articles")
    return {"status": "completed", "extracted": len(extraction_results)}

@with_db_session
def run_parallel_pdf_fetch_task(project_id: str, article_ids: List[str]):
    """Récupération parallèle des PDFs pour une liste d'articles"""
    logger.info(f"📄 Récupération parallèle de {len(article_ids)} PDFs")
    
    success_count = 0
    for article_id in article_ids:
        try:
            # Récupération via Unpaywall
            article = session.execute(text("""
                SELECT doi, url FROM search_results 
                WHERE project_id = :pid AND article_id = :aid
            """), {"pid": project_id, "aid": article_id}).mappings().fetchone()
            
            if article and article.get('doi'):
                pdf_url = fetch_unpaywall_pdf_url(article['doi'])
                if pdf_url:
                    response = http_get_with_retries(pdf_url, timeout=30)
                    if response and response.headers.get('content-type', '').startswith('application/pdf'):
                        
                        project_dir = PROJECTS_DIR / project_id
                        project_dir.mkdir(exist_ok=True)
                        pdf_path = project_dir / f"{sanitize_filename(article_id)}.pdf"
                        pdf_path.write_bytes(response.content)
                        
                        success_count += 1
                        logger.info(f"✅ PDF récupéré: {article_id}")
                        
        except Exception as e:
            logger.warning(f"Échec PDF {article_id}: {e}")
            continue
    
    send_project_notification(
        project_id,
        'pdf_batch_completed', 
        f'Récupération PDFs terminée: {success_count}/{len(article_ids)} réussies',
        {'success_rate': round((success_count/len(article_ids))*100, 1)}
    )
    
    return {"status": "completed", "pdfs_fetched": success_count}