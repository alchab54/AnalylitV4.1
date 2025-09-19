# utils/database.py

import os
import logging
from functools import wraps
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from flask_sqlalchemy import SQLAlchemy

logger = logging.getLogger(__name__)

# --- Variables globales (non initialisées) ---
engine = None
SessionFactory = None

# Définir le schéma, mais le rendre None si en mode test
SCHEMA = 'analylit_schema' if os.getenv('TESTING') != 'true' else None

# Base déclarative partagée
Base = declarative_base()
# Note : les modèles seront importés par server_v4_complete.py

# Instance Flask-SQLAlchemy pour les tests
db = SQLAlchemy()

def init_database(database_url=None):
    """Initialise le moteur et la factory de session."""
    global engine, SessionFactory
    if engine:
        return engine

    if not database_url:
        database_url = os.getenv("DATABASE_URL", "postgresql://user:pass@db/analylit_db")

    try:
        engine = create_engine(database_url, pool_pre_ping=True)
        if SCHEMA:
            with engine.connect() as connection:
                connection.execute(text(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}"))
                connection.commit()
        
        Base.metadata.create_all(bind=engine)
        SessionFactory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
        logger.info("✅ Base de données initialisée avec succès.")
    except Exception as e:
        logger.critical(f"❌ ERREUR D'INITIALISATION DB : {e}", exc_info=True)
        engine = None
        raise
    return engine

def get_session():
    """Récupère une session de la factory."""
    if not SessionFactory:
        raise RuntimeError("La base de données n'est pas initialisée. Appelez init_database().")
    return SessionFactory()

def with_db_session(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        session = get_session()
        try:
            result = func(session, *args, **kwargs)
            session.commit()
            return result
        except Exception as e:
            session.rollback()
            logger.exception(f"Erreur DB dans {func.__name__}: {e}")
            raise
        finally:
            session.close()
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
