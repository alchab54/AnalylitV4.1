import os
import sys
from pathlib import Path
from dotenv import load_dotenv

def main():
    """Point d'entrée principal pour démarrer le serveur."""
    
    # --- CORRECTION: Charger les variables d'environnement ---
    # Charge les variables du fichier .env à la racine du projet.
    # Cela rend DATABASE_URL et d'autres configurations disponibles.
    load_dotenv()

    # --- CORRECTION DÉFINITIVE ---
    # Ajoute manuellement le répertoire parent (la racine du projet) au sys.path.
    # Cela garantit que l'import de 'server_v4_complete' fonctionnera toujours.
    project_root = Path(__file__).resolve().parent.parent
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))

    from backend.server_v4_complete import create_app
    
    if sys.platform == 'win32':
        # --- Configuration pour Windows (qui ne supporte pas Gunicorn) ---
        print("Starting server with gevent-websocket for Windows...")
        from gevent import pywsgi
        from geventwebsocket.handler import WebSocketHandler
        
        app = create_app()
        # CORRECTION: Changed port from 5000 to 5001 to avoid conflicts on Windows.
        print(f"Server starting on http://0.0.0.0:5001")
        server = pywsgi.WSGIServer(('0.0.0.0', 5001), app, handler_class=WebSocketHandler)
        server.serve_forever()
    else:
        # --- Configuration pour Linux/macOS (Gunicorn) ---
        print("Starting Gunicorn...")
        gunicorn_cmd = [
            "gunicorn",
            "backend.server_v4_complete:create_app()",
            "-k", "geventwebsocket.gunicorn.workers.GeventWebSocketWorker",
            "-w", "1",
            "--timeout", "300",
            "-b", "0.0.0.0:5000",
            "--access-logfile", "-",
            "--error-logfile", "-"
        ]
        os.execvp("gunicorn", gunicorn_cmd)
        
if __name__ == "__main__":
    main()
