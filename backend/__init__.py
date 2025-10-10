# Fichier: backend/__init__.py

# --- PATCH GEVEBT : CRUCIAL POUR LA STABILITÉ ---
from gevent import monkey
monkey.patch_all()

import os
from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO

# --- IMPORTS DES EXTENSIONS ET CONFIG ---
from utils.extensions import db, migrate, limiter
from backend.config.config_v4 import get_config

# --- INITIALISATION DES EXTENSIONS (non liées à l'app) ---
# Elles seront connectées à l'application dans la factory.
socketio = SocketIO()

def create_app(config_override=None):
    """
    Factory pour créer et configurer l'instance de l'application Flask.
    """
    app = Flask(__name__,
                static_folder='../web', # Point vers le dossier de build du frontend
                static_url_path='')

    # --- CONFIGURATION ---
    config = get_config()
    app.config.from_object(config)
    if config_override:
        app.config.update(config_override)

    # --- CONNEXION DES EXTENSIONS À L'APPLICATION ---
    db.init_app(app)
    migrate.init_app(app, db)
    limiter.init_app(app)
    socketio.init_app(app, cors_allowed_origins="*", async_mode='gevent', message_queue=app.config['REDIS_URL'])

    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # --- IMPORTS ET ENREGISTREMENT DES BLUEPRINTS ---
    # L'importation se fait ici pour éviter les dépendances circulaires.
    with app.app_context():
        # Importez tous vos blueprints ici
        from api.admin import admin_bp
        from api.analysis_profiles import analysis_profiles_bp
        # ... (importez TOUS vos autres blueprints de la même manière)
        from api.projects import projects_bp
        from api.tasks import tasks_bp
        
        # Enregistrez-les
        app.register_blueprint(admin_bp, url_prefix='/api')
        app.register_blueprint(analysis_profiles_bp, url_prefix='/api')
        # ... (enregistrez TOUS vos autres blueprints)
        app.register_blueprint(projects_bp, url_prefix='/api')
        app.register_blueprint(tasks_bp, url_prefix='/api')

        # Import des modèles pour que Alembic les voie
        from utils import models

        # Import des commandes CLI pour les rendre disponibles
        from . import cli
        cli.register_commands(app)

        # Import des routes de base qui ne sont pas dans des blueprints
        from . import routes
        app.register_blueprint(routes.main_bp)

    return app
