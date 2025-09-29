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
from utils.database import db, migrate
# ✅ CORRECTION: Imports nécessaires pour la création/suppression de DB
from sqlalchemy import create_engine, text
from sqlalchemy.exc import ProgrammingError

@pytest.fixture(scope='function')
def app():
    """
    Fixture de fonction pour créer une app et une base de données isolées pour chaque test.
    C'est une solution robuste qui garantit qu'aucun état n'est partagé entre les tests.
    """
    # ✅ Force une base de test séparée
    test_db_url = 'postgresql://analylit_user:strong_password@test-db:5432/analylit_test_db'
    os.environ['DATABASE_URL'] = test_db_url
    os.environ['TEST_DATABASE_URL'] = test_db_url
    
    _app = create_app()
    with _app.app_context():
        # Pour une base test vierge, on peut utiliser create_all
        db.drop_all()
        db.create_all()  # Safe sur base test isolée
        yield _app
        db.drop_all()  # Nettoyage après chaque test

@pytest.fixture
def client(app):
    """Client de test Flask pour les requêtes HTTP."""
    with app.test_client() as client:
        yield client

@pytest.fixture(scope="function")
def db_session(app, request):
    """
    ✅ THE DEFINITIVE FIX: Provides a transactional scope for tests.
    Starts a transaction before each test and rolls it back after.
    This is the fastest and most reliable way to isolate tests.
    """
    with app.app_context(): 
        connection = db.engine.connect()
        transaction = connection.begin()

        # Bind the session to the transaction; this is the key step.
        # The app's db.session will now use this transaction.
        db.session.configure(bind=connection)
        db.session.begin_nested()

        # This is a 'teardown' function that pytest will call after the test has run.
        @request.addfinalizer
        def teardown():
            # Rollback the overall transaction and close the connection
            transaction.rollback()
            connection.close()
            # Unbind the session
            db.session.remove()

        yield db.session

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
    # ✅ CORRECTION: Ne pas commiter ici. La fixture db_session gère la transaction.
    # Le commit peut causer des deadlocks en parallèle. On flush pour obtenir l'ID.
    db_session.flush()
    yield project

@pytest.fixture  
def clean_db(db_session):
    """Assure une base de données vide en supprimant toutes les données des tables clés."""
    from utils.models import Project, Extraction, SearchResult, Grid, ChatMessage, AnalysisProfile, RiskOfBias, Prompt
    db_session.query(RiskOfBias).delete()
    db_session.query(Extraction).delete()
    db_session.query(SearchResult).delete()
    db_session.query(Grid).delete()
    db_session.query(ChatMessage).delete()
    db_session.query(AnalysisProfile).delete()
    db_session.query(Project).delete()
    db_session.query(Prompt).delete()
    # ✅ CORRECTION: Remplacer commit() par flush() pour rester dans la transaction du test.
    # Le commit() est la cause des deadlocks en mode parallèle.
    db_session.flush()
    yield db_session

@pytest.fixture(scope="function")
def mock_queue():
    """Mock pour la queue Redis."""
    from unittest.mock import MagicMock
    mock_q = MagicMock()
    mock_q.enqueue = MagicMock()
    return mock_q
