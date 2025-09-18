# tests/conftest.py

import pytest
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

# FORCER le mode test AVANT tout autre import
os.environ['TESTING'] = 'true'

from server_v4_complete import app as flask_app
from utils.db_base import Base
from utils import models  # Force l'enregistrement des modèles

TEST_DATABASE_URL = "sqlite:///:memory:"

@pytest.fixture(scope="session")
def engine():
    """Crée un moteur SQLite en mémoire pour toute la session de test."""
    return create_engine(TEST_DATABASE_URL)

@pytest.fixture(scope="session")
def connection(engine):
    """Crée les tables une seule fois au début des tests."""
    Base.metadata.create_all(engine)
    connection = engine.connect()
    yield connection
    connection.close()
    Base.metadata.drop_all(engine)

@pytest.fixture(scope="function")
def session(connection):
    """
    Fournit une session de DB transactionnelle et isolée pour CHAQUE test.
    Ceci est la solution aux problèmes d'isolation.
    """
    transaction = connection.begin()
    db_session = Session(bind=connection)
    
    # Injection de la session dans le contexte de l'application Flask pour les tests
    flask_app.extensions['db_session_factory'] = lambda: db_session

    yield db_session
    
    db_session.close()
    transaction.rollback() # Annule toutes les modifications à la fin du test

@pytest.fixture(scope="module")
def client():
    """Fournit un client de test Flask pour un module de test."""
    with flask_app.test_client() as c:
        yield c
