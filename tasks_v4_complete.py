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

# --- Importer les helpers/utilitaires applicatifs ---
from utils.fetchers import db_manager, fetch_unpaywall_pdf_url, fetch_article_details
from utils.ai_processors import call_ollama_api
from utils.file_handlers import sanitize_filename, extract_text_from_pdf
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
# === FONCTIONS UTILITAIRES DB-SAFE (SQLAlchemy)
# ================================================================
def update_project_status(project_id: str, status: str, result: dict = None, discussion: str = None,
                          graph: dict = None, prisma_path: str = None, analysis_result: dict = None,
                          analysis_plot_path: str = None):
    """Met à jour le statut et/ou champs résultat d'un projet."""
    session = Session()
    try:
        now_iso = datetime.now().isoformat()
        
        # Définir les clauses et les paramètres de base
        set_clauses = ["status = :status", "updated_at = :ts"]
        params = {"pid": project_id, "ts": now_iso, "status": status}

        # Ajouter dynamiquement des clauses et des paramètres si les données sont fournies
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

        # Assembler la requête SQL finale
        stmt = f"UPDATE projects SET {', '.join(set_clauses)} WHERE id = :pid"
        
        session.execute(text(stmt), params)
        session.commit()
    except Exception as e:
        session.rollback()
        logger.error(f"Erreur update_project_status: {e}", exc_info=True)
        raise
    finally:
        session.close()

def log_processing_status(session, project_id: str, article_id: str, status: str, details: str):
    """Enregistre un événement de traitement dans processing_log."""
    session.execute(text("""
        INSERT INTO processing_log (project_id, pmid, status, details, \"timestamp\")
        VALUES (:project_id, :pmid, :status, :details, :ts)
    """),
    {"project_id": project_id, "pmid": article_id, "status": status, "details": details, "ts": datetime.now()})

def increment_processed_count(session, project_id: str):
    """Incrémente processed_count du projet."""
    session.execute(text("UPDATE projects SET processed_count = processed_count + 1 WHERE id = :id"),
                    {"id": project_id})

def update_project_timing(session, project_id: str, duration: float):
    """Ajoute une durée au total_processing_time."""
    session.execute(text("""
        UPDATE projects SET total_processing_time = total_processing_time + :d WHERE id = :id
    """),
    {"d": float(duration), "id": project_id})
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
                    continue

                for r in results:
                    # CORRECTION : Parenthèse fermante après la liste des colonnes ajoutée
                    session.execute(text("""
                        INSERT INTO search_results (
                            id, project_id, article_id, title, abstract, authors,
                            publication_date, journal, doi, url, database_source, created_at
                        ) VALUES (
                            :id, :pid, :aid, :title, :abstract, :authors,
                            :pub_date, :journal, :doi, :url, :src, :ts
                        )
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
                time.sleep(0.6)  # Pour ne pas surcharger les APIs
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
    """Traite un article: screening ou extraction complète."""
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
            # On incrémente quand même pour que le compteur corresponde au total
            increment_processed_count(session, project_id)
            session.commit()
            return

        if analysis_mode == "full_extraction":
            fields_list = []
            if custom_grid_id:
                try:
                    grid_row = session.execute(text("""
                        SELECT fields FROM extraction_grids WHERE id = :gid AND project_id = :pid
                    """), {"gid": custom_grid_id, "pid": project_id}).mappings().fetchone()
                    if grid_row and grid_row.get("fields"):
                        # Le champ 'fields' est un JSON string d'une liste d'objets
                        fields_list_of_dicts = json.loads(grid_row["fields"])
                        if isinstance(fields_list_of_dicts, list):
                            # Extrait juste les noms pour le prompt
                            fields_list = [d.get("name") for d in fields_list_of_dicts if d.get("name")]
                except Exception as e:
                    logger.warning(f"Grille custom invalide: {e}")

            if not fields_list:
                fields_list = ["type_etude", "population", "intervention",
                               "resultats_principaux", "limites", "methodologie"]

            fields = [{"name": f, "description": f} for f in fields_list]
            base_tpl = get_full_extraction_prompt_template(fields)
            tpl = get_effective_prompt_template("full_extraction_prompt", base_tpl)

            # Remplacement SEULEMENT pour {text} et {database_source}
            prompt = tpl.replace("{text}", text_for_analysis).replace("{database_source}", article.get("database_source", "unknown"))

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
            # screening - les accolades JSON sont échappées dans le template
            base_tpl = get_screening_prompt_template()
            tpl = get_effective_prompt_template("screening_prompt", base_tpl)

            prompt_data = {
                "title": article.get("title", ""),
                "abstract": article.get("abstract", ""),
                "database_source": article.get("database_source", "unknown")
            }
            # Formatage sûr: seuls {title}, {abstract}, {database_source} sont présents
            prompt = tpl.format(**prompt_data)

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

        increment_processed_count(session, project_id)
        update_project_timing(session, project_id, time.time() - start_time)
        session.commit()
        send_project_notification(project_id, 'article_processed',
                                  f'Article "{article.get("title","" )[:30]}..." traité.',
                                  {'article_id': article_id})
    except Exception as e:
        session.rollback()
        logger.error(f"Erreur process_single_article_task [{article_id}]: {e}", exc_info=True)
        try:
            with Session() as s2:
                log_processing_status(s2, project_id, article_id, "erreur", str(e))
                # On incrémente aussi ici pour ne pas bloquer la barre de progression
                increment_processed_count(s2, project_id)
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
        abstracts = [f"Titre: {r['title']}\nRésumé: {r['abstract']}" for r in rows if r.get('abstract')]
        if not abstracts:
            update_project_status(project_id, 'failed')
            send_project_notification(project_id, 'synthesis_failed', 'Articles pertinents sans résumé.')
            return

        data_for_prompt = "\n---\n".join(abstracts)

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
    """Génère le brouillon de la discussion."""
    session = Session()
    try:
        update_project_status(project_id, 'generating_analysis')
        
        # Récupérer les données nécessaires depuis la base
        rows = session.execute(text("""
            SELECT e.extracted_data, e.pmid, s.title, e.relevance_score
            FROM extractions e
            JOIN search_results s ON e.project_id = s.project_id AND e.pmid = s.article_id
            WHERE e.project_id = :pid AND e.relevance_score >= 7 AND e.extracted_data IS NOT NULL
        """), {"pid": project_id}).mappings().all()

        if not rows:
            raise ValueError("Aucune donnée d'extraction pertinente trouvée pour générer la discussion.")
            
        df = pd.DataFrame(rows)
        
        # Obtenir le modèle IA à utiliser
        profile = session.execute(text("SELECT profile_used FROM projects WHERE id = :pid"), {"pid": project_id}).scalar_one_or_none() or 'standard'
        model_name = config.DEFAULT_MODELS.get(profile, {}).get('synthesis', 'llama3.1:8b')
        
        # Générer le brouillon
        draft = generate_discussion_draft(df, call_ollama_api, model_name)

        # Mettre à jour le projet avec le résultat
        update_project_status(project_id, 'completed', discussion=draft)
        
        # CORRECTION : Envoyer le résultat dans la notification pour une mise à jour immédiate
        send_project_notification(
            project_id, 
            'analysis_completed', 
            'Le brouillon de discussion a été généré.',
            {'discussion_draft': draft}  # Ajout de cette ligne
        )

    except Exception as e:
        logger.error(f"Erreur run_discussion_generation_task: {e}", exc_info=True)
        update_project_status(project_id, 'failed')
        send_project_notification(project_id, 'analysis_failed', f'Erreur discussion: {e}')
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
            send_project_notification(project_id, 'analysis_completed', 'Le graphe de connaissances est prêt.', {'analysis_type': 'knowledge_graph'}) # Correction: notification spécifique
        else:
            update_project_status(project_id, status='analysis_failed')
            send_project_notification(project_id, 'analysis_failed', 'La génération du graphe de connaissances a échoué.', {'analysis_type': 'knowledge_graph'})
    
    except Exception as e:
        logger.error(f"Erreur run_knowledge_graph_task: {e}", exc_info=True)
        update_project_status(project_id, status='analysis_failed')
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
        
        # AMÉLIORATION : Générer directement le graphique haute résolution pour la thèse
        fig, ax = plt.subplots(figsize=(12, 16), dpi=300)  # Haute résolution
        
        # Style professionnel pour thèse
        plt.style.use('seaborn-v0_8-whitegrid')
        
        # Boîtes avec style académique
        box_props = dict(boxstyle="round,pad=0.8",
                        facecolor='lightblue',
                        edgecolor='navy',
                        linewidth=2,
                        alpha=0.8)
        
        # Textes avec police académique
        font_props = {'fontsize': 12, 'fontweight': 'bold', 'fontfamily': 'serif'}
        
        ax.text(0.5, 0.9, f'Articles identifiés\nn = {total_found}', ha='center', va='center', bbox=box_props, **font_props)
        ax.text(0.5, 0.7, f'Après exclusion doublons\nn = {n_after_duplicates}', ha='center', va='center', bbox=box_props, **font_props)
        ax.text(0.5, 0.5, f'Articles évalués\nn = {n_after_duplicates}', ha='center', va='center', bbox=box_props, **font_props)
        ax.text(0.5, 0.3, f'Études incluses\nn = {n_included}', ha='center', va='center', bbox=box_props, **font_props)
        ax.text(1.0, 0.5, f'Exclus au criblage\nn = {n_excluded_screening}', ha='left', va='center', bbox=box_props, **font_props)
        ax.axis('off')
        
        # Sauvegarder en haute résolution
        p_dir = PROJECTS_DIR / project_id
        p_dir.mkdir(exist_ok=True)
        image_path = str(p_dir / 'prisma_flow.png')
        plt.savefig(image_path, bbox_inches='tight', dpi=300, format='png')
        
        # Version PDF vectoriel pour LaTeX
        pdf_path = str(p_dir / 'prisma_flow.pdf') 
        plt.savefig(pdf_path, bbox_inches='tight', format='pdf')
        
        plt.close(fig) # CORRECTION: Fermer la figure après les deux sauvegardes

        update_project_status(project_id, status='completed', prisma_path=image_path)
        send_project_notification(project_id, 'analysis_completed', 'Le diagramme PRISMA est prêt.', {'analysis_type': 'prisma_flow'}) # Correction: notification spécifique

    except Exception as e:
        logger.error(f"Erreur run_prisma_flow_task: {e}", exc_info=True)
        update_project_status(project_id, status='analysis_failed')
    finally:
        session.close()

def run_meta_analysis_task(project_id: str):
    """Méta-analyse simple des scores de pertinence (distribution + IC 95%)."""
    update_project_status(project_id, 'generating_analysis')
    session = Session()
    
    try:
        # Récupérer les scores de pertinence
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
    """Génère des statistiques descriptives sur les extractions."""
    logger.info(f"📊 Statistiques descriptives pour projet {project_id}")
    update_project_status(project_id, 'generating_analysis')
    session = Session()
    
    try:
        rows = session.execute(text("""
            SELECT relevance_score FROM extractions
            WHERE project_id = :pid AND relevance_score IS NOT NULL
        """), {"pid": project_id}).mappings().all()
        
        if not rows:
            update_project_status(project_id, 'failed')
            return
        
        scores = [r['relevance_score'] for r in rows]
        stats_result = {
            'total_extractions': len(scores),
            'mean_score': float(np.mean(scores)),
            'median_score': float(np.median(scores)),
            'std_dev': float(np.std(scores)),
            'min_score': float(np.min(scores)),
            'max_score': float(np.max(scores))
        }
        
        update_project_status(project_id, 'completed', analysis_result=stats_result)
        send_project_notification(project_id, 'analysis_completed', 'Statistiques descriptives générées')
    
    except Exception as e:
        logger.error(f"Erreur run_descriptive_stats_task: {e}")
        update_project_status(project_id, 'failed')
    finally:
        session.close()

# ================================================================
# === CHAT RAG
# ================================================================

def answer_chat_question_task(project_id: str, question: str):
    """Répond à une question via RAG sur les PDFs indexés."""
    logger.info(f"💬 Question chat pour projet {project_id}")
    session = Session()
    
    try:
        if embedding_model is None:
            response = "Modèle d'embedding non disponible"
        else:
            # Simulation RAG simple
            client = chromadb.Client()
            try:
                collection = client.get_collection(name=f"project_{project_id}")
                query_embedding = embedding_model.encode([question]).tolist()
                
                results = collection.query(
                    query_embeddings=[query_embedding],
                    n_results=3
                )
                
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
        
        # Sauvegarder la conversation
        session.execute(text("""
            INSERT INTO chat_messages (id, project_id, role, content, timestamp)
            VALUES (:id1, :pid, 'user', :q, :ts1), (:id2, :pid, 'assistant', :a, :ts2)
        """), {
            "id1": str(uuid.uuid4()), "id2": str(uuid.uuid4()),
            "pid": project_id, "q": question, "a": response,
            "ts1": datetime.now().isoformat(), "ts2": datetime.now().isoformat()
        })
        session.commit()
        
        return response
    
    except Exception as e:
        logger.error(f"Erreur answer_chat_question_task: {e}")
        return "Erreur lors du traitement de la question."
    finally:
        session.close()

# ================================================================
# === IMPORT/EXPORT
# ================================================================

def import_from_zotero_file_task(project_id: str, json_file_path: str):
    """Importe les articles depuis un fichier JSON Zotero en utilisant le parseur robuste."""
    logger.info(f"📚 Import Zotero depuis {json_file_path} pour projet {project_id}")
    session = Session()
    try:
        extractor = ZoteroAbstractExtractor(json_file_path)
        records = extractor.process()

        if not records:
            send_project_notification(project_id, 'import_failed', 'Aucun article valide trouvé dans le fichier Zotero.')
            return

        imported_count = 0
        for record in records:
            if not record.get('article_id'): continue

            exists = session.execute(text("""
                SELECT 1 FROM search_results WHERE project_id = :pid AND article_id = :aid
            """), {"pid": project_id, "aid": record['article_id']}).fetchone()

            if not exists:
                session.execute(text("""
                    INSERT INTO search_results (id, project_id, article_id, title, abstract, authors, publication_date, journal, doi, url, database_source, created_at)
                    VALUES (:id, :pid, :aid, :title, :abstract, :authors, :pub_date, :journal, :doi, :url, :src, :ts)
                """), {
                    "id": str(uuid.uuid4()), "pid": project_id, "aid": record['article_id'],
                    "title": record.get('title', 'Sans titre'), "abstract": record.get('abstract', ''),
                    "authors": record.get('authors', ''), "pub_date": record.get('publication_date', ''),
                    "journal": record.get('journal', ''), "doi": record.get('doi', ''),
                    "url": record.get('url', ''), "src": record.get('database_source', 'zotero'),
                    "ts": datetime.now().isoformat()
                })
                imported_count += 1
        
        session.commit()

        total_articles = session.execute(text("SELECT COUNT(*) FROM search_results WHERE project_id = :pid"), {"pid": project_id}).scalar_one()
        session.execute(text("UPDATE projects SET pmids_count = :count WHERE id = :pid"), {"count": total_articles, "pid": project_id})
        session.commit()

        send_project_notification(project_id, 'import_completed', f'Import Zotero terminé: {imported_count} nouveaux articles ajoutés.')
        
        try:
            os.remove(json_file_path)
        except Exception as e:
            logger.warning(f"Impossible de supprimer le fichier temporaire {json_file_path}: {e}")

    except Exception as e:
        session.rollback()
        logger.error(f"Erreur import_from_zotero_file_task: {e}", exc_info=True)
        send_project_notification(project_id, 'import_failed', f'Erreur lors de l\'import Zotero: {e}')
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

def index_project_pdfs_task(project_id: str):
    """Indexe les PDFs d'un projet pour le RAG."""
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
        
        # Indexation ChromaDB
        indexed_count = 0
        client = chromadb.Client()
        collection = client.get_or_create_collection(name=f"project_{project_id}")
        
        for pdf_path in pdf_files:
            text = extract_text_from_pdf(str(pdf_path))
            if text and len(text) > 100:
                # Découpage simple en chunks
                chunks = [text[i:i+CHUNK_SIZE] for i in range(0, len(text), CHUNK_SIZE-CHUNK_OVERLAP)]
                
                for i, chunk in enumerate(chunks):
                    if len(chunk) > MIN_CHUNK_LEN:
                        emb = embedding_model.encode([chunk]).tolist()
                        doc_id = f"{sanitize_filename(pdf_path.stem)}_{i}"
                        
                        collection.add(
                            documents=[chunk],
                            embeddings=[emb],
                            ids=[doc_id],
                            metadatas=[{"source_id": pdf_path.stem, "filename": pdf_path.name, "chunk": i}]
                        )
                
                indexed_count += 1
        
        # Mettre à jour le projet
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
# === OLLAMA
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
# === VALIDATION INTER-ÉVALUATEURS
# ================================================================

def calculate_kappa_task(project_id: str):
    """Calcule le coefficient Kappa de Cohen pour la validation inter-évaluateurs."""
    logger.info(f"📊 Calcul du Kappa pour projet {project_id}")
    session = Session()
    
    try:
        # Récupérer les validations avec les deux évaluateurs
        rows = session.execute(text("""
            SELECT validations FROM extractions
            WHERE project_id = :pid AND validations IS NOT NULL
        """), {"pid": project_id}).mappings().all()
        
        if not rows:
            send_project_notification(project_id, 'kappa_failed', 'Aucune validation trouvée.')
            return
        
        evaluator1_decisions = []
        evaluator2_decisions = []
        
        for r in rows:
            try:
                v = json.loads(r["validations"])
                if "evaluator1" in v and "evaluator2" in v:
                    # Convertir en numérique: include=1, exclude=0
                    eval1 = 1 if v["evaluator1"].lower() == "include" else 0
                    eval2 = 1 if v["evaluator2"].lower() == "include" else 0
                    
                    evaluator1_decisions.append(eval1)
                    evaluator2_decisions.append(eval2)
            except Exception:
                continue
        
        if len(evaluator1_decisions) < 2:
            send_project_notification(project_id, 'kappa_failed', 
                                    'Pas assez de validations communes (minimum 2 requises).')
            return
        
        # Calculer le Kappa
        kappa = cohen_kappa_score(evaluator1_decisions, evaluator2_decisions)
        
        # Interpréter le résultat
        if kappa < 0:
            interpretation = "Accord pire que le hasard"
        elif kappa < 0.20:
            interpretation = "Accord faible"
        elif kappa < 0.40:
            interpretation = "Accord passable"
        elif kappa < 0.60:
            interpretation = "Accord modéré"
        elif kappa < 0.80:
            interpretation = "Accord substantiel"
        else:
            interpretation = "Accord quasi parfait"
        
        result = {
            "kappa": float(kappa),
            "interpretation": interpretation,
            "n_comparisons": len(evaluator1_decisions),
            "agreement_rate": float(np.mean(np.array(evaluator1_decisions) == np.array(evaluator2_decisions)))
        }
        
        # Sauvegarder le résultat
        session.execute(text("""
            UPDATE projects SET inter_rater_reliability = :result WHERE id = :pid
        """), {"result": json.dumps(result), "pid": project_id})
        session.commit()
        
        message = f"Kappa = {kappa:.3f} ({interpretation}), n = {len(evaluator1_decisions)}"
        send_project_notification(project_id, 'kappa_calculated', message)
    
    except Exception as e:
        logger.error(f"Erreur calculate_kappa_task: {e}", exc_info=True)
        send_project_notification(project_id, 'kappa_failed', f'Erreur: {e}')
    finally:
        session.close()

# ================================================================
# === SCORES ATN
# ================================================================

def run_atn_stakeholder_analysis_task(project_id: str):
    """Analyse multipartie prenante spécialisée pour l'ATN."""
    update_project_status(project_id, 'analyzing')
    session = Session()
    
    try:
        # Récupérer toutes les extractions avec données ATN
        rows = session.execute(text("""
            SELECT extracted_data, stakeholder_perspective, ai_type, platform_used 
            FROM extractions 
            WHERE project_id = :pid AND extracted_data IS NOT NULL
        """), {"pid": project_id}).mappings().all()
        
        if not rows:
            update_project_status(project_id, 'failed')
            send_project_notification(project_id, 'analysis_failed', 'Aucune extraction disponible.')
            return
        
        stakeholder_analysis = {
            "patients": {"count": 0, "empathy_scores": [], "acceptability": [], "adherence": []},
            "healthcare_providers": {"count": 0, "workflow_impact": [], "satisfaction": []},
            "developers": {"count": 0, "ai_types": [], "platforms": []},
            "regulators": {"count": 0, "gdpr_compliance": [], "ai_act_risk": []}
        }
        
        total_studies = len(rows)
        atn_specific_metrics = {
            "empathy_scores_ai": [],
            "empathy_scores_human": [],
            "wai_sr_scores": [],
            "adherence_rates": [],
            "algorithmic_trust": [],
            "acceptability_scores": []
        }
        
        ai_types_distribution = {}
        platforms_used = set()
        ethical_considerations = []
        regulatory_mentions = {"gdpr": 0, "ai_act": 0}
        
        for row in rows:
            try:
                data = json.loads(row['extracted_data'])
                
                # Extraction des métriques ATN spécifiques
                if data.get("Score_empathie_IA"):
                    try:
                        score = float(data["Score_empathie_IA"])
                        atn_specific_metrics["empathy_scores_ai"].append(score)
                    except ValueError:
                        pass
                
                if data.get("Score_empathie_humain"):
                    try:
                        score = float(data["Score_empathie_humain"])
                        atn_specific_metrics["empathy_scores_human"].append(score)
                    except ValueError:
                        pass
                
                if data.get("WAI-SR_modifié"):
                    try:
                        score = float(data["WAI-SR_modifié"])
                        atn_specific_metrics["wai_sr_scores"].append(score)
                    except ValueError:
                        pass
                
                if data.get("Taux_adhésion"):
                    adherence = data["Taux_adhésion"]
                    atn_specific_metrics["adherence_rates"].append(adherence)
                
                if data.get("Confiance_algorithmique"):
                    trust = data["Confiance_algorithmique"]
                    atn_specific_metrics["algorithmic_trust"].append(trust)
                
                if data.get("Acceptabilité_patients"):
                    accept = data["Acceptabilité_patients"]
                    atn_specific_metrics["acceptability_scores"].append(accept)
                
                # Types d'IA
                if data.get("Type_IA"):
                    ai_type = data["Type_IA"]
                    ai_types_distribution[ai_type] = ai_types_distribution.get(ai_type, 0) + 1
                
                # Plateformes
                if data.get("Plateforme"):
                    platforms_used.add(data["Plateforme"])
                
                # Considérations éthiques
                if data.get("Considération_éthique"):
                    ethical_considerations.append(data["Considération_éthique"])
                
                # Conformité réglementaire
                if data.get("RGPD_conformité") and "oui" in data["RGPD_conformité"].lower():
                    regulatory_mentions["gdpr"] += 1
                
                if data.get("AI_Act_risque"):
                    regulatory_mentions["ai_act"] += 1
                
            except (json.JSONDecodeError, ValueError) as e:
                logger.warning(f"Erreur parsing extraction: {e}")
                continue
        
        # Calculs des métriques agrégées
        analysis_result = {
            "total_studies": total_studies,
            "atn_metrics": {
                "empathy_analysis": {
                    "mean_ai_empathy": np.mean(atn_specific_metrics["empathy_scores_ai"]) if atn_specific_metrics["empathy_scores_ai"] else None,
                    "mean_human_empathy": np.mean(atn_specific_metrics["empathy_scores_human"]) if atn_specific_metrics["empathy_scores_human"] else None,
                    "empathy_comparison": len(atn_specific_metrics["empathy_scores_ai"]) > 0 and len(atn_specific_metrics["empathy_scores_human"]) > 0,
                    "studies_with_empathy": len(atn_specific_metrics["empathy_scores_ai"])
                },
                "alliance_metrics": {
                    "mean_wai_sr": np.mean(atn_specific_metrics["wai_sr_scores"]) if atn_specific_metrics["wai_sr_scores"] else None,
                    "studies_with_wai": len(atn_specific_metrics["wai_sr_scores"])
                },
                "adherence_trust": {
                    "adherence_rates": atn_specific_metrics["adherence_rates"],
                    "algorithmic_trust": atn_specific_metrics["algorithmic_trust"],
                    "acceptability": atn_specific_metrics["acceptability_scores"]
                }
            },
            "technology_analysis": {
                "ai_types_distribution": ai_types_distribution,
                "platforms_used": list(platforms_used),
                "most_common_ai_type": max(ai_types_distribution.items(), key=lambda x: x[1])[0] if ai_types_distribution else None
            },
            "ethical_regulatory": {
                "ethical_considerations_count": len(ethical_considerations),
                "gdpr_mentions": regulatory_mentions["gdpr"],
                "ai_act_mentions": regulatory_mentions["ai_act"],
                "regulatory_compliance_rate": (regulatory_mentions["gdpr"] / total_studies * 100) if total_studies > 0 else 0
            }
        }
        
        # Générer le graphique de distribution des types d'IA
        if ai_types_distribution:
            try:
                project_dir = PROJECTS_DIR / project_id
                project_dir.mkdir(exist_ok=True)
                plot_path = str(project_dir / 'atn_ai_types_distribution.png')
                
                fig, ax = plt.subplots(figsize=(10, 6))
                ai_types = list(ai_types_distribution.keys())
                counts = list(ai_types_distribution.values())
                
                bars = ax.bar(ai_types, counts, color=['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336'][:len(ai_types)])
                ax.set_xlabel('Types d\'IA')
                ax.set_ylabel('Nombre d\'études')
                ax.set_title('Distribution des Types d\'IA dans les Études ATN')
                ax.tick_params(axis='x', rotation=45)
                
                # Ajouter les valeurs sur les barres
                for bar in bars:
                    height = bar.get_height()
                    ax.text(bar.get_x() + bar.get_width()/2., height,
                           f'{int(height)}', ha='center', va='bottom')
                
                plt.tight_layout()
                plt.savefig(plot_path, bbox_inches='tight', dpi=300)
                plt.close(fig)
                
                analysis_result["plot_path"] = plot_path
                
            except Exception as e:
                logger.warning(f"Erreur génération graphique: {e}")
        
        update_project_status(project_id, 'completed', analysis_result=analysis_result)
        send_project_notification(project_id, 'atn_analysis_completed', 
                                'Analyse ATN multipartie prenante terminée.')
        
    except Exception as e:
        logger.error(f"Erreur run_atn_stakeholder_analysis_task: {e}", exc_info=True)
        update_project_status(project_id, 'failed')
        send_project_notification(project_id, 'analysis_failed', f'Erreur: {e}')
    finally:
        session.close()

def run_atn_score_task(project_id: str):
    """Calcule des scores ATN à partir des extractions JSON."""
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
                
                # Calcul ATN simulé basé sur des mots-clés
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
        
        # Créer le graphique
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

# ================================================================
# === ANALYSE DU RISQUE DE BIAIS (RoB)
# ================================================================

def run_risk_of_bias_task(project_id: str, article_id: str):
    """
    Tâche pour évaluer le risque de biais d'un article en utilisant l'IA.
    Ceci est une version simplifiée inspirée de RoB 2.
    """
    logger.info(f"⚖️ Analyse RoB pour article {article_id} dans projet {project_id}")
    session = Session()
    try:
        # 1. Récupérer le texte intégral du PDF
        pdf_path = PROJECTS_DIR / project_id / f"{sanitize_filename(article_id)}.pdf"
        if not pdf_path.exists():
            send_project_notification(project_id, 'rob_failed', f"PDF non trouvé pour {article_id}.")
            return

        text_content = extract_text_from_pdf(str(pdf_path))
        if not text_content or len(text_content) < 500:
            send_project_notification(project_id, 'rob_failed', f"Contenu insuffisant dans le PDF pour {article_id}.")
            return

        # 2. Créer le prompt pour l'IA
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

        # 3. Appeler l'IA
        rob_data = call_ollama_api(prompt, model="llama3.1:8b", output_format="json")

        if not rob_data or not isinstance(rob_data, dict):
            raise ValueError("La réponse de l'IA pour l'analyse RoB est invalide.")

        # 4. Sauvegarder les résultats
        rob_data['id'] = str(uuid.uuid4())
        rob_data['project_id'] = project_id
        rob_data['article_id'] = article_id
        rob_data['created_at'] = datetime.now().isoformat()

        session.execute(text("""
            INSERT INTO risk_of_bias (id, project_id, article_id, domain_1_bias, domain_1_justification, domain_2_bias, domain_2_justification, overall_bias, overall_justification, created_at)
            VALUES (:id, :project_id, :article_id, :domain_1_bias, :domain_1_justification, :domain_2_bias, :domain_2_justification, :overall_bias, :overall_justification, :created_at)
            ON CONFLICT (project_id, article_id) DO UPDATE SET
                domain_1_bias = EXCLUDED.domain_1_bias, domain_1_justification = EXCLUDED.domain_1_justification,
                domain_2_bias = EXCLUDED.domain_2_bias, domain_2_justification = EXCLUDED.domain_2_justification,
                overall_bias = EXCLUDED.overall_bias, overall_justification = EXCLUDED.overall_justification;
        """), rob_data)
        session.commit()

        send_project_notification(project_id, 'rob_completed', f"Analyse RoB terminée pour {article_id}.")

    except Exception as e:
        session.rollback()
        logger.error(f"Erreur dans run_risk_of_bias_task pour {article_id}: {e}", exc_info=True)
        send_project_notification(project_id, 'rob_failed', f"Erreur d'analyse RoB pour {article_id}: {e}")
    finally:
        session.close()

# ================================================================
# === TÂCHE POUR AJOUT MANUEL D'ARTICLES (ASYNCHRONE)
# ================================================================

def add_manual_articles_task(project_id: str, identifiers: list):
    """
    Tâche d'arrière-plan pour ajouter des articles manuellement.
    """
    logger.info(f"📝 Ajout manuel d'articles pour le projet {project_id}")
    session = Session()
    try:
        if not identifiers:
            logger.warning(f"Aucun identifiant fourni pour le projet {project_id}.")
            return

        added = 0
        for article_id in identifiers:
            try:
                # Récupérer des métadonnées minimales (fallback si inconnu)
                details = fetch_article_details(article_id)
                exists = session.execute(
                    text("SELECT 1 FROM search_results WHERE project_id = :pid AND article_id = :aid"),
                    {"pid": project_id, "aid": details.get('id') or article_id}
                ).fetchone()
                if exists:
                    continue

                session.execute(text("""
                INSERT INTO search_results (
                    id, project_id, article_id, title, abstract, authors,
                    publication_date, journal, doi, url, database_source, created_at
                ) VALUES (
                    :id, :pid, :aid, :title, :abstract, :authors,
                    :pub_date, :journal, :doi, :url, :src, :ts
                )
                """), {
                    "id": str(uuid.uuid4()),
                    "pid": project_id,
                    "aid": details.get('id') or article_id,
                    "title": details.get('title', '') or f"Article {article_id}",
                    "abstract": details.get('abstract', '') or '',
                    "authors": details.get('authors', '') or '',
                    "pub_date": details.get('publication_date', '') or '',
                    "journal": details.get('journal', '') or '',
                    "doi": details.get('doi', '') or '',
                    "url": details.get('url', '') or '',
                    "src": details.get('database_source', 'manual'),
                    "ts": datetime.now().isoformat()
                })
                
                time.sleep(0.5)  # Pour ne pas surcharger les APIs externes
                added += 1
                
            except Exception as e:
                logger.warning(f"Ajout manuel ignoré pour {article_id}: {e}")
                continue
        
        session.commit()

        # Mettre à jour le compteur
        session.execute(text("""
        UPDATE projects SET pmids_count = (
            SELECT COUNT(*) FROM search_results WHERE project_id = :pid
        ), updated_at = :ts WHERE id = :pid
        """), {"pid": project_id, "ts": datetime.now().isoformat()})
        session.commit()

        send_project_notification(project_id, 'import_completed',
                                  f'Ajout manuel terminé: {added} article(s) ajouté(s).')
        logger.info(f"✅ Ajout manuel terminé pour le projet {project_id}. {added} articles ajoutés.")

    except Exception as e:
        session.rollback()
        logger.error(f"Erreur critique dans add_manual_articles_task pour le projet {project_id}: {e}", exc_info=True)
        send_project_notification(project_id, 'import_failed', f'Erreur lors de l\'ajout manuel: {e}')
    finally:
        session.close()
