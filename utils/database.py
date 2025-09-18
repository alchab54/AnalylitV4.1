import os
import logging
from functools import wraps
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base, scoped_session

logger = logging.getLogger(__name__)

# --- Variables globales (non initialisées) ---
engine = None
SessionFactory = None
Base = declarative_base()
SCHEMA = 'analylit_schema'

# --- Fonction d'initialisation principale ---
def init_database(database_url=None):
    """
    Initialise le moteur de base de données et la factory de session.
    Ne fait rien si déjà initialisé.
    """
    global engine, SessionFactory

    if engine:
        return engine

    if not database_url:
        database_url = os.getenv("DATABASE_URL", "postgresql://analylit:password@analylit-db-v4:5432/analylit_db")
    
    logger.info(f"Initialisation de la base de données : {database_url}")
    try:
        engine = create_engine(database_url, pool_pre_ping=True, echo=False)
        
        # Créer le schéma
        with engine.connect() as connection:
            connection.execute(text(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}"))
            connection.commit()
            
        # Créer les tables
        Base.metadata.create_all(bind=engine)
        
        # Créer la factory de session
        SessionFactory = sessionmaker(bind=engine, autoflush=False, autocommit=False)

        logger.info("✅ Base de données initialisée avec succès.")
    except Exception as e:
        logger.critical(f"❌ ERREUR CRITIQUE : L'initialisation de la base de données a échoué : {e}", exc_info=True)
        engine = None # Réinitialiser pour permettre une nouvelle tentative
        raise
        
    return engine

# --- Fonctions de gestion de session ---
def get_session():
    """Récupère une nouvelle session de la factory."""
    if not SessionFactory:
        raise RuntimeError("La base de données n'est pas initialisée. Appelez init_database() au démarrage de l'application.")
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
    """
    Seed la base de données avec des données par défaut (un projet et un profil).
    Ne fait rien si les données existent déjà.
    """
    # Importer les modèles ici pour éviter les imports circulaires
    from utils.models import AnalysisProfile, Project

    try:
        # Vérifier et créer le profil par défaut
        existing_profile = session.query(AnalysisProfile).filter_by(name='Standard').first()
        if not existing_profile:
            default_profile = AnalysisProfile(
                name='Standard',
                description='Profil par défaut pour les analyses standards.',
                is_custom=False
            )
            session.add(default_profile)
            logger.info("Profil 'Standard' par défaut créé.")

        # Vérifier et créer le projet par défaut
        existing_project = session.query(Project).filter_by(name='Projet par défaut').first()
        if not existing_project:
            default_project = Project(
                name='Projet par défaut',
                description='Projet de démonstration pour les nouveaux utilisateurs.'
            )
            session.add(default_project)
            logger.info("Projet 'Projet par défaut' créé.")

        session.commit()

    except Exception as e:
        logger.error(f"Erreur pendant le seeding des données: {e}")
        session.rollback()
