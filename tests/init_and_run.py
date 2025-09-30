import warnings
warnings.filterwarnings("ignore", message="Failed to load image Python extension")

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
    # Cela garantit que l'import de 'backend.server_v4_complete' fonctionnera toujours.
    project_root = Path(__file__).resolve().parent.parent
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))

    # --- CORRECTION DÉFINITIVE POUR LE DÉVELOPPEMENT LOCAL ---
    # Forcer l'utilisation de la base de données locale (localhost) exposée par Docker,
    # en ignorant la variable DATABASE_URL du fichier .env qui est destinée à l'intérieur de Docker.
    os.environ['DATABASE_URL'] = 'postgresql+psycopg2://analylit_user:strong_password@localhost:5433/analylit_db'

    # ✅ CORRECTION: Importer la factory et l'utiliser pour créer l'app ici.
    # Cela évite les problèmes d'initialisation double.
    from backend.server_v4_complete import create_app, socketio
    
    if sys.platform == 'win32':
        # --- Configuration pour Windows (qui ne supporte pas Gunicorn) ---
        print("Starting server with gevent-websocket for Windows...")

        # Créer l'instance de l'application
        app = create_app()

        # Lancer le serveur avec SocketIO
        socketio.run(app, host="0.0.0.0", port=5000, debug=True, allow_unsafe_werkzeug=True)

    else:
        # --- Configuration pour Linux/macOS (similaire à Windows pour le dev local) ---
        print("Starting server with gevent-websocket for Linux/macOS...")
        app = create_app()
        socketio.run(app, host="0.0.0.0", port=5001, debug=True)
        
if __name__ == "__main__":
    main()