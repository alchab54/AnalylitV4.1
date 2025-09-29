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

@pytest.fixture(scope='session', autouse=True)
def mock_all_queues_and_fetch(monkeypatch):
    """
    Fixture auto-utilisée pour mocker toutes les files RQ et Job.fetch pour toute la session de test.
    """
    # 1. Mocker les files d'attente
    mock_job_obj = MagicMock(spec=Job)
    mock_job_obj.id = "mocked_task_id_123"
    mock_job_obj.get_id.return_value = "mocked_task_id_123"
    
    mock_q = MagicMock()
    mock_q.enqueue.return_value = mock_job_obj

    monkeypatch.setattr("backend.server_v4_complete.processing_queue", mock_q)
    monkeypatch.setattr("backend.server_v4_complete.synthesis_queue", mock_q)
    monkeypatch.setattr("backend.server_v4_complete.analysis_queue", mock_q)
    monkeypatch.setattr("backend.server_v4_complete.background_queue", mock_q)
    monkeypatch.setattr("backend.server_v4_complete.extension_queue", mock_q)
    monkeypatch.setattr("backend.server_v4_complete.models_queue", mock_q)

    # 2. Mocker Job.fetch
    mock_job_obj.get_status.return_value = 'queued'
    mock_job_obj.return_value.return_value = {"status": "complete"}
    mock_job_obj.enqueued_at = datetime.utcnow()
    mock_job_obj.started_at = datetime.utcnow()
    mock_job_obj.ended_at = None
    mock_job_obj.is_failed = False

    def mock_fetch(job_id, connection=None):
        if job_id == "mocked_task_id_123":
            return mock_job_obj
        raise NoSuchJobError(f"Tâche non trouvée: {job_id}")

    monkeypatch.setattr(Job, 'fetch', mock_fetch)

@pytest.fixture
def mock_queue():
    """Mock pour la queue Redis."""
    from unittest.mock import MagicMock
    mock_q = MagicMock()
    mock_q.enqueue = MagicMock()
    return mock_q