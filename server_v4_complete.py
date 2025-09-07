# ================================================================
# AnalyLit V4.1 - Serveur Flask (100% PostgreSQL/SQLAlchemy) - CORRIGÉ
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
from rq.worker import Worker
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
    import_pdfs_from_zotero_task,
    index_project_pdfs_task,
    answer_chat_question_task,
    fetch_online_pdf_task,
    import_from_zotero_file_task,
    pull_ollama_model_task,
    calculate_kappa_task,
    run_atn_score_task
)

from utils.fetchers import db_manager, fetch_article_details
from utils.file_handlers import sanitize_filename
from utils.notifications import send_project_notification
from sklearn.metrics import cohen_kappa_score

# --- Configuration ---
config = get_config()
logging.basicConfig(level=getattr(logging, config.LOG_LEVEL))
logger = logging.getLogger(__name__)

# --- Base de Données (SQLAlchemy) ---
engine = create_engine(config.DATABASE_URL, pool_pre_ping=True)
SessionFactory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Session = scoped_session(SessionFactory)

# --- Application ---
app = Flask(__name__, static_folder='web', static_url_path='/')
api_bp = Blueprint('api', __name__, url_prefix='/api')
CORS(app, resources={r"/api/*": {"origins": "*"}})
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    message_queue=config.REDIS_URL,
    async_mode='gevent',
    path='/socket.io/'
)

# --- Redis / Queues ---
redis_conn = redis.from_url(config.REDIS_URL)
processing_queue = Queue('analylit_processing_v4', connection=redis_conn)
synthesis_queue = Queue('analylit_synthesis_v4', connection=redis_conn)
analysis_queue = Queue('analylit_analysis_v4', connection=redis_conn)
background_queue = Queue('analylit_background_v4', connection=redis_conn)

# --- Projets: répertoire fichiers ---
PROJECTS_DIR = Path(config.PROJECTS_DIR)
PROJECTS_DIR.mkdir(parents=True, exist_ok=True)

# ================================================================
# 1) Initialisation / Migrations
# ================================================================
def init_db():
    """Initialise ou migre le schéma PostgreSQL."""
    with engine.begin() as conn:
        try:
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

            # Migrations idempotentes
            conn.execute(text("ALTER TABLE projects ADD COLUMN IF NOT EXISTS inter_rater_reliability TEXT"))
            conn.execute(text("ALTER TABLE extractions ADD COLUMN IF NOT EXISTS validations TEXT"))

            # Seeding profils
            count_profiles = conn.execute(text("SELECT COUNT(*) FROM analysis_profiles")).scalar_one()
            if count_profiles == 0:
                default_profiles = [
                    {"id": "fast", "name": "Rapide", "is_custom": False, "preprocess_model": "gemma:2b",
                     "extract_model": "phi3:mini", "synthesis_model": "llama3.1:8b"},
                    {"id": "standard", "name": "Standard", "is_custom": False, "preprocess_model": "phi3:mini",
                     "extract_model": "llama3.1:8b", "synthesis_model": "llama3.1:8b"},
                    {"id": "deep", "name": "Approfondi", "is_custom": False, "preprocess_model": "llama3.1:8b",
                     "extract_model": "mixtral:8x7b", "synthesis_model": "llama3.1:70b"},
                ]
                stmt = text("""
INSERT INTO analysis_profiles (id, name, is_custom, preprocess_model, extract_model, synthesis_model)
VALUES (:id, :name, :is_custom, :preprocess_model, :extract_model, :synthesis_model)
""")
                for p in default_profiles:
                    conn.execute(stmt, p)

            # Seeding prompts (JSON échappé)
            count_prompts = conn.execute(text("SELECT COUNT(*) FROM prompts")).scalar_one()
            if count_prompts == 0:
                default_prompts = [
                    {
                        "name": "screening_prompt",
                        "description": "Prompt pour la pré-sélection des articles.",
                        "template": (
                            "En tant qu'assistant de recherche spécialisé, analysez cet article et déterminez sa pertinence.\n\n"
                            "Titre: {title}\n\nRésumé: {abstract}\n\nSource: {database_source}\n\n"
                            "Répondez UNIQUEMENT en JSON: "
                            "{{\"relevance_score\": 0-10, \"decision\": \"À inclure\"|\"À exclure\", \"justification\": \"...\"}}"
                        ),
                    },
                    {
                        "name": "full_extraction_prompt",
                        "description": "Prompt pour l'extraction détaillée (grille).",
                        "template": (
                            "ROLE: Assistant expert. Répondez UNIQUEMENT avec un JSON valide.\n"
                            "TEXTE À ANALYSER:\n---\n{text}\n---\nSOURCE: {database_source}\n"
                            "{{\n\"type_etude\":\"...\",\"population\":\"...\",\"intervention\":\"...\","
                            "\"resultats_principaux\":\"...\",\"limites\":\"...\",\"methodologie\":\"...\"\n}}"
                        ),
                    },
                    {
                        "name": "synthesis_prompt",
                        "description": "Prompt pour la synthèse.",
                        "template": (
                            "Contexte: {project_description}\n"
                            "Résumés:\n---\n{data_for_prompt}\n---\n"
                            "Réponds en JSON: {{\"relevance_evaluation\":[],\"main_themes\":[],\"key_findings\":[],"
                            "\"methodologies_used\":[],\"synthesis_summary\":\"\",\"research_gaps\":[]}}"
                        ),
                    },
                ]
                stmt = text("INSERT INTO prompts (name, description, template) VALUES (:name, :description, :template)")
                for pr in default_prompts:
                    conn.execute(stmt, pr)

            logger.info("✅ DB init/migrations OK.")
        except Exception as e:
            logger.error(f"❌ Erreur initialisation DB: {e}", exc_info=True)
            raise
            
# ================================================================
# 2) API Routes
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
    return jsonify({
        "status": "ok",
        "version": config.ANALYLIT_VERSION,
        "timestamp": datetime.now().isoformat(),
        "services": {"database": db_status, "redis": redis_status, "ollama": "unknown"}
    })

@api_bp.route('/databases', methods=['GET'])
def get_available_databases():
    try:
        return jsonify(db_manager.get_available_databases())
    except Exception as e:
        logger.error(f"Erreur get_available_databases: {e}")
        return jsonify([]), 200

# --- Projets CRUD ---
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
    project_id = data.get('project_id')
    query = data.get('query')
    databases = data.get('databases', ['pubmed'])
    max_results_per_db = data.get('max_results_per_db', 50)
    if not project_id or not query:
        return jsonify({'error': 'project_id et query requis'}), 400

    session = Session()
    try:
        session.execute(text("""
        UPDATE projects
        SET search_query = :q, databases_used = :dbs, status = 'searching', updated_at = :now
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
        per_page = request.args.get('per_page', 500, type=int)
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
        total = session.execute(text("SELECT COUNT(*) FROM search_results WHERE project_id = :pid"),
                                {"pid": project_id}).scalar_one()
        return jsonify({
            "total_results": total,
            "results_by_database": {r["database_source"]: r["count"] for r in stats}
        })
    finally:
        session.close()

# --- Upload et gestion des fichiers ---
@api_bp.route('/projects/<project_id>/upload-pdfs-bulk', methods=['POST'])
def upload_pdfs_bulk(project_id):
    files = []
    if 'files' in request.files:
        files = request.files.getlist('files')
    elif 'file' in request.files:
        files = [request.files['file']]
    if not files:
        return jsonify({'error': 'Aucun fichier fourni'}), 400

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

    send_project_notification(project_id, 'pdf_upload_completed',
                              f"{len(successful)} PDF importés, {len(failed)} échecs.",
                              {'successful': successful, 'failed': failed})
    return jsonify({'successful': successful, 'failed': failed}), 200

@api_bp.route('/projects/<project_id>/upload-pdf-for-article', methods=['POST'])
def upload_pdf_for_article(project_id):
    """Upload manuel d'un PDF lié à un article (utilisé par le frontend)."""
    if 'file' not in request.files:
        return jsonify({'error': 'Aucun fichier fourni'}), 400
    file = request.files['file']
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        return jsonify({'error': 'Veuillez fournir un fichier PDF.'}), 400

    article_id = request.args.get('article_id', '') or Path(file.filename).stem
    if not article_id:
        article_id = str(uuid.uuid4())

    project_dir = PROJECTS_DIR / project_id
    project_dir.mkdir(exist_ok=True)
    safe_name = f"{sanitize_filename(article_id)}.pdf"
    try:
        file.save(str(project_dir / safe_name))
        send_project_notification(project_id, 'pdf_upload_completed', f'PDF uploadé pour {article_id}')
        return jsonify({'message': 'PDF uploadé avec succès', 'filename': safe_name}), 200
    except Exception as e:
        logger.error(f"Erreur upload_pdf_for_article: {e}", exc_info=True)
        return jsonify({'error': 'Erreur lors de l’upload'}), 500

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

# --- Extractions ---
@api_bp.route('/projects/<project_id>/extractions', methods=['GET'])
def get_project_extractions(project_id):
    session = Session()
    try:
        rows = session.execute(text("""
        SELECT * FROM extractions
        WHERE project_id = :pid
        ORDER BY relevance_score DESC
        """), {"pid": project_id}).mappings().all()
        return jsonify([dict(r) for r in rows])
    finally:
        session.close()

# --- Profils et prompts ---
@api_bp.route('/profiles', methods=['GET', 'POST'])
def handle_analysis_profiles():
    session = Session()
    try:
        if request.method == 'GET':
            rows = session.execute(text("SELECT * FROM analysis_profiles ORDER BY name")).mappings().all()
            return jsonify([dict(r) for r in rows])

        if request.method == 'POST':
            data = request.get_json(force=True)
            profile = {
                "id": str(uuid.uuid4()),
                "name": data['name'],
                "is_custom": True,
                "preprocess_model": data['preprocess_model'],
                "extract_model": data['extract_model'],
                "synthesis_model": data['synthesis_model']
            }
            session.execute(text("""
            INSERT INTO analysis_profiles (id, name, is_custom, preprocess_model, extract_model, synthesis_model)
            VALUES (:id, :name, :is_custom, :preprocess_model, :extract_model, :synthesis_model)
            """), profile)
            session.commit()
            return jsonify(profile), 201
    except Exception as e:
        session.rollback()
        logger.error(f"Erreur handle_analysis_profiles: {e}")
        return jsonify({'error': 'Erreur interne'}), 500
    finally:
        session.close()

# ALIAS pour compatibilité frontend: /analysis-profiles
@api_bp.route('/analysis-profiles', methods=['GET', 'POST'])
def handle_analysis_profiles_alias():
    if request.method == 'GET':
        return handle_analysis_profiles()
    if request.method == 'POST':
        return handle_analysis_profiles()

@api_bp.route('/prompts', methods=['GET', 'POST'])
def handle_prompts():
    session = Session()
    try:
        if request.method == 'GET':
            rows = session.execute(text("SELECT * FROM prompts ORDER BY name")).mappings().all()
            return jsonify([dict(r) for r in rows])

        if request.method == 'POST':
            data = request.get_json(force=True)
            session.execute(text("""
            INSERT INTO prompts (name, description, template)
            VALUES (:name, :description, :template)
            ON CONFLICT (name) DO UPDATE SET
              description = EXCLUDED.description,
              template = EXCLUDED.template
            """), {
                "name": data['name'],
                "description": data['description'],
                "template": data['template']
            })
            session.commit()
            return jsonify({'message': 'Prompt sauvegardé'}), 201
    except Exception as e:
        session.rollback()
        logger.error(f"Erreur handle_prompts: {e}")
        return jsonify({'error': 'Erreur interne'}), 500
    finally:
        session.close()

# --- Grilles d'extraction ---
@api_bp.route('/projects/<project_id>/grids', methods=['GET', 'POST'])
def handle_extraction_grids(project_id):
    session = Session()
    try:
        if request.method == 'GET':
            rows = session.execute(text("""
            SELECT * FROM extraction_grids
            WHERE project_id = :pid
            ORDER BY created_at DESC
            """), {"pid": project_id}).mappings().all()
            return jsonify([dict(r) for r in rows])

        if request.method == 'POST':
            data = request.get_json(force=True)
            grid = {
                "id": str(uuid.uuid4()),
                "project_id": project_id,
                "name": data['name'],
                "fields": json.dumps(data['fields']),
                "created_at": datetime.now().isoformat()
            }
            session.execute(text("""
            INSERT INTO extraction_grids (id, project_id, name, fields, created_at)
            VALUES (:id, :project_id, :name, :fields, :created_at)
            """), grid)
            session.commit()
            return jsonify(grid), 201
    except Exception as e:
        session.rollback()
        logger.error(f"Erreur handle_extraction_grids: {e}")
        return jsonify({'error': 'Erreur interne'}), 500
    finally:
        session.close()

# --- Paramètres Zotero ---
@api_bp.route('/settings/zotero', methods=['GET', 'POST'])
def handle_zotero_settings():
    config_path = PROJECTS_DIR / 'zotero_config.json'
    if request.method == 'GET':
        if config_path.exists():
            with open(config_path, 'r') as f:
                zotero_config = json.load(f)
            return jsonify({
                'userId': zotero_config.get('user_id', ''),
                'hasApiKey': bool(zotero_config.get('api_key'))
            })
        return jsonify({'userId': '', 'hasApiKey': False})

    if request.method == 'POST':
        data = request.get_json(force=True)
        zotero_config = {
            'user_id': data.get('userId'),
            'api_key': data.get('apiKey')
        }
        with open(config_path, 'w') as f:
            json.dump(zotero_config, f)
        return jsonify({'message': 'Paramètres Zotero sauvegardés.'})

# --- Import Zotero ---
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
                INSERT INTO search_results
                (id, project_id, article_id, title, abstract, database_source, created_at, url, doi, authors, journal, publication_date)
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

        total_articles = session.execute(text(
            "SELECT COUNT(*) FROM search_results WHERE project_id = :pid"
        ), {"pid": project_id}).scalar_one()
        session.execute(text(
            "UPDATE projects SET pmids_count = :c WHERE id = :pid"
        ), {"c": total_articles, "pid": project_id})
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
    return jsonify({
        'message': f'Import Zotero lancé pour {len(article_ids_to_process)} articles.',
        'job_id': job.id
    }), 202

@api_bp.route('/projects/<project_id>/import-zotero-file', methods=['POST'])
def import_from_zotero_file(project_id):
    if 'file' not in request.files:
        return jsonify({'error': 'Aucun fichier fourni'}), 400
    file = request.files['file']
    if not file.filename.endswith('.json'):
        return jsonify({'error': 'Veuillez fournir un fichier .json'}), 400

    temp_dir = PROJECTS_DIR / 'temp_uploads'
    temp_dir.mkdir(exist_ok=True)
    temp_filename = f"{uuid.uuid4()}.json"
    temp_filepath = temp_dir / temp_filename
    try:
        file.save(str(temp_filepath))
    except Exception as e:
        logger.error(f"Impossible de sauvegarder le fichier Zotero temporaire: {e}")
        return jsonify({"error": "Erreur interne lors de la sauvegarde du fichier."}), 500

    job = background_queue.enqueue(
        import_from_zotero_file_task,
        project_id=project_id,
        json_file_path=str(temp_filepath),
        job_timeout='1h'
    )
    return jsonify({'message': 'Import du fichier Zotero lancé.', 'job_id': job.id}), 202

@api_bp.route('/projects/<project_id>/fetch-online-pdfs', methods=['POST'])
def fetch_online_pdfs(project_id):
    data = request.get_json(force=True)
    manual_ids = data.get('articles', [])
    article_ids_to_process = add_manual_articles_to_project(project_id, manual_ids)
    if not article_ids_to_process:
        return jsonify({'error': 'Aucun article valide à traiter pour ce projet.'}), 400

    for article_id in article_ids_to_process:
        background_queue.enqueue(
            fetch_online_pdf_task,
            project_id=project_id,
            article_id=article_id,
            job_timeout='1h'
        )
    return jsonify({
        'message': f'Recherche OA lancée pour {len(article_ids_to_process)} articles.'
    }), 202

# --- Pipeline d'analyse ---
@api_bp.route('/projects/<project_id>/run', methods=['POST'])
def run_project_pipeline(project_id):
    data = request.get_json(force=True)
    selected_articles = data.get('articles', [])
    profile_id = data.get('profile', 'standard')
    custom_grid_id = data.get('custom_grid_id')
    analysis_mode = data.get('analysis_mode', 'screening')

    if not selected_articles:
        return jsonify({'error': "La liste d'articles est requise."}), 400

    session = Session()
    try:
        profile_row = session.execute(text("SELECT * FROM analysis_profiles WHERE id = :id"),
                                      {"id": profile_id}).mappings().fetchone()
        if not profile_row:
            return jsonify({'error': f"Profil invalide: '{profile_id}'"}), 400

        session.execute(text("DELETE FROM extractions WHERE project_id = :pid"), {"pid": project_id})
        session.execute(text("DELETE FROM processing_log WHERE project_id = :pid"), {"pid": project_id})

        session.execute(text("""
        UPDATE projects SET
            status = 'processing',
            profile_used = :p,
            updated_at = :t,
            pmids_count = :n,
            processed_count = 0,
            total_processing_time = 0,
            analysis_mode = :am
        WHERE id = :pid
        """), {
            "p": profile_id,
            "t": datetime.now().isoformat(),
            "n": len(selected_articles),
            "am": analysis_mode,
            "pid": project_id
        })
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
        logger.error(f"run_project_pipeline error: {e}", exc_info=True)
        return jsonify({'error': 'Erreur interne'}), 500
    finally:
        session.close()

@api_bp.route('/projects/<project_id>/run-synthesis', methods=['POST'])
def run_synthesis_endpoint(project_id):
    data = request.get_json(force=True)
    profile_id = data.get('profile', 'standard')

    session = Session()
    try:
        profile_row = session.execute(text("SELECT * FROM analysis_profiles WHERE id = :id"),
                                      {"id": profile_id}).mappings().fetchone()
        if not profile_row:
            return jsonify({'error': f"Profil invalide: '{profile_id}'"}), 400

        profile_to_use = dict(profile_row)
        job = synthesis_queue.enqueue(
            run_synthesis_task,
            project_id=project_id,
            profile=profile_to_use,
            job_timeout=3600
        )

        session.execute(text(
            "UPDATE projects SET status = 'synthesizing', job_id = :jid WHERE id = :pid"
        ), {"jid": job.id, "pid": project_id})
        session.commit()
        return jsonify({"status": "synthesizing", "message": "Synthèse lancée."}), 202
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
                v = json.loads(r["validations"]) if r.get("validations") else {}
                if "evaluator1" in v:
                    records.append({
                        "article_id": r["pmid"],
                        "title": r["title"],
                        "decision": v["evaluator1"],
                        "ia_score": r.get("relevance_score", None)
                    })
            except Exception:
                continue

        if not records:
            return jsonify({"message": "Aucune validation évaluateur 1 à exporter."}), 404

        df = pd.DataFrame(records)
        csv_data = df.to_csv(index=False)
        return Response(
            csv_data,
            mimetype='text/csv',
            headers={'Content-Disposition': f'attachment; filename=validations_eval1_{project_id}.csv'}
        )
    except Exception as e:
        logger.error(f"Erreur export validations: {e}", exc_info=True)
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
        normalized = {str(c).strip().lower(): c for c in df.columns}
        if not {"articleid", "decision"}.issubset(set(normalized.keys())):
            return jsonify({"error": "Le fichier CSV doit contenir les colonnes ['articleId','decision']"}), 400

        updated = 0
        for _, row in df.iterrows():
            article_id = str(row[normalized["articleid"]]).strip()
            decision = str(row[normalized["decision"]]).strip().lower()
            mapping = {
                "inclure": "include", "inclu": "include", "include": "include",
                "exclure": "exclude", "exclu": "exclude", "exclude": "exclude"
            }
            decision = mapping.get(decision, decision)
            if not article_id or decision not in ("include", "exclude"):
                continue

            ext = session.execute(text("""
            SELECT id, validations FROM extractions
            WHERE project_id = :pid AND pmid = :pmid
            """), {"pid": project_id, "pmid": article_id}).mappings().fetchone()
            if not ext:
                continue

            try:
                v = json.loads(ext["validations"]) if ext.get("validations") else {}
            except Exception:
                v = {}
            v["evaluator2"] = decision

            session.execute(text("""
            UPDATE extractions SET validations = :val WHERE id = :id
            """), {"val": json.dumps(v, ensure_ascii=False), "id": ext["id"]})
            updated += 1

        session.commit()
        return jsonify({"message": f"{updated} validations importées pour l'évaluateur 2."}), 200
    except Exception as e:
        session.rollback()
        logger.error(f"Erreur import validations: {e}", exc_info=True)
        return jsonify({"error": "Erreur interne ou format invalide"}), 500
    finally:
        session.close()

@api_bp.route('/projects/<project_id>/calculate-kappa', methods=['POST'])
def calculate_project_kappa(project_id):
    job = analysis_queue.enqueue(calculate_kappa_task, project_id=project_id, job_timeout='10m')
    return jsonify({"message": "Calcul du Kappa lancé.", "job_id": job.id}), 202

@api_bp.route('/projects/<project_id>/inter-rater-stats', methods=['GET'])
def get_inter_rater_stats(project_id):
    session = Session()
    try:
        row = session.execute(text("""
        SELECT inter_rater_reliability FROM projects WHERE id = :pid
        """), {"pid": project_id}).mappings().fetchone()
        return jsonify({
            "kappa_result": row["inter_rater_reliability"] if row else "Non calculé"
        })
    except Exception as e:
        logger.error(f"Erreur inter-rater stats: {e}", exc_info=True)
        return jsonify({"error": "Erreur interne du serveur"}), 500
    finally:
        session.close()

# --- Analyses avancées ---
@api_bp.route('/projects/<project_id>/run-analysis', methods=['POST'])
def run_advanced_analysis(project_id):
    data = request.get_json(force=True)
    analysis_type = data.get('type')
    if not analysis_type:
        return jsonify({'error': 'Type d\'analyse requis'}), 400
    try:
        session = Session()
        session.execute(text("UPDATE projects SET status = 'generating_analysis' WHERE id = :pid"),
                        {"pid": project_id})
        session.commit()
        session.close()
        if analysis_type == 'meta_analysis':
            job = analysis_queue.enqueue(run_meta_analysis_task, project_id=project_id, job_timeout='30m')
        elif analysis_type == 'atn_scores':
            job = analysis_queue.enqueue(run_atn_score_task, project_id=project_id, job_timeout='30m')
        elif analysis_type == 'discussion':
            job = analysis_queue.enqueue(run_discussion_generation_task, project_id=project_id, job_timeout='30m')
        elif analysis_type == 'knowledge_graph':
            job = analysis_queue.enqueue(run_knowledge_graph_task, project_id=project_id, job_timeout='30m')
        elif analysis_type == 'prisma_flow':
            job = analysis_queue.enqueue(run_prisma_flow_task, project_id=project_id, job_timeout='30m')
        else:
            return jsonify({'error': 'Type d\'analyse non supporté'}), 400
        return jsonify({'message': f'Analyse {analysis_type} lancée', 'job_id': job.id}), 202
    except Exception as e:
        logger.error(f"Erreur run analysis: {e}")
        return jsonify({'error': 'Erreur lors du lancement de l\'analyse'}), 500

# --- Chat RAG ---
@api_bp.route('/projects/<project_id>/chat', methods=['POST', 'GET'])
def handle_project_chat(project_id):
    if request.method == 'GET':
        session = Session()
        try:
            rows = session.execute(text("""
            SELECT * FROM chat_messages
            WHERE project_id = :pid
            ORDER BY timestamp ASC
            """), {"pid": project_id}).mappings().all()
            return jsonify([dict(r) for r in rows])
        finally:
            session.close()
    if request.method == 'POST':
        data = request.get_json(force=True)
        question = data.get('question', '').strip()
        if not question:
            return jsonify({'error': 'La question est requise.'}), 400
        job = background_queue.enqueue(
            answer_chat_question_task,
            project_id=project_id,
            question=question,
            job_timeout='15m'
        )
        return jsonify({'message': 'Question envoyée au moteur RAG.', 'job_id': job.id}), 202

# --- Ollama ---
@api_bp.route('/ollama/models', methods=['GET'])
def list_ollama_models():
    import requests
    try:
        resp = requests.get(f"{config.OLLAMA_BASE_URL}/api/tags", timeout=10)
        resp.raise_for_status()
        data = resp.json() or {}
        models = []
        for m in data.get('models', []):
            name = m.get('name')
            if name:
                models.append({"name": name, "size": m.get("size", 0)})
        return jsonify(models)
    except Exception as e:
        logger.error(f"Erreur /ollama/models: {e}", exc_info=True)
        return jsonify([]), 200

@api_bp.route('/ollama/pull', methods=['POST'])
def ollama_pull_model():
    data = request.get_json(force=True)
    model = data.get('model')
    if not model:
        return jsonify({'error': 'Champ "model" requis.'}), 400
    try:
        job = background_queue.enqueue(pull_ollama_model_task, model_name=model, job_timeout='1h')
        return jsonify({'message': f'Téléchargement du modèle {model} lancé', 'job_id': job.id}), 202
    except Exception as e:
        logger.error(f"Erreur pull model: {e}")
        return jsonify({'error': 'Erreur lors du lancement du téléchargement'}), 500

# --- Statut des files ---
@api_bp.route('/queues/info', methods=['GET'])
def get_queues_information():
    try:
        queues_info = []
        queue_map = {
            'processing': processing_queue,
            'synthesis': synthesis_queue,
            'analysis': analysis_queue,
            'background': background_queue
        }
        for name, queue in queue_map.items():
            queues_info.append({
                'name': name,
                'size': len(queue),
                'workers': len(queue.workers)
            })
        return jsonify(queues_info)
    except Exception as e:
        logger.error(f"Erreur queues info: {e}")
        return jsonify([]), 500

@api_bp.route('/queues/<queue_name>/clear', methods=['POST'])
def clear_specific_queue(queue_name):
    try:
        queue_map = {
            'processing': processing_queue,
            'synthesis': synthesis_queue,
            'analysis': analysis_queue,
            'background': background_queue
        }
        if queue_name not in queue_map:
            return jsonify({'error': 'File inconnue'}), 404
        queue_map[queue_name].empty()
        return jsonify({'message': f'File {queue_name} vidée'})
    except Exception as e:
        logger.error(f"Erreur clear queue: {e}")
        return jsonify({'error': 'Erreur lors du vidage'}), 500

# --- Export projet ---
@api_bp.route('/projects/<project_id>/export', methods=['GET'])
def export_project(project_id):
    session = Session()
    try:
        proj = session.execute(text("SELECT * FROM projects WHERE id = :pid"),
                               {"pid": project_id}).mappings().fetchone()
        if not proj:
            return jsonify({'error': 'Projet introuvable'}), 404

        results = session.execute(text("SELECT * FROM search_results WHERE project_id = :pid"),
                                  {"pid": project_id}).mappings().all()
        extractions = session.execute(text("SELECT * FROM extractions WHERE project_id = :pid"),
                                      {"pid": project_id}).mappings().all()
        logs = session.execute(text("SELECT * FROM processing_log WHERE project_id = :pid ORDER BY timestamp DESC"),
                               {"pid": project_id}).mappings().all()
        grids = session.execute(text("SELECT * FROM extraction_grids WHERE project_id = :pid"),
                                {"pid": project_id}).mappings().all()
        chats = session.execute(text("SELECT * FROM chat_messages WHERE project_id = :pid ORDER BY timestamp"),
                                {"pid": project_id}).mappings().all()

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
            zf.writestr('project.json', json.dumps(dict(proj), ensure_ascii=False, indent=2))
            zf.writestr('search_results.json', json.dumps([dict(r) for r in results], ensure_ascii=False, indent=2))
            zf.writestr('extractions.json', json.dumps([dict(e) for e in extractions], ensure_ascii=False, indent=2))
            zf.writestr('processing_log.json', json.dumps([dict(l) for l in logs], ensure_ascii=False, indent=2))
            zf.writestr('extraction_grids.json', json.dumps([dict(g) for g in grids], ensure_ascii=False, indent=2))
            zf.writestr('chat_messages.json', json.dumps([dict(c) for c in chats], ensure_ascii=False, indent=2))

            project_dir = PROJECTS_DIR / project_id
            if project_dir.exists():
                for pdf_file in project_dir.glob("*.pdf"):
                    zf.write(pdf_file, f"pdfs/{pdf_file.name}")

        buf.seek(0)
        return Response(
            buf.getvalue(),
            mimetype='application/zip',
            headers={'Content-Disposition': f'attachment; filename=project_{project_id}_export.zip'}
        )
    except Exception as e:
        logger.error(f"Erreur export projet: {e}")
        return jsonify({'error': 'Erreur lors de l\'export'}), 500
    finally:
        session.close()

@api_bp.route('/projects/<project_id>/add-manual-articles', methods=['POST'])
def add_manual_articles(project_id):
    """Ajoute manuellement des articles au projet via leurs identifiants."""
    data = request.get_json(force=True)
    articles = data.get('articles', [])
    fetch_metadata = data.get('fetch_metadata', True)

    if not articles:
        return jsonify({'error': 'Liste d\'articles requise'}), 400

    session = Session()
    try:
        added_count = 0
        failed_count = 0
        failed_articles = []

        for article_id in articles:
            if not article_id or not isinstance(article_id, str):
                failed_count += 1
                continue

            # Vérifier si l'article existe déjà
            exists = session.execute(text("""
                SELECT 1 FROM search_results WHERE project_id = :pid AND article_id = :aid
            """), {"pid": project_id, "aid": article_id}).fetchone()

            if exists:
                continue  # Ignorer les doublons

            # Récupérer les métadonnées si demandé
            if fetch_metadata:
                try:
                    details = fetch_article_details(article_id)
                    if details and details.get('title') != 'Erreur de récupération':
                        session.execute(text("""
                            INSERT INTO search_results (
                                id, project_id, article_id, title, abstract, authors,
                                publication_date, journal, doi, url, database_source, created_at
                            ) VALUES (
                                :id, :pid, :aid, :title, :abstract, :authors,
                                :pub_date, :journal, :doi, :url, :db_source, :ts
                            )
                        """), {
                            "id": str(uuid.uuid4()),
                            "pid": project_id,
                            "aid": article_id,
                            "title": details.get('title', 'Titre non trouvé'),
                            "abstract": details.get('abstract', ''),
                            "authors": details.get('authors', ''),
                            "pub_date": details.get('publication_date', ''),
                            "journal": details.get('journal', ''),
                            "doi": details.get('doi', ''),
                            "url": details.get('url', ''),
                            "db_source": 'manual',
                            "ts": datetime.now().isoformat()
                        })
                        added_count += 1
                    else:
                        failed_articles.append(article_id)
                        failed_count += 1
                except Exception as e:
                    logger.warning(f"Erreur récupération métadonnées pour {article_id}: {e}")
                    failed_articles.append(article_id)
                    failed_count += 1
            else:
                # Ajouter l'article sans métadonnées
                session.execute(text("""
                    INSERT INTO search_results (
                        id, project_id, article_id, title, database_source, created_at
                    ) VALUES (
                        :id, :pid, :aid, :title, :db_source, :ts
                    )
                """), {
                    "id": str(uuid.uuid4()),
                    "pid": project_id,
                    "aid": article_id,
                    "title": f"Article {article_id}",
                    "db_source": 'manual',
                    "ts": datetime.now().isoformat()
                })
                added_count += 1

        # Mettre à jour le compteur du projet
        total_articles = session.execute(text(
            "SELECT COUNT(*) FROM search_results WHERE project_id = :pid"
        ), {"pid": project_id}).scalar_one()

        session.execute(text(
            "UPDATE projects SET pmids_count = :c, updated_at = :ts WHERE id = :pid"
        ), {"c": total_articles, "ts": datetime.now().isoformat(), "pid": project_id})

        session.commit()

        message = f"{added_count} article(s) ajouté(s)"
        if failed_count > 0:
            message += f", {failed_count} échec(s)"

        send_project_notification(project_id, 'articles_added', message)

        return jsonify({
            'message': message,
            'added_count': added_count,
            'failed_count': failed_count,
            'failed_articles': failed_articles
        }), 200

    except Exception as e:
        session.rollback()
        logger.error(f"Erreur add_manual_articles: {e}", exc_info=True)
        return jsonify({'error': 'Erreur interne du serveur'}), 500
    finally:
        session.close()
    
# ================================================================
# 3) WebSocket Events
# ================================================================
@socketio.on('connect')
def handle_connect(auth):
    logger.info(f"Client connecté: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f"Client déconnecté: {request.sid}")

@socketio.on('join_room')
def handle_join_room(data):
    room = data.get('room')
    if room:
        from flask_socketio import join_room, emit
        join_room(room)
        emit('room_joined', {'project_id': room})
        logger.info(f"Client {request.sid} a rejoint la room {room}")

# ================================================================
# 4) Enregistrement du blueprint et route front
# ================================================================
app.register_blueprint(api_bp)

@app.route('/')
def serve_frontend():
    return app.send_static_file('index.html')

if __name__ == '__main__':
    init_db()
    socketio.run(app, host='0.0.0.0', port=5001, debug=True)
