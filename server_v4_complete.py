# server_v4_complete.py
from flask import Flask, jsonify
from flask_cors import CORS
from utils.logging_config import setup_logging
# Import direct de init_db et Session depuis utils.database pour éviter les dépendances circulaires
# et garantir que init_db est défini lors de l'appel dans create_app().
from utils.database import init_db, Session 

# RÈGLE RESPECTÉE : Ne PAS importer 'engine' au niveau du module.
# L'importer ici le lierait à la valeur 'None' avant son initialisation.
# Importe les autres composants globaux non-DB.
from utils.app_globals import (
    config, logger, 
    initialize_app_globals, socketio
)

def create_app(config_overrides=None):
    """
    Crée et configure l'application Flask.
    L'appel à init_db() est la TOUTE PREMIÈRE instruction pour garantir que la base de données
    est prête avant que tout autre composant ne soit enregistré ou configuré.
    """
    # Initialise la connexion à la DB et les sessions au démarrage de l'app.
    # Ceci sera exécuté par chaque worker Gunicorn.
    init_db()

    app = Flask(__name__, static_folder='web', static_url_path='/')
    app.config['JSON_AS_ASCII'] = False
    if config_overrides:
        app.config.update(config_overrides)

    allowed_origins = ["http://localhost:8080", "https://www.zotero.org", "chrome-extension://*"]
    CORS(app, resources={r"/api/*": {"origins": allowed_origins}}, supports_credentials=True)

    # Initialise les composants qui ne dépendent pas de la base de données (Redis, Sockets...)
    initialize_app_globals(app)

    @app.teardown_appcontext
    def shutdown_session(exception=None):
        """
        Nettoie la session SQLAlchemy après chaque requête.
        La variable 'Session' est importée directement de utils.database.
        """
        if Session:
            Session.remove()

    # Enregistrement des Blueprints (routes de l'API)
    from api.projects import projects_bp
    from api.search import search_bp
    from api.admin import admin_bp
    from api.settings import settings_bp
    from api.files import files_bp
    from api.extensions import extensions_bp # New import

    app.register_blueprint(projects_bp, url_prefix='/api')
    app.register_blueprint(search_bp, url_prefix='/api')
    app.register_blueprint(admin_bp, url_prefix='/api')
    app.register_blueprint(settings_bp, url_prefix='/api/settings')
    app.register_blueprint(files_bp, url_prefix='/api')
    app.register_blueprint(extensions_bp) # New registration

    # Routes de health check pour le monitoring
    @app.route('/api/health')
    def health_check():
        return jsonify({'status': 'ok'}), 200

    @app.route('/healthz')
    def healthz():
        return jsonify({'status': 'ok'}), 200

    if not app.config.get("TESTING"):
        setup_logging()

    # Ajout de la commande CLI pour l'initialisation
    @app.cli.command('init-db')
    def init_db_command_wrapper():
        """Expose la logique d'initialisation via la commande 'flask init-db'."""
        logger.info("Lancement de la commande d'initialisation de la base de données...")
        _init_db_command()
        logger.info("Commande d'initialisation terminée.")

    return app

def _init_db_command():
    """
    Orchestre l'initialisation de la base de données et le peuplement (seeding).
    Cette fonction suit le pattern d'import tardif pour résoudre le bug de race condition
    lors de l'exécution de la commande CLI.
    """
    # ÉTAPE 1: Appeler init_db() en premier. Cette fonction peuple la variable
    # globale 'engine' dans le module 'utils.database'.
    from utils.database import init_db
    try:
        init_db()
    except Exception as e:
        logger.critical(f"L'initialisation de la base de données a échoué. Le conteneur ne peut pas démarrer. Erreur: {e}", exc_info=True)
        raise RuntimeError("Impossible d'initialiser la connexion à la base de données.") from e

    # ÉTAPE 2: ENSUITE, importer le getter et la fonction de seeding.
    # C'est la garantie de ne pas récupérer une version 'None' de l'engine.
    from utils.database import get_engine, seed_default_data
    
    db_engine = get_engine()
    
    # Vérification critique pour s'assurer que l'initialisation a bien eu lieu
    if db_engine is None:
        raise RuntimeError("L'engine de la base de données est None après l'initialisation. Le démarrage est avorté.")

    logger.info("Peuplement de la base de données avec les données par défaut...")
    
    # ÉTAPE 3: Utiliser l'engine pour créer une connexion transactionnelle et peupler la DB.
    try:
        with db_engine.begin() as conn:
            seed_default_data(conn)
        logger.info("La base de données a été peuplée avec succès.")
    except Exception as e:
        logger.critical(f"Le peuplement de la base de données a échoué. Erreur: {e}", exc_info=True)
        raise RuntimeError("Impossible de peupler la base de données.") from e

# Point d'entrée principal pour la création de l'application
app = create_app()

# Ce bloc est utile pour le développement local mais n'est pas exécuté par Gunicorn
if __name__ == '__main__':
    # Pour un test local : flask --app server_v4_complete.py run
    # Pour initialiser la DB : flask --app server_v4_complete.py init-db
    logger.info("Application prête à être servie par un serveur WSGI (ex: Gunicorn).")