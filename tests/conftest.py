# tests/conftest.py
import pytest
import os
from sqlalchemy import create_engine
from utils.database import init_database, get_session, engine
from utils.db_base import Base
from server_v4_complete import create_app

@pytest.fixture(scope='session')
def app():
    """Crée une instance de l'application Flask pour les tests."""
    
    # Configuration de l'URL de base de données de test
    test_db_url = os.getenv("TEST_DATABASE_URL", "postgresql://user:pass@db/analylit_db_test")
    
    # Initialiser la base de données avec l'URL de test
    init_database(test_db_url)

    # CORRECTION : Vérifier si create_app retourne un tuple
    result = create_app({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': test_db_url,
        'WTF_CSRF_ENABLED': False  # Désactiver CSRF pour les tests
    })
    
    # Si create_app retourne un tuple, extraire l'app
    if isinstance(result, tuple):
        app = result[0]  # Prendre le premier élément du tuple
    else:
        app = result  # create_app retourne directement l'app
    
    # Créer le contexte d'application
    ctx = app.app_context()
    ctx.push()
    
    yield app
    
    ctx.pop()

@pytest.fixture(scope='function')
def db_session(app):
    """Session de base de données pour chaque test."""
    # Créer toutes les tables
    db.create_all()
    
    yield db.session
    
    # Nettoyage après chaque test
    db.session.remove()
    db.drop_all()

@pytest.fixture
def client(app):
    """Client de test Flask."""
    return app.test_client()

@pytest.fixture
def setup_project(db_session):
    """Crée un projet de test."""
    from utils.models import Project
    import uuid
    from datetime import datetime
    
    project = Project(
        id=str(uuid.uuid4()),
        name="Test Project",
        description="Projet de test",
        analysis_mode="screening",
        created_at=datetime.utcnow()
    )
    
    db_session.add(project)
    db_session.commit()
    
    yield project.id
    
    # Le nettoyage est automatique avec db.drop_all()

@pytest.fixture
def clean_db(db_session):
    """Assure une base de données vide."""
    # Supprimer toutes les données
    for table in reversed(db.metadata.sorted_tables):
        db_session.execute(table.delete())
    db_session.commit()
    yield db_session

@pytest.fixture
def mock_queue():
    """Mock pour la queue Redis."""
    from unittest.mock import MagicMock
    mock_q = MagicMock()
    mock_q.enqueue = MagicMock()
    return mock_q
