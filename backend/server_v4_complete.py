# ===============================================================
# ===         ANALYLIT V4.2 - SERVEUR PRINCIPAL "GLORY"       ===
# ===          VERSION FINALE, CORRIGÉE ET STABILISÉE         ===
# ===============================================================

# --- PATCH GEVEBT : DOIT ÊTRE LA TOUTE PREMIÈRE CHOSE EXÉCUTÉE ---
# Correction cruciale pour la compatibilité entre Flask-SocketIO, gevent et Redis.
from gevent import monkey
monkey.patch_all()

# --- IMPORTS SYSTÈME ET STANDARDS ---
import logging
import sys
import os
import json
import uuid
from pathlib import Path

# --- AJOUT DE LA RACINE DU PROJET AU PYTHONPATH ---
# Garantit que les modules locaux sont trouvables, peu importe comment le script est lancé.
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

# --- IMPORT DES DÉPENDANCES EXTERNES ---
# Patch pour une version de feedparser qui peut être capricieuse
import feedparser
if not hasattr(feedparser, '_FeedParserMixin'):
    feedparser._FeedParserMixin = type('_FeedParserMixin', (object,), {})

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from sqlalchemy.orm import sessionmaker
from rq.exceptions import NoSuchJobError
from flask_socketio import SocketIO

# --- IMPORTS DES MODULES DE L'APPLICATION ---

# Blueprints (Routes API modulaires)
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

# Utilitaires et Configuration
from utils.extensions import db, migrate
from utils.app_globals import redis_conn, analysis_queue, limiter
from utils.models import Project, Extraction, SearchResult, AnalysisProfile # Import direct du modèle
from backend.config.config_v4 import get_config

# --- CONFIGURATION DU LOGGING ---
# Bascule entre une configuration de développement (plus verbeuse) et de production.
if os.getenv('FLASK_ENV') == 'development':
    from utils.logging_config_dev import setup_logging
    setup_logging()
else:
    from utils.logging_config import setup_logging
    setup_logging()

logger = logging.getLogger(__name__)

# --- INITIALISATION GLOBALE DES EXTENSIONS ---
# Déclarées ici pour être accessibles dans la factory d'application.
socketio = SocketIO()

def create_app(config_override=None):
    """
    Factory pour créer et configurer l'instance de l'application Flask.
    Cette structure permet de créer différentes instances de l'app (ex: pour les tests).
    """
    # Correction pour servir le frontend depuis le bon dossier
    app = Flask(__name__,
                static_folder='../web',
                static_url_path='') # URL racine vide pour servir index.html et autres

    # --- CONFIGURATION DE L'APPLICATION ---
    config = get_config()
    app.config.from_object(config)
    if config_override:
        app.config.update(config_override)

    # Configuration du schéma PostgreSQL pour l'isolation des données
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'pool_pre_ping': True,
        "connect_args": {
            "options": f"-c search_path={config.DB_SCHEMA},public"
        }
    }
    
    if 'SQLALCHEMY_DATABASE_URI' not in (config_override or {}):
        app.config['SQLALCHEMY_DATABASE_URI'] = config.DATABASE_URL

    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # --- INITIALISATION DES EXTENSIONS FLASK AVEC L'APP ---
    db.init_app(app)
    migrate.init_app(app, db)
    limiter.init_app(app)
    # Initialisation de SocketIO avec async_mode='gevent' et la queue Redis
    socketio.init_app(app, cors_allowed_origins="*", async_mode='gevent', message_queue=app.config['REDIS_URL'])

    # --- ENREGISTREMENT DES BLUEPRINTS (ROUTES API) ---
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

    # --- COMMANDES CLI (ex: `flask seed_db`) ---
    @app.cli.command("seed_db")
    def seed_db():
        """Peuple la base de données avec les profils d'analyse initiaux."""
        logger.info("🌱 Seeding database with initial analysis profiles...")
        
        # Définition des profils par défaut à insérer
        initial_profiles = [
            {'id': 'fast-local', 'name': '⚡ Rapide (Local)', 'description': 'Pour tests et développement. Utilise les plus petits modèles locaux. 100% hors-ligne.', 'preprocess_model': 'phi3:mini', 'extract_model': 'phi3:mini', 'synthesis_model': 'llama3:8b', 'is_custom': False},
            {'id': 'standard-local', 'name': ' balanced Standard (Local)', 'description': 'Bon équilibre vitesse/qualité pour le travail quotidien. 100% hors-ligne.', 'preprocess_model': 'phi3:mini', 'extract_model': 'llama3:8b', 'synthesis_model': 'llama3:8b', 'is_custom': False},
            {'id': 'deep-local', 'name': '🔬 Approfondi (Local)', 'description': 'Qualité maximale en local. Nécessite une machine puissante (GPU). 100% hors-ligne.', 'preprocess_model': 'llama3:8b', 'extract_model': 'mixtral:8x7b', 'synthesis_model': 'llama3:70b', 'is_custom': False},
            {'id': 'cloud-balanced', 'name': '☁️ Cloud Équilibré', 'description': 'Qualité supérieure via le cloud. Idéal pour des analyses robustes. Connexion requise.', 'preprocess_model': 'llama3:8b', 'extract_model': 'gpt-oss:20b-cloud', 'synthesis_model': 'gpt-oss:120b-cloud', 'is_custom': False},
            {'id': 'cloud-maximum', 'name': '🏆 Cloud Maximum (Qualité Thèse)', 'description': "Qualité d'analyse ultime pour la publication. Utilise les plus grands modèles cloud.", 'preprocess_model': 'llama3:8b', 'extract_model': 'deepseek-v3.1:671b-cloud', 'synthesis_model': 'deepseek-v3.1:671b-cloud', 'is_custom': False}
        ]

        with app.app_context():
            for profile_data in initial_profiles:
                exists = db.session.query(AnalysisProfile.id).filter_by(id=profile_data['id']).first() is not None
                if not exists:
                    new_profile = AnalysisProfile(**profile_data)
                    db.session.add(new_profile)
                    logger.info(f"  -> Added profile: {profile_data['name']}")
                else:
                    logger.info(f"  -> Profile already exists: {profile_data['name']}")
            db.session.commit()
        logger.info("✅ Database seeding complete.")

    # --- ROUTES SPÉCIFIQUES À L'APPLICATION ---
    @app.route('/')
    def serve_frontend():
        """Sert le point d'entrée du frontend (Single Page Application)."""
        return send_from_directory(app.static_folder, 'index.html')
    
    @app.route('/<path:filename>')
    def serve_static(filename):
        """Sert les fichiers statiques (JS, CSS, images, etc.)."""
        # Ne sert que si le fichier existe pour éviter les conflits avec les routes API
        if os.path.exists(os.path.join(app.static_folder, filename)):
            return send_from_directory(app.static_folder, filename)
        # Si le fichier n'existe pas, on redirige vers l'index pour la SPA
        return send_from_directory(app.static_folder, 'index.html')
    
    @app.route('/api/databases', methods=['GET'])
    def get_databases():
        """Retourne la liste statique des bases de données de recherche."""
        databases = [
            {'id': 'pubmed', 'name': 'PubMed', 'description': 'Base de données biomédicale principale', 'enabled': True, 'icon': '🏥'},
            {'id': 'semantic_scholar', 'name': 'Semantic Scholar', 'description': 'Recherche académique IA-powered', 'enabled': True, 'icon': '🎓'},
            {'id': 'arxiv', 'name': 'arXiv', 'description': 'Prépublications scientifiques', 'enabled': True, 'icon': '📄'},
            {'id': 'crossref', 'name': 'CrossRef', 'description': 'Métadonnées de publications', 'enabled': True, 'icon': '🔗'}
        ]
        return jsonify(databases)
    
    @app.route('/api/health', methods=['GET'])
    def health_check():
        """Point de terminaison de santé pour les checks de l'infrastructure."""
        return jsonify({"status": "healthy"}), 200

    @app.route('/api/projects/<project_id>/extractions', methods=['GET'])
    def get_project_extractions(project_id):
        """Retourne les extractions d'un projet avec l'abstract de l'article associé."""
        try:
            results = db.session.query(
                Extraction, 
                SearchResult.abstract, 
                SearchResult.title
            ).outerjoin(
                SearchResult, 
                (Extraction.pmid == SearchResult.article_id) & (Extraction.project_id == SearchResult.project_id)
            ).filter(Extraction.project_id == project_id).all()

            combined_results = []
            for extraction, abstract, title in results:
                extraction_dict = extraction.to_dict()
                extraction_dict['abstract'] = abstract or "Abstract non disponible."
                extraction_dict['title'] = title or extraction.title
                combined_results.append(extraction_dict)
            return jsonify(combined_results)
        except Exception as e:
            logger.error(f"Error fetching extractions for project {project_id}: {e}", exc_info=True)
            return jsonify({"error": "Failed to fetch extractions"}), 500

    # --- GESTIONNAIRES D'ERREURS GLOBAUX ---
    @app.errorhandler(429)
    def ratelimit_handler(e):
        """Gère les erreurs de limitation de débit (rate limiting)."""
        return jsonify(error="ratelimit exceeded", description=str(e)), 429

    @app.errorhandler(500)
    def internal_server_error(e):
        """Gère les erreurs internes du serveur non interceptées."""
        logger.error(f"Internal Server Error: {e}", exc_info=True)
        return jsonify(error="Internal server error"), 500

    return app

# --- POINT D'ENTRÉE PRINCIPAL ---
# Crée l'instance de l'application au niveau du module pour qu'elle soit importable par Gunicorn/WSGI
app = create_app()

if __name__ == "__main__":
    # Ce bloc ne s'exécute que lors d'un lancement direct (ex: `python server_v4_complete.py`)
    # Idéal pour le débogage local. NE PAS UTILISER EN PRODUCTION.
    logger.info("🚀 Lancement du serveur de développement Flask-SocketIO...")
    socketio.run(app, host="0.0.0.0", port=5000, debug=True, use_reloader=False)

