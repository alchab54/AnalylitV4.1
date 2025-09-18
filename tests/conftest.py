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
    """Crée un moteur SQLite en mémoire une seule fois."""
    return create_engine(TEST_DATABASE_URL)

@pytest.fixture(scope="session")
def tables(engine):
    """Crée toutes les tables une seule fois au début des tests."""
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)

@pytest.fixture(scope="function")
def session(engine, tables):
    """
    Fournit une session DB transactionnelle et 100% isolée pour CHAQUE test.
    Ceci est la solution finale aux problèmes d'isolation.
    """
    # TRUNCATE toutes les tables avant chaque test pour une isolation parfaite
    with engine.connect() as connection:
        transaction = connection.begin()
        for table in reversed(Base.metadata.sorted_tables):
            connection.execute(table.delete())
        transaction.commit()

    # Crée une nouvelle session pour le test
    db_session = sessionmaker(bind=engine)()
    yield db_session
    db_session.close()

@pytest.fixture(scope="function")
def client(session):
    """Fournit un client de test Flask pour chaque test."""
    with flask_app.test_client() as c:
        yield c
