# backend/gunicorn_entry.py

# Maintenant que le patch est fait, importer la factory de l'application Flask et créer l'application.
from server_v4_complete import create_app

app = create_app()