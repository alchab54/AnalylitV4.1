from flask import Flask, jsonify
from flask_cors import CORS
from utils.logging_config import setup_logging
from utils.app_globals import (
    config, logger, engine, Session,
    initialize_app_globals, socketio
)
from api.projects import projects_bp
from api.search import search_bp
from api.admin import admin_bp
from api.settings import settings_bp
from api.files import files_bp

def create_app(config_overrides=None):
    app = Flask(__name__, static_folder='web', static_url_path='/')
    app.config['JSON_AS_ASCII'] = False
    if config_overrides:
        app.config.update(config_overrides)

    allowed = ["http://localhost:8080", "https://www.zotero.org", "chrome-extension://*"]
    CORS(app, resources={r"/api/*": {"origins": allowed}}, supports_credentials=True)

    # Init “passive”: Redis/Queues/SocketIO, pas de DB/seed ici
    initialize_app_globals(app)

    @app.teardown_appcontext
    def shutdown_session(exception=None):
        Session.remove()

    app.register_blueprint(projects_bp, url_prefix='/api')
    app.register_blueprint(search_bp, url_prefix='/api')
    app.register_blueprint(admin_bp, url_prefix='/api')
    app.register_blueprint(settings_bp, url_prefix='/api')
    app.register_blueprint(files_bp, url_prefix='/api')

    @app.route('/api/health')
    def health_check():
        return jsonify({'status': 'ok'}), 200

    @app.route('/healthz')
    def healthz():
        return jsonify({'status': 'ok'}), 200

    if not app.config.get("TESTING"):
        setup_logging()

    return app

def _init_db_command():
    from utils.database import init_db, seed_default_data
    logger.info("Initialisation DB...")
    init_db()
    logger.info("Seeding défaut...")
    with engine.begin() as conn:
        seed_default_data(conn)

app = create_app()
