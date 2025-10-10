# Fichier: backend/__init__.py

import os
from .server_v4_complete import create_app, socketio, db

# Crée une instance de l'application en utilisant la factory
# La configuration sera chargée depuis le fichier config/config_v4.py
app = create_app()

# Pousser un contexte d'application pour que les extensions et les tâches
# puissent y accéder lors de l'importation.
app.app_context().push()
