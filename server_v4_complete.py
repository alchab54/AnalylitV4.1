# ================================================================
# AnalyLit V4.1 - Serveur Flask (Finalisé et 100% PostgreSQL/SQLAlchemy)
# ================================================================
import os
import uuid
import json
import logging
import io
import zipfile
import pandas as pd
from pathlib import Path
from datetime import datetime
from flask import Flask, jsonify, request, Blueprint, send_from_directory, Response
from flask_cors import CORS
from rq import Queue
import redis
from flask_socketio import SocketIO
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, scoped_session

from config_v4 import get_config
from tasks_v4_complete import (
    multi_database_search_task,
    process_single_article_task,
    run_synthesis_task,
    run_discussion_generation_task,
    run_knowledge_graph_task,
    run_prisma_flow_task,
    run_meta_analysis_task,
    run_descriptive_stats_task,
    pull_ollama_model_task,
    run_atn_score_task,
    import_pdfs_from_zotero_task,
    index_project_pdfs_task,
    answer_chat_question_task,
    fetch_online_pdf_task,
    db_manager,
    fetch_article_details,
    sanitize_filename,
    import_from_zotero_file_task,
    calculate_kappa_task,
    send_project_notification
)

# --- Configuration ---
config = get_config()
logging.basicConfig(level=getattr(logging, config.LOG_LEVEL))
logger = logging.getLogger(__name__)

# --- Base de Données (SQLAlchemy Uniquement) ---
engine = create_engine(config.DATABASE_URL, pool_pre_ping=True)
SessionFactory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Session = scoped_session(SessionFactory)

# --- Initialisation de l'application ---
app = Flask(__name__, static_folder='web', static_url_path='/')
api_bp = Blueprint('api', __name__, url_prefix='/api')
CORS(app, resources={r"/api/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*", message_queue=config.REDIS_URL, async_mode='gevent', path='/socket.io/')

# --- Connexions Redis et Queues RQ ---
redis_conn = redis.from_url(config.REDIS_URL)
processing_queue = Queue('analylit_processing_v4', connection=redis_conn)
synthesis_queue = Queue('analylit_synthesis_v4', connection=redis_conn)
analysis_queue = Queue('analylit_analysis_v4', connection=redis_conn)
background_queue = Queue('analylit_background_v4', connection=redis_conn)

# --- Dossiers projets ---
PROJECTS_DIR = Path(config.PROJECTS_DIR)
PROJECTS_DIR.mkdir(parents=True, exist_ok=True)

# ================================================================
# === 1. INITIALISATION DE LA BASE DE DONNÉES
# ================================================================
def init_db():
    """Initialise ou met à jour le schéma de la base PostgreSQL via SQLAlchemy."""
    with engine.begin() as conn:
        try:
            # Tables
            conn.execute(text("""
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                status TEXT DEFAULT 'pending',
                profile_used TEXT,
                job_id TEXT,
                created_at TEXT,
                updated_at TEXT,
                synthesis_result TEXT,
                discussion_draft TEXT,
                knowledge_graph TEXT,
                prisma_flow_path TEXT,
                analysis_mode TEXT DEFAULT 'screening',
                analysis_result TEXT,
                analysis_plot_path TEXT,
                pmids_count INTEGER DEFAULT 0,
                processed_count INTEGER DEFAULT 0,
                total_processing_time DOUBLE PRECISION DEFAULT 0,
                indexed_at TEXT,
                search_query TEXT,
                databases_used TEXT,
                inter_rater_reliability TEXT
            )
            """))
            conn.execute(text("""
            CREATE TABLE IF NOT EXISTS search_results (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                article_id TEXT NOT NULL,
                title TEXT,
                abstract TEXT,
                authors TEXT,
                publication_date TEXT,
                journal TEXT,
                doi TEXT,
                url TEXT,
                database_source TEXT NOT NULL,
                created_at TEXT,
                FOREIGN KEY (project_id) REFERENCES projects(id),
                UNIQUE(project_id, article_id)
            )
            """))
            conn.execute(text("""
            CREATE TABLE IF NOT EXISTS extractions (
                id TEXT PRIMARY KEY,
                project_id TEXT,
                pmid TEXT,
                title TEXT,
                validation_score DOUBLE PRECISION,
                created_at TEXT,
                extracted_data TEXT,
                relevance_score DOUBLE PRECISION DEFAULT 0,
                relevance_justification TEXT,
                user_validation_status TEXT,
                analysis_source TEXT,
                validations TEXT,
                FOREIGN KEY (project_id) REFERENCES projects(id)
            )
            """))
            conn.execute(text("""
            CREATE TABLE IF NOT EXISTS processing_log (
                id SERIAL PRIMARY KEY,
                project_id TEXT,
                pmid TEXT,
                status TEXT,
                details TEXT,
                "timestamp" TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id)
            )
            """))
            conn.execute(text("""
            CREATE TABLE IF NOT EXISTS analysis_profiles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                is_custom BOOLEAN DEFAULT TRUE,
                preprocess_model TEXT NOT NULL,
                extract_model TEXT NOT NULL,
                synthesis_model TEXT NOT NULL
            )
            """))
            conn.execute(text("""
            CREATE TABLE IF NOT EXISTS prompts (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                template TEXT NOT NULL
            )
            """))
            conn.execute(text("""
            CREATE TABLE IF NOT EXISTS extraction_grids (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                name TEXT NOT NULL,
                fields TEXT NOT NULL,
                created_at TEXT,
                FOREIGN KEY (project_id) REFERENCES projects(id)
            )
            """))
            conn.execute(text("""
            CREATE TABLE IF NOT EXISTS chat_messages (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                sources TEXT,
                timestamp TEXT,
                FOREIGN KEY (project_id) REFERENCES projects(id)
            )
            """))
            logger.info("✅ Tables créées ou déjà existantes.")

            # Migrations idempotentes
            conn.execute(text("ALTER TABLE projects ADD COLUMN IF NOT EXISTS inter_rater_reliability TEXT"))
            conn.execute(text("ALTER TABLE extractions ADD COLUMN IF NOT EXISTS validations TEXT"))
            logger.info("✅ Migrations de colonnes appliquées.")

            # Seeding profils
            if conn.execute(text("SELECT COUNT(*) FROM analysis_profiles")).scalar_one() == 0:
                default_profiles = [
                    {"id": "fast", "name": "Rapide", "is_custom": False, "preprocess_model": "gemma:2b", "extract_model": "phi3:mini", "synthesis_model": "llama3.1:8b"},
                    {"id": "standard", "name": "Standard", "is_custom": False, "preprocess_model": "phi3:mini", "extract_model": "llama3.1:8b", "synthesis_model": "llama3.1:8b"},
                    {"id": "deep", "name": "Approfondi", "is_custom": False, "preprocess_model": "llama3.1:8b", "extract_model": "mixtral:8x7b", "synthesis_model": "llama3.1:70b"},
                ]
                stmt = text("""
                INSERT INTO analysis_profiles (id, name, is_custom, preprocess_model, extract_model, synthesis_model)
                VALUES (:id, :name, :is_custom, :preprocess_model, :extract_model, :synthesis_model)
                """)
                for p in default_profiles:
                    conn.execute(stmt, p)
                logger.info("✅ Profils par défaut insérés.")

            # Seeding prompts (si vide)
            if conn.execute(text("SELECT COUNT(*) FROM prompts")).scalar_one() == 0:
                default_prompts = [
                    {
                        "name": "screening_prompt",
                        "description": "Prompt pour la pré-sélection des articles.",
                        "template": (
                            "En tant qu'assistant de recherche spécialisé, analysez cet article et déterminez sa pertinence.\n\n"
                            "Titre: {title}\n\nRésumé: {abstract}\n\nSource: {database_source}\n\n"
                            "Répondez UNIQUEMENT en JSON: {\"relevance_score\": 0-10, \"decision\": \"À inclure\"|\"À exclure\", \"justification\": \"...\"}"
                        )
                    },
                    {
                        "name": "full_extraction_prompt",
                        "description": "Prompt pour l'extraction détaillée (grille).",
                        "template": (
                            "ROLE: Assistant expert. Répondez UNIQUEMENT avec un JSON valide.\n"
                            "TEXTE À ANALYSER:\n---\n{text}\n---\nSOURCE: {database_source}\n"
                            "{\n\"type_etude\":\"...\",\"population\":\"...\",\"intervention\":\"...\",\"resultats_principaux\":\"...\",\"limites\":\"...\",\"methodologie\":\"...\"\n}"
                        )
                    },
                    {
                        "name": "synthesis_prompt",
                        "description": "Prompt pour la synthèse.",
                        "template": (
                            "Contexte: {project_description}\n"
                            "Résumés:\n---\n{data_for_prompt}\n---\n"
                            "Réponds en JSON: {\"relevance_evaluation\":[],\"main_themes\":[],\"key_findings\":[],\"methodologies_used\":[],\"synthesis_summary\":\"\",\"research_gaps\":[]}"
                        )
                    }
                ]
                stmt = text("INSERT INTO prompts (name, description, template) VALUES (:name, :description, :template)")
                for pr in default_prompts:
                    conn.execute(stmt, pr)
                logger.info("✅ Prompts par défaut insérés.")

        except Exception as e:
            logger.error(f"❌ Erreur initialisation/migration DB: {e}", exc_info=True)
            raise

# ================================================================
# === 2. ROUTES API
# ================================================================
@api_bp.route('/health', methods=['GET'])
def health_check():
    db_status, redis_status = "error", "error"
    try:
        redis_status = "connected" if redis_conn.ping() else "disconnected"
    except Exception:
        pass
    session = Session()
    try:
        session.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        logger.error(f"Erreur health check DB: {e}")
    finally:
        session.close()
    return jsonify({"status": "ok", "version": config.ANALYLIT_VERSION, "timestamp": datetime.now().isoformat(),
                    "services": {"database": db_status, "redis": redis_status, "ollama": "unknown"}})

# --- Bases disponibles (via db_manager des tasks) ---
@api_bp.route('/databases', methods=['GET'])
def get_available_databases():
    try:
        return jsonify(db_manager.get_available_databases())
    except Exception as e:
        logger.error(f"Erreur get_available_databases: {e}")
        return jsonify([]), 200

# --- CRUD Projets ---
@api_bp.route('/projects', methods=['GET', 'POST'])
def handle_projects():
    session = Session()
    try:
        if request.method == 'GET':
            rows = session.execute(text("SELECT * FROM projects ORDER BY updated_at DESC")).mappings().all()
            return jsonify([dict(r) for r in rows])
        if request.method == 'POST':
            data = request.get_json(force=True)
            now = datetime.now().isoformat()
            project = {
                "id": str(uuid.uuid4()),
                "name": data['name'],
                "description": data.get('description', ''),
                "created_at": now,
                "updated_at": now,
                "analysis_mode": data.get('mode', 'screening')
            }
            session.execute(text("""
                INSERT INTO projects (id, name, description, created_at, updated_at, analysis_mode)
                VALUES (:id, :name, :description, :created_at, :updated_at, :analysis_mode)
            """), project)
            PROJECTS_DIR.joinpath(project['id']).mkdir(exist_ok=True)
            session.commit()
            return jsonify(project), 201
    except Exception as e:
        session.rollback()
        logger.error(f"Erreur handle_projects: {e}", exc_info=True)
        return jsonify({'error': 'Erreur interne'}), 500
    finally:
        session.close()

@api_bp.route('/projects/<project_id>', methods=['GET', 'DELETE'])
def handle_single_project(project_id):
    session = Session()
    try:
        if request.method == 'GET':
            row = session.execute(text("SELECT * FROM projects WHERE id = :id"), {"id": project_id}).mappings().fetchone()
            return (jsonify(dict(row)) if row else (jsonify({'error': 'Projet non trouvé'}), 404))
        if request.method == 'DELETE':
            session.execute(text("DELETE FROM search_results WHERE project_id = :pid"), {"pid": project_id})
            session.execute(text("DELETE FROM extractions WHERE project_id = :pid"), {"pid": project_id})
            session.execute(text("DELETE FROM processing_log WHERE project_id = :pid"), {"pid": project_id})
            session.execute(text("DELETE FROM extraction_grids WHERE project_id = :pid"), {"pid": project_id})
            session.execute(text("DELETE FROM chat_messages WHERE project_id = :pid"), {"pid": project_id})
            session.execute(text("DELETE FROM projects WHERE id = :pid"), {"pid": project_id})
            session.commit()
            return jsonify({'message': 'Projet supprimé'})
    except Exception as e:
        session.rollback()
        logger.error(f"Erreur handle_single_project: {e}", exc_info=True)
        return jsonify({'error': 'Erreur interne'}), 500
    finally:
        session.close()

# --- Recherche multi-bases ---
@api_bp.route('/search', methods=['POST'])
def search_multiple_databases():
    data = request.get_json(force=True)
    project_id, query = data.get('project_id'), data.get('query')
    databases = data.get('databases', ['pubmed'])
    max_results_per_db = data.get('max_results_per_db', 50)
    if not project_id or not query:
        return jsonify({'error': 'project_id et query requis'}), 400

    session = Session()
    try:
        session.execute(text("""
            UPDATE projects SET search_query = :q, databases_used = :dbs, status = 'searching', updated_at = :now
            WHERE id = :pid
        """), {"q": query, "dbs": json.dumps(databases), "now": datetime.now().isoformat(), "pid": project_id})
        session.commit()
    except Exception as e:
        session.rollback()
        logger.error(f"Erreur saving search params: {e}")
        return jsonify({'error': 'Erreur interne'}), 500
    finally:
        session.close()

    background_queue.enqueue(
        multi_database_search_task,
        project_id=project_id,
        query=query,
        databases=databases,
        max_results_per_db=max_results_per_db,
        job_timeout='30m'
    )
    return jsonify({'message': f'Recherche lancée dans {len(databases)} base(s)'}), 202

@api_bp.route('/projects/<project_id>/search-results', methods=['GET'])
def get_project_search_results(project_id):
    session = Session()
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        database_filter = request.args.get('database')
        offset = (page - 1) * per_page

        base_query = "FROM search_results WHERE project_id = :pid"
        params = {"pid": project_id}
        if database_filter:
            base_query += " AND database_source = :db"
            params["db"] = database_filter

        total = session.execute(text(f"SELECT COUNT(*) {base_query}"), params).scalar_one()
        rows = session.execute(text(f"""
            SELECT * {base_query}
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
        """), {**params, "limit": per_page, "offset": offset}).mappings().all()

        return jsonify({
            "results": [dict(r) for r in rows],
            "total": total,
            "page": page,
            "per_page": per_page,
            "has_next": (offset + per_page) < total,
            "has_prev": page > 1
        })
    finally:
        session.close()

@api_bp.route('/projects/<project_id>/search-stats', methods=['GET'])
def get_project_search_stats(project_id):
    session = Session()
    try:
        stats = session.execute(text("""
            SELECT database_source, COUNT(*) as count
            FROM search_results WHERE project_id = :pid
            GROUP BY database_source
        """), {"pid": project_id}).mappings().all()
        total = session.execute(text("SELECT COUNT(*) FROM search_results WHERE project_id = :pid"), {"pid": project_id}).scalar_one()
        return jsonify({
            "total_results": total,
            "results_by_database": {r["database_source"]: r["count"] for r in stats}
        })
    finally:
        session.close()

# --- Files/Uploads/Indexation ---
@api_bp.route('/projects/<project_id>/upload-pdfs-bulk', methods=['POST'])
def upload_pdfs_bulk(project_id):
    if 'files' not in request.files:
        return jsonify({'error': 'Aucun fichier fourni'}), 400
    files = request.files.getlist('files')
    project_dir = PROJECTS_DIR / project_id
    project_dir.mkdir(exist_ok=True)
    successful, failed = [], []
    for file in files:
        if file and file.filename:
            filename_base = Path(file.filename).stem
            safe_filename = sanitize_filename(filename_base) + ".pdf"
            pdf_path = project_dir / safe_filename
            try:
                file.save(str(pdf_path))
                successful.append(safe_filename)
            except Exception as e:
                failed.append(f"{safe_filename}: {str(e)}")

    send_project_notification(project_id, 'pdf_upload_completed', f"{len(successful)} PDF importés, {len(failed)} échecs.", {'successful': successful, 'failed': failed})
    return jsonify({'successful': successful, 'failed': failed}), 200

@api_bp.route('/projects/<project_id>/files', methods=['GET'])
def list_project_files(project_id):
    project_dir = PROJECTS_DIR / project_id
    if not project_dir.is_dir():
        return jsonify([])
    pdf_files = [{"filename": f.name} for f in project_dir.glob("*.pdf")]
    return jsonify(pdf_files)

@api_bp.route('/projects/<project_id>/files/<filename>', methods=['GET'])
def get_project_file(project_id, filename):
    project_dir = PROJECTS_DIR / project_id
    if ".." in filename or filename.startswith("/"):
        return jsonify({"error": "Chemin de fichier invalide."}), 400
    return send_from_directory(str(project_dir), filename)

@api_bp.route('/projects/<project_id>/index', methods=['POST'])
def run_indexing(project_id):
    job = background_queue.enqueue(index_project_pdfs_task, project_id=project_id, job_timeout='1h')
    session = Session()
    try:
        session.execute(text("UPDATE projects SET status = 'indexing', updated_at = :t WHERE id = :pid"),
                        {"t": datetime.now().isoformat(), "pid": project_id})
        session.commit()
    finally:
        session.close()
    return jsonify({'message': "Indexation lancée.", 'job_id': job.id}), 202

# --- Zotero / Fetch en ligne ---
@api_bp.route('/settings/zotero', methods=['POST'])
def save_zotero_settings():
    data = request.get_json(force=True)
    zotero_config = {'user_id': data.get('userId'), 'api_key': data.get('apiKey')}
    config_path = PROJECTS_DIR / 'zotero_config.json'
    with open(config_path, 'w') as f:
        json.dump(zotero_config, f)
    return jsonify({'message': 'Paramètres Zotero sauvegardés.'})

@api_bp.route('/settings/zotero', methods=['GET'])
def get_zotero_settings():
    config_path = PROJECTS_DIR / 'zotero_config.json'
    if config_path.exists():
        with open(config_path, 'r') as f:
            zotero_config = json.load(f)
        return jsonify({'userId': zotero_config.get('user_id', ''), 'hasApiKey': bool(zotero_config.get('api_key'))})
    return jsonify({'userId': '', 'hasApiKey': False})

def add_manual_articles_to_project(project_id, article_ids):
    processed_ids = []
    session = Session()
    try:
        for article_id in article_ids:
            if not article_id or not isinstance(article_id, str):
                continue
            exists = session.execute(text("""
                SELECT 1 FROM search_results WHERE project_id = :pid AND article_id = :aid
            """), {"pid": project_id, "aid": article_id}).fetchone()
            if exists:
                processed_ids.append(article_id)
                continue
            details = fetch_article_details(article_id)
            if details and details.get('title') != 'Erreur de récupération':
                session.execute(text("""
                    INSERT INTO search_results (id, project_id, article_id, title, abstract, database_source, created_at, url, doi, authors, journal, publication_date)
                    VALUES (:id, :pid, :aid, :title, :abstract, :db, :ts, :url, :doi, :authors, :journal, :pub)
                """), {
                    "id": str(uuid.uuid4()),
                    "pid": project_id,
                    "aid": article_id,
                    "title": details.get('title', 'Titre non trouvé'),
                    "abstract": details.get('abstract', ''),
                    "db": details.get('database_source', 'manual'),
                    "ts": datetime.now().isoformat(),
                    "url": details.get('url'),
                    "doi": details.get('doi'),
                    "authors": details.get('authors'),
                    "journal": details.get('journal'),
                    "publication_date": details.get('publication_date'),
                })
                processed_ids.append(article_id)
        total_articles = session.execute(text("SELECT COUNT(*) FROM search_results WHERE project_id = :pid"), {"pid": project_id}).scalar_one()
        session.execute(text("UPDATE projects SET pmids_count = :c WHERE id = :pid"), {"c": total_articles, "pid": project_id})
        session.commit()
        return processed_ids
    except Exception as e:
        session.rollback()
        logger.error(f"add_manual_articles_to_project error: {e}")
        return processed_ids
    finally:
        session.close()

@api_bp.route('/projects/<project_id>/import-zotero', methods=['POST'])
def import_from_zotero(project_id):
    data = request.get_json(force=True)
    manual_ids = data.get('articles', [])
    try:
        with open(PROJECTS_DIR / 'zotero_config.json', 'r') as f:
            zotero_config = json.load(f)
    except FileNotFoundError:
        return jsonify({'error': 'Veuillez configurer Zotero dans les paramètres.'}), 400

    article_ids_to_process = add_manual_articles_to_project(project_id, manual_ids)
    if not article_ids_to_process:
        return jsonify({'error': 'Aucun article valide à importer pour ce projet.'}), 400

    job = background_queue.enqueue(
        import_pdfs_from_zotero_task,
        project_id=project_id,
        pmids=article_ids_to_process,
        zotero_user_id=zotero_config.get('user_id'),
        zotero_api_key=zotero_config.get('api_key'),
        job_timeout='1h'
    )
    return jsonify({'message': f'Import Zotero lancé pour {len(article_ids_to_process)} articles.', 'job_id': job.id}), 202

@api_bp.route('/projects/<project_id>/import-zotero-file', methods=['POST'])
def import_from_zotero_file(project_id):
    if 'file' not in request.files:
        return jsonify({'error': 'Aucun fichier fourni'}), 400
    file = request.files['file']
    if not file.filename.endswith('.json'):
        return jsonify({'error': 'Veuillez fournir un fichier .json'}), 400
    try:
        file_content = file.stream.read().decode('utf-8')
        zotero_data = json.loads(file_content)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return jsonify({'error': 'Fichier JSON invalide ou mal encodé.'}), 400

    job = background_queue.enqueue(
        import_from_zotero_file_task,
        project_id=project_id,
        zotero_json_data=zotero_data,
        job_timeout='1h'
    )
    return jsonify({'message': f'Import fichier Zotero lancé pour {len(zotero_data)} items.', 'job_id': job.id}), 202

@api_bp.route('/projects/<project_id>/fetch-online-pdfs', methods=['POST'])
def fetch_online_pdfs(project_id):
    data = request.get_json(force=True)
    manual_ids = data.get('articles', [])
    article_ids_to_process = add_manual_articles_to_project(project_id, manual_ids)
    if not article_ids_to_process:
        return jsonify({'error': 'Aucun article valide à traiter pour ce projet.'}), 400
    job = background_queue.enqueue(
        fetch_online_pdf_task,
        project_id=project_id,
        article_ids=article_ids_to_process,
        job_timeout='1h'
    )
    return jsonify({'message': f'Recherche OA lancée pour {len(article_ids_to_process)} articles.', 'job_id': job.id}), 202

# --- Pipeline de traitement / analyses ---
@api_bp.route('/projects/<project_id>/run', methods=['POST'])
def run_project_pipeline(project_id):
    data = request.get_json(force=True)
    selected_articles = data.get('articles', [])
    profile_id = data.get('profile', 'standard')
    custom_grid_id = data.get('custom_grid_id')
    analysis_mode = data.get('analysis_mode', 'screening')
    if not selected_articles:
        return jsonify({'error': 'La liste d\'articles est requise.'}), 400

    session = Session()
    try:
        profile_row = session.execute(text("SELECT * FROM analysis_profiles WHERE id = :id"), {"id": profile_id}).mappings().fetchone()
        if not profile_row:
            return jsonify({'error': f"Profil invalide: '{profile_id}'"}), 400

        # Nettoyage et mise à jour projet
        session.execute(text("DELETE FROM extractions WHERE project_id = :pid"), {"pid": project_id})
        session.execute(text("DELETE FROM processing_log WHERE project_id = :pid"), {"pid": project_id})
        session.execute(text("""
            UPDATE projects SET
            status = 'processing', profile_used = :p, updated_at = :t, pmids_count = :n,
            processed_count = 0, total_processing_time = 0, analysis_mode = :am
            WHERE id = :pid
        """), {"p": profile_id, "t": datetime.now().isoformat(), "n": len(selected_articles), "am": analysis_mode, "pid": project_id})
        session.commit()

        profile = dict(profile_row)
        for article_id in selected_articles:
            processing_queue.enqueue(
                process_single_article_task,
                project_id=project_id,
                article_id=article_id,
                profile=profile,
                analysis_mode=analysis_mode,
                custom_grid_id=custom_grid_id,
                job_timeout=1800
            )
        return jsonify({"status": "processing"}), 202
    except Exception as e:
        session.rollback()
        logger.error(f"run_project_pipeline error: {e}")
        return jsonify({'error': 'Erreur interne'}), 500
    finally:
        session.close()

@api_bp.route('/projects/<project_id>/run-synthesis', methods=['POST'])
def run_synthesis_endpoint(project_id):
    data = request.get_json(force=True)
    profile_id = data.get('profile', 'standard')
    session = Session()
    try:
        profile_row = session.execute(text("SELECT * FROM analysis_profiles WHERE id = :id"), {"id": profile_id}).mappings().fetchone()
        if not profile_row:
            return jsonify({'error': f"Profil invalide: '{profile_id}'"}), 400
        profile_to_use = dict(profile_row)
        job = synthesis_queue.enqueue(run_synthesis_task, project_id=project_id, profile=profile_to_use, job_timeout=3600)
        session.execute(text("UPDATE projects SET status = 'synthesizing', job_id = :jid WHERE id = :pid"),
                        {"jid": job.id, "pid": project_id})
        session.commit()
        return jsonify({"status": "synthesizing", "message": "Synthèse lancée."}), 202
    finally:
        session.close()

# --- Extractions / Résultats / Export ---
@api_bp.route('/projects/<project_id>/extractions', methods=['GET'])
def get_project_extractions(project_id):
    session = Session()
    try:
        rows = session.execute(text("""
            SELECT
                e.id, e.pmid, e.title, e.relevance_score, e.relevance_justification,
                e.user_validation_status, e.extracted_data,
                s.abstract, s.url
            FROM extractions e
            LEFT JOIN search_results s
                ON e.project_id = s.project_id AND e.pmid = s.article_id
            WHERE e.project_id = :pid
            ORDER BY e.relevance_score DESC NULLS LAST
        """), {"pid": project_id}).mappings().all()
        return jsonify([dict(r) for r in rows])
    finally:
        session.close()

@api_bp.route('/projects/<project_id>/processing-log', methods=['GET'])
def get_project_processing_log(project_id):
    session = Session()
    try:
        rows = session.execute(text("""
            SELECT pmid, status, details, timestamp FROM processing_log
            WHERE project_id = :pid ORDER BY id DESC LIMIT 100
        """), {"pid": project_id}).mappings().all()
        return jsonify([dict(r) for r in rows])
    finally:
        session.close()

@api_bp.route('/projects/<project_id>/result', methods=['GET'])
def get_project_result(project_id):
    session = Session()
    try:
        row = session.execute(text("SELECT synthesis_result FROM projects WHERE id = :pid"), {"pid": project_id}).mappings().fetchone()
        if row and row["synthesis_result"]:
            try:
                return jsonify(json.loads(row["synthesis_result"]))
            except Exception:
                return jsonify({})
        return jsonify({})
    finally:
        session.close()

@api_bp.route('/projects/<project_id>/export', methods=['GET'])
def export_results_csv(project_id):
    session = Session()
    try:
        rows = session.execute(text("SELECT * FROM extractions WHERE project_id = :pid"), {"pid": project_id}).mappings().all()
        if not rows:
            return jsonify({"error": "Aucune donnée à exporter."}), 404

        records = []
        for ext in rows:
            base_record = {
                "pmid": ext["pmid"],
                "title": ext["title"],
                "relevance_score": ext["relevance_score"],
                "relevance_justification": ext["relevance_justification"],
                "user_validation_status": ext["user_validation_status"],
                "validation_score": ext["validation_score"],
                "created_at": ext["created_at"]
            }
            try:
                if ext["extracted_data"]:
                    data = json.loads(ext["extracted_data"])
                    if isinstance(data, dict):
                        for category, details in data.items():
                            if isinstance(details, dict):
                                for key, value in details.items():
                                    base_record[f"{category}_{key}"] = value
                            else:
                                base_record[category] = details
            except Exception:
                pass
            records.append(base_record)

        df = pd.DataFrame(records)
        csv_data = df.to_csv(index=False)
        return Response(csv_data, mimetype="text/csv",
                        headers={"Content-disposition": f"attachment; filename=export_{project_id}.csv"})
    finally:
        session.close()

@api_bp.route('/projects/<project_id>/export-all', methods=['GET'])
def export_all_data_zip(project_id):
    session = Session()
    try:
        project = session.execute(text("SELECT * FROM projects WHERE id = :pid"), {"pid": project_id}).mappings().fetchone()
        extractions = session.execute(text("SELECT * FROM extractions WHERE project_id = :pid"), {"pid": project_id}).mappings().all()
        search_results = session.execute(text("SELECT * FROM search_results WHERE project_id = :pid"), {"pid": project_id}).mappings().all()
        if not project:
            return jsonify({"error": "Projet non trouvé."}), 404

        memory_file = io.BytesIO()
        with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
            summary = f"""Rapport d'Exportation pour le Projet AnalyLit V4
-------------------------------------------------
ID du Projet: {project.get('id', 'N/A')}
Nom: {project.get('name', 'N/A')}
Description: {project.get('description', 'N/A')}
Date de création: {project.get('created_at', 'N/A')}
Dernière mise à jour: {project.get('updated_at', 'N/A')}
Statut: {project.get('status', 'N/A')}
Profil utilisé: {project.get('profile_used', 'N/A')}
Mode d'analyse: {project.get('analysis_mode', 'N/A')}
Nombre d'articles: {project.get('pmids_count', 0)}
Requête de recherche: {project.get('search_query', 'N/A')}
Bases de données utilisées: {project.get('databases_used', 'N/A')}
"""
            zf.writestr('summary.txt', summary)

            if search_results:
                zf.writestr('search_results.csv', pd.DataFrame(search_results).to_csv(index=False))
            if extractions:
                zf.writestr('extractions.csv', pd.DataFrame(extractions).to_csv(index=False))
            if project.get('synthesis_result'):
                zf.writestr('synthesis_result.json', project['synthesis_result'])
            if project.get('discussion_draft'):
                zf.writestr('discussion_draft.txt', project['discussion_draft'])
            if project.get('knowledge_graph'):
                zf.writestr('knowledge_graph.json', project['knowledge_graph'])
            if project.get('analysis_result'):
                zf.writestr('analysis_result_raw.json', project['analysis_result'])

        memory_file.seek(0)
        return Response(memory_file.read(), mimetype="application/zip",
                        headers={"Content-disposition": f"attachment; filename=analylit_export_{project_id}.zip"})
    finally:
        session.close()

# --- Mise à jour d'une extraction ---
@api_bp.route('/projects/<project_id>/extractions/<extraction_id>', methods=['PATCH'])
def update_extraction(project_id, extraction_id):
    data = request.get_json(force=True)
    fields, params = [], {}
    if 'extracted_data' in data:
        fields.append("extracted_data = :exd")
        params["exd"] = json.dumps(data['extracted_data'])
    if 'user_validation_status' in data:
        fields.append("user_validation_status = :uvs")
        params["uvs"] = data['user_validation_status']
    if not fields:
        return jsonify({'error': 'Rien à mettre à jour'}), 400
    params.update({"id": extraction_id, "pid": project_id})
    session = Session()
    try:
        session.execute(text(f"""
            UPDATE extractions SET {', '.join(fields)} WHERE id = :id AND project_id = :pid
        """), params)
        session.commit()
        return jsonify({'message': 'Extraction mise à jour'}), 200
    finally:
        session.close()

# --- Suppression d'articles ---
@api_bp.route('/projects/<project_id>/delete-articles', methods=['POST'])
def delete_articles(project_id):
    data = request.get_json(force=True)
    article_ids = data.get('article_ids', [])
    if not article_ids:
        return jsonify({'error': 'Aucun ID d\'article fourni'}), 400

    session = Session()
    try:
        # Suppressions en base
        session.execute(text("""
            DELETE FROM extractions
            WHERE project_id = :pid AND pmid = ANY(:ids)
        """), {"pid": project_id, "ids": article_ids})

        session.execute(text("""
            DELETE FROM search_results
            WHERE project_id = :pid AND article_id = ANY(:ids)
        """), {"pid": project_id, "ids": article_ids})

        # Recompter le nombre d’articles restants et mettre à jour projects.pmids_count
        remaining = session.execute(text("""
            SELECT COUNT(*) FROM search_results WHERE project_id = :pid
        """), {"pid": project_id}).scalar_one()

        session.execute(text("""
            UPDATE projects SET pmids_count = :c, updated_at = :t WHERE id = :pid
        """), {"c": remaining, "t": datetime.now().isoformat(), "pid": project_id})

        session.commit()

        # Suppression des fichiers PDF associés (système de fichiers)
        deleted_files = 0
        project_dir = PROJECTS_DIR / project_id
        for article_id in article_ids:
            pdf_path = project_dir / (sanitize_filename(article_id) + ".pdf")
            if pdf_path.exists():
                try:
                    pdf_path.unlink()
                    deleted_files += 1
                except Exception:
                    pass

        return jsonify({
            'message': f'{len(article_ids)} article(s) supprimé(s).',
            'files_deleted': deleted_files,
            'remaining_articles': remaining
        }), 200

    except Exception as e:
        session.rollback()
        logger.error(f"delete_articles error: {e}")
        return jsonify({'error': 'Erreur interne'}), 500
    finally:
        session.close()

# --- Validation inter-évaluateurs ---
@api_bp.route('/projects/<project_id>/export-validations', methods=['GET'])
def export_validations(project_id):
    session = Session()
    try:
        rows = session.execute(text("""
            SELECT pmid, title, validations, relevance_score
            FROM extractions
            WHERE project_id = :pid AND validations IS NOT NULL
        """), {"pid": project_id}).mappings().all()

        records = []
        for r in rows:
            try:
                v = json.loads(r["validations"])
                if "evaluator_1" in v:
                    records.append({
                        "article_id": r["pmid"],
                        "title": r["title"],
                        "decision": v["evaluator_1"],
                        "ia_score": r["relevance_score"],
                    })
            except Exception:
                continue

        if not records:
            return jsonify({"message": "Aucune validation (évaluateur 1) à exporter."}), 404

        df = pd.DataFrame(records)
        csv_data = df.to_csv(index=False, encoding='utf-8')
        return Response(csv_data, mimetype="text/csv",
                        headers={"Content-disposition": f"attachment; filename=validations_eval1_{project_id}.csv"})
    except Exception as e:
        logger.error(f"Erreur d'export validations: {e}")
        return jsonify({"error": "Erreur interne du serveur"}), 500
    finally:
        session.close()

@api_bp.route('/projects/<project_id>/import-validations', methods=['POST'])
def import_validations(project_id):
    if 'file' not in request.files:
        return jsonify({"error": "Aucun fichier fourni"}), 400
    file = request.files['file']
    session = Session()
    try:
        df = pd.read_csv(file.stream)
        normalized = {str(c).strip().lower() for c in df.columns}
        required = {"article_id", "decision"}
        if not required.issubset(normalized):
            return jsonify({"error": f"Le fichier CSV doit contenir les colonnes {sorted(required)}"}), 400

        updated = 0
        for _, row in df.iterrows():
            article_id = str(row.get('article_id', '')).strip()
            decision = str(row.get('decision', '')).strip().lower()
            if not article_id or decision not in ("include", "exclude"):
                continue
            ext = session.execute(text("""
                SELECT id, validations FROM extractions WHERE project_id = :pid AND pmid = :pmid
            """), {"pid": project_id, "pmid": article_id}).mappings().fetchone()
            if not ext:
                continue
            v = {}
            try:
                v = json.loads(ext["validations"] or '{}')
            except Exception:
                v = {}
            v["evaluator_2"] = decision
            session.execute(text("UPDATE extractions SET validations = :val WHERE id = :id"),
                            {"val": json.dumps(v), "id": ext["id"]})
            updated += 1
        session.commit()
        return jsonify({"message": f"{updated} validations importées pour l'évaluateur 2."}), 200
    except Exception as e:
        session.rollback()
        logger.error(f"Erreur import validations: {e}")
        return jsonify({"error": "Erreur interne ou format de fichier invalide"}), 500
    finally:
        session.close()

@api_bp.route('/projects/<project_id>/calculate-kappa', methods=['POST'])
def calculate_kappa(project_id):
    job = analysis_queue.enqueue(calculate_kappa_task, project_id=project_id)
    return jsonify({"message": "Calcul du Kappa lancé.", "job_id": job.id}), 202

@api_bp.route('/projects/<project_id>/inter-rater-stats', methods=['GET'])
def get_inter_rater_stats(project_id):
    session = Session()
    try:
        row = session.execute(text("SELECT inter_rater_reliability FROM projects WHERE id = :pid"),
                              {"pid": project_id}).mappings().fetchone()
        return jsonify({"kappa_result": row["inter_rater_reliability"] if row else "Non calculé"})
    except Exception as e:
        logger.error(f"Erreur inter-rater stats: {e}")
        return jsonify({"error": "Erreur interne du serveur"}), 500
    finally:
        session.close()

# --- Chat ---
@api_bp.route('/projects/<project_id>/chat', methods=['POST'])
def handle_chat_message(project_id):
    data = request.get_json(force=True)
    question = data.get('question')
    profile_id = data.get('profile', 'standard')
    session = Session()
    try:
        profile_row = session.execute(text("SELECT * FROM analysis_profiles WHERE id = :id"), {"id": profile_id}).mappings().fetchone()
        if not profile_row:
            return jsonify({'error': 'Profil invalide'}), 400
        profile = dict(profile_row)
    finally:
        session.close()

    try:
        result = answer_chat_question_task(project_id, question, profile)
        return jsonify(result)
    except Exception as e:
        logger.error(f"Erreur chat pour {project_id}: {e}")
        return jsonify({'error': 'Erreur lors de la génération de la réponse.'}), 500

@api_bp.route('/projects/<project_id>/chat-history', methods=['GET'])
def get_chat_history(project_id):
    session = Session()
    try:
        rows = session.execute(text("""
            SELECT role, content, sources, timestamp FROM chat_messages
            WHERE project_id = :pid ORDER BY timestamp ASC
        """), {"pid": project_id}).mappings().all()
        return jsonify([dict(r) for r in rows])
    finally:
        session.close()

# --- Ollama ---
@api_bp.route('/ollama/models', methods=['GET'])
def get_ollama_local_models():
    try:
        import requests
        response = requests.get(f"{config.OLLAMA_BASE_URL}/api/tags", timeout=30)
        response.raise_for_status()
        return jsonify(response.json().get('models', []))
    except Exception as e:
        logger.error(f"Erreur de communication avec Ollama: {e}")
        return jsonify({'error': 'Impossible de contacter le service Ollama.'}), 503

@api_bp.route('/ollama/pull', methods=['POST'])
def pull_ollama_model():
    data = request.get_json(force=True)
    model_name = data.get('model_name')
    if not model_name:
        return jsonify({'error': 'Le nom du modèle est requis.'}), 400
    job = background_queue.enqueue(pull_ollama_model_task, model_name, job_timeout='1h')
    return jsonify({'message': f'Téléchargement du modèle "{model_name}" lancé.', 'job_id': job.id}), 202

# --- Prompts ---
@api_bp.route('/prompts', methods=['GET'])
def get_prompts():
    session = Session()
    try:
        rows = session.execute(text("SELECT id, name, description, template FROM prompts")).mappings().all()
        return jsonify([dict(r) for r in rows])
    finally:
        session.close()

@api_bp.route('/prompts/<int:prompt_id>', methods=['PUT'])
def update_prompt(prompt_id):
    data = request.get_json(force=True)
    template = data.get('template')
    session = Session()
    try:
        session.execute(text("UPDATE prompts SET template = :t WHERE id = :id"), {"t": template, "id": prompt_id})
        session.commit()
        return jsonify({'message': 'Prompt mis à jour.'})
    finally:
        session.close()

# --- Profils d'analyse ---
@api_bp.route('/analysis-profiles', methods=['GET'])
def get_analysis_profiles():
    session = Session()
    try:
        rows = session.execute(text("SELECT * FROM analysis_profiles ORDER BY is_custom, name")).mappings().all()
        return jsonify([dict(r) for r in rows])
    finally:
        session.close()

@api_bp.route('/analysis-profiles', methods=['POST'])
def create_analysis_profile():
    data = request.get_json(force=True)
    required_fields = ['name', 'preprocess_model', 'extract_model', 'synthesis_model']
    if not all(field in data for field in required_fields):
        return jsonify({'error': 'Tous les champs sont requis'}), 400
    profile_id = str(uuid.uuid4())
    session = Session()
    try:
        session.execute(text("""
            INSERT INTO analysis_profiles (id, name, is_custom, preprocess_model, extract_model, synthesis_model)
            VALUES (:id, :name, 1, :pre, :ext, :syn)
        """), {"id": profile_id, "name": data['name'], "pre": data['preprocess_model'],
               "ext": data['extract_model'], "syn": data['synthesis_model']})
        session.commit()
        return jsonify({'message': 'Profil créé avec succès', 'id': profile_id}), 201
    except Exception as e:
        session.rollback()
        if "unique" in str(e).lower():
            return jsonify({'error': 'Un profil avec ce nom existe déjà'}), 409
        logger.error(f"Erreur création profil: {e}")
        return jsonify({'error': 'Erreur interne du serveur'}), 500
    finally:
        session.close()

@api_bp.route('/analysis-profiles/<profile_id>', methods=['PUT'])
def update_analysis_profile(profile_id):
    data = request.get_json(force=True)
    required_fields = ['name', 'preprocess_model', 'extract_model', 'synthesis_model']
    if not all(field in data for field in required_fields):
        return jsonify({'error': 'Tous les champs sont requis'}), 400
    session = Session()
    try:
        res = session.execute(text("""
            UPDATE analysis_profiles SET
                name = :n, preprocess_model = :pre, extract_model = :ext, synthesis_model = :syn
            WHERE id = :id AND is_custom = 1
        """), {"n": data['name'], "pre": data['preprocess_model'], "ext": data['extract_model'],
               "syn": data['synthesis_model'], "id": profile_id})
        if res.rowcount == 0:
            return jsonify({'error': 'Profil non trouvé ou non modifiable'}), 404
        session.commit()
        return jsonify({'message': 'Profil mis à jour avec succès'})
    except Exception as e:
        session.rollback()
        if "unique" in str(e).lower():
            return jsonify({'error': 'Un profil avec ce nom existe déjà'}), 409
        logger.error(f"Erreur maj profil: {e}")
        return jsonify({'error': 'Erreur interne du serveur'}), 500
    finally:
        session.close()

@api_bp.route('/analysis-profiles/<profile_id>', methods=['DELETE'])
def delete_analysis_profile(profile_id):
    session = Session()
    try:
        res = session.execute(text("DELETE FROM analysis_profiles WHERE id = :id AND is_custom = 1"), {"id": profile_id})
        if res.rowcount == 0:
            return jsonify({'error': 'Profil non trouvé ou non modifiable'}), 404
        session.commit()
        return jsonify({'message': 'Profil supprimé avec succès'})
    except Exception as e:
        session.rollback()
        logger.error(f"Erreur suppression profil: {e}")
        return jsonify({'error': 'Erreur interne du serveur'}), 500
    finally:
        session.close()

# --- Grilles d'extraction ---
@api_bp.route('/projects/<project_id>/grids', methods=['GET', 'POST'])
def grids_collection(project_id):
    session = Session()
    try:
        if request.method == 'GET':
            rows = session.execute(text("""
                SELECT id, name, fields, created_at FROM extraction_grids
                WHERE project_id = :pid ORDER BY created_at DESC
            """), {"pid": project_id}).mappings().all()
            grids = []
            for r in rows:
                g = dict(r)
                try:
                    g['fields'] = json.loads(g['fields'])
                except Exception:
                    g['fields'] = []
                grids.append(g)
            return jsonify(grids)
        if request.method == 'POST':
            data = request.get_json(force=True)
            name, fields = data.get('name'), data.get('fields')
            if not name or not isinstance(fields, list) or not fields:
                return jsonify({'error': 'Le nom et une liste de champs sont requis.'}), 400
            grid_id = str(uuid.uuid4())
            session.execute(text("""
                INSERT INTO extraction_grids (id, project_id, name, fields, created_at)
                VALUES (:id, :pid, :n, :f, :t)
            """), {"id": grid_id, "pid": project_id, "n": name, "f": json.dumps(fields), "t": datetime.now().isoformat()})
            session.commit()
            return jsonify({"id": grid_id, "project_id": project_id, "name": name, "fields": fields, "created_at": datetime.now().isoformat()}), 201
    except Exception as e:
        session.rollback()
        logger.error(f"Erreur grids_collection: {e}")
        return jsonify({'error': 'Erreur interne du serveur'}), 500
    finally:
        session.close()

@api_bp.route('/projects/<project_id>/grids/<grid_id>', methods=['PUT', 'DELETE'])
def grid_resource(project_id, grid_id):
    session = Session()
    try:
        if request.method == 'PUT':
            data = request.get_json(force=True)
            name, fields = data.get('name'), data.get('fields')
            if not name or not isinstance(fields, list) or not fields:
                return jsonify({'error': 'Le nom et une liste de champs sont requis.'}), 400
            res = session.execute(text("""
                UPDATE extraction_grids SET name = :n, fields = :f
                WHERE id = :id AND project_id = :pid
            """), {"n": name, "f": json.dumps(fields), "id": grid_id, "pid": project_id})
            if res.rowcount == 0:
                return jsonify({'error': "Grille non trouvée ou n'appartient pas à ce projet."}), 404
            session.commit()
            return jsonify({'message': 'Grille mise à jour avec succès.'})
        if request.method == 'DELETE':
            res = session.execute(text("""
                DELETE FROM extraction_grids WHERE id = :id AND project_id = :pid
            """), {"id": grid_id, "pid": project_id})
            if res.rowcount == 0:
                return jsonify({'error': "Grille non trouvée ou n'appartient pas à ce projet."}), 404
            session.commit()
            return jsonify({'message': 'Grille supprimée avec succès.'})
    except Exception as e:
        session.rollback()
        logger.error(f"Erreur grid_resource: {e}")
        return jsonify({'error': 'Erreur interne du serveur'}), 500
    finally:
        session.close()

@api_bp.route('/projects/<project_id>/grids/import', methods=['POST'])
def import_grid_from_file(project_id):
    if 'file' not in request.files:
        return jsonify({"error": "Aucun fichier n'a été envoyé"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Aucun fichier sélectionné"}), 400
    if not file.filename.endswith('.json'):
        return jsonify({"error": "Type de fichier non supporté. Veuillez utiliser un fichier .json"}), 400
    try:
        grid_data = json.load(file.stream)
        grid_name = grid_data.get('name')
        grid_fields = grid_data.get('fields')
        if not grid_name or not isinstance(grid_fields, list):
            return jsonify({"error": "Le JSON doit contenir 'name' et 'fields' (liste)"}), 400
        session = Session()
        try:
            session.execute(text("""
                INSERT INTO extraction_grids (id, project_id, name, fields, created_at)
                VALUES (:id, :pid, :n, :f, :t)
            """), {"id": str(uuid.uuid4()), "pid": project_id, "n": grid_name, "f": json.dumps(grid_fields), "t": datetime.now().isoformat()})
            session.commit()
        finally:
            session.close()
        return jsonify({"message": "Grille importée avec succès"}), 201
    except json.JSONDecodeError:
        return jsonify({"error": "Fichier JSON invalide"}), 400
    except Exception as e:
        logger.error(f"Erreur import grid: {e}")
        return jsonify({"error": "Erreur interne du serveur"}), 500

# --- Analyses avancées ---
@api_bp.route('/projects/<project_id>/generate-discussion', methods=['POST'])
def generate_discussion_endpoint(project_id):
    analysis_queue.enqueue(run_discussion_generation_task, project_id=project_id, job_timeout=1800)
    return jsonify({"message": "Génération de la discussion lancée."}), 202

@api_bp.route('/projects/<project_id>/generate-knowledge-graph', methods=['POST'])
def generate_knowledge_graph_endpoint(project_id):
    analysis_queue.enqueue(run_knowledge_graph_task, project_id=project_id, job_timeout=1800)
    return jsonify({"message": "Génération du graphe de connaissances lancée."}), 202

@api_bp.route('/projects/<project_id>/generate-prisma-flow', methods=['POST'])
def generate_prisma_flow_endpoint(project_id):
    analysis_queue.enqueue(run_prisma_flow_task, project_id=project_id, job_timeout=1800)
    return jsonify({"message": "Génération du diagramme PRISMA lancée."}), 202

@api_bp.route('/projects/<project_id>/run-meta-analysis', methods=['POST'])
def run_meta_analysis_endpoint(project_id):
    analysis_queue.enqueue(run_meta_analysis_task, project_id=project_id, job_timeout=1800)
    return jsonify({"message": "Lancement de la méta-analyse."}), 202

@api_bp.route('/projects/<project_id>/run-descriptive-stats', methods=['POST'])
def run_descriptive_stats_endpoint(project_id):
    analysis_queue.enqueue(run_descriptive_stats_task, project_id=project_id, job_timeout=1800)
    return jsonify({"message": "Lancement de l'analyse descriptive."}), 202

@api_bp.route('/projects/<project_id>/run-atn-score', methods=['POST'])
def run_atn_score_endpoint(project_id):
    analysis_queue.enqueue(run_atn_score_task, project_id=project_id, job_timeout=1800)
    return jsonify({"message": "Lancement du calcul du score ATN."}), 202

@api_bp.route('/projects/<project_id>/analysis-plot', methods=['GET'])
def get_analysis_plot_image(project_id):
    session = Session()
    try:
        row = session.execute(text("SELECT analysis_plot_path FROM projects WHERE id = :pid"), {"pid": project_id}).mappings().fetchone()
        if not row or not row["analysis_plot_path"]:
            return jsonify({"error": "Aucun chemin de graphique trouvé pour ce projet."}), 404
        plot_path_data = row["analysis_plot_path"]
    finally:
        session.close()

    final_plot_path = None
    try:
        plot_paths = json.loads(plot_path_data)
        if isinstance(plot_paths, dict):
            final_plot_path = next(iter(plot_paths.values()), None)
    except Exception:
        final_plot_path = plot_path_data

    if final_plot_path and os.path.exists(final_plot_path):
        return send_from_directory(os.path.dirname(final_plot_path), os.path.basename(final_plot_path))
    return jsonify({"error": "Fichier image d'analyse introuvable sur le serveur."}), 404

@api_bp.route('/projects/<project_id>/prisma-flow', methods=['GET'])
def get_prisma_flow_image(project_id):
    session = Session()
    try:
        row = session.execute(text("SELECT prisma_flow_path FROM projects WHERE id = :pid"), {"pid": project_id}).mappings().fetchone()
        prisma_path = row["prisma_flow_path"] if row else None
    finally:
        session.close()
    if prisma_path and os.path.exists(prisma_path):
        return send_from_directory(os.path.dirname(prisma_path), os.path.basename(prisma_path))
    return jsonify({"error": "Image PRISMA non trouvée."}), 404

# --- Files d'attente ---
@api_bp.route('/queue-status', methods=['GET'])
def get_queue_status():
    queues = {
        'Traitement': processing_queue,
        'Synthèse': synthesis_queue,
        'Analyse': analysis_queue,
        'Tâches de fond': background_queue
    }
    status = {name: {'count': q.count} for name, q in queues.items()}
    return jsonify(status)

@api_bp.route('/queues/clear', methods=['POST'])
def clear_queues():
    data = request.get_json(force=True)
    queue_name = data.get('queue_name')
    queues_map = {
        'Traitement': processing_queue,
        'Synthèse': synthesis_queue,
        'Analyse': analysis_queue,
        'Tâches de fond': background_queue
    }
    if queue_name in queues_map:
        q = queues_map[queue_name]
        q.empty()
        failed_registry = q.failed_job_registry
        for job_id in failed_registry.get_job_ids():
            failed_registry.remove(job_id, delete_job=True)
        return jsonify({'message': f'La file "{queue_name}" a été vidée.'}), 200
    return jsonify({'error': 'Nom de file invalide'}), 400

# --- WebSocket Events ---
@socketio.on('connect')
def handle_connect():
    logger.info(f"Client WebSocket connecté")
    socketio.emit('connection_confirmed', {
        'status': 'connected',
        'server_time': datetime.now().isoformat(),
        'version': config.ANALYLIT_VERSION
    })

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f"Client WebSocket déconnecté")

@socketio.on('join_room')
def handle_join_room(data):
    from flask_socketio import join_room as flask_join_room
    project_id = data.get('room')
    if not project_id:
        return
    flask_join_room(project_id)
    socketio.emit('room_joined', {'project_id': project_id}, room=project_id)
    logger.info(f"Client a rejoint la room du projet {project_id}")

# --- Enregistrement du blueprint et routes statiques ---
app.register_blueprint(api_bp)

@app.route('/')
def serve_index():
    return app.send_static_file('index.html')

@app.errorhandler(404)
def not_found(error):
    return app.send_static_file('index.html')

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Erreur interne du serveur: {error}")
    return jsonify({"error": "Erreur interne du serveur"}), 500

if __name__ == '__main__':
    init_db()
    logger.info("🚀 Démarrage du serveur AnalyLit V4.1 sur le port 5001...")
    socketio.run(app, host='0.0.0.0', port=5001, debug=False, allow_unsafe_werkzeug=True)
