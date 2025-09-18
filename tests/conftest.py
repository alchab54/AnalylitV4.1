# tests/conftest.py

import pytest
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# FORCER le mode test AVANT tout autre import
os.environ['TESTING'] = 'true'

from server_v4_complete import create_app
from utils.db_base import Base
from utils import models

TEST_DATABASE_URL = "sqlite:///:memory:"

@pytest.fixture(scope='session')
def engine():
    return create_engine(TEST_DATABASE_URL)

@pytest.fixture(scope='session')  
def tables(engine):
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)

@pytest.fixture(scope='function')
def session(engine, tables):
    """Session 100% ISOLÉE avec TRUNCATE explicite de toutes les tables."""
    connection = engine.connect()
    db_session = sessionmaker(bind=connection)()
    
    yield db_session
    
    # NETTOYAGE BRUTAL : vider toutes les tables dans le bon ordre
    for table in reversed(Base.metadata.sorted_tables):
        db_session.execute(table.delete())
    db_session.commit()
    db_session.close()
    connection.close()

@pytest.fixture(scope='function')
def client(session):
    app = create_app()
    app.config.update({"TESTING": True})
    
    # Injection de session : remplacer le décorateur temporairement
    from utils.database import with_db_session
    original_decorator = with_db_session
    
    def test_decorator(func):
        def wrapper(*args, **kwargs):
            return func(session, *args, **kwargs)
        return wrapper
    
    import utils.database
    utils.database.with_db_session = test_decorator
    
    with app.test_client() as c:
        yield c
    
    # Restaurer le décorateur original
    utils.database.with_db_session = original_decorator
