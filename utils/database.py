# database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session
from config_v4 import get_config

config = get_config()

engine = create_engine(config.DATABASE_URL, pool_pre_ping=True)
SessionFactory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
db_session = scoped_session(SessionFactory)

def init_db():
    # Import all models here to ensure they are registered with SQLAlchemy
    from . import models
    # This will create all tables
    models.Base.metadata.create_all(bind=engine)

def seed_default_data(conn):
    # This function can remain in server_v4_complete.py or be moved here
    pass