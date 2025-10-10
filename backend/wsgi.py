# Fichier: backend/wsgi.py

from backend import create_app

# Crée l'instance de l'application en utilisant la factory
app = create_app()
