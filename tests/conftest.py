# tests/conftest.py

import pytest
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

# FORCER le mode test AVANT tout autre import
os.environ['TESTING'] = 'true'

from server_v4_complete import create_app
from utils.db_base import Base
from utils import models # Force l'enregistrement des modèles

TEST_DATABASE_URL = "sqlite:///:memory:"

@pytest.fixture(scope='session')
def app():
    """Crée une instance de l'application Flask une seule fois pour toute la session."""
    app = create_app()
    app.config.update({
        "TESTING": True,
    })
    yield app

@pytest.fixture(scope='session')
def engine():
    """Crée un moteur SQLite en mémoire une seule fois."""
    return create_engine(TEST_DATABASE_URL)

@pytest.fixture(scope='session')
def tables(engine):
    """Crée toutes les tables une seule fois au début des tests."""
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)

@pytest.fixture(scope='function')
def session(engine, tables):
    """
    Fournit une session DB transactionnelle et 100% ISOLÉE pour CHAQUE test.
    C'est la solution la plus robuste.
    """
    connection = engine.connect()
    transaction = connection.begin()
    db_session = Session(bind=connection)
    
    yield db_session
    
    # Nettoyage explicite de toutes les tables après chaque test
    for table in reversed(Base.metadata.sorted_tables):
        db_session.execute(table.delete())
    
    db_session.commit() # Valide le nettoyage
    db_session.close()
    transaction.close()
    connection.close()

@pytest.fixture
def client(app, session):
    """
    Fournit un client de test Flask 100% isolé pour CHAQUE test,
    avec injection de la session de base de données.
    """
    @app.before_request
    def provide_session():
        from flask import g
        g.db_session = session

    return app.test_client()

