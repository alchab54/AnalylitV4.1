# Fichier : run_migrations.py (CORRIGÉ)
import logging
from flask_migrate import Migrate, upgrade
from server_v4_complete import create_app, db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    logger.info("Creating app context for migrations...")
    app = create_app()
    
    # Initialiser Flask-Migrate explicitement dans ce contexte
    migrate = Migrate(app, db)
    
    with app.app_context():
        logger.info("Applying database migrations via upgrade()...")
        upgrade()
        logger.info("✅ Database migrations applied successfully.")
        
except Exception as e:
    logger.error(f"❌ CRITICAL MIGRATION ERROR: {e}", exc_info=True)
    # En cas d'échec, on tente de créer les tables directement comme solution de secours
    logger.warning("Migration failed. Falling back to db.create_all()...")
    with create_app().app_context():
        db.create_all()
        logger.info("✅ Tables created directly via db.create_all().")
