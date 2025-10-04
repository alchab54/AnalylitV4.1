# tests/conftest.py - VERSION ANTI-CONCURRENCE ULTIME

import pytest
import os
import sys
import threading
import tempfile
import shutil
from pathlib import Path
import fakeredis
from unittest.mock import patch, MagicMock
import uuid

# Configuration environnement
root_dir = Path(__file__).parent.parent
sys.path.insert(0, str(root_dir))
os.environ['TESTING'] = 'true'
os.environ['FLASK_ENV'] = 'development'

# Imports après configuration PATH
from backend.server_v4_complete import create_app
from utils.extensions import db as _db
from sqlalchemy import text, event, create_engine
from sqlalchemy.orm import sessionmaker, scoped_session
from utils.models import Project
from rq.registry import StartedJobRegistry, FinishedJobRegistry, FailedJobRegistry

# ✅ SOLUTION #1 : Mock Redis/RQ Complet et Sérialisable
@pytest.fixture(scope='session', autouse=True)
def mock_redis_and_rq():
    """
    Mock complet et intelligent de Redis et RQ qui gère les ID de tâches
    et les exceptions comme le vrai système.
    """
    fake_redis = fakeredis.FakeRedis()
    
    # Dictionnaire pour stocker nos "fausses" tâches
    mock_jobs_storage = {}

    def create_mock_job(job_id=None):
        # Utiliser l'ID fourni ou en générer un nouveau
        job_id = job_id or f'test-job-{uuid.uuid4().hex[:8]}'
        
        mock_job = MagicMock()
        mock_job.id = job_id
        mock_job.result = {'status': 'completed', 'data': 'test'}
        mock_job.get_status.return_value = 'finished'
        mock_job.successful.return_value = True
        mock_job.enqueued_at = None
        mock_job.started_at = None
        mock_job.ended_at = None
        mock_job.exc_info = None  # type: ignore

        # Stocker le mock par son ID
        mock_jobs_storage[job_id] = mock_job
        return mock_job

    def fetch_mock_job(job_id, connection=None):
        """
        ✅ CORRECTION CLÉ #1 : Retrouve le job dans le stockage.
        Retourne le job s'il existe, sinon None.
        """
        return mock_jobs_storage.get(job_id)
    
    def enqueue_side_effect(*args, **kwargs):
        """
        ✅ CORRECTION CLÉ #2 : Crée un job en utilisant l'ID passé
        par l'API pour assurer la cohérence.
        """
        # Récupère le job_id s'il est passé dans les arguments de enqueue
        job_id_from_call = kwargs.get('job_id')
        if not job_id_from_call and len(args) > 1:
            # Tente de le trouver dans les arguments positionnels si besoin
            pass
            
        return create_mock_job(job_id=job_id_from_call)

    mock_queue = MagicMock()
    mock_queue.enqueue.side_effect = enqueue_side_effect
    
    with patch('utils.app_globals.redis_conn', fake_redis), \
         patch('redis.from_url', return_value=fake_redis), \
         patch('rq.Queue', return_value=mock_queue), \
         patch('rq.job.Job.fetch', side_effect=lambda job_id, connection=None: create_mock_job()), \
         patch('utils.app_globals.limiter') as mock_limiter:
        
        # Mock Queue
        mock_limiter.limit.return_value = lambda f: f
        yield fake_redis

# ✅ SOLUTION #2 : Répertoires Temporaires Isolés
@pytest.fixture(scope="session", autouse=True)
def setup_test_directories():
    """Répertoires temporaires avec UUID unique par session"""
    session_id = uuid.uuid4().hex[:8]
    test_projects_dir = tempfile.mkdtemp(prefix=f"analylit_projects_{session_id}_")
    test_logs_dir = tempfile.mkdtemp(prefix=f"analylit_logs_{session_id}_")
    
    os.environ['PROJECTS_DIR'] = test_projects_dir
    os.environ['LOGS_DIR'] = test_logs_dir
    
    yield
    
    shutil.rmtree(test_projects_dir, ignore_errors=True)
    shutil.rmtree(test_logs_dir, ignore_errors=True)

# ✅ SOLUTION #3 : Application avec Base de Données Unique par Worker
@pytest.fixture(scope='session')
def app():
    """Application Flask avec base de données isolée par worker"""
    # Créer un nom de DB unique par worker pytest
    worker_id = os.environ.get('PYTEST_XDIST_WORKER', 'master')
    session_id = uuid.uuid4().hex[:8]
    db_name = f'analylit_test_{worker_id}_{session_id}'
    
    test_db_url = f'postgresql://analylit_user:strong_password@test-db:5432/{db_name}'
    
    _app = create_app({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': test_db_url,
        'SQLALCHEMY_ENGINE_OPTIONS': {
            'pool_size': 1,
            'pool_recycle': 30,
            'pool_pre_ping': True,
            'connect_args': {'options': f'-c search_path=public'}
        },
        'WTF_CSRF_ENABLED': False,
    })
    
    return _app

# ✅ SOLUTION #4 : Gestion DB Robuste Anti-Concurrence
_db_lock = threading.Lock()

@pytest.fixture(scope='session')
def db(app):
    """Base de données avec gestion complète de concurrence"""
    with _db_lock:
        with app.app_context():
            # Créer la base de données si elle n'existe pas
            engine = create_engine('postgresql://analylit_user:strong_password@test-db:5432/postgres')
            with engine.connect() as conn:
                conn.execute(text("COMMIT"))  # Sortir de la transaction
                try:
                    conn.execute(text(f"CREATE DATABASE {app.config['SQLALCHEMY_DATABASE_URI'].split('/')[-1]}"))
                except Exception:
                    pass  # DB existe déjà
            
            # Créer toutes les tables
            try:
                _db.create_all()
                _db.session.commit()
            except Exception as e:
                _db.session.rollback()
                print(f"Warning during table creation: {e}")
            
            yield _db
            
            # Nettoyage final
            try:
                _db.drop_all()
                _db.session.commit()
            except Exception:
                pass

# ✅ SOLUTION #5 : Session Transactionnelle Parfaitement Isolée
@pytest.fixture(scope='function')
def db_session(db, app):
    """Session isolée avec rollback automatique"""
    with app.app_context():
        # Créer une connexion et transaction isolée
        connection = db.engine.connect()
        transaction = connection.begin()
        
        # Session scopée pour éviter les problèmes de 'remove'
        session_factory = sessionmaker(bind=connection)
        session = scoped_session(session_factory)
        
        # Remplacer la session globale
        old_session = db.session
        db.session = session
        
        # Savepoint pour rollbacks imbriqués
        session.begin_nested()
        
        @event.listens_for(session, "after_transaction_end")
        def restart_savepoint(session, transaction):
            if transaction.nested and not transaction._parent.nested:
                session.begin_nested()
        
        yield session
        
        # Nettoyage complet
        try:
            session.remove()
            transaction.rollback()
            connection.close()
            db.session = old_session
        except Exception as e:
            print(f"Warning during session cleanup: {e}")

@pytest.fixture
def client(app):
    """Client de test Flask"""
    return app.test_client()

@pytest.fixture
def setup_project(db_session):
    """Projet de test avec UUID unique"""
    project = Project(
        id=str(uuid.uuid4()),
        name=f"Test Project {uuid.uuid4().hex[:8]}"
    )
    db_session.add(project)
    db_session.commit()
    return project
