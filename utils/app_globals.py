import os, json, logging
from datetime import datetime, timezone
from flask import Blueprint
from flask_socketio import SocketIO
from rq import Queue
import redis
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, scoped_session
from functools import wraps
from pathlib import Path

from config_v4 import get_config
from utils.logging_config import setup_logging # Assuming this is needed for global logger setup

# --- Configuration ---
config = get_config()

# --- Logger ---
logger = logging.getLogger(__name__)
# setup_logging() # This should be called once, typically in create_app or main entry point

# --- Base de Données (SQLAlchemy) ---
engine = create_engine(config.DATABASE_URL, pool_pre_ping=True)
SessionFactory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Session = scoped_session(SessionFactory)

# --- Redis / Queues ---
redis_conn = redis.from_url(config.REDIS_URL)
processing_queue = Queue('analylit_processing_v4', connection=redis_conn)
synthesis_queue = Queue('analylit_synthesis_v4', connection=redis_conn)
analysis_queue = Queue('analylit_analysis_v4', connection=redis_conn)
discussion_draft_queue = Queue('analylit_discussion_draft_v4', connection=redis_conn)
background_queue = Queue('analylit_background_v4', connection=redis_conn)
q = processing_queue # Alias pour la file de traitement principale

# --- Blueprint et SocketIO (définis globalement) ---
api_bp = Blueprint('api', __name__) # Le préfixe sera ajouté lors de l'enregistrement
socketio = SocketIO()

# --- Projets: répertoire fichiers ---
PROJECTS_DIR = Path(config.PROJECTS_DIR)
PROJECTS_DIR.mkdir(parents=True, exist_ok=True)

# --- Decorator for DB session management ---
def with_db_session(f):
    """Décorateur pour injecter et gérer une session de base de données."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        session = Session()
        try:
            result = f(db_session=session, *args, **kwargs)
            session.commit()
            return result
        except Exception as e:
            session.rollback()
            raise e
        finally:
            Session.remove()
    return decorated_function
