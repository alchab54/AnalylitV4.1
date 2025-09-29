# tests/conftest.py
import pytest
import os
import sys
from pathlib import Path

# Ajouter le répertoire racine au PATH pour les imports
root_dir = Path(__file__).parent.parent
sys.path.insert(0, str(root_dir))

# --- ACTIVATION DES PLUGINS PYTEST ---
pytest_plugins = [
    "pytest_mock",
    "pytest_cov",
    "pytest_asyncio",
]

# Set TESTING environment variable for models.py
os.environ['TESTING'] = 'true'

# --- IMPORTS DE L'APPLICATION ---
from backend.server_v4_complete import create_app
from utils.database import db

@pytest.fixture(scope='session')
def app():
    """
    Fixture de session pour créer et configurer une instance de l'application Flask
    pour la durée de la session de test.
    """
    test_config = {
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": os.environ.get("TEST_DATABASE_URL", "sqlite:///:memory:"),
        "SQLALCHEMY_TRACK_MODIFICATIONS": False,
        "WTF_CSRF_ENABLED": False,
        "SERVER_NAME": "localhost"
    }
    _app = create_app(test_config)

    with _app.app_context():
        db.create_all()
        yield _app
        db.drop_all()

@pytest.fixture
def client(app):
    """Client de test Flask pour les requêtes HTTP."""
    with app.test_client() as client:
        yield client

@pytest.fixture
def db_session(app):
    """Fournit une session de base de données par test."""
    with app.app_context():
        yield db.session
        db.session.rollback()
        db.session.remove()

@pytest.fixture
def setup_project(db_session):
    """Crée un projet de test."""
    import uuid
    from datetime import datetime
    from utils.models import Project
    project = Project(
        id=str(uuid.uuid4()),
        name=f"Test Project {uuid.uuid4().hex[:8]}",
        description="Projet de test",
        analysis_mode="screening",
        created_at=datetime.utcnow()
    )
    db_session.add(project)
    db_session.commit()
    yield project

@pytest.fixture  
def clean_db(db_session):
    """Assure une base de données vide en supprimant toutes les données des tables clés."""
    from utils.models import Project, Extraction, SearchResult, Grid, ChatMessage, AnalysisProfile, RiskOfBias
    db_session.query(RiskOfBias).delete()
    db_session.query(Extraction).delete()
    db_session.query(SearchResult).delete()
    db_session.query(Grid).delete()
    db_session.query(ChatMessage).delete()
    db_session.query(AnalysisProfile).delete()
    db_session.query(Project).delete()
    db_session.commit()
    yield db_session

@pytest.fixture
def mock_queue():
    """Mock pour la queue Redis."""
    from unittest.mock import MagicMock
    mock_q = MagicMock()
    mock_q.enqueue = MagicMock()
    return mock_q
