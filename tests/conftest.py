# tests/conftest.py

import pytest
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# FORCER le mode test AVANT tout autre import
os.environ['TESTING'] = 'true'

from server_v4_complete import app as flask_app
from utils.database import Base # Importer la Base déclarative

# URL pour la base de données de test en mémoire
TEST_DATABASE_URL = "sqlite:///:memory:"

@pytest.fixture(scope="session")
def app():
    """Configure l'application Flask pour les tests."""
    flask_app.config.update({"TESTING": True})
    yield flask_app

@pytest.fixture(scope="session")
def engine():
    """Crée un moteur de DB SQLite en mémoire pour toute la session de test."""
    return create_engine(TEST_DATABASE_URL)

@pytest.fixture(scope="session", autouse=True)
def setup_test_database(engine):
    """Crée toutes les tables une seule fois au début des tests."""
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)

@pytest.fixture(scope="function")
def session(engine):
    """Fournit une session de DB isolée pour chaque test."""
    connection = engine.connect()
    transaction = connection.begin()
    Session = sessionmaker(bind=connection)
    db_session = Session()
    yield db_session
    db_session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture(scope="function")
def client(app, session):
    """Fournit un client de test Flask et mock la session DB."""
    def get_test_session():
        return session
    # Remplace la fonction get_session de l'app par notre session de test
    flask_app.extensions['db_session'] = get_test_session 
    return app.test_client()
