# utils/app_globals.py

import logging
import redis
from rq import Queue
from flask_socketio import SocketIO

# CORRECTION : L'import doit pointer vers 'config_v4' à la racine du projet.
from config_v4 import get_config 

# 'engine' n'est plus importé directement pour éviter les dépendances circulaires.
# Les modules doivent utiliser get_engine() de utils.database après l'initialisation.
from utils.database import Session, SessionFactory, with_db_session, PROJECTS_DIR
from utils.queues import set_background_queue

logger = logging.getLogger("analylit")
config = get_config()

# Objets neutres à l’import (pas de connexions actives ici)
socketio = SocketIO(message_queue=None, async_mode='gevent', cors_allowed_origins="*")
redis_conn = None
processing_queue = None
synthesis_queue = None
analysis_queue = None
discussion_draft_queue = None
background_queue = None
q = None

def initialize_app_globals(app=None):
    """
    Initialise les objets globaux de l'application (Redis, Queues, SocketIO).
    Cette fonction est appelée une fois que l'application Flask est créée.
    """
    global redis_conn, processing_queue, synthesis_queue, analysis_queue
    global discussion_draft_queue, background_queue, q, socketio

    if redis_conn is None:
        redis_conn = redis.from_url(config.REDIS_URL)

    # Utiliser les noms de file d'attente définis
    if processing_queue is None:
        processing_queue = Queue("analylit_processing_v4", connection=redis_conn)
    if synthesis_queue is None:
        synthesis_queue = Queue("analylit_synthesis_v4", connection=redis_conn)
    if analysis_queue is None:
        analysis_queue = Queue("analylit_analysis_v4", connection=redis_conn)
    if discussion_draft_queue is None:
        discussion_draft_queue = Queue("discussion_draft", connection=redis_conn)
    if background_queue is None:
        background_queue = Queue("analylit_background_v4", connection=redis_conn)
        set_background_queue(background_queue) # Initialise la queue partagée
    if q is None:
        q = Queue("default", connection=redis_conn)

    if app is not None:
        socketio.init_app(
            app,
            cors_allowed_origins="*",
            message_queue=config.REDIS_URL,
            async_mode='gevent',
            path='/socket.io/'
        )
