# ================================================================
# AnalyLit V4.1 - Serveur Flask (100% PostgreSQL/SQLAlchemy) - CORRIGÉ
# ================================================================

import os, uuid, json, logging, io, zipfile, pandas as pd
from pathlib import Path
import sys

from datetime import datetime, timezone
from flask import Flask, jsonify, request, Blueprint, send_from_directory, Response
from flask_cors import CORS
from rq import Queue
from rq.worker import Worker
import redis
from flask_socketio import SocketIO
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import create_engine, text
from functools import wraps
from sqlalchemy.orm import sessionmaker, scoped_session
import shutil

from utils.models import (
    Project, Article, SearchResult, Extraction, Grid, GridField,
    Validation, Analysis, ChatMessage, AnalysisProfile as Profile, Prompt,
    Stakeholder, StakeholderGroup, AnalysisProfile)
from utils.database import db_session, init_db, seed_default_data
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
    run_atn_stakeholder_analysis_task, # Correction: Import de la bonne fonction ATN
    import_from_zotero_file_task,
    index_project_pdfs_task,
    answer_chat_question_task,
    fetch_online_pdf_task,
    pull_ollama_model_task,
    calculate_kappa_task,
    run_atn_score_task,
    run_risk_of_bias_task, # Ajout de la nouvelle tâche
    add_manual_articles_task # Ajout de la nouvelle tâche
)

from werkzeug.utils import secure_filename
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
def create_app():
    """Crée et configure l'instance de l'application Flask."""
    app = Flask(__name__, static_folder='web', static_url_path='/')
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    
    # Enregistrement du blueprint API
    app.register_blueprint(api_bp)

    # Configuration de SocketIO
    socketio.init_app(app, cors_allowed_origins="*", message_queue=config.REDIS_URL, async_mode='gevent', path='/socket.io/')

    return app

# --- Redis / Queues ---
redis_conn = redis.from_url(config.REDIS_URL)
processing_queue = Queue('analylit_processing_v4', connection=redis_conn)
synthesis_queue = Queue('analylit_synthesis_v4', connection=redis_conn)
analysis_queue = Queue('analylit_analysis_v4', connection=redis_conn)
background_queue = Queue('analylit_background_v4', connection=redis_conn)
q = processing_queue # Alias pour la file de traitement principale

# --- Blueprint et SocketIO (définis globalement) ---
api_bp = Blueprint('api', __name__, url_prefix='/api')
socketio = SocketIO()

# --- Création de l'instance de l'application ---
# Gunicorn utilisera cette fonction pour obtenir l'application.
app = create_app()


# --- Projets: répertoire fichiers ---
PROJECTS_DIR = Path(config.PROJECTS_DIR)
PROJECTS_DIR.mkdir(parents=True, exist_ok=True)

# ================================================================
# 0) Gestion de la session SQLAlchemy
# ================================================================

@app.teardown_appcontext
def shutdown_session(exception=None):
    """Ferme la session SQLAlchemy à la fin de la requête."""
    session = Session()
    if session:
        if exception:
            session.rollback()
        session.remove()

def with_db_session(f):
    """Décorateur pour injecter et gérer une session de base de données."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        session = Session()
        try:
            result = f(db_session=session, *args, **kwargs)
            session.commit()
            return result
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.remove()
    return decorated_function

# ================================================================
# 1) Initialisation / Migrations
# ================================================================

import click

@app.cli.command('init-db')
def init_db_command():
    """Initialise la base de données et insère les données par défaut."""
    click.echo("Initialisation de la base de données...")
    init_db()
    click.echo("Base de données initialisée.")
    click.echo("Insertion des données par défaut (profils, prompts)...")
    try:
        with engine.begin() as conn:
            seed_default_data(conn)
        click.echo("Données par défaut insérées avec succès.")
    except Exception as e:
        click.echo(f"Erreur lors de l'insertion des données par défaut: {e}")

# ================================================================
# 2) API Routes
# ================================================================

@api_bp.route('/projects/<project_id>/export/thesis', methods=['GET'])
def export_for_thesis(project_id):
    """Export spécialisé pour thèse : données ATN + graphiques haute résolution."""
    try:
        uuid.UUID(project_id, version=4)
    except ValueError:
        return jsonify({'error': 'ID de projet invalide'}), 400

    session = Session()
    try:
        atn_data = session.execute(text("""
            SELECT extracted_data, stakeholder_perspective, ai_type,
                   ethical_considerations, stakeholder_barriers, stakeholder_facilitators
            FROM extractions
            WHERE project_id = :pid AND extracted_data IS NOT NULL
        """ ), {"pid": project_id}).mappings().all()

        metrics_query = """
            SELECT
                AVG(CASE WHEN extracted_data->>'Score_empathie_IA' ~ '^[0-9.]+$'
                    THEN CAST(extracted_data->>'Score_empathie_IA' AS FLOAT) END) as avg_ai_empathy,
                AVG(CASE WHEN extracted_data->>'Score_empathie_humain' ~ '^[0-9.]+$'
                    THEN CAST(extracted_data->>'Score_empathie_humain' AS FLOAT) END) as avg_human_empathy,
                COUNT(*) as total_studies,
                COUNT(CASE WHEN extracted_data->>'RGPD_conformité' = 'Oui' THEN 1 END) as gdpr_compliant,
                COUNT(CASE WHEN extracted_data->>'Type_IA' IS NOT NULL THEN 1 END) as ai_type_identified
            FROM extractions
            WHERE project_id = :pid
        """
        
        metrics = session.execute(text(metrics_query), {"pid": project_id}).mappings().fetchone()

        project_info = session.execute(text("""
            SELECT name, description, created_at, search_query, databases_used
            FROM projects WHERE id = :pid
        """ ), {"pid": project_id}).mappings().fetchone()

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
            if atn_data:
                df_atn = pd.DataFrame([dict(row) for row in atn_data])
                excel_buffer = io.BytesIO()
                with pd.ExcelWriter(excel_buffer, engine='openpyxl') as writer:
                    df_atn.to_excel(writer, sheet_name='Données_ATN', index=False)
                    metrics_df = pd.DataFrame([dict(metrics)])
                    metrics_df.to_excel(writer, sheet_name='Métriques_Agrégées', index=False)
                zf.writestr('donnees_atn_these.xlsx', excel_buffer.getvalue())

            export_data = {
                "project_info": dict(project_info) if project_info else {},
                "metrics": dict(metrics) if metrics else {},
                "export_date": datetime.now().isoformat(),
                "total_extractions": len(atn_data)
            }
            zf.writestr('export_metadata.json', json.dumps(export_data, indent=2, ensure_ascii=False))

            project_dir = PROJECTS_DIR / project_id
            if project_dir.exists():
                for graph_file in project_dir.glob("*.png"):
                    zf.write(graph_file, f"graphiques_these/{graph_file.name}")
                for graph_file in project_dir.glob("*.pdf"): # Versions vectorielles
                    zf.write(graph_file, f"graphiques_these/{graph_file.name}")

        buf.seek(0)
        return Response(
            buf.getvalue(),
            mimetype='application/zip',
            headers={'Content-Disposition': f'attachment;filename=export_these_{project_id}.zip'}
        )

    except Exception as e:
        logger.exception(f"Erreur export ATN: {e}")
        return jsonify({'error': 'Erreur interne du serveur'}), 500
    finally:
        session.close()

def get_base_prisma_checklist():
    # C'est la structure de données de ta checklist, avec des IDs uniques
    return {
        "methods": {
            "title": "Méthodes",
            "items": [
                {"id": "prisma-item-7", "text": "Présenter toutes les stratégies de recherche d'information"},
                # ... autres items de la section Méthodes
            ]
        },
        "results": {
            "title": "Résultats",
            "items": [
                 {"id": "prisma-item-16a", "text": "Donner le nombre d'enregistrements identifiés, inclus et exclus, et les raisons de l'exclusion."},
                 # ... autres items de la section Résultats
            ]
        }
        # ... autres sections
    }

@api_bp.route('/projects/<project_id>/prisma-checklist', methods=['GET', 'POST'])
@with_db_session
def handle_prisma_checklist(db_session, project_id):
    """Gère la checklist PRISMA-ScR du projet."""
    project = db_session.get(Project, project_id)
    if not project:
        return jsonify({"error": "Projet non trouvé"}), 404

    if request.method == 'GET':
        checklist_data = get_base_prisma_checklist()

        # Logique d'auto-complétion
        if project.search_query and project.databases_used:
            # Item 7: Stratégie de recherche
            if 'methods' in checklist_data and len(checklist_data['methods']['items']) > 0:
                checklist_data['methods']['items'][0]['status'] = 'auto-completed'

        if project.prisma_flow_path:
            # Item 16a: Diagramme de flux
            if 'results' in checklist_data and len(checklist_data['results']['items']) > 0:
                checklist_data['results']['items'][0]['status'] = 'auto-completed'

        # Récupérer l'état sauvegardé par l'utilisateur
        saved_state = json.loads(project.prisma_checklist or '{}')
        for section, data in checklist_data.items():
            for item in data['items']:
                item['checked'] = saved_state.get(item['id'], False)

        return jsonify(checklist_data)

    elif request.method == 'POST':
            data = request.get_json(force=True)
            db_session.execute(text("""
                UPDATE projects
                SET prisma_checklist = :checklist, updated_at = :ts
                WHERE id = :pid
            """ ), {
                "checklist": json.dumps(data.get('checklist', {})),
                "ts": datetime.now().isoformat(),
                "pid": project_id
            })
            db_session.commit()
            return jsonify({"message": "Checklist PRISMA-ScR sauvegardée"}), 200

@app.route('/api/projects/<project_id>/upload-zotero', methods=['POST'])
@with_db_session
def handle_zotero_file_upload(db_session, project_id):
    project = db_session.query(Project).filter(Project.id == project_id).first()
    if not project:
        return jsonify({"error": "Projet non trouvé"}), 404

    file = request.files.get('file')
    if not file:
        return jsonify({"error": "Aucun fichier fourni"}), 400

    project_path = os.path.join(app.config['PROJECTS_FOLDER'], str(project.id))
    os.makedirs(project_path, exist_ok=True)

    filename = secure_filename(file.filename)
    file_path = os.path.join(project_path, filename)
    file.save(file_path)

    task = q.enqueue('tasks.import_from_zotero_file', project_id=str(project.id), file_path=file_path)
    return jsonify({'message': f'Fichier {filename} téléversé, import en cours.', 'job_id': task.id}), 202

# --- Health ---
@api_bp.route('/health', methods=['GET'])
def health_check():
    try:
        redis_status = "connected" if redis_conn.ping() else "disconnected"
    except Exception as e:
        redis_status = "disconnected"
        logger.error(f"Erreur Redis health check: {e}")

    session = Session()
    try:
        session.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = "disconnected"
        logger.error(f"Erreur health check DB: {e}")
    finally:
        session.close()

    return jsonify({
        "status": "ok",
        "version": config.ANALYLIT_VERSION,
        "timestamp": datetime.now().isoformat(),
        "services": {"database": db_status, "redis": redis_status, "ollama": "unknown"}
    })

# --- Databases list (CORRIGÉ) ---
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
            """ ), project)

            PROJECTS_DIR.joinpath(project['id']).mkdir(exist_ok=True)
            session.commit()
            return jsonify(project), 201

    except Exception as e:
        logger.exception(f"Erreur handle_projects: {e}")
        return jsonify({'error': 'Erreur interne'}), 500

@api_bp.route('/projects/<project_id>', methods=['DELETE'])
@with_db_session
def delete_project(db_session, project_id):
    """Supprime un projet et ses données associées."""
    try:
        project = db_session.get(Project, project_id)
        if not project:
            return jsonify({"error": "Projet non trouvé"}), 404

        # Supprimer le dossier du projet sur le disque
        project_path = Path(config.PROJECTS_DIR) / str(project_id)
        if project_path.exists() and project_path.is_dir():
            # CORRECTION : Les "..." invalides ont été retirés
            shutil.rmtree(project_path)

        # Supprimer le projet de la base de données (les cascades devraient gérer le reste)
        db_session.delete(project)
        db_session.commit()

        logger.info(f"Projet {project_id} supprimé avec succès.")
        return jsonify({"message": "Projet supprimé"})

    except SQLAlchemyError as e:
        db_session.rollback()
        logger.exception(f"Erreur DB lors de la suppression du projet {project_id}: {e}")
        return jsonify({"error": "Erreur base de données"}), 500
    except Exception as e:
        db_session.rollback()
        logger.exception(f"Erreur inattendue lors de la suppression du projet {project_id}: {e}")
        return jsonify({"error": "Erreur interne du serveur"}), 500
    
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
        """ ), {"q": query, "dbs": json.dumps(databases), "now": datetime.now().isoformat(), "pid": project_id})
        session.commit()
    except SQLAlchemyError as e:
        logger.error(f"Erreur DB saving search params: {e}", exc_info=True)
        return jsonify({'error': 'Erreur interne'}), 500

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
        uuid.UUID(project_id, version=4)
    except ValueError:
        return jsonify({'error': 'ID de projet invalide'}), 400

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
        """ ), {**params, "limit": per_page, "offset": offset}).mappings().all()

        return jsonify({
            "results": [dict(r) for r in rows],
            "total": total,
            "page": page,
            "per_page": per_page,
            "has_next": (offset + per_page) < total,
            "has_prev": page > 1
        })

    except Exception as e:
        logger.exception(f"Erreur dans get_project_search_results: {e}")
        return jsonify({'error': 'Erreur interne'}), 500

@api_bp.route('/projects/<project_id>/search-stats', methods=['GET'])
def get_project_search_stats(project_id):
    try:
        uuid.UUID(project_id, version=4)
    except ValueError:
        return jsonify({'error': 'ID de projet invalide'}), 400

    session = Session()
    try:
        # Récupération des statistiques par base de données
        stats = session.execute(text("""
            SELECT database_source, COUNT(*) as count
            FROM search_results WHERE project_id = :pid
            GROUP BY database_source
        """ ), {"pid": project_id}).mappings().all()
        
        total = session.execute(text("SELECT COUNT(*) FROM search_results WHERE project_id = :pid"),
                              {"pid": project_id}).scalar_one()

        return jsonify({
            "total_results": total,
            "results_by_database": {r["database_source"]: r["count"] for r in stats}
        })
    except Exception as e:
        logger.exception(f"Erreur dans get_project_search_stats: {e}")
        return jsonify({'error': 'Erreur interne'}), 500
    finally:
        session.close()

# --- Upload et gestion des fichiers ---
@api_bp.route('/projects/<project_id>/upload-pdfs-bulk', methods=['POST'])
def upload_pdfs_bulk(project_id):
    try:
        uuid.UUID(project_id, version=4)
    except ValueError:
        return jsonify({'error': 'ID de projet invalide'}), 400

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
    try:
        uuid.UUID(project_id, version=4)
    except ValueError:
        return jsonify({'error': 'ID de projet invalide'}), 400

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
        logger.exception(f"Erreur upload_pdf_for_article: {e}")
        return jsonify({'error': 'Erreur lors de l\'upload'}), 500


@api_bp.route('/projects/<project_id>/files', methods=['GET'])
def list_project_files(project_id):
    try:
        uuid.UUID(project_id, version=4)
    except ValueError:
        return jsonify({'error': 'ID de projet invalide'}), 400

    project_dir = PROJECTS_DIR / project_id
    if not project_dir.is_dir():
        return jsonify([])

    pdf_files = [{"filename": f.name} for f in project_dir.glob("*.pdf")]
    return jsonify(pdf_files)

@app.route('/projects/<project_id>/files/<filename>')
def serve_project_file(project_id, filename):
    """Sert un fichier statique depuis le dossier d'un projet spécifique."""
    # Sécurisation du chemin
    # Il est plus sûr de ne pas interroger la DB ici pour un simple service de fichier.
    # La validation de l'UUID est suffisante pour prévenir la plupart des abus.
    project_path = os.path.join(config.PROJECTS_DIR, str(project_id))
    try:
        return send_from_directory(project_path, filename)  # type: ignore
    except FileNotFoundError:
        return jsonify({"error": "Fichier non trouvé"}), 404

def run_indexing(project_id):
    job = background_queue.enqueue(index_project_pdfs_task, project_id=project_id, job_timeout='1h')
    session = Session()
    try:
        session.execute(text("UPDATE projects SET status = 'indexing', updated_at = :t WHERE id = :pid"),
                       {"t": datetime.now().isoformat(), "pid": project_id})
        session.commit()
    except Exception as e:
        logger.exception(f"Erreur DB dans run_indexing: {e}")
        # La tâche est déjà en file d'attente, on ne retourne pas d'erreur au client

    return jsonify({'message': "Indexation lancée.", 'job_id': job.id}), 202

# --- Extractions ---
@api_bp.route('/projects/<project_id>/index-pdfs', methods=['POST'])
def run_index_pdfs(project_id):
    """Lance l'indexation des PDFs pour le chat RAG."""
    try:
        # Validation de l'UUID
        try:
            uuid.UUID(project_id, version=4)
        except ValueError:
            return jsonify({'error': 'ID de projet invalide'}), 400

        # Mise en file d'attente dans la file "background"
        job = background_queue.enqueue(
            index_project_pdfs_task,
            project_id=project_id,
            job_timeout='1h'  # Timeout généreux pour les gros projets
        )

        # Notifier que la tâche a bien été lancée
        send_project_notification(
            project_id,
            'info',
            "Lancement de l'indexation des PDFs en arrière-plan."
        )

        return jsonify({'message': 'Indexation des PDFs lancée en arrière-plan.', 'job_id': job.id}), 202

    except Exception as e:
        logger.exception(f"Erreur lors du lancement de l\'indexation pour le projet {project_id}: {e}")
        return jsonify({'error': "Erreur interne du serveur lors du lancement de la tâche."}), 500

@api_bp.route('/projects/<project_id>/results', methods=['GET'])
def get_project_results(project_id):
    """Récupère les résultats de recherche d'un projet."""
    session = Session()
    try:
        try:
            uuid.UUID(project_id, version=4)
        except ValueError:
            return jsonify({'error': 'ID de projet invalide'}), 400

        # Validation de l'UUID déjà faite
        # Récupérer les résultats de recherche pour le projet
        rows = session.execute(text("""
            SELECT * FROM search_results
            WHERE project_id = :pid
            ORDER BY created_at DESC
        """ ), {"pid": project_id}).mappings().all()

        results = [dict(row) for row in rows]
        return jsonify(results), 200

    except SQLAlchemyError as e:
        logger.error(f"Erreur DB get_project_results: {e}", exc_info=True)
        return jsonify({"error": "Erreur lors de la récupération des résultats"}), 500

# --- Profils et prompts ---
@api_bp.route('/profiles', methods=['GET', 'POST'])
@with_db_session
def create_profile(db_session):
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({"error": "Le nom du profil est requis"}), 400

    new_profile = Profile(
        name=data['name'],
        description=data.get('description', ''),
        model_name=data.get('model_name', 'default'),
        temperature=data.get('temperature', 0.7),
        context_length=data.get('context_length', 4096)
    )

    db_session.add(new_profile)
    try:
        db_session.commit()
    except Exception as e:
        db_session.rollback()
        logger.exception("Erreur lors de la création du profil.")
        return jsonify({"error": "Erreur interne du serveur"}), 500

    return jsonify(new_profile.to_dict()), 201

@api_bp.route('/profiles/<profile_id>', methods=['DELETE'])
@with_db_session
def delete_profile(db_session, profile_id):
    profile = db_session.get(Profile, profile_id)
    if not profile:
        return jsonify({"error": "Profil non trouvé"}), 404

    db_session.delete(profile)
    try:
        db_session.commit()
    except Exception as e:
        db_session.rollback()
        logger.exception("Erreur lors de la suppression du profil.")
        return jsonify({"error": "Erreur interne du serveur"}), 500

    return jsonify({"message": "Profil supprimé"})

@api_bp.route('/profiles/<profile_id>', methods=['PUT'])
@with_db_session
def update_profile(db_session, profile_id):
    profile = db_session.get(Profile, profile_id)
    if not profile:
        return jsonify({"error": "Profil non trouvé"}), 404

    data = request.get_json()
    if not data:
        return jsonify({"error": "Données manquantes"}), 400

    profile.name = data.get('name', profile.name)
    profile.description = data.get('description', profile.description)
    profile.model_name = data.get('model_name', profile.model_name)
    profile.temperature = data.get('temperature', profile.temperature)
    profile.context_length = data.get('context_length', profile.context_length)

    try:
        db_session.commit() # type: ignore
    except Exception as e:
        db_session.rollback()
        logger.exception("Erreur lors de la mise à jour du profil.")
        return jsonify({'error': 'Erreur interne'}), 500
 
    return jsonify(profile.to_dict())

@api_bp.route('/projects/<project_id>/analysis-profile', methods=['PUT'])
@with_db_session
def update_analysis_profile(db_session, project_id):
    project = db_session.get(Project, project_id)
    if not project:
        return jsonify({"error": "Projet non trouvé"}), 404

    data = request.get_json()
    profile_id = data.get('profile_id')
    if not profile_id:
        return jsonify({"error": "ID de profil manquant"}), 400

    profile = db_session.get(AnalysisProfile, profile_id)
    if not profile:
        return jsonify({"error": "Profil d'analyse non trouvé"}), 404

    project.analysis_profile_id = profile_id
    try:
        db_session.commit()
    except Exception as e:
        db_session.rollback()
        logger.exception(f"Erreur lors de la mise à jour du profil pour le projet {project_id}")
        return jsonify({"error": "Erreur interne"}), 500

    return jsonify({"message": "Profil d'analyse mis à jour"})

# ALIAS pour compatibilité frontend: /analysis-profiles
@api_bp.route('/analysis-profiles', methods=['GET', 'POST'])
@with_db_session
def handle_analysis_profiles_alias(db_session):
    if request.method == 'GET':
        profiles = db_session.query(Profile).order_by(Profile.name).all()
        return jsonify([p.to_dict() for p in profiles])

@api_bp.route('/prompts/<prompt_id>', methods=['PUT'])
@with_db_session
def update_prompt(db_session, prompt_id):
    prompt = db_session.get(Prompt, prompt_id)
    if not prompt:
        return jsonify({"error": "Prompt non trouvé"}), 404

    data = request.get_json()
    if not data:
        return jsonify({"error": "Données manquantes"}), 400

    prompt.name = data.get('name', prompt.name)
    prompt.content = data.get('content', prompt.content)
    prompt.is_default = data.get('is_default', prompt.is_default)
    prompt.analysis_type = data.get('analysis_type', prompt.analysis_type)

    try:
        db_session.commit()
    except Exception as e:
        db_session.rollback()
        logger.exception("Erreur lors de la mise à jour du prompt.")
        return jsonify({"error": "Erreur interne"}), 500

    return jsonify(prompt.to_dict())

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
            """ ), {
                "name": data['name'],
                "description": data['description'],
                "template": data['template']
            })
            session.commit()
            return jsonify({'message': 'Prompt sauvegardé'}), 201

    except Exception as e:
        logger.exception(f"Erreur handle_prompts: {e}")
        return jsonify({'error': 'Erreur interne'}), 500

# --- Grilles d'extraction ---
@api_bp.route('/projects/<project_id>/grids', methods=['GET', 'POST'])
@with_db_session
def handle_extraction_grids(db_session, project_id):
    try:
        uuid.UUID(project_id, version=4)
    except ValueError:
        return jsonify({'error': 'ID de projet invalide'}), 400

    if request.method == 'GET':
        try:
            rows = db_session.execute(text("""
                SELECT id, name, fields, created_at FROM extraction_grids
                WHERE project_id = :pid ORDER BY created_at DESC            """ ), {"pid": project_id}).mappings().all()

            grids = []
            for r in rows:
                g = dict(r)
                try:
                    g['fields'] = json.loads(g['fields'])
                except Exception:
                    g['fields'] = []
                grids.append(g)

            return jsonify(grids)
        except Exception as e:
            logger.exception(f"Erreur grids_collection: {e}")
            return jsonify({'error': 'Erreur interne du serveur'}), 500
    
    # La méthode POST est maintenant gérée par la fonction create_grid ci-dessous
    # pour une meilleure séparation des préoccupations.

@api_bp.route('/grids/<grid_id>', methods=['PUT'])
@with_db_session
def update_grid(db_session, grid_id):
    grid = db_session.get(Grid, grid_id)
    if not grid:
        return jsonify({"error": "Grille non trouvée"}), 404

    data = request.get_json()
    if not data:
        return jsonify({"error": "Données manquantes"}), 400

    grid.name = data.get('name', grid.name)
    grid.description = data.get('description', grid.description)

    # Mise à jour des champs (suppression puis recréation)
    db_session.query(GridField).filter(GridField.grid_id == grid_id).delete()

    new_fields = data.get('fields', [])
    for field_data in new_fields:
        field = GridField(
            grid_id=grid.id,
            name=field_data.get('name'),
            description=field_data.get('description')
        )
        db_session.add(field)

    try:
        db_session.commit()
    except Exception as e:
        db_session.rollback()
        logger.exception(f"Erreur lors de la mise à jour de la grille {grid_id}")
        return jsonify({"error": "Erreur interne du serveur"}), 500

    return jsonify(grid.to_dict())

@api_bp.route('/projects/<project_id>/grids', methods=['POST'])
@with_db_session
def create_grid(db_session, project_id):
    project = db_session.get(Project, project_id)
    if not project:
        return jsonify({"error": "Projet non trouvé"}), 404

    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({"error": "Le nom de la grille est requis"}), 400

    new_grid = Grid(
        id=uuid.uuid4(),
        project_id=project_id,
        name=data['name'],
        description=data.get('description', '')
    )

    db_session.add(new_grid)
    try:
        db_session.commit()
    except SQLAlchemyError as e:
        db_session.rollback()
        logger.exception(f"Erreur DB lors de la création de la grille pour le projet {project_id}: {e}")
        return jsonify({"error": "Erreur base de données"}), 500

    return jsonify(new_grid.to_dict()), 201

@api_bp.route('/grids/<grid_id>/fields', methods=['POST'])
@with_db_session
def add_field_to_grid(db_session, grid_id):
    grid = db_session.get(Grid, grid_id)
    if not grid:
        return jsonify({"error": "Grille non trouvée"}), 404

    data = request.get_json()
    if not data or not data.get('name') or 'type' not in data:
        return jsonify({"error": "Le nom et le type du champ sont requis"}), 400

    new_field = GridField(
        id=uuid.uuid4(),
        grid_id=grid_id,
        name=data['name'],
        field_type=data['type'],
        description=data.get('description', '')
    )

    db_session.add(new_field)
    try:
        db_session.commit()
    except SQLAlchemyError as e:
        db_session.rollback()
        logger.exception(f"Erreur DB lors de l\'ajout du champ à la grille {grid_id}: {e}")
        return jsonify({"error": "Erreur base de données"}), 500

    return jsonify(new_field.to_dict()), 201

@api_bp.route('/projects/<project_id>/grids/import', methods=['POST'])
def import_grid_from_file(project_id):
    try:
        uuid.UUID(project_id, version=4)
    except ValueError:
        return jsonify({'error': 'ID de projet invalide'}), 400

    if 'file' not in request.files:
        return jsonify({'error': "Aucun fichier n'a été envoyé"}), 400

    file = request.files['file']
    if file.filename == '' or not file.filename.endswith('.json'):
        return jsonify({'error': "Veuillez sélectionner un fichier .json"}), 400

    try:
        grid_data = json.load(file.stream)
        grid_name = grid_data.get('name')
        grid_fields = grid_data.get('fields')

        if not grid_name or not isinstance(grid_fields, list):
            return jsonify({"error": "Le JSON doit contenir 'name' (string) et 'fields' (liste de strings)"}), 400

        # Transformer la liste de strings en liste d'objets pour être cohérent
        formatted_fields = [{"name": field, "description": ""} for field in grid_fields]

        session = Session()
        try:
            session.execute(text("""
                INSERT INTO extraction_grids (id, project_id, name, fields, created_at)
                VALUES (:id, :pid, :n, :f, :t)
            """ ), {"id": str(uuid.uuid4()), "pid": project_id, "n": grid_name,
                   "f": json.dumps(formatted_fields), "t": datetime.now().isoformat()})
            session.commit()
        except Exception as e:
            logger.exception(f"Erreur DB import grid: {e}")
            return jsonify({'error': 'Erreur interne du serveur'}), 500

        return jsonify({'message': 'Grille importée avec succès'}), 201

    except json.JSONDecodeError:
        return jsonify({'error': 'Fichier JSON invalide'}), 400
    except Exception as e:
        logger.exception(f"Erreur import grid: {e}")
        return jsonify({'error': 'Erreur interne du serveur'}), 500

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
@api_bp.route('/projects/<project_id>/analyses', methods=['GET'])
def get_project_analyses(project_id):
    """
    Retourne un petit objet JSON résumant l'état et les sorties d'analyse
    pour alimenter l'onglet 'Analyses' du frontend.
    """
    session = Session()
    try:
        uuid.UUID(project_id, version=4)
    except ValueError:
        return jsonify({'error': 'ID de projet invalide'}), 400

    try:
        row = session.execute(text("""
            SELECT
                status,
                analysis_result,
                analysis_plot_path,
                synthesis_result,
                discussion_draft,
                knowledge_graph,
                prisma_flow_path
            FROM projects
            WHERE id = :pid
        """ ), {"pid": project_id}).mappings().fetchone()

        if not row:
            return jsonify({"error": "Projet introuvable"}), 404

        # Normalisation des champs (JSON string -> dict)
        def _safe_load(s):
            try:
                return json.loads(s) if isinstance(s, str) and s.strip() else None
            except (json.JSONDecodeError, TypeError):
                return s if isinstance(s, (dict, list)) else None  # Retourne la donnée si déjà un dict/list

        analysis_data = {
            "status": row.get("status"),
            "analysis_result": _safe_load(row.get("analysis_result")),
            "analysis_plot_path": row.get("analysis_plot_path"),
            "synthesis_result": _safe_load(row.get("synthesis_result")),
            "discussion_draft": row.get("discussion_draft"),
            "knowledge_graph": _safe_load(row.get("knowledge_graph")),
            "prisma_flow_path": row.get("prisma_flow_path"),
        }

        return jsonify(analysis_data), 200

    except Exception as e:
        logger.exception(f"Erreur get_project_analyses: {e}")
        return jsonify({'error': 'Erreur interne'}), 500

# --- Export projet ---

@api_bp.route('/projects/<project_id>/add-manual-articles', methods=['POST'])
def add_manual_articles(project_id):
    """
    Lance l'ajout asynchrone d'articles manuellement (PMID, DOI, arXiv) au projet.
    """
    try:
        uuid.UUID(project_id, version=4)
    except ValueError:
        return jsonify({'error': 'ID de projet invalide'}), 400
    try:
        data = request.get_json(force=True) or {}
        raw = data.get('identifiers', '') or ''
        items = data.get('items')
        if isinstance(items, list) and items:
            identifiers = [str(x).strip() for x in items if str(x).strip()]
        else:
            identifiers = [line.strip() for line in str(raw).splitlines() if line.strip()]
        if not identifiers:
            return jsonify({'error': 'Aucun identifiant fourni.'}), 400

        job = background_queue.enqueue(
            add_manual_articles_task,
            project_id=project_id,
            identifiers=identifiers,
            job_timeout='30m'
        )

        return jsonify({'message': f'Ajout de {len(identifiers)} article(s) lancé en arrière-plan.', 'job_id': job.id}), 202
    except Exception as e:
        logger.exception(f"Erreur add_manual_articles: {e}")
        return jsonify({'error': "Erreur lors du lancement de l\'ajout des articles."}), 500
        
@api_bp.route('/projects/<project_id>/export-analyses', methods=['GET'])
def export_project_analyses(project_id):
    """Exporte les résultats d'analyse d'un projet dans une archive ZIP."""
    return export_project_analyses(project_id)

# --- Statut détaillé des files (remplace/complète les endpoints de queues) ---
@api_bp.route('/admin/queues-status', methods=['GET'])
def get_queues_status():
    """Retourne un statut consolidé et stable pour l\'UI (évite [object Promise])."""
    try:
        queues = [
            ('analylit_processing_v4', processing_queue, 'Traitement des articles'),
            ('analylit_synthesis_v4', synthesis_queue, 'Synthèses et analyses'),
            ('analylit_analysis_v4', analysis_queue, 'Analyses avancées'),
            ('analylit_background_v4', background_queue, 'Arrière-plan')
        ]

        all_workers = Worker.all(connection=redis_conn)

        # Compte des workers à l\'écoute de chaque file réelle RQ
        worker_map = {qname: 0 for qname, _, _ in queues}
        for w in all_workers:
            try:
                names = [n.decode() if isinstance(n, bytes) else n for n in w.queue_names()]
            except Exception:
                names = []
            for qname, qobj, _ in queues:
                if qobj.name in names:
                    worker_map[qname] += 1

        payload = []
        for qname, qobj, label in queues:
            payload.append({
                "rq_name": qobj.name,
                "display": label,
                "pending": len(qobj),
                "started": len(qobj.started_job_registry),
                "failed": len(qobj.failed_job_registry),
                "finished": len(qobj.finished_job_registry),
                "scheduled": len(qobj.scheduled_job_registry),
                "workers": worker_map.get(qname, 0)
            })

        return jsonify({"queues": payload, "timestamp": datetime.now().isoformat()}), 200

    except Exception as e:
        logger.exception(f"Erreur get_queues_status: {e}")
        return jsonify({"queues": []}), 200

@api_bp.route('/projects/<project_id>/import-zotero', methods=['POST'])
def import_from_zotero(project_id):
    try:
        uuid.UUID(project_id, version=4)
    except ValueError:
        return jsonify({'error': 'ID de projet invalide'}), 400

    data = request.get_json(force=True)
    manual_ids = data.get('articles', [])

    try:
        with open(PROJECTS_DIR / 'zotero_config.json', 'r') as f:
            zotero_config = json.load(f)
    except FileNotFoundError:
        return jsonify({'error': 'Veuillez configurer Zotero dans les paramètres.'}), 400

    if not manual_ids:
        return jsonify({'error': 'Aucun article à importer pour ce projet.'}), 400

    # La logique d'ajout d'article est déjà gérée côté client ou via une autre route.
    # Cette tâche se concentre sur la récupération des PDFs.
    # CORRECTION: Appel de la bonne tâche pour récupérer les PDFs depuis Zotero.
    job = background_queue.enqueue(
        import_pdfs_from_zotero_task,
        project_id=project_id,
        pmids=manual_ids,
        zotero_user_id=zotero_config.get('user_id'),
        zotero_api_key=zotero_config.get('api_key'),
        job_timeout='1h'
    )

    return jsonify({
        'message': f'Import Zotero lancé pour {len(manual_ids)} articles.',
        'job_id': job.id
    }), 202

@api_bp.route('/projects/<project_id>/import-zotero-file', methods=['POST'])
def import_from_zotero_file(project_id):
    try:
        uuid.UUID(project_id, version=4)
    except ValueError:
        return jsonify({'error': 'ID de projet invalide'}), 400

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
        return jsonify({"error": "Erreur interne lors de la sauvegarde du fichier."}, 500)

    job = background_queue.enqueue(
        import_from_zotero_file_task,
        project_id=project_id,
        json_file_path=str(temp_filepath),
        job_timeout='1h'
    )

    return jsonify({'message': 'Import du fichier Zotero lancé.', 'job_id': job.id}), 202

@api_bp.route('/projects/<project_id>/fetch-online-pdfs', methods=['POST'])
def fetch_online_pdfs(project_id):
    try:
        uuid.UUID(project_id, version=4)
    except ValueError:
        return jsonify({'error': 'ID de projet invalide'}), 400

    data = request.get_json(force=True)
    article_ids = data.get('articles', [])

    if not article_ids:
        return jsonify({'error': 'Aucun article valide à traiter pour ce projet.'}), 400

    for article_id in article_ids:
        background_queue.enqueue(
            fetch_online_pdf_task,
            project_id=project_id,
            article_id=article_id,
            job_timeout='1h'
        )

    return jsonify({
        'message': f'Recherche OA lancée pour {len(article_ids)} articles.'
    }), 202

# --- Pipeline d'analyse ---
@api_bp.route('/projects/<project_id>/run', methods=['POST'])
def run_project_pipeline(project_id):
    try:
        uuid.UUID(project_id, version=4)
    except ValueError:
        return jsonify({'error': 'ID de projet invalide'}), 400

    data = request.get_json(force=True)
    selected_articles = data.get('articles', [])
    profile_id = data.get('profile', 'standard')
    custom_grid_id = data.get('custom_grid_id')
    analysis_mode = data.get('analysis_mode', 'screening')

    if not selected_articles:
        return jsonify({'error': "La liste d'articles est requise."}, 400)

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
        """ ), {
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

        return jsonify({'status': 'processing'}), 202

    except Exception as e:
        logger.exception(f"run_project_pipeline error: {e}")
        return jsonify({'error': 'Erreur interne'}), 500

@api_bp.route('/projects/<project_id>/run-synthesis', methods=['POST'])
def run_synthesis_endpoint(project_id):
    try:
        uuid.UUID(project_id, version=4)
    except ValueError:
        return jsonify({'error': 'ID de projet invalide'}), 400

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

    except SQLAlchemyError as e:
        logger.error(f"Erreur DB dans run_synthesis_endpoint: {e}", exc_info=True)
        return jsonify({'error': 'Erreur de base de données'}), 500
    except Exception as e:
        logger.exception(f"Erreur inattendue dans run_synthesis_endpoint: {e}")
        return jsonify({'error': 'Erreur interne'}), 500

    return jsonify({"status": "synthesizing", "message": "Synthèse lancée."}), 202

# --- Ajout pour la validation ---
@api_bp.route('/projects/<project_id>/extractions/<extraction_id>/decision', methods=['PUT'])
def save_extraction_decision(project_id, extraction_id):
    """Sauvegarde la décision d'un évaluateur pour une extraction."""
    # Pas de validation UUID ici car extraction_id n'est pas un UUID
    data = request.get_json(force=True)
    decision = data.get('decision')
    evaluator = data.get('evaluator', 'evaluator1')

    if decision not in ['include', 'exclude', '']:
        return jsonify({'error': 'Décision invalide'}), 400

    session = Session()
    try:
        extraction = session.execute(text("""
            SELECT id, validations FROM extractions
            WHERE project_id = :pid AND id = :eid
        """ ), {"pid": project_id, "eid": extraction_id}).mappings().fetchone()

        if not extraction:
            return jsonify({'error': 'Extraction non trouvée'}), 404

        try:
            validations_data = json.loads(extraction['validations']) if extraction['validations'] else {}
        except (json.JSONDecodeError, TypeError):
            validations_data = {}

        # Mettre à jour le JSON et le statut principal
        validations_data[evaluator] = decision if decision else None

        # CORRECTION : Mettre à jour la colonne user_validation_status
        session.execute(text("""
            UPDATE extractions SET validations = :validations, user_validation_status = :status WHERE id = :eid
        """ ), {
            "validations": json.dumps(validations_data),
            "status": decision if decision else None,  # Mettre à jour le statut direct
            "eid": extraction_id
        })
        session.commit()

        send_project_notification(project_id, 'validation_updated', f'Validation mise à jour pour {extraction_id}')
        return jsonify({'message': 'Décision enregistrée'}), 200

    except Exception as e:
        logger.exception(f"Erreur save_extraction_decision: {e}")
        return jsonify({'error': 'Erreur interne du serveur'}), 500

@api_bp.route('/projects/<project_id>/validate-article', methods=['POST'])
def validate_article_endpoint(project_id):
    """
    CORRECTION: Route manquante pour la validation manuelle depuis la section Validation.
    Met à jour le statut de validation d'un article (extraction).
    """
    try:
        uuid.UUID(project_id, version=4)
    except ValueError:
        return jsonify({'error': 'ID de projet invalide'}), 400

    session = Session()
    try:
        data = request.get_json(force=True)
        article_id = data.get('article_id')
        decision = data.get('decision')  # 'include' ou 'exclude'
        score = data.get('score')
        justification = data.get('justification')

        if not all([article_id, decision]):
            return jsonify({'error': 'article_id et decision sont requis'}), 400

        # Trouver l'extraction correspondante
        extraction = session.execute(text("""
            SELECT id FROM extractions WHERE project_id = :pid AND pmid = :pmid
        """ ), {"pid": project_id, "pmid": article_id}).mappings().fetchone()

        if not extraction:
            return jsonify({'error': 'Extraction non trouvée pour cet article'}), 404

        # Mettre à jour l'extraction
        session.execute(text("""
            UPDATE extractions
            SET user_validation_status = :decision, relevance_score = :score, relevance_justification = :justification
            WHERE id = :id
        """ ), {
            "decision": decision,
            "score": score,
            "justification": justification,
            "id": extraction['id']
        })
        session.commit()

        send_project_notification(project_id, 'validation_updated', f'Article {article_id} validé comme "{decision}".')
        return jsonify({'message': 'Validation enregistrée avec succès'}), 200

    except Exception as e:
        session.rollback()
        logger.error(f"Erreur validate_article_endpoint: {e}", exc_info=True)
        return jsonify({'error': 'Erreur interne du serveur'}), 500
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
        """ ), {"pid": project_id}).mappings().all()

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
            return jsonify({"message": "Aucune validation évaluateur 1 à exporter."}, 404)

        df = pd.DataFrame(records)
        csv_data = df.to_csv(index=False)

        return Response(
            csv_data,
            mimetype='text/csv',
            headers={'Content-Disposition': f'attachment; filename=validations_eval1_{project_id}.csv'}
        )

    except Exception as e:
        logger.exception(f"Erreur export validations: {e}")
        return jsonify({'error': 'Erreur interne du serveur'}), 500

@api_bp.route('/projects/<project_id>/import-validations', methods=['POST'])
def import_validations(project_id):
    """
    Importe les décisions de validation (inclure/exclure) depuis un fichier CSV
    pour un deuxième évaluateur.
    """
    try:
        uuid.UUID(project_id, version=4)
    except ValueError:
        return jsonify({'error': 'ID de projet invalide'}), 400

    if 'file' not in request.files:
        return jsonify({'error': 'Aucun fichier fourni'}), 400

    file = request.files['file']
    if not file or file.filename == '':
        return jsonify({'error': 'Fichier vide ou non sélectionné'}), 400

    session = db_session()
    try:
        df = pd.read_csv(file.stream)
        # Normalise les noms de colonnes (enlève les espaces, met en minuscules)
        normalized_columns = {str(c).strip().lower(): c for c in df.columns}

        # Vérifie la présence des colonnes requises
        required_keys = {"articleid", "decision"}
        if not required_keys.issubset(normalized_columns.keys()):
            return jsonify({'error': "Le fichier CSV doit contenir les colonnes 'articleId' et 'decision'"}), 400

        updated_count = 0
        for _, row in df.iterrows():
            article_id = str(row[normalized_columns["articleid"]]).strip()
            decision = str(row[normalized_columns["decision"]]).strip().lower()

            # Mappe les différentes variations de décision vers les valeurs standard
            decision_mapping = {
                "inclure": "include", "inclu": "include",
                "exclure": "exclude", "exclu": "exclude"
            }
            # Utilise la valeur mappée ou la valeur originale si elle est déjà correcte ("include" ou "exclude")
            final_decision = decision_mapping.get(decision, decision)

            if not article_id or final_decision not in ("include", "exclude"):
                continue  # Ignore les lignes invalides

            # Trouve l'extraction correspondante dans la base de données
            extraction = session.query(Extraction).filter_by(project_id=project_id, pmid=article_id).first()

            if not extraction:
                continue # Ignore si l'article n'est pas trouvé dans le projet

            # Met à jour le champ de validations (JSON)
            try:
                validations = json.loads(extraction.validations) if extraction.validations else {}
            except (json.JSONDecodeError, TypeError):
                validations = {}

            validations["evaluator2"] = final_decision
            extraction.validations = json.dumps(validations, ensure_ascii=False)
            updated_count += 1

        session.commit()
        logger.info(f"{updated_count} validations importées avec succès pour le projet {project_id}.")
        return jsonify({'message': f"{updated_count} validations ont été importées pour l'évaluateur 2."}), 200

    except pd.errors.ParserError:
        logger.warning(f"Échec de l'importation : le fichier pour le projet {project_id} n'est pas un CSV valide.")
        return jsonify({'error': 'Le fichier fourni n\'est pas un CSV valide.'}), 400
    except Exception as e:
        session.rollback()
        logger.exception(f"Erreur inattendue lors de l'importation des validations pour le projet {project_id}: {e}")
        return jsonify({'error': 'Une erreur interne est survenue.'}), 500
    finally:
        # S'assure que la session est fermée à la fin de la requête
        db_session.remove()
        
@api_bp.route('/projects/<project_id>/calculate-kappa', methods=['POST'])
def calculate_project_kappa(project_id, db_session=None):
    try:
        uuid.UUID(project_id, version=4)
    except ValueError:
        return jsonify({'error': 'ID de projet invalide'}), 400

    try:
        job = analysis_queue.enqueue(calculate_kappa_task, project_id=project_id, job_timeout='10m')
        return jsonify({"message": "Calcul du Kappa lancé.", "job_id": job.id}), 202
    except Exception as e:  # CORRECTION : Ajout de la clause except manquante
        logger.exception(f"Erreur lors de la mise en file d'attente du calcul Kappa: {e}")
        return jsonify({'error': 'Erreur interne du serveur'}), 500

@api_bp.route('/projects/<project_id>/inter-rater-stats', methods=['GET'])
def get_inter_rater_stats(project_id):
    session = Session()
    try:
        try:
            uuid.UUID(project_id, version=4)
        except ValueError:
            return jsonify({'error': 'ID de projet invalide'}), 400

        # Validation de l\'UUID déjà faite
        row = session.execute(text("""
            SELECT inter_rater_reliability FROM projects WHERE id = :pid
        """ ), {"pid": project_id}).mappings().fetchone()

        return jsonify({
            "kappa_result": row["inter_rater_reliability"] if row else "Non calculé"
        })

    except Exception as e:
        logger.exception(f"Erreur inter-rater stats: {e}")
        return jsonify({'error': 'Erreur interne du serveur'}), 500

# ================================================================
# --- Rapports & Exports pour la Thèse ---
# ================================================================

@api_bp.route('/projects/<project_id>/reports/summary-table', methods=['GET'])
def get_summary_table_data(project_id):
    """Fournit les données extraites des articles inclus pour un tableau de synthèse."""
    session = Session()
    try:
        project = session.query(Project).get(project_id)
        if not project:
            return jsonify({"error": "Projet non trouvé"}), 404

        # CORRECTION: Charger le profil pour obtenir prompt_id
        profile = session.query(AnalysisProfile).filter_by(id=project.profile_used).first()
        if not profile:
            return jsonify({"error": "Profil d'analyse non trouvé pour ce projet"}), 404

        # Logique de récupération des données pour le tableau de synthèse
        rows = session.execute(text("""
            SELECT pmid, title, extracted_data
            FROM extractions
            WHERE project_id = :pid AND user_validation_status = 'include'
        """ ), {"pid": project_id}).mappings().all()

        return jsonify([dict(r) for r in rows])

    except Exception as e:
        logger.exception(f"Erreur get_summary_table_data pour projet {project_id}: {e}")
        return jsonify({'error': 'Erreur interne du serveur'}), 500

def format_citation(article, style='apa'):
    """Formate une citation simple pour un article."""
    authors = article.get('authors', 'Auteur inconnu')
    year = article.get('publication_date', 's.d.')
    title = article.get('title', 'Titre inconnu')
    journal = article.get('journal', 'Journal inconnu')

    # Simplification : ne prend que le premier auteur pour l'instant
    first_author = authors.split(',')[0].split(' ')[0] if authors else 'Auteur inconnu'

    if style == 'apa':
        return f"{first_author}, {year}. {title}. *{journal}*."
    elif style == 'vancouver':
        return f"{first_author}. {title}. {journal}. {year}."
    else:
        return f"[{first_author} ({year})] {title}"

@api_bp.route('/projects/<project_id>/reports/bibliography', methods=['GET'])
def get_bibliography(project_id):
    """Génère une bibliographie formatée pour les articles inclus."""
    try:
        uuid.UUID(project_id, version=4)
    except ValueError:
        return jsonify({'error': 'ID de projet invalide'}), 400

    style = request.args.get('style', 'apa')
    session = Session()
    try:
        # On récupère les détails des articles inclus depuis la table search_results
        query = text("""
            SELECT sr.* FROM search_results sr
            JOIN extractions e ON sr.article_id = e.pmid AND sr.project_id = e.project_id
            WHERE e.project_id = :pid AND e.user_validation_status = 'include'
        """ )
        articles = session.execute(query, {"pid": project_id}).mappings().all()
        bibliography = [format_citation(dict(art), style) for art in articles]

        return jsonify(bibliography)

    except SQLAlchemyError as e:
        logger.error(f"Erreur DB get_bibliography: {e}", exc_info=True)
        return jsonify({'error': 'Erreur interne du serveur'}), 500
    except Exception as e:
        logger.exception(f"Erreur get_bibliography: {e}")
        return jsonify({'error': 'Erreur interne du serveur'}), 500

@api_bp.route('/projects/<project_id>/risk-of-bias', methods=['GET', 'POST'])
@with_db_session
def handle_risk_of_bias(db_session, project_id):
    """Gère la récupération et la sauvegarde des évaluations de risque de biais."""
    project = db_session.query(Project).get(project_id)
    if not project:
        return jsonify({"error": "Projet non trouvé"}), 404

    if request.method == 'GET':
        rows = db_session.execute(text("SELECT * FROM risk_of_bias WHERE project_id = :pid"),
                                 {"pid": project_id}).mappings().all()
        return jsonify([dict(r) for r in rows])

    elif request.method == 'POST':
        try:
            data = request.get_json()
            if not data:
                return jsonify({"error": "Données manquantes"}), 400
            
            # TODO: Ajouter ici la logique de sauvegarde des évaluations RoB
            # Par exemple :
            # - Valider les données reçues
            # - Créer/mettre à jour l'enregistrement dans risk_of_bias
            # - Sauvegarder en base
            
            db_session.commit()
            return jsonify({"message": "Évaluation RoB sauvegardée"}), 200
            
        except Exception as e:
            db_session.rollback()
            logger.exception(f"Erreur lors de la sauvegarde de l\'évaluation RoB pour le projet {project_id}: {e}")
            return jsonify({"error": "Erreur interne"}), 500

# ================================================================
# 8) Analyses
# ================================================================

@api_bp.route('/projects/<project_id>/run-prisma-flow', methods=['POST'])
def run_prisma_flow(project_id):
    """Lance la génération du diagramme PRISMA."""
    try:
        uuid.UUID(project_id, version=4)
    except ValueError:
        return jsonify({'error': 'ID de projet invalide'}), 400

    job = analysis_queue.enqueue(run_prisma_flow_task, project_id=project_id, job_timeout='10m')
    return jsonify({'message': 'Génération du diagramme PRISMA lancée.', 'job_id': job.id}), 202

@api_bp.route('/projects/<project_id>/run-meta-analysis', methods=['POST'])
def run_meta_analysis(project_id):
    """Lance une méta-analyse."""
    try:
        uuid.UUID(project_id, version=4)
    except ValueError:
        return jsonify({'error': 'ID de projet invalide'}), 400

    job = analysis_queue.enqueue(run_meta_analysis_task, project_id=project_id, job_timeout='20m')
    return jsonify({'message': 'Méta-analyse lancée.', 'job_id': job.id}), 202

@api_bp.route('/projects/<project_id>/run-descriptive-stats', methods=['POST'])
def run_descriptive_stats(project_id):
    """Lance le calcul des statistiques descriptives."""
    try:
        uuid.UUID(project_id, version=4)
    except ValueError:
        return jsonify({'error': 'ID de projet invalide'}), 400

    job = analysis_queue.enqueue(run_descriptive_stats_task, project_id=project_id, job_timeout='15m')
    return jsonify({'message': 'Calcul des statistiques descriptives lancé.', 'job_id': job.id}), 202

# --- Analyses avancées ---
@api_bp.route('/projects/<project_id>/run-analysis', methods=['POST'])
def run_advanced_analysis(project_id):
    try:
        uuid.UUID(project_id, version=4)
    except ValueError:
        return jsonify({'error': 'ID de projet invalide'}), 400

    data = request.get_json(force=True)
    analysis_type = data.get('type')
    if not analysis_type:
        return jsonify({'error': 'Type d\'analyse requis'}), 400

    # Vérifier que le type est valide AVANT de changer le statut
    valid_types = ['meta_analysis', 'atn_scores', 'discussion', 'knowledge_graph', 'prisma_flow']
    if analysis_type not in valid_types:
        return jsonify({'error': 'Type d\'analyse non supporté'}), 400

    try:
        session = Session()
        session.execute(text("UPDATE projects SET status = 'generating_analysis' WHERE id = :pid"),
                       {"pid": project_id})
        session.commit()

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

        return jsonify({'message': f'Analyse {analysis_type} lancée', 'job_id': job.id}), 202

    except Exception as e:
        logger.exception(f"Erreur run analysis: {e}")
        return jsonify({'error': 'Erreur lors du lancement de l\'analyse'}), 500

@api_bp.route('/projects/<project_id>/run-discussion-draft', methods=['POST'])
def run_discussion_draft(project_id):
    """Lance la génération du brouillon de discussion."""
    try:
        uuid.UUID(project_id, version=4)
    except ValueError:
        return jsonify({'error': 'ID de projet invalide'}), 400

    session = Session()
    try:
        # Validation de l\'UUID déjà faite
        session.execute(text("UPDATE projects SET status = 'generating_analysis' WHERE id = :pid"), {"pid": project_id})
        session.commit()

        job = analysis_queue.enqueue(run_discussion_generation_task, project_id=project_id, job_timeout='30m')
        return jsonify({'message': 'Génération du brouillon de discussion lancée', 'job_id': job.id}), 202

    except Exception as e:
        session.rollback()
        logger.exception(f"Erreur run discussion draft: {e}")
        return jsonify({'error': str(e)}), 500

@api_bp.route('/projects/<project_id>/run-knowledge-graph', methods=['POST'])
def run_knowledge_graph(project_id):
    """Lance la génération du graphe de connaissances."""
    try:
        uuid.UUID(project_id, version=4)
    except ValueError:
        return jsonify({'error': 'ID de projet invalide'}), 400

    session = Session()
    try:
        # Validation de l\'UUID déjà faite
        session.execute(text("UPDATE projects SET status = 'generating_analysis' WHERE id = :pid"), 
                       {"pid": project_id})
        session.commit()
        
        job = analysis_queue.enqueue(run_knowledge_graph_task, project_id=project_id, job_timeout='30m')
        return jsonify({'message': 'Génération du graphe de connaissances lancée', 'job_id': job.id}), 202
        
    except Exception as e:
        session.rollback()
        logger.exception(f"Erreur run knowledge graph: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        session.close()

# --- Chat RAG ---
@api_bp.route('/projects/<project_id>/chat', methods=['POST', 'GET'])
def handle_project_chat(project_id):
    """
    Gère la récupération et la soumission des messages de chat pour un projet.
    - GET: Récupère l'historique des messages.
    - POST: Soumet une nouvelle question à la tâche de fond RAG.
    """
    try:
        # Valide que l'ID du projet est un UUID valide
        uuid.UUID(project_id, version=4)
    except ValueError:
        return jsonify({'error': 'ID de projet invalide'}), 400

    # --- GESTION DE LA RÉCUPÉRATION DES MESSAGES (GET) ---
    if request.method == 'GET':
        session = db_session()
        try:
            # Exécute la requête pour récupérer tous les messages du projet, ordonnés par date
            rows = session.execute(text(
                """
                SELECT id, project_id, role, content, sources, timestamp 
                FROM chat_messages
                WHERE project_id = :pid
                ORDER BY timestamp ASC
                """
            ), {"pid": project_id}).mappings().all()
            
            # Convertit les résultats en une liste de dictionnaires pour la réponse JSON
            messages = [dict(row) for row in rows]
            return jsonify(messages)

        except SQLAlchemyError as e:
            # En cas d'erreur avec la base de données, on logue l'erreur et on retourne une erreur 500
            logger.error(f"Erreur de base de données lors de la récupération du chat: {e}")
            return jsonify({'error': 'Erreur interne du serveur lors de la lecture des messages.'}), 500
        
        finally:
            # **CORRECTION CRUCIALE** : Quoi qu'il arrive (succès ou erreur),
            # on s'assure que la session de la base de données est fermée.
            db_session.remove()

    # --- GESTION DE LA SOUMISSION D'UN NOUVEAU MESSAGE (POST) ---
    if request.method == 'POST':
        try:
            data = request.get_json()
            question = data.get('question', '').strip()

            if not question:
                return jsonify({'error': 'La question ne peut pas être vide.'}), 400

            # Met en file d'attente la tâche de fond pour traiter la question
            job = background_queue.enqueue(
                answer_chat_question_task,
                project_id=project_id,
                question=question,
                job_timeout='15m'
            )
            return jsonify({'message': 'Question envoyée au moteur RAG.', 'job_id': job.id}), 202
            
        except Exception as e:
            # Capture toute autre erreur (ex: JSON mal formé, échec de la mise en file d'attente)
            logger.error(f"Erreur lors de la soumission de la question au chat: {e}")
            return jsonify({'error': 'Erreur interne du serveur lors de la soumission de la question.'}), 500

@api_bp.route('/projects/<project_id>/run-atn-analysis', methods=['POST'])
@with_db_session
def run_atn_analysis(db_session, project_id):
    """Lance l'analyse multipartite prenante spécialisée pour l'ATN."""
    project = db_session.get(Project, project_id)
    if not project:
        return jsonify({"error": "Projet non trouvé"}), 404

    try:
        job = analysis_queue.enqueue(
            run_atn_stakeholder_analysis_task,
            project_id=project_id,
            job_timeout='30m'
        )
        return jsonify({'message': "Analyse ATN multipartite lancée.", 'job_id': job.id}), 202
    except Exception as e:
        logger.exception(f"Erreur lors du lancement de l'analyse ATN pour le projet {project_id}: {e}")
        return jsonify({"error": "Erreur interne du serveur"}), 500
        
@api_bp.route('/projects/<project_id>/chat-messages', methods=['GET'])
def get_chat_messages(project_id):
    """Récupère l'historique des messages pour le chat."""
    try:
        uuid.UUID(project_id, version=4)
    except ValueError:
        return jsonify({'error': 'ID de projet invalide'}), 400

    session = Session()
    try:
        rows = session.execute(text("""
            SELECT * FROM chat_messages
            WHERE project_id = :pid
            ORDER BY timestamp ASC
        """ ), {"pid": project_id}).mappings().all()
        return jsonify([dict(r) for r in rows])

    except Exception as e:
        logger.exception(f"Erreur get_chat_messages: {e}")
        return jsonify({'error': 'Erreur interne'}), 500

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
        logger.exception(f"Erreur /ollama/models: {e}")
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
        logger.exception(f"Erreur pull model: {e}")
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

        # Récupérer tous les workers et compter par file
        all_workers = Worker.all(connection=redis_conn)
        queues_workers_count = {name: 0 for name in queue_map.keys()}
        
        for w in all_workers:
            # w.queue_names() retourne les noms des files écoutées par le worker
            try:
                names = [q.decode() if isinstance(q, bytes) else q for q in w.queue_names()]
            except Exception:
                names = []
            
            for name in queue_map.keys():
                # Le nom réel de la file dans RQ = queue.name (ex: 'analylit_processing_v4')
                if queue_map[name].name in names:
                    queues_workers_count[name] += 1

        for name, queue in queue_map.items():
            queues_info.append({
                'name': name, 
                'size': len(queue), 
                'workers': queues_workers_count.get(name, 0)
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
    # Définition de project_name_safe qui était manquante
    proj_info = session.execute(text("SELECT name FROM projects WHERE id = :pid"), {"pid": project_id}).mappings().fetchone()
    project_name_safe = sanitize_filename(proj_info.get('name', 'export')) if proj_info else 'export'

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
            headers={'Content-Disposition': f'attachment; filename=export_complet_{project_name_safe}.zip'}
        )

    except Exception as e:
        logger.exception(f"Erreur export projet: {e}")
        return jsonify({'error': 'Erreur lors de l\'export'}), 500

# Route pour les statistiques de validation (récupérée de la v4.0 et adaptée)
@api_bp.route('/projects/<project_id>/validation-stats', methods=['GET'])
def get_validation_stats(project_id):
    """Calcule les statistiques de validation pour un projet."""
    try:
        uuid.UUID(project_id, version=4)
    except ValueError:
        return jsonify({'error': 'ID de projet invalide'}), 400

    session = Session()
    try:
        extractions = session.execute(text("""
            SELECT relevance_score, validations
            FROM extractions
            WHERE project_id = :pid AND validations IS NOT NULL AND validations != '{}'
        """ ), {"pid": project_id}).mappings().all()

        if not extractions:
            return jsonify({"message": "Aucune validation utilisateur trouvée pour calculer les statistiques."}), 200

        total = len(extractions)
        ia_includes = sum((1 for e in extractions if e['relevance_score'] >= 7))
        user_includes = 0
        tp, tn, fp, fn = 0, 0, 0, 0

        for e in extractions:
            try:
                validation_data = json.loads(e['validations']) if e['validations'] else {}
                user_decision = validation_data.get('evaluator1')

                if user_decision == 'include':
                    user_includes += 1

                is_ia_include = e['relevance_score'] >= 7
                is_user_include = user_decision == 'include'

                if is_ia_include and is_user_include:
                    tp += 1
                elif not is_ia_include and not is_user_include:
                    tn += 1
                elif is_ia_include and not is_user_include:
                    fp += 1
                elif not is_ia_include and is_user_include:
                    fn += 1

            except (json.JSONDecodeError, TypeError):
                continue

        accuracy = (tp + tn) / total if total > 0 else 0
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        f1_score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0

        return jsonify({
            "total_articles": total,
            "ia_includes": ia_includes,
            "user_includes": user_includes,
            "confusion_matrix": {"tp": tp, "tn": tn, "fp": fp, "fn": fn},
            "metrics": {
                "accuracy": round(accuracy, 3),
                "precision": round(precision, 3),
                "recall": round(recall, 3),
                "f1_score": round(f1_score, 3)
            }
        })

    except Exception as e:
        logger.exception(f"Erreur get_validation_stats: {e}")
        return jsonify({'error': 'Erreur interne du serveur'}), 500
    finally:
        session.close()

@api_bp.route('/projects/<project_id>/stakeholders', methods=['GET', 'POST'])
@with_db_session
def handle_stakeholder_groups(db_session, project_id):
    project = db_session.get(Project, project_id)
    if not project:
        return jsonify({"error": "Projet non trouvé"}), 404

    if request.method == 'GET':
        groups = db_session.query(StakeholderGroup).filter_by(project_id=project_id).all()
        return jsonify([g.to_dict() for g in groups])

    if request.method == 'POST':
        data = request.get_json()
        if not data or not data.get('name'):
            return jsonify({"error": "Le nom du groupe est requis"}), 400

        new_group = StakeholderGroup(
            id=str(uuid.uuid4()),
            project_id=project_id,
            name=data['name'],
            color=data.get('color', '#4CAF50'),
            description=data.get('description', '')
        )

        db_session.add(new_group)
        try:
            db_session.commit()
        except SQLAlchemyError as e:
            db_session.rollback()
            logger.exception(f"Erreur DB lors de la création du groupe de parties prenantes pour le projet {project_id}: {e}")
            return jsonify({"error": "Erreur base de données"}), 500
        return jsonify(new_group.to_dict()), 201

@api_bp.route('/admin/fix-profiles', methods=['POST'])
@with_db_session
def fix_analysis_profiles(db_session):
    """Charge ou met à jour les profils d'analyse depuis un fichier profiles.json."""
    try:
        with open('profiles.json', 'r', encoding='utf-8') as f:
            profiles_data = json.load(f)

        count = 0
        for profile_data in profiles_data:
            profile_id = profile_data.get("id")
            profile = db_session.get(Profile, profile_id)

            if not profile:
                profile = Profile(id=profile_id)
                db_session.add(profile)

            profile.name = profile_data.get("name")
            profile.description = profile_data.get("description")
            profile.model_name = profile_data.get("model_name")
            profile.temperature = profile_data.get("temperature")
            profile.context_length = profile_data.get("context_length")
            count += 1

        db_session.commit()
        return jsonify({'message': f"{count} profils ont été chargés/mis à jour avec succès."}, 200)

    except FileNotFoundError:
        return jsonify({'error': "Le fichier profiles.json est introuvable."}, 404)
    except Exception as e:
        db_session.rollback()
        logger.exception("Erreur lors de la correction des profils d'analyse.")
        return jsonify({'error': 'Erreur interne du serveur'}), 500

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
        join_room(room) # type: ignore
        emit('room_joined', {'project_id': room})
        logger.info(f"Client {request.sid} a rejoint la room {room}")

@api_bp.route('/projects/<project_id>/run-rob-analysis', methods=['POST']) # type: ignore
def run_rob_analysis(project_id):
    """Lance l'analyse du risque de biais pour les articles sélectionnés."""
    try:
        uuid.UUID(project_id, version=4)
    except ValueError:
        return jsonify({'error': 'ID de projet invalide'}), 400

    data = request.get_json(force=True)
    article_ids = data.get('article_ids', [])

    if not article_ids:
        return jsonify({'error': 'Aucun article sélectionné'}), 400

    for article_id in article_ids:
        analysis_queue.enqueue(run_risk_of_bias_task, project_id=project_id, article_id=article_id, job_timeout='20m')

    return jsonify({
        "message": f"Analyse du risque de biais lancée pour {len(article_ids)} article(s)."
    }), 202

# ================================================================
# 4) Enregistrement du blueprint et route front
# ================================================================

@app.route('/')
def serve_frontend():
    return app.send_static_file('index.html')

def listen_for_notifications():
    """Tâche de fond pour écouter les notifications Redis et les relayer via Socket.IO."""
    pubsub = redis_conn.pubsub()
    pubsub.subscribe("analylit_notifications")
    logger.info("📢 L\'écouteur de notifications Redis est démarré.")

    for message in pubsub.listen():
        if message['type'] == 'message':
            try:
                data = json.loads(message['data'])
                if data.get('is_global'):
                    socketio.emit('notification', data, broadcast=True, namespace='/')
                elif data.get('project_id'):
                    socketio.emit('notification', data, room=data['project_id'], namespace='/')
            except Exception as e:
                logger.error(f"Erreur lors du relais de la notification: {e}")

if __name__ == '__main__':
    init_db()
    # Démarrer l'écouteur dans un thread séparé pour ne pas bloquer le serveur
    socketio.start_background_task(target=listen_for_notifications)
    socketio.run(app, host='0.0.0.0', port=5001, debug=True)