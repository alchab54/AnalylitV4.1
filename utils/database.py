# utils/database.py

import os
import logging
from functools import wraps
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, scoped_session
# ↓↓↓ MODIFIEZ CET IMPORT ↓↓↓
from .db_base import Base  # Importer la Base partagée
 
logger = logging.getLogger(__name__)

# Global db object
class _DB:
    def __init__(self):
        self.engine = None
        self.SessionFactory = None
        self.session = None # This will be the scoped_session for application use

db = _DB()

# Définir le schéma, mais le rendre None si en mode test
SCHEMA = 'analylit_schema' if os.getenv('TESTING') != 'true' else None

# ↓↓↓ AJOUTEZ CET IMPORT CI-DESSOUS ↓↓↓
# Cela force l'enregistrement de tous les modèles auprès de la 'Base' déclarative
from utils import models # noqa

def init_database(database_url=None):
    """Initialise le moteur et la factory de session. Ne fait rien si déjà initialisé."""
    if db.engine:
        return db.engine

    if not database_url:
        database_url = os.getenv("DATABASE_URL", "postgresql://user:pass@db/test") # URL générique

    try:
        db.engine = create_engine(database_url, pool_pre_ping=True)
        if SCHEMA: # Si on utilise PostgreSQL, on crée le schéma
            with db.engine.connect() as connection:
                connection.execute(text(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}"))
                connection.commit()
        
        Base.metadata.create_all(bind=db.engine)
        db.SessionFactory = sessionmaker(bind=db.engine, autoflush=False, autocommit=False)
        db.session = scoped_session(db.SessionFactory) # Initialize the scoped_session here
        logger.info("✅ Base de données initialisée avec succès.")
    except Exception as e:
        logger.critical(f"❌ ERREUR D'INITIALISATION DB : {e}", exc_info=True)
        db.engine = None
        raise
    return db.engine

def get_session():
    """Récupère une session de la factory."""
    if not db.session: # Use db.session
        raise RuntimeError("La base de données n'est pas initialisée. Appelez init_database().")
    return db.session() # Call the scoped_session to get a session

def with_db_session(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        session = db.session() # Get a session from the scoped_session
        try:
            result = func(session, *args, **kwargs)
            session.commit()
            return result
        except Exception as e:
            session.rollback()
            logger.exception(f"Erreur DB dans {func.__name__}: {e}")
            raise
        finally:
            session.remove() # Remove the session from the registry for scoped_session
    return wrapper

def seed_default_data(session):
    """Seed la DB avec des données par défaut."""
    from utils.models import AnalysisProfile, Project
    try:
        if not session.query(AnalysisProfile).filter_by(name='Standard').first():
            session.add(AnalysisProfile(name='Standard', is_custom=False))
        if not session.query(Project).filter_by(name='Projet par défaut').first():
            session.add(Project(name='Projet par défaut'))
        session.commit()
    except Exception as e:
        logger.error(f"Erreur pendant le seeding : {e}")
        session.rollback()