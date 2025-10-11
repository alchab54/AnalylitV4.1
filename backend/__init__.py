# Fichier: backend/__init__.py

import os

# ✅ MODIFICATION CONDITIONNELLE
if os.getenv('DISABLE_SOCKETIO', '').lower() != 'true':
    from .server_v4_complete import create_app, socketio, db
    # SocketIO activé
    app = create_app()
    app.app_context().push()
else:
    # ✅ VERSION SANS SOCKETIO
    from flask import Flask
    from utils.extensions import db, migrate, limiter
    from backend.config.config_v4 import get_config
    
    app = Flask(__name__, static_folder='../web', static_url_path='')
    config = get_config()
    app.config.from_object(config)
    
    db.init_app(app)
    migrate.init_app(app, db)
    limiter.init_app(app)
    
    # Pas de SocketIO = pas d'erreur !
    
app.app_context().push()
