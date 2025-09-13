# database.py
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, scoped_session
from config_v4 import get_config

config = get_config()

engine = create_engine(config.DATABASE_URL, pool_pre_ping=True)
SessionFactory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
db_session = scoped_session(SessionFactory)

def init_db():
    from . import models
    models.Base.metadata.create_all(bind=engine)

    # Manual migration to add missing columns to analysis_profiles
    inspector = inspect(engine)
    columns = {col['name'] for col in inspector.get_columns('analysis_profiles')}
    
    with engine.connect() as connection:
        if 'description' not in columns:
            print("MIGRATION: Adding 'description' column to 'analysis_profiles' table.")
            connection.execute(text('ALTER TABLE analysis_profiles ADD COLUMN description TEXT'))
        
        if 'temperature' not in columns:
            print("MIGRATION: Adding 'temperature' column to 'analysis_profiles' table.")
            connection.execute(text('ALTER TABLE analysis_profiles ADD COLUMN temperature FLOAT'))

        if 'context_length' not in columns:
            print("MIGRATION: Adding 'context_length' column to 'analysis_profiles' table.")
            connection.execute(text('ALTER TABLE analysis_profiles ADD COLUMN context_length INTEGER'))
            
        if 'preprocess_model' not in columns:
            print("MIGRATION: Adding 'preprocess_model' column to 'analysis_profiles' table.")
            connection.execute(text('ALTER TABLE analysis_profiles ADD COLUMN preprocess_model VARCHAR'))
            
        if 'extract_model' not in columns:
            print("MIGRATION: Adding 'extract_model' column to 'analysis_profiles' table.")
            connection.execute(text('ALTER TABLE analysis_profiles ADD COLUMN extract_model VARCHAR'))
            
        if 'synthesis_model' not in columns:
            print("MIGRATION: Adding 'synthesis_model' column to 'analysis_profiles' table.")
            connection.execute(text('ALTER TABLE analysis_profiles ADD COLUMN synthesis_model VARCHAR'))

        connection.commit()

def seed_default_data(conn):
    # This function can remain in server_v4_complete.py or be moved here
    pass