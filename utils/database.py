# utils/database.py
import logging
import functools
from config_v4 import get_config
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, scoped_session

logger = logging.getLogger(__name__)
config = get_config()

# Définir les variables globales au niveau du module, initialisées à None
engine = None
SessionFactory = None
Session = None
db_session = None  # Alias pour Session

# Exporter les constantes nécessaires pour d'autres modules
PROJECTS_DIR = config.PROJECTS_DIR

def init_db(db_url=None):
    """Initialise l'engine de la base de données et les sessions."""
    global engine, SessionFactory, Session, db_session
    
    if engine:
        logger.debug("La base de données est déjà initialisée.")
        return

    db_url = db_url or config.DATABASE_URL
    logger.info("Initialisation de l'engine SQLAlchemy...")

    try:
        engine = create_engine(
            db_url,
            pool_pre_ping=True,
            connect_args={'options': '-c search_path=analylit_schema'}
        )
        SessionFactory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
        # scoped_session assure une session par thread, crucial pour une app web
        db_session = scoped_session(SessionFactory)
        Session = db_session  # Assigner l'alias
        logger.info("Engine et sessions initialisés avec succès.")
    except Exception as e:
        logger.exception(f"Erreur lors de l'initialisation de la base de données: {e}")
        # Réinitialiser en cas d'erreur pour éviter un état instable
        engine = SessionFactory = Session = db_session = None
        raise

def get_engine():
    """Retourne l'instance globale de l'engine. Point d'accès unique."""
    if engine is None:
        logger.warning("get_engine() appelé avant la fin de init_db().")
    return engine

@functools.lru_cache(maxsize=None)
def with_db_session(func):
    """Décorateur pour injecter une session de base de données."""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        if 'session' in kwargs:
            return func(*args, **kwargs)
        
        session = Session()
        try:
            kwargs['session'] = session
            result = func(*args, **kwargs)
            # Le commit est de la responsabilité de l'appelant
            return result
        except Exception:
            session.rollback()
            logger.exception("Rollback de la session suite à une erreur.")
            raise
        finally:
            # La session est gérée par le scoped_session, qui la ferme
            # généralement à la fin de la requête (teardown_appcontext).
            pass
    return wrapper

def seed_default_data(conn):
    """Peuple la base de données avec les données initiales."""
    logger.info("Début du peuplement de la base de données (seeding)...")
    from utils.models import Base, AnalysisProfile, Project
    from sqlalchemy.orm import Session as SASession
    import uuid
    from datetime import datetime

    try:
        logger.info("Création du schéma 'analylit_schema' et des tables.")
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS analylit_schema"))
        Base.metadata.create_all(bind=conn)
        
        session = SASession(bind=conn)
        
        if not session.query(AnalysisProfile).filter_by(name="Standard Profile").first():
            default_profile = AnalysisProfile(
                id=str(uuid.uuid4()), name="Standard Profile", description="Default analysis profile",
                temperature=0.7, context_length=4096, preprocess_model="default",
                extract_model="default", synthesis_model="default"
            )
            session.add(default_profile)
            logger.info("Profil par défaut créé.")
            session.flush()

            if not session.query(Project).filter_by(name="Default Project").first():
                default_project = Project(
                    id=str(uuid.uuid4()), name="Default Project", description="A default project.",
                    created_at=datetime.now(), updated_at=datetime.now(),
                    analysis_mode="screening", profile_used=default_profile.id
                )
                session.add(default_project)
                logger.info("Projet par défaut créé.")
        
        logger.info("Peuplement des données terminé.")
    except Exception as e:
        logger.exception(f"Erreur lors du peuplement de la base de données: {e}")
        raise
