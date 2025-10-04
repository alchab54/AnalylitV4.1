# utils/app_globals.py - VERSION FINALE CORRIGÉE
import os
from redis import from_url
from rq import Queue
from backend.config.config_v4 import get_config
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Configuration
config = get_config()

# Configuration Redis
redis_url = os.getenv('REDIS_URL', 'redis://redis:6379/0')
redis_conn = from_url(redis_url)

# ✅ CORRECTION : Configuration rate limiter selon environnement
if os.getenv('TESTING') == 'true':
    # En mode test : pas de rate limiting réel
    limiter = Limiter(
        key_func=get_remote_address,
        storage_uri="memory://",
        default_limits=["1000 per minute"]
    )
else:
    # En production : rate limiting normal via Redis
    limiter = Limiter(
        key_func=get_remote_address,
        storage_uri=redis_url,
        default_limits=["100 per minute"]
    )

# Configuration des files d'attente RQ
processing_queue = Queue('processing_queue', connection=redis_conn)
synthesis_queue = Queue('synthesis_queue', connection=redis_conn)
analysis_queue = Queue('analysis_queue', connection=redis_conn)
background_queue = Queue('background_queue', connection=redis_conn)
models_queue = Queue('models_queue', connection=redis_conn)
extension_queue = Queue('extension_queue', connection=redis_conn)
fast_queue = Queue('fast_queue', connection=redis_conn)
default_queue = Queue('default_queue', connection=redis_conn)
ai_queue = Queue('ai_queue', connection=redis_conn)

# ✅ CORRECTION : Configuration répertoire projects
PROJECTS_DIR = os.getenv('PROJECTS_DIR', '/home/appuser/app/projects')

def ensure_projects_directory():
    """S'assurer que le répertoire projects existe avec les bonnes permissions"""
    import pathlib
    projects_path = pathlib.Path(PROJECTS_DIR)
    try:
        projects_path.mkdir(parents=True, exist_ok=True)
        # Définir permissions si pas en mode test
        if os.getenv('TESTING') != 'true':
            projects_path.chmod(0o755)
        return True
    except (OSError, PermissionError) as e:
        print(f"⚠️  Impossible de créer {PROJECTS_DIR}: {e}")
        return False

# Créer le répertoire au démarrage si nécessaire
ensure_projects_directory()

# Alias pour la clarté du code - ✅ AJOUTER CETTE LIGNE
discussion_draft_queue = analysis_queue
