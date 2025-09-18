# tests/conftest.py

import pytest
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ['TESTING'] = 'true'

# Importer l'application Flask et la Base de SQLAlchemy APRÈS avoir défini la variable d'env
from server_v4_complete import app as flask_app
from utils.database import Base, init_database

TEST_DATABASE_URL = "sqlite:///:memory:"

@pytest.fixture(scope="session")
def app():
    """Configure l'application Flask pour les tests."""
    flask_app.config.update({
        "TESTING": True,
        "DATABASE_URL": TEST_DATABASE_URL,
    })
    # Initialiser la base de données une seule fois pour tous les tests
    with flask_app.app_context():
        init_database(TEST_DATABASE_URL)
    yield flask_app

@pytest.fixture(scope="session")
def engine(app):
    """Retourne le moteur de la base de données de test."""
    return create_engine(TEST_DATABASE_URL)

@pytest.fixture(scope="session", autouse=True)
def setup_test_database(engine):
    """Crée toutes les tables au début et les supprime à la fin."""
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)

@pytest.fixture(scope="function")
def session(engine):
    """Fournit une session de base de données isolée pour chaque test."""
    connection = engine.connect()
    transaction = connection.begin()
    Session = sessionmaker(bind=connection)
    db_session = Session()
    yield db_session
    db_session.close()
    transaction.rollback()
    connection.close()
    
# Alias pour la compatibilité avec les anciens tests
@pytest.fixture(scope="function")
def db_session(session):
    yield session

# Fixture demandée par de nombreux tests
@pytest.fixture(scope="function")
def clean_db(session):
    """Fixture qui garantit que la base de données est vide."""
    # Le rollback de la fixture `session` nettoie déjà tout,
    # donc cette fixture ne fait que passer la session.
    yield session

@pytest.fixture(scope='module')
def client(app):
    """Fournit un client de test Flask."""
    return app.test_client()
