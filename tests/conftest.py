# tests/conftest.py
import pytest
from server_v4_complete import create_app
from utils.database import init_database, get_session

@pytest.fixture(scope='session')
def app():
    """Crée une instance de l'application Flask pour les tests."""
    app = create_app({
        'TESTING': True,
        'WTF_CSRF_ENABLED': False
    })
    
    # CRUCIAL : Initialiser la base de données dans le contexte de l'app
    with app.app_context():
        init_database()
    
    yield app

@pytest.fixture
def client(app):
    """Client de test Flask."""
    return app.test_client()

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
    from utils.models import Project
    import uuid
    from datetime import datetime
    
    with app.app_context():
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

@pytest.fixture(autouse=True)
def clean_between_tests(db_session):
    """Nettoie la base entre chaque test."""
    yield
    # Nettoyage après chaque test
    try:
        db_session.rollback()
    except:
        pass
