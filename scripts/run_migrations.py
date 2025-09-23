# Fichier : run_migrations.py (CORRIGÉ)
import logging
from flask import Flask
from flask_migrate import upgrade
from server_v4_complete import create_app  # On importe juste la factory

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# On ne crée pas une nouvelle instance de Migrate ici.
# On utilise le contexte de l'application pour que tout soit déjà initialisé.

try:
    logger.info("Creating app context to apply migrations...")
    app = create_app()

    with app.app_context():
        logger.info("Applying database migrations via upgrade()...")
        # La commande 'upgrade' utilisera l'instance Migrate déjà configurée dans create_app()
        upgrade()
        logger.info("✅ Database migrations applied successfully.")

except Exception as e:
    logger.error(f"❌ CRITICAL MIGRATION ERROR: {e}", exc_info=True)
    # Important : faire planter le script pour que Docker redémarre le conteneur
    exit(1)

