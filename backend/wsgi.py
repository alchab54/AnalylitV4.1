# Fichier: backend/wsgi.py

# Importe la factory qui crée l'application
from backend.server_v4_complete import create_app

# Crée l'instance de l'application ici.
# Cet objet 'app' devient le point de référence unique pour toute l'application.
app = create_app()

# Le code pour SocketIO est déplacé ici pour Gunicorn
if __name__ == '__main__':
    from backend.server_v4_complete import socketio
    socketio.run(app)
