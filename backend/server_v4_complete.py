import logging
import sys
from pathlib import Path

# Ajoute la racine du projet au chemin Python
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

import feedparser
if not hasattr(feedparser, '_FeedParserMixin'):
    feedparser._FeedParserMixin = type('_FeedParserMixin', (object,), {})

import os
import json
import uuid
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from sqlalchemy.orm import sessionmaker
from rq.exceptions import NoSuchJobError

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
from utils.app_globals import redis_conn, analysis_queue, limiter
from utils.models import Project, Extraction, SearchResult
from backend.config.config_v4 import get_config

# --- Configuration du logging selon l'environnement ---
if os.getenv('FLASK_ENV') == 'development':
    from utils.logging_config_dev import setup_logging
    setup_logging()
else:
    from utils.logging_config import setup_logging
    setup_logging()

logger = logging.getLogger(__name__)

# --- Initialisation des extensions ---
socketio = SocketIO()

def create_app(config_override=None):
    """Factory pour créer et configurer l'application Flask."""
    # ✅✅✅ **CORRECTION FINALE POUR LES FICHIERS STATIQUES** ✅✅✅
    # Définir correctement les dossiers static et template
    app = Flask(__name__, 
                static_folder='../web',           # Dossier des fichiers statiques
                static_url_path='/static')               # URL racine pour les statiques

    # Configuration
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

    # Set the database URI from the configuration, allowing override
    if 'SQLALCHEMY_DATABASE_URI' not in (config_override or {}):
        app.config['SQLALCHEMY_DATABASE_URI'] = config.DATABASE_URL

    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Initialisation des extensions
    db.init_app(app)
    migrate.init_app(app, db)
    limiter.init_app(app)
    socketio.init_app(app, cors_allowed_origins="*", async_mode='gevent', message_queue=app.config['REDIS_URL'])

    # Enregistrement des blueprints
    app.register_blueprint(admin_bp, url_prefix='/api')
    app.register_blueprint(analysis_profiles_bp, url_prefix='/api')
    app.register_blueprint(extensions_bp, url_prefix='/api')
    app.register_blueprint(files_bp, url_prefix='/api')
    app.register_blueprint(projects_bp, url_prefix='/api')
    app.register_blueprint(prompts_bp, url_prefix='/api/prompts')
    app.register_blueprint(reporting_bp, url_prefix='/api')
    app.register_blueprint(search_bp, url_prefix='/api')
    app.register_blueprint(selection_bp, url_prefix='/api')
    app.register_blueprint(settings_bp, url_prefix='/api')
    app.register_blueprint(stakeholders_bp, url_prefix='/api')
    app.register_blueprint(tasks_bp, url_prefix='/api')


    # --- Routes Spécifiques ---
    @app.route('/')
    def serve_frontend():
        """Serve the index HTML file."""
        return send_from_directory(app.static_folder, 'index.html')
    
    @app.route('/<path:filename>')
    def serve_static(filename):
        """Serves static files (CSS, JS, images) - useful for SPA routing."""
        return send_from_directory(app.static_folder, filename)
    
    @app.route('/api/databases', methods=['GET'])
    def get_databases():
        """Retourne la liste des bases de données disponibles pour la recherche."""
        databases = [
            {
                'id': 'pubmed',
                'name': 'PubMed',
                'description': 'Base de données biomédicale principale',
                'enabled': True,
                'icon': '🏥'
            },
            {
                'id': 'semantic_scholar',
                'name': 'Semantic Scholar',
                'description': 'Recherche académique IA-powered',
                'enabled': True,
                'icon': '🎓'
            },
            {
                'id': 'arxiv',
                'name': 'arXiv',
                'description': 'Prépublications scientifiques',
                'enabled': True,
                'icon': '📄'
            },
            {
                'id': 'crossref',
                'name': 'CrossRef',
                'description': 'Métadonnées de publications',
                'enabled': True,
                'icon': '🔗'
            }
        ]
        return jsonify(databases)
    
    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({"status": "healthy"}), 200

    @app.errorhandler(429)
    def ratelimit_handler(e):
        return jsonify({
            "error": "ratelimit exceeded",
            "description": "Too many requests, please try again later." # I think you want this.
        }), 429

    @app.errorhandler(500)
    def internal_server_error(e):
        app.logger.error(f"Erreur interne du serveur: {e}")
        return jsonify(error="Internal server error"), 500


    @app.route('/api/prompts', methods=['GET', 'POST'])
    def api__prompts():
        try:
            # Your existing code
            if request.method == 'POST':
                # Handle POST request
                result = {} # Replace this with actual result
            else:
                # Handle GET request
                result = {} # Replace this with actual result
            return jsonify(result)
        except Exception as e:
            app.logger.error(f"Error in api_prompts: {e}")
            return jsonify({'error': 'Erreur interne du serveur'}), 500

    def normalize_profile(profile: dict) -> dict:
        """
        Normalizes the profile dictionary to support both old and new keys.
        """
        return {
            'preprocess': profile.get('preprocess') or profile.get('preprocess_model') or 'phi3:mini',
            'extract': profile.get('extract') or profile.get('extract_model') or 'llama3.1:8b',
            'synthesis': profile.get('synthesis') or profile.get('synthesis_model') or 'llama3.1:8b'}



    @app.route('/api/projects/<project_id>/extractions', methods=['GET'])
    def get_project_extractions(project_id):
        """Retourne les extractions avec l'abstract de l'article."""
        Session = sessionmaker(bind=db.engine)
        session = Session()
        try:
            results = session.query(Extraction, SearchResult.abstract, SearchResult.title).outerjoin(SearchResult, (Extraction.pmid == SearchResult.article_id) & (Extraction.project_id == SearchResult.project_id)).filter(Extraction.project_id == project_id).all()

            combined_results = []
            for extraction, abstract, title in results:
                extraction_dict = extraction.to_dict()
                extraction_dict['abstract'] = abstract or "Abstract non disponible."
                extraction_dict['title'] = title or extraction.title
                combined_results.append(extraction_dict)

            return jsonify(combined_results)
        finally:
            session.close()

    return app

# ✅ Créer l'instance de l'application au niveau du module
app = create_app()

if __name__ == "__main__":
    import gevent.monkey
    gevent.monkey.patch_all() # Patch all for production and local
    socketio.run(app, host="0.0.0.0", port=5000, debug=True, use_reloader=False)