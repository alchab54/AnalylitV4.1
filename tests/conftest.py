# tests/conftest.py

import pytest
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# FORCER le mode test AVANT tout autre import
os.environ['TESTING'] = 'true'

from server_v4_complete import app as flask_app
from utils.database import Base

# ↓↓↓ CET IMPORT EST LA CLÉ DE LA VICTOIRE ↓↓↓
# Il force Python à lire le fichier models.py et à enregistrer
# toutes les tables (Project, AnalysisProfile, etc.) auprès de la Base.
from utils import models # noqa

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
    # Maintenant que les modèles sont importés, create_all connaît toutes les tables.
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

@pytest.fixture(scope="module")
def client(app):
    """Fournit un client de test Flask."""
    return app.test_client()
