# backend/manage.py

import os

from backend.server_v4_complete import create_app, db
from utils.database import migrate

# Create an app instance for the CLI
app = create_app()

# Link the Migrate instance to the app and db for the 'flask db' command
migrate.init_app(app, db)