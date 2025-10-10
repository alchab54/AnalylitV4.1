# Fichier : utils/app_globals.py (VERSION FINALE)

import os
from redis import from_url
from rq import Queue

# Configuration Redis
redis_url = os.getenv('REDIS_URL', 'redis://redis:6379/0')
redis_conn = from_url(redis_url)

# --- Files d'attente RQ alignées sur docker-compose.glory.yml ---
# C'est la seule source de vérité pour les noms de files d'attente.

import_queue = Queue('import_queue', connection=redis_conn)
screening_queue = Queue('screening_queue', connection=redis_conn)
atn_scoring_queue = Queue('atn_scoring_queue', connection=redis_conn)
extraction_queue = Queue('extraction_queue', connection=redis_conn)
analysis_queue = Queue('analysis_queue', connection=redis_conn)
synthesis_queue = Queue('synthesis_queue', connection=redis_conn)
discussion_draft_queue = Queue('discussion_draft_queue', connection=redis_conn)

# --- PAS DE Limiter ou d'autres configurations ici ---
# Cela sera géré dans la factory de l'application pour éviter les imports circulaires.
