# tests/conftest.py - VERSION CORRIGÉE
import pytest
import os
from sqlalchemy import create_engine

# CORRECTION: Import depuis le fichier principal au lieu de utils inexistant
from server_v4_complete import app, db, Project

@pytest.fixture(scope='session')
def app_config():
    """Fournit une configuration de test propre."""
    test_db_url = os.environ.get('DATABASE_URL', 'sqlite:///:memory:')
    return {
        'TESTING': True,
        'WTF_CSRF_ENABLED': False,
        'DATABASE_URL': test_db_url,
        'SERVER_NAME': 'localhost'
    }

@pytest.fixture(scope='session')
def test_app(app_config):
    """Crée une instance de l'application Flask pour les tests."""
    app.config.update(app_config)
    
    with app.app_context():
        # CORRECTION: Utilise db au lieu de Base
        db.create_all()
        yield app
        db.drop_all()

@pytest.fixture
def client(test_app):
    """Client de test Flask pour les requêtes HTTP."""
    with test_app.test_client() as client:
        yield client

@pytest.fixture
def db_session(test_app):
    """Fournit une session de base de données par test."""
    with test_app.app_context():
        yield db.session
        db.session.rollback()

@pytest.fixture
def setup_project(test_app, db_session):
    """Crée un projet de test."""
    import uuid
    from datetime import datetime
    
    with test_app.app_context():
        project = Project(
            id=str(uuid.uuid4()),
            name=f"Test Project {uuid.uuid4().hex[:8]}",
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
