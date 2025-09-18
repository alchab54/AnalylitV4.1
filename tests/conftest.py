# tests/conftest.py

import pytest
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# --- ÉTAPE 1 : Configuration de l'environnement de test ---
# S'assurer que les modèles n'utilisent pas de schéma en mode test
os.environ['TESTING'] = 'true'

# Importer l'application Flask et la Base de SQLAlchemy APRÈS avoir défini la variable d'env
from server_v4_complete import app as flask_app
from utils.database import Base

# --- ÉTAPE 2 : Fixture pour la base de données en mémoire ---
# Utiliser une base de données en mémoire pour des tests rapides et isolés
TEST_DATABASE_URL = "sqlite:///:memory:"

@pytest.fixture(scope="session")
def engine():
    """Crée un moteur de DB unique pour toute la session de tests."""
    return create_engine(TEST_DATABASE_URL)

@pytest.fixture(scope="session", autouse=True)
def setup_test_database(engine):
    """Crée toutes les tables au début des tests et les supprime à la fin."""
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)

# --- ÉTAPE 3 : Fixture pour la session de base de données ---
@pytest.fixture(scope="function")
def session(engine):
    """
    Crée une nouvelle session de DB pour CHAQUE test.
    Toute modification est annulée (rollback) à la fin du test pour garantir l'isolation.
    """
    connection = engine.connect()
    transaction = connection.begin()
    
    Session = sessionmaker(bind=connection)
    db_session = Session()
    
    yield db_session
    
    db_session.close()
    transaction.rollback()
    connection.close()

# --- ÉTAPE 4 : Fixture pour le client de test Flask ---
@pytest.fixture(scope='module')
def app():
    """Configure l'application Flask pour l'environnement de test."""
    flask_app.config.update({
        "TESTING": True,
        "DATABASE_URL": TEST_DATABASE_URL,  # Utiliser la base de données de test
    })
    yield flask_app

@pytest.fixture(scope='module')
def client(app):
    """Fournit un client de test pour faire des requêtes à l'API."""
    return app.test_client()
