# backend/manage.py

from backend.server_v4_complete import create_app
from utils.database import db, migrate

# Create an app instance for the CLI
# The create_app factory now handles all extension initializations.
app = create_app()

# Link the Migrate instance to the app and db for the 'flask db' command
migrate.init_app(app, db)