# backend/gunicorn_entry.py

# Now that patching is done, import the Flask app factory and create the app.
from backend.server_v4_complete import create_app

app = create_app()