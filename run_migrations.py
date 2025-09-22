# Fichier : run_migrations.py
import logging
from flask_migrate import upgrade
from server_v4_complete import create_app, db

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

logger.info("Creating app for migrations...")
app = create_app()

with app.app_context():
    logger.info("Initializing DB for migrations...")
    # Pas besoin de db.init_app(app) ici, create_app le fait déjà.

    logger.info("Applying database migrations...")
    upgrade()
    logger.info("Database migrations applied successfully.")
