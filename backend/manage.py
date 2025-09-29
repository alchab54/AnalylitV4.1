# backend/manage.py

from backend.server_v4_complete import create_app
from utils.extensions import db, migrate # ✅ Importer depuis les extensions

# Créer une instance d'application dédiée pour les commandes CLI
app = create_app()

# Link the Migrate instance to the app and db for the 'flask db' command
migrate.init_app(app, db)