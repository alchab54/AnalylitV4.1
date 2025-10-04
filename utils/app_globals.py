import os
from redis import from_url
from rq import Queue
from backend.config.config_v4 import get_config
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address


# --- Configuration de la connexion Redis ---
redis_url = os.getenv('REDIS_URL', 'redis://redis:6379/0')
redis_conn = from_url(redis_url)

# Utiliser une connexion Redis pour la file d'attente RQ
limiter = Limiter(key_func=get_remote_address, storage_uri="redis://redis:6379/0")


# ✅ CORRECTION DÉFINITIVE: Détecter si on est en mode test pour rendre les tâches synchrones.
# Cela évite les timeouts et les dépendances externes pendant les tests en exécutant les tâches immédiatement.
is_testing = os.getenv('TESTING') == 'true'

# --- Initialisation des files d'attente (queues) RQ ---
# ✅ CORRECTION: Noms de files alignés avec docker-compose.yml et ajout de la logique de test (is_async).
# En mode test (is_testing=True), is_async devient False, et les tâches s'exécutent sur-le-champ.
processing_queue = Queue('default_queue', connection=redis_conn, is_async=not is_testing, default_timeout=1800)
synthesis_queue = Queue('ai_queue', connection=redis_conn, is_async=not is_testing, default_timeout=3600)
analysis_queue = Queue('analysis_queue', connection=redis_conn, is_async=not is_testing, default_timeout=3600)
background_queue = Queue('background_queue', connection=redis_conn, is_async=not is_testing, default_timeout=1800)
extension_queue = Queue('extension_queue', connection=redis_conn, is_async=not is_testing, default_timeout=1800)
models_queue = Queue('background_queue', connection=redis_conn, is_async=not is_testing, default_timeout=3600)

# Alias pour la clarté du code
discussion_draft_queue = analysis_queue

# Compatibilité pour file_handlers qui attend cette variable
PROJECTS_DIR = get_config().PROJECTS_DIR
