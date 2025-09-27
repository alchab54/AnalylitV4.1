import os
from redis import Redis
from rq import Queue
from config_v4 import get_config

REDIS_HOST = os.getenv("REDIS_HOST", "analylit_redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))

redis_conn = Redis(host=REDIS_HOST, port=REDIS_PORT, db=0)

# Queues RQ nommées selon convention v4
processing_queue = Queue("analylit_processing_v4", connection=redis_conn, default_timeout=1800)
synthesis_queue = Queue("analylit_synthesis_v4", connection=redis_conn, default_timeout=3600)
analysis_queue = Queue("analylit_analysis_v4", connection=redis_conn, default_timeout=3600)
background_queue = Queue("analylit_background_v4", connection=redis_conn, default_timeout=1800)

# Pour l’endpoint /api/extensions
extension_queue = processing_queue
models_queue = Queue("models", connection=redis_conn, default_timeout=3600)

# Alias pour compatibilité des tests et flexibilité
discussion_draft_queue = analysis_queue

# Compatibilité pour file_handlers qui attend cette variable
PROJECTS_DIR = get_config().PROJECTS_DIR
