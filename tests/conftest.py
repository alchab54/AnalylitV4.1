# tests/conftest.py
import pytest
# from server_v4_complete import create_app # Remove this line
from utils.database import init_database, get_session
import sys
import importlib

@pytest.fixture(scope='session')
def app():
    """Crée une instance de l'application Flask pour les tests."""
    # Force a fresh import of the module
    if 'server_v4_complete' in sys.modules:
        del sys.modules['server_v4_complete']
    from server_v4_complete import create_app # Import after removal

    app = create_app({
        'TESTING': True,
        'WTF_CSRF_ENABLED': False
    })
    
    with app.app_context():
        init_database()
    
    yield app

@pytest.fixture
def client(app):
    """Client de test Flask."""
    return app.test_client()

@pytest.fixture(autouse=True)
def clean_db_before_test(app):
    """Nettoyage de la base de données avant chaque test."""
    with app.app_context():
        try:
            from utils.models import Project, AnalysisProfile, SearchResult, Extraction, Grid, ChatMessage, RiskOfBias, Prompt
            session = get_session()
            
            session.query(ChatMessage).delete()
            session.query(RiskOfBias).delete()
            session.query(Extraction).delete()
            session.query(SearchResult).delete()
            session.query(Grid).delete()
            session.query(Project).delete()
            session.query(AnalysisProfile).delete()
            session.query(Prompt).delete()
            session.commit()
            session.close()
        except Exception:
            pass

@pytest.fixture
def db_session(app):
    """Session de base de données pour chaque test."""
    with app.app_context():
        session = get_session()
        yield session
        session.close()

@pytest.fixture
def setup_project(app, db_session):
    """Crée un projet de test."""
    import uuid
    from utils.models import Project
    from datetime import datetime
    
    with app.app_context():
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
