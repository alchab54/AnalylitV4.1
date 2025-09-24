# tests/conftest.py - VERSION CORRIGÉE
import pytest
import os
from sqlalchemy import create_engine
import uuid # Added import for uuid

# Set TESTING environment variable for models.py
os.environ['TESTING'] = 'true'

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

@pytest.fixture(scope='function')
def test_app(app_config):
    """Crée une instance de l'application Flask pour les tests."""
    app.config.update(app_config)
    
    # Generate a unique database name for each test function
    unique_db_name = f"analylit_test_db_{uuid.uuid4().hex}"
    test_db_url = os.getenv("DATABASE_URL", "postgresql://user:pass@db/analylit_db_test").replace("analylit_db_test", unique_db_name)
    app.config['SQLALCHEMY_DATABASE_URI'] = test_db_url

    # Initialize the database for testing
    from utils.database import init_database
    init_database(is_test=True, database_url=test_db_url) # Pass the unique URL

    with app.app_context():
        # Explicitly delete default data that might cause IntegrityError
        from utils.models import AnalysisProfile, Prompt
        db.session.query(AnalysisProfile).filter_by(name='Standard Profile').delete()
        db.session.query(AnalysisProfile).filter_by(name='Profil KG').delete() # For knowledge graph test
        db.session.query(Prompt).filter_by(name='test_prompt_to_update').delete()
        db.session.commit() # Commit deletions before creating all tables

        db.create_all()
        yield app
        # Removed db.drop_all() from here. clean_db will handle it.
        db.session.remove() # Ensure session is removed after each test


@pytest.fixture
def client(test_app):
    """Client de test Flask pour les requêtes HTTP."""
    # The test_app fixture already pushes an app context, so we don't need to push another one here.
    with test_app.test_client() as client:
        yield client

@pytest.fixture
def db_session(test_app):
    """Fournit une session de base de données par test."""
    # The test_app fixture already pushes an app context, so we don't need to push another one here.
    yield db.session
    db.session.rollback()
    db.session.remove() # Ensure session is removed after each test

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
def clean_db(db_session, test_app):
    """Assure une base de données vide en supprimant toutes les données des tables clés."""
    with test_app.app_context(): # Ensure we are in the correct app context
        print("\n--- Cleaning database (deleting data) ---")
        from utils.models import Project, Extraction, SearchResult, Grid, ChatMessage # Import models here
        db_session.query(Extraction).delete()
        db_session.query(SearchResult).delete()
        db_session.query(Grid).delete()
        db_session.query(ChatMessage).delete()
        db_session.query(Project).delete()
        db_session.commit()
        print("--- Database cleaned (deleting data) ---")
        yield db_session
        # The test_app fixture's teardown will handle dropping the unique database.



@pytest.fixture
def mock_queue():
    """Mock pour la queue Redis."""
    from unittest.mock import MagicMock
    mock_q = MagicMock()
    mock_q.enqueue = MagicMock()
    return mock_q
