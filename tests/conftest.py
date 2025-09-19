# tests/conftest.py
import pytest
import os
from server_v4_complete import create_app

@pytest.fixture(scope='session')
def app():
    """Crée une instance de l'application Flask pour les tests."""
    
    # CORRECTION : Utiliser la même base de données que le développement
    app = create_app({
        'TESTING': True,
        'WTF_CSRF_ENABLED': False
    })
    
    yield app

@pytest.fixture
def client(app):
    """Client de test Flask."""
    return app.test_client()

@pytest.fixture
def db_session():
    """Session de base de données pour chaque test."""
    from utils.database import db
    return db.session

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

@pytest.fixture  
def clean_db(db_session):
    """Assure une base de données vide."""
    yield db_session

@pytest.fixture
def mock_queue():
    """Mock pour la queue Redis."""
    from unittest.mock import MagicMock
    mock_q = MagicMock()
    mock_q.enqueue = MagicMock()
    return mock_q
