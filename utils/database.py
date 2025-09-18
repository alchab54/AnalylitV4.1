import logging
from config_v4 import get_config, Settings
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, scoped_session

logger = logging.getLogger(__name__)

# --- CORRECTION ---
# Nous devons instancier l'objet config au niveau du module
# pour qu'il soit disponible lorsque init_db() est appelé depuis conftest.
config = get_config()
# ------------------

# Declare these as global to be reconfigurable
engine = None
SessionFactory = None
db_session = None

def init_db(db_url=None, config_obj: Settings = None):
    logger.info("Starting init_db...")
    global engine, SessionFactory, db_session
    
    # Utilisez config_obj s'il est passé (pour les tests), sinon utilisez le config global
    active_config = config_obj if config_obj else config

    if db_url is None:
        db_url = active_config.DATABASE_URL # Modifié pour utiliser active_config

    # Always re-create engine and SessionFactory to ensure a clean state for tests
    engine = create_engine(db_url, pool_pre_ping=True, connect_args={'options': '-c search_path=analylit_schema'})
    SessionFactory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    db_session = scoped_session(SessionFactory)

    from . import models
    try:
        with engine.connect() as connection:
            connection.execute(text("SET search_path TO analylit_schema;"))
            connection.commit()
            print(f"Current search_path: {connection.execute(text("SHOW search_path;")).scalar()}")
            models.Base.metadata.create_all(bind=connection, schema='analylit_schema')
        logger.info("All tables created successfully.")
    except Exception as e:
        logger.exception(f"Error creating tables: {e}")
        raise

    # Manual migration to add missing columns to analysis_profiles
    inspector = inspect(engine)
    try:
        columns = {col['name'] for col in inspector.get_columns('analysis_profiles')}
    except Exception as e:
        logger.warning(f"Could not inspect analysis_profiles table (might not exist yet): {e}")
        columns = set() # Assume no columns if table doesn't exist

    with engine.connect() as connection:
        if 'description' not in columns:
            logger.info("MIGRATION: Adding 'description' column to 'analysis_profiles' table.")
            connection.execute(text('ALTER TABLE analysis_profiles ADD COLUMN description TEXT'))
        
        if 'temperature' not in columns:
            logger.info("MIGRATION: Adding 'temperature' column to 'analysis_profiles' table.")
            connection.execute(text('ALTER TABLE analysis_profiles ADD COLUMN temperature FLOAT'))

        if 'context_length' not in columns:
            logger.info("MIGRATION: Adding 'context_length' column to 'analysis_profiles' table.")
            connection.execute(text('ALTER TABLE analysis_profiles ADD COLUMN context_length INTEGER'))
            
        if 'preprocess_model' not in columns:
            logger.info("MIGRATION: Adding 'preprocess_model' column to 'analysis_profiles' table.")
            connection.execute(text('ALTER TABLE analysis_profiles ADD COLUMN preprocess_model VARCHAR'))
            
        if 'extract_model' not in columns:
            logger.info("MIGRATION: Adding 'extract_model' column to 'analysis_profiles' table.")
            connection.execute(text('ALTER TABLE analysis_profiles ADD COLUMN extract_model VARCHAR'))
            
        if 'synthesis_model' not in columns:
            logger.info("MIGRATION: Adding 'synthesis_model' column to 'analysis_profiles' table.")
            connection.execute(text('ALTER TABLE analysis_profiles ADD COLUMN synthesis_model VARCHAR'))

        connection.commit()
    logger.info("Finished init_db.")

def seed_default_data(conn):
    logger.info("Starting seed_default_data...")
    from .models import AnalysisProfile, Project
    from sqlalchemy.orm import Session
    import uuid
    from datetime import datetime

    session = Session(bind=conn)

    try:
        # Create a default analysis profile if it doesn't exist
        default_profile = session.query(AnalysisProfile).filter_by(name="Standard Profile").first()
        if not default_profile:
            default_profile = AnalysisProfile(
                id=str(uuid.uuid4()),
                name="Standard Profile",
                description="Default analysis profile",
                temperature=0.7,
                context_length=4096,
                preprocess_model="default",
                extract_model="default",
                synthesis_model="default"
            )
            session.add(default_profile)
            logger.info("Default AnalysisProfile created.")
        
        # Create a default project if it doesn't exist
        default_project = session.query(Project).filter_by(name="Default Project").first()
        if not default_project:
            default_project = Project(
                id=str(uuid.uuid4()),
                name="Default Project",
                description="A default project for testing and initial use.",
                created_at=datetime.now(),
                updated_at=datetime.now(),
                analysis_mode="screening",
                profile_used=default_profile.id
            )
            session.add(default_project)
            logger.info("Default Project created.")

        session.commit()
        logger.info("Default data seeded successfully.")
    except Exception as e:
        session.rollback()
        logger.exception(f"Error seeding default data: {e}")
        raise
    finally:
        session.close()
    logger.info("Finished seed_default_data.")