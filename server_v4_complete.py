# ================================================================
# AnalyLit V4.1 - Serveur Flask Principal
# ================================================================
import json
import logging
import sys
from flask import Flask, jsonify, request, Blueprint, send_from_directory, Response
from flask_cors import CORS # type: ignore
from rq import Queue
from rq.worker import Worker
import redis
from flask_socketio import SocketIO
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import text

from utils.database import init_db, seed_default_data
from utils.logging_config import setup_logging # <-- AJOUT : Import de la fonction centralisée

# --- Import des variables globales partagées ---
from utils.app_globals import (
    config, logger, engine, Session, SessionFactory,
    redis_conn, processing_queue, synthesis_queue, analysis_queue,
    discussion_draft_queue, background_queue, q,
    api_bp, socketio, PROJECTS_DIR, with_db_session
)
from tasks_v4_complete import (
    add_manual_articles_task,
    import_from_zotero_json_task
)
from utils.models import SearchResult

# --- NOUVEAU : Import des Blueprints ---
from api.projects import projects_bp
from api.search import search_bp
from api.admin import admin_bp
from api.settings import settings_bp
from api.files import files_bp # Assurez-vous que ce fichier existe

# ================================================================
# 1) Création de l'application Flask (Factory Pattern)
# ================================================================

def create_app(config_overrides=None): # <--- Accepte les overrides
    """Crée et configure l'instance de l'application Flask."""
    app = Flask(__name__, static_folder='web', static_url_path='/')
    app.config['JSON_AS_ASCII'] = False 
    
    if config_overrides: # <--- Applique les overrides (pour pytest)
        app.config.update(config_overrides)
    
    allowed_origins = [
        "http://localhost:8080",  # Pour votre frontend local
        "https://www.zotero.org", # Pour l'intégration de l'extension
        "chrome-extension://*",    # Autorise TOUTES les extensions chrome (pour le dev)
    ]
    CORS(app, resources={r"/api/*": {"origins": allowed_origins}}, supports_credentials=True)
    
    # Configuration de SocketIO
    socketio.init_app(app, cors_allowed_origins="*", message_queue=config.REDIS_URL, async_mode='gevent', path='/socket.io/')

    @app.teardown_appcontext
    def shutdown_session(exception=None):
        """Ferme la session SQLAlchemy à la fin de la requête."""
        Session.remove()
        
    # Enregistrement des blueprints avec le préfixe commun
    app.register_blueprint(projects_bp, url_prefix='/api')
    app.register_blueprint(search_bp, url_prefix='/api')
    app.register_blueprint(admin_bp, url_prefix='/api')
    app.register_blueprint(settings_bp, url_prefix='/api')
    app.register_blueprint(files_bp, url_prefix='/api')
        
    @app.route('/api/health')
    def health_check():
        return jsonify({'status': 'ok', 'message': 'AnalyLit V4.1 is running'}), 200

    @app.route('/healthz')
    def healthz():
        return jsonify({'status': 'ok', 'message': 'Healthz check passed'}), 200

    logger.info(f"App is in TESTING mode: {app.config.get('TESTING')}")
    if not app.config.get("TESTING"):
        # Configurer la journalisation au démarrage de l'application
        setup_logging()

        with app.app_context():
            logger.info("Initializing database and seeding default data...")
            # init_db()
            # seed_default_data(engine)
            logger.info("Database initialization and seeding complete.")

    return app

# ================================================================
# 2) Événements WebSocket
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

# ================================================================
# 3) Logique de démarrage et tâches de fond
# ================================================================

def _init_db_command():
    """
    Fonction interne pour initialiser la base de données.
    Sera appelée par une commande Flask CLI.
    """
    logger.info("Initialisation de la base de données...")
    init_db()
    logger.info("Base de données initialisée.")
    logger.info("Insertion des données par défaut (profils, prompts)...")
    try:
        with engine.begin() as conn:
            seed_default_data(conn)
        logger.info("Données par défaut insérées avec succès.")
    except Exception as e:
        logger.error(f"Erreur lors de l'insertion des données par défaut: {e}")

def listen_for_notifications():
    """Tâche de fond pour écouter les notifications Redis et les relayer via Socket.IO."""
    pubsub = redis_conn.pubsub()
    pubsub.subscribe("analylit_notifications")
    logger.info("ðŸ“¢ L\'écouteur de notifications Redis est démarré.")

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
    app = create_app()
    socketio.start_background_task(target=listen_for_notifications)
    socketio.run(app, host='0.0.0.0', port=5000, debug=True, use_reloader=False, allow_unsafe_werkzeug=True)