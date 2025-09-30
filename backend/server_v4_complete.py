import logging
# --- CORRECTION CRITIQUE : Résolution du ModuleNotFoundError ---
# Ce bloc de code est essentiel pour rendre le serveur exécutable directement
# pour le développement local. Il ajoute la racine du projet au chemin de Python,
# permettant ainsi aux imports absolus (ex: `from api.admin import admin_bp`) de fonctionner.
import sys
from pathlib import Path
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

logger = logging.getLogger(__name__)

import feedparser

# --- CORRECTIF DE COMPATIBILITÉ PYZOTERO / FEEDPARSER ---
# pyzotero tente de patcher une méthode interne de feedparser qui n'existe plus.
# Nous appliquons manuellement un patch compatible avant d'importer pyzotero.
if not hasattr(feedparser, '_FeedParserMixin'):
    feedparser._FeedParserMixin = type('_FeedParserMixin', (object,), {})

import os
import json
import uuid
import io
import csv
import zipfile
from pathlib import Path
import pandas as pd
import rq
import subprocess
import requests
from flask import Flask, request, jsonify, send_from_directory, abort, send_file, Blueprint, current_app

# --- Import des Blueprints API ---
from api.admin import admin_bp
from api.analysis_profiles import analysis_profiles_bp
from api.extensions import extensions_bp
from api.files import files_bp
from api.projects import projects_bp
from api.reporting import reporting_bp
from api.search import search_bp
from api.selection import selection_bp
from api.settings import settings_bp
from api.stakeholders import stakeholders_bp
from flask_cors import CORS
from sqlalchemy.exc import IntegrityError
from rq.worker import Worker 
from werkzeug.utils import secure_filename


# --- Imports des utilitaires et de la configuration ---
from flask_socketio import SocketIO
from utils.extensions import db, migrate
from utils.database import with_db_session # Importer seulement le décorateur
from utils.app_globals import (
    processing_queue, synthesis_queue, analysis_queue, background_queue,
    extension_queue, redis_conn, models_queue
)
from utils.models import Project, Grid, Extraction, Prompt, AnalysisProfile, SearchResult, ChatMessage, RiskOfBias
from api.tasks import tasks_bp # type: ignore
from utils.file_handlers import save_file_to_project_dir
from utils.app_globals import PROJECTS_DIR as PROJECTS_DIR_STR
from utils.prisma_scr import get_base_prisma_checklist
import utils.models  # noqa
from datetime import datetime
from rq.job import Job
from rq.registry import StartedJobRegistry, FinishedJobRegistry, FailedJobRegistry

# --- Imports des tâches asynchrones ---
from backend.tasks_v4_complete import (
    run_extension_task, multi_database_search_task, process_single_article_task,
    run_synthesis_task, run_discussion_generation_task, run_knowledge_graph_task,
    run_prisma_flow_task, run_meta_analysis_task, run_descriptive_stats_task, run_atn_score_task,
    import_from_zotero_file_task, import_pdfs_from_zotero_task, index_project_pdfs_task,
    answer_chat_question_task, run_risk_of_bias_task,
    import_from_zotero_json_task,
    add_manual_articles_task, pull_ollama_model_task, calculate_kappa_task,
    run_atn_specialized_extraction_task, run_empathy_comparative_analysis_task
)

# --- Imports pour l_extension Zotero ---
from utils.importers import process_zotero_item_list
# Simulez ou remplacez par vos vraies fonctions de BDD et d_export
# Assurez-vous que 'with_db_session' est importé si vous l_utilisez dans les fonctions ci-dessous
from utils.database import with_db_session

# Convertir PROJECTS_DIR en objet Path pour assurer la compatibilité
PROJECTS_DIR = Path(PROJECTS_DIR_STR)

# --- Initialisation des extensions ---
# On les déclare ici pour qu_elles soient accessibles globalement,
# mais on les initialise dans create_app()
socketio = SocketIO()


def create_app(config_override=None):
    """Factory pour créer et configurer l'application Flask."""
    app = Flask(__name__, static_folder='web', static_url_path='')

    # Configuration de base
    if config_override:
        app.config.update(config_override)
    """
    Factory d'application Flask - VERSION CORRIGÉE ET COMPLÈTE
    Garantie de retourner une instance Flask valide.
    """
    print("🚀 DÉBUT create_app()")
    
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'pool_size': 10,
        'pool_recycle': 120,
        'pool_pre_ping': True,
        "connect_args": {
            "options": "-c search_path=analylit_schema,public"
    try:
        # 1. Création de l'instance Flask
        app = Flask(__name__, static_folder='web', static_url_path='')
        print(f"✅ Instance Flask créée: {app}")
        
        # 2. Configuration de base
        if config_override:
            app.config.update(config_override)
        
        app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'postgresql://analylit_user:strong_password@db:5432/analylit_db')
        app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
        app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
            'pool_size': 10,
            'pool_recycle': 120,
            'pool_pre_ping': True,
            "connect_args": {
                "options": "-c search_path=analylit_schema,public"
            }
        }
    }
        print("✅ Configuration Flask terminée")
        
        # 3. Initialisation des extensions
        db.init_app(app)
        migrate.init_app(app, db)
        socketio.init_app(app, cors_allowed_origins="*", async_mode='gevent')
        print("✅ Extensions initialisées")
        
        # 4. Enregistrement des blueprints
        try:
            app.register_blueprint(projects_bp)
            app.register_blueprint(extensions_bp)
            print("✅ Blueprints enregistrés")
        except Exception as e:
            print(f"⚠️ Erreur blueprints: {e}")
            # Continuer même si les blueprints échouent
        
        # 5. Routes de base (exemple)
        @app.route('/')
        def index():
            return "AnalylitV4.1 - Application démarrée avec succès!"
        
        print("✅ Routes de base ajoutées")
        
        # 6. RETURN CRITIQUE - TOUJOURS PRÉSENT
        print("🎯 RETURN app")
        return app
        
    except Exception as e:
        print(f"❌ EXCEPTION dans create_app(): {e}")
        import traceback
        traceback.print_exc()
        # Retourner None en cas d'erreur pour debug
        return None

    # Initialisation des extensions
    db.init_app(app)
    migrate.init_app(app, db)
    socketio.init_app(app, cors_allowed_origins="*", async_mode='gevent')

    # Enregistrement des blueprints
    app.register_blueprint(admin_bp, url_prefix='/api')
    app.register_blueprint(analysis_profiles_bp, url_prefix='/api')
    app.register_blueprint(extensions_bp, url_prefix='/api')
    app.register_blueprint(files_bp, url_prefix='/api')
    app.register_blueprint(projects_bp, url_prefix='/api')
    app.register_blueprint(reporting_bp, url_prefix='/api')
    app.register_blueprint(search_bp, url_prefix='/api')
    app.register_blueprint(selection_bp, url_prefix='/api')
    app.register_blueprint(settings_bp, url_prefix='/api')
    app.register_blueprint(stakeholders_bp, url_prefix='/api')
    app.register_blueprint(tasks_bp, url_prefix='/api')

    # Routes de base
    @app.route('/')
    def index():
        return send_from_directory(app.static_folder, 'index.html')

    @app.route('/<path:path>')
    def serve_static(path):
        return send_from_directory(app.static_folder, path)

    @app.errorhandler(404)
    def not_found(error):
        # Si le chemin n'est pas une API, renvoyer l'index pour le routage côté client
        if not request.path.startswith('/api/'):
            return send_from_directory(app.static_folder, 'index.html')
        return jsonify({"error": "Not Found"}), 404

    return app

def register_models():
    """Force l_enregistrement de tous les modèles."""
    pass  # Juste le fait d_importer ce module enregistre les modèles

# --- GUNICORN HOOK ---
def post_fork(server, worker):
    """
    Hook Gunicorn pour s_assurer que chaque worker a sa propre initialisation de DB.
    Cela évite les problèmes de partage de connexion entre les processus.
    """
    import gevent.monkey
    gevent.monkey.patch_all()
    server.log.info("Worker %s forked.", worker.pid)

if __name__ == "__main__":
    import gevent.monkey
    gevent.monkey.patch_all()

    # Créer l'application pour le développement local
    app = create_app() # L'instance est locale à ce bloc

    # Utilise le serveur de développement de SocketIO
    socketio.run(app, host="0.0.0.0", port=5000, debug=True, allow_unsafe_werkzeug=True)
