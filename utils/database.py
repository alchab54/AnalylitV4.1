import os
import logging
from contextlib import contextmanager
from functools import wraps
from sqlalchemy import create_engine, text, inspect
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

# Compatibilité pour les tests
inspect = inspect  # Rendre inspect disponible au niveau module

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

def seed_default_data(session_or_connection):
    """
    Seed des données par défaut dans la base de données.
    Compatible avec les tests qui passent une connection ou une session.
    """
    # Ignorer en environnement de test
    if os.getenv("FLASK_ENV") == "testing" or os.getenv("TESTING") == "true":
        logger.info("Test env détecté: seed_default_data ignoré")
        return
    
    # Si c'est une connection, créer une session
    if hasattr(session_or_connection, 'execute') and not hasattr(session_or_connection, 'query'):
        # C'est une connection, créer une session pour les tests
        from sqlalchemy.orm import Session
        session = Session(bind=session_or_connection)
        should_close = True
    else:
        # C'est déjà une session
        session = session_or_connection  
        should_close = False
    
    try:
        logger.info("Début du seeding par défaut...")
        _create_schema_if_needed(session)
        
        # Vérifier et créer le profil par défaut
        from utils.models import AnalysisProfile, Project
        
        existing_profile = session.query(AnalysisProfile).filter_by(name='Standard').first()
        if not existing_profile:
            default_profile = AnalysisProfile(
                name='Standard', 
                description='Profil par défaut', 
                is_custom=False
            )
            session.add(default_profile)
        
        # Vérifier et créer le projet par défaut
        existing_project = session.query(Project).filter_by(name='Projet par défaut').first()
        if not existing_project:
            default_project = Project(
                name='Projet par défaut',
                description='Projet de démonstration'
            )
            session.add(default_project)
        
        session.commit()
        logger.info("Seeding terminé avec succès.")
        
    except Exception as e:
        session.rollback()
        logger.warning(f"Seeding non appliqué: {e}")
    finally:
        if should_close:
            session.close()

def init_database():
    """Initialise la base de données en créant toutes les tables et en appliquant le seeding."""
    logger.info("Initialisation de la base de données...")
    try:
        with get_session() as session:
            _create_schema_if_needed(session)
            Base.metadata.create_all(bind=engine)
            seed_default_data(session)
        logger.info("Initialisation de la base de données terminée.")
    except Exception as e:
        logger.error("Erreur lors de l'initialisation de la DB: %s", e, exc_info=True)
        # Ne pas propager l'erreur en production pour permettre au serveur de démarrer
        if os.getenv("FLASK_ENV") == "testing":
            raise

# Variable globale pour la compatibilité des tests
db_session = None

def init_db():
    """
    Initialise la base de données en créant toutes les tables.
    Fonction utilitaire pour les tests.
    """
    from utils.models import Base
    
    try:
        # Créer le schéma s'il n'existe pas
        with get_session() as session:
            session.execute(text("CREATE SCHEMA IF NOT EXISTS analylit_schema"))
            session.commit()
        
        # Créer toutes les tables
        Base.metadata.create_all(engine)
        print("✅ Tables créées avec succès")
        return engine
    except Exception as e:
        print(f"❌ Erreur lors de l'initialisation de la DB: {e}")
        raise

def get_db_session():
    """Retourne la session de base de données pour les tests"""
    global db_session
    if db_session is None:
        db_session = get_session()
    return db_session
