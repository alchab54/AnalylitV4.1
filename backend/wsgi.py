# backend/wsgi.py
from backend.server_v4_complete import create_app

# Crée l'instance de l'application qui sera utilisée PARTOUT
app = create_app()

# Point d'entrée pour Gunicorn
if __name__ == '__main__':
    from backend.server_v4_complete import socketio
    socketio.run(app)
