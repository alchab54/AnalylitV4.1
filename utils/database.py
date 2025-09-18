import os
import logging
from contextlib import contextmanager
from functools import wraps
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.exc import ProgrammingError, OperationalError

logger = logging.getLogger(__name__)

# Répertoire projets (utilisé par utils.app_globals et utils.file_handlers)
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
PROJECTS_DIR = os.getenv("PROJECTS_DIR", os.path.abspath(os.path.join(BASE_DIR, "..", "projects")))

# URL DB
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://analylit:password@analylit-db-v4:5432/analylit_db")

# Engine et Base
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    echo=False,
    future=True,
)
Base = declarative_base()

# Session factory
SessionFactory = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

# Compatibilité: certains modules importent `Session` directement
def Session():
    return SessionFactory()

def get_session():
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
            logger.exception("Erreur DB dans %s: %s", func.__name__, e)
            raise
        finally:
            session.close()
    return wrapper

def _create_schema_if_needed(session):
    # Crée le schéma si absent
    try:
        session.execute(text("CREATE SCHEMA IF NOT EXISTS analylit_schema"))
        session.commit()
    except Exception:
        session.rollback()
        raise

def seed_default_data(session):
    # Ignorer en test
    if os.getenv("FLASK_ENV") == "testing" or os.getenv("TESTING") == "true":
        logger.info("Test env détecté: seed_default_data ignoré")
        return
    logger.info("Début du seeding par défaut...")
    _create_schema_if_needed(session)
    # Exemple minimal: garantir la table profiles si mappée via Base (sinon DDL séparés)
    Base.metadata.create_all(bind=engine)
    # Insertion de profil d'analyse par défaut si la table existe
    try:
        session.execute(text("""
            INSERT INTO analylit_schema.analysis_profiles (name, description, config_json)
            VALUES ('Standard', 'Profil par défaut', '{}')
            ON CONFLICT DO NOTHING
        """))
        session.commit()
        logger.info("Seeding terminé.")
    except Exception as e:
        session.rollback()
        logger.warning("Seeding non appliqué (peut être normal si la table n'existe pas encore): %s", e)

def init_database():
    # Création DDL basique
    with get_session() as session:
        _create_schema_if_needed(session)
    Base.metadata.create_all(bind=engine)
    # Seed hors tests
    with get_session() as session:
        seed_default_data(session)
