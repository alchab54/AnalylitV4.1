# Fichier : backend/__init__.py

# Le patch gevent doit être la toute première chose, c'est crucial.
from gevent import monkey
monkey.patch_all()

import os
import logging
from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from redis import from_url as redis_from_url
from rq import Queue
from flask_socketio import SocketIO

# =================================================================
# ===      INITIALISATION CENTRALE DES EXTENSIONS             ===
# =================================================================
# On crée les instances ici, elles seront liées à l'app dans la factory.
# Cela permet de les importer partout sans causer d'imports circulaires.
db = SQLAlchemy()
migrate = Migrate()
socketio = SocketIO()

# Connexion centrale à Redis
redis_conn = redis_from_url(os.getenv('REDIS_URL', 'redis://redis:6379/0'))

# Définition centrale des files d'attente RQ
import_queue = Queue('import_queue', connection=redis_conn)
screening_queue = Queue('screening_queue', connection=redis_conn)
extraction_queue = Queue('extraction_queue', connection=redis_conn)
analysis_queue = Queue('analysis_queue', connection=redis_conn)
synthesis_queue = Queue('synthesis_queue', connection=redis_conn)
atn_scoring_queue = Queue('atn_scoring_queue', connection=redis_conn)
discussion_draft_queue = Queue('discussion_draft_queue', connection=redis_conn)
# =================================================================


def create_app(config_name=os.getenv('FLASK_ENV', 'default')):
    """
    Application Factory: Crée, configure et retourne l'instance de l'application Flask.
    """
    app = Flask(__name__)

    # --- CONFIGURATION ---
    # Charger la configuration depuis un fichier ou un objet
    # (Adaptez 'backend.config.Config' à votre fichier de configuration)
    from backend.config import config
    app.config.from_object(config[config_name])
    config[config_name].init_app(app)


    # --- INITIALISATION DES EXTENSIONS AVEC L'APP ---
    db.init_app(app)
    migrate.init_app(app, db)
    socketio.init_app(app, cors_allowed_origins="*", async_mode='gevent', message_queue=app.config['REDIS_URL'])

    # --- JOURNALISATION (LOGGING) ---
    gunicorn_logger = logging.getLogger('gunicorn.error')
    if gunicorn_logger.handlers:
        app.logger.handlers = gunicorn_logger.handlers
        app.logger.setLevel(gunicorn_logger.level)
    app.logger.info("Journalisation configurée.")


    # --- ENREGISTREMENT DES BLUEPRINTS (ROUTES) ---
    # L'importation est faite ici pour éviter les dépendances circulaires
    from .server_v4_complete import main_bp as main_routes_bp
    app.register_blueprint(main_routes_bp)
    
    # (Si vous avez d'autres blueprints, enregistrez-les ici)
    # from .api.projects import projects_bp
    # app.register_blueprint(projects_bp, url_prefix='/api')


    return app
