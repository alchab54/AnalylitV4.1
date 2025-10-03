import logging
# --- CORRECTION CRITIQUE : Résolution du ModuleNotFoundError ---
import sys
from pathlib import Path

# Ajoute la racine du projet au chemin Python
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

logger = logging.getLogger(__name__)

import feedparser
# --- CORRECTIF DE COMPATIBILITÉ PYZOTERO / FEEDPARSER ---
if not hasattr(feedparser, '_FeedParserMixin'):
    feedparser._FeedParserMixin = type('_FeedParserMixin', (object,), {})

import os
import json
import uuid
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from sqlalchemy.orm import sessionmaker

# --- Import des Blueprints API ---
from api.admin import admin_bp
from api.analysis_profiles import analysis_profiles_bp
from api.extensions import extensions_bp
from api.files import files_bp
from api.projects import projects_bp
from api.reporting import reporting_bp
from api.search import search_bp
from api.selection import selection_bp
from api.prompts import prompts_bp
from api.settings import settings_bp
from api.stakeholders import stakeholders_bp
from api.tasks import tasks_bp

# --- Imports des utilitaires et de la configuration ---
from flask_socketio import SocketIO
from utils.extensions import db, migrate
from utils.app_globals import redis_conn
from utils.models import Project, Extraction, SearchResult
from backend.config.config_v4 import get_config

# --- Initialisation des extensions ---
socketio = SocketIO()

def create_app(config_override=None):
    """Factory pour créer et configurer l'application Flask."""
    app = Flask(__name__, static_folder='../web', static_url_path='/static')
    
    # Configurationl
    config = get_config()
    app.config.from_object(config)
    if config_override:
        app.config.update(config_override)

    # Configuration de la base de données avec le schéma
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'pool_pre_ping': True,
        "connect_args": {
            "options": f"-c search_path={config.DB_SCHEMA},public"
        }
    }

    # Set the database URI from the configuration
    app.config['SQLALCHEMY_DATABASE_URI'] = config.DATABASE_URL

    CORS(app, resources={r"/api/*": {"origins": "*"}})
    
    # Initialisation des extensions
    db.init_app(app)
    migrate.init_app(app, db)
    socketio.init_app(app, cors_allowed_origins="*", async_mode='gevent', message_queue=app.config['REDIS_URL'])

    # Enregistrement des blueprints

    app.register_blueprint(admin_bp, url_prefix='/api')
    app.register_blueprint(analysis_profiles_bp, url_prefix='/api')
    app.register_blueprint(extensions_bp, url_prefix='/api')
    app.register_blueprint(files_bp, url_prefix='/api')
    app.register_blueprint(projects_bp, url_prefix='/api')
    app.register_blueprint(prompts_bp, url_prefix='/api')
    app.register_blueprint(reporting_bp, url_prefix='/api')
    app.register_blueprint(search_bp, url_prefix='/api')
    app.register_blueprint(selection_bp, url_prefix='/api')
    app.register_blueprint(settings_bp, url_prefix='/api')
    app.register_blueprint(stakeholders_bp, url_prefix='/api')
    app.register_blueprint(tasks_bp, url_prefix='/api')


    # --- Routes Spécifiques ---
    
    @app.route('/')
    def serve_frontend():
        """Sert l'interface frontend HTML."""
        return send_from_directory(app.static_folder, 'index.html')

    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({"status": "healthy"})

    # ✅ **PATCH n°1 : Enrichir l'endpoint des extractions**
    @app.route('/api/projects/<project_id>/extractions', methods=['GET'])
    def get_project_extractions(project_id):
        """Retourne les extractions avec l'abstract de l'article."""
        Session = sessionmaker(bind=db.engine)
        session = Session()
        try:
            results = session.query(Extraction, SearchResult.abstract, SearchResult.title).\
                outerjoin(SearchResult, (Extraction.pmid == SearchResult.article_id) & (Extraction.project_id == SearchResult.project_id)).\
                filter(Extraction.project_id == project_id).\
                all()

            combined_results = []
            for extraction, abstract, title in results:
                extraction_dict = extraction.to_dict()
                extraction_dict['abstract'] = abstract or "Abstract non disponible."
                extraction_dict['title'] = title or extraction.title # Assurer un titre
                combined_results.append(extraction_dict)
            
            return jsonify(combined_results)
        finally:
            session.close()
            
    # ✅ **PATCH n°2 : Fiabiliser l'endpoint des files d'attente**
    @app.route('/api/queues/info', methods=['GET'])
    def get_queues_info():
        """Retourne le statut des files d'attente RQ."""
        from rq import Queue
        queues_to_check = ['ai_queue', 'analysis_queue', 'background_queue', 'default_queue', 'fast_queue', 'extension_queue']
        queues_info = []
        for q_name in queues_to_check:
            q = Queue(q_name, connection=redis_conn)
            queues_info.append({
                "name": q_name,
                "count": q.count, # Nombre de tâches en attente
            })
        return jsonify(queues_info)

    return app

if __name__ == "__main__":
    import gevent.monkey
    gevent.monkey.patch_all()
    app = create_app()
    socketio.run(app, host="0.0.0.0", port=5000, debug=True, use_reloader=False)
