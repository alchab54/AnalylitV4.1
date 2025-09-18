import logging
import redis
from rq import Queue
from flask_socketio import SocketIO
from utils.config_v4 import Config
from utils.database import engine, Session, SessionFactory, with_db_session, PROJECTS_DIR

logger = logging.getLogger("analylit")
config = Config()

# Objets neutres à l’import
socketio = SocketIO(message_queue=None, async_mode='gevent', cors_allowed_origins="*")
redis_conn = None
processing_queue = None
synthesis_queue = None
analysis_queue = None
discussion_draft_queue = None
background_queue = None
q = None

def initialize_app_globals(app=None):
    global redis_conn, processing_queue, synthesis_queue, analysis_queue
    global discussion_draft_queue, background_queue, q, socketio

    if redis_conn is None:
        redis_conn = redis.from_url(config.REDIS_URL)

    if processing_queue is None:
        processing_queue = Queue("processing", connection=redis_conn)
    if synthesis_queue is None:
        synthesis_queue = Queue("synthesis", connection=redis_conn)
    if analysis_queue is None:
        analysis_queue = Queue("analysis", connection=redis_conn)
    if discussion_draft_queue is None:
        discussion_draft_queue = Queue("discussion_draft", connection=redis_conn)
    if background_queue is None:
        background_queue = Queue("background", connection=redis_conn)
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
