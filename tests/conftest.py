# tests/conftest.py - VERSION COMPLÈTE CORRIGÉE
import pytest
import os
import sys
import threading
import tempfile
import shutil
from pathlib import Path
import fakeredis
from unittest.mock import patch, MagicMock

# Configuration environnement
root_dir = Path(__file__).parent.parent
sys.path.insert(0, str(root_dir))
os.environ['TESTING'] = 'true'
os.environ['FLASK_ENV'] = 'development'

# ✅ CORRECTION COMPLÈTE : Mock Redis ET RQ global
@pytest.fixture(scope='session', autouse=True)
def mock_redis_and_rq():
    """Mock complet Redis + RQ pour tous les tests"""
    fake_redis = fakeredis.FakeRedis()
    
    # Mock Job class
    mock_job = MagicMock()
    mock_job.id = 'test-job-id'
    mock_job.get_status.return_value = 'finished'
    mock_job.result = 'test-result'
    mock_job.successful.return_value = True
    
    # Mock Queue class
    mock_queue = MagicMock()
    mock_queue.enqueue.return_value = mock_job
    mock_queue.count = 0
    mock_queue.__len__ = lambda: 0
    
    with patch('utils.app_globals.redis_conn', fake_redis), \
         patch('redis.from_url', return_value=fake_redis), \
         patch('rq.Queue', return_value=mock_queue), \
         patch('rq.job.Job', return_value=mock_job), \
         patch('rq.job.Job.fetch', return_value=mock_job):
        yield fake_redis

# ✅ CORRECTION : Setup répertoires temporaires
@pytest.fixture(scope="session", autouse=True)
def setup_test_directories():
    """Créer répertoires temporaires pour tests"""
    test_projects_dir = tempfile.mkdtemp(prefix="analylit_test_projects_")
    test_logs_dir = tempfile.mkdtemp(prefix="analylit_test_logs_")
    
    os.environ['PROJECTS_DIR'] = test_projects_dir  
    os.environ['LOGS_DIR'] = test_logs_dir
    
    # Mock PROJECTS_DIR dans app_globals
    with patch('utils.app_globals.PROJECTS_DIR', test_projects_dir):
        yield
    
    # Nettoyage
    shutil.rmtree(test_projects_dir, ignore_errors=True)
    shutil.rmtree(test_logs_dir, ignore_errors=True)

# Import modèles
from utils.models import (
    Project, Article, SearchResult, Extraction, Grid, GridField, 
    Validation, Analysis, ChatMessage, AnalysisProfile, PRISMARecord, 
    ScreeningDecision, RiskOfBias, Prompt, GreyLiterature, 
    ProcessingLog, Stakeholder
)

_db_lock = threading.Lock()

# ✅ CORRECTION : Mock Flask-Limiter
@pytest.fixture(autouse=True)
def mock_rate_limiter():
    """Mock Flask-Limiter pour tests"""
    with patch('utils.app_globals.limiter') as mock_limiter:
        mock_limiter.limit.return_value = lambda f: f  # Decorator qui ne fait rien
        yield mock_limiter

@pytest.fixture(scope='session')
def app():
    """Application Flask pour tests"""
    with _db_lock:
        from backend.server_v4_complete import create_app
        from utils.extensions import db
        from sqlalchemy import text
        
        test_db_url = 'postgresql://analylit_user:strong_password@test-db:5432/analylit_test_db'
        
        _app = create_app({
            'TESTING': True,
            'SQLALCHEMY_DATABASE_URI': test_db_url,
            'SQLALCHEMY_ENGINE_OPTIONS': {
                'pool_size': 1,
                'pool_recycle': 30,
                'pool_pre_ping': True,
                "connect_args": {
                    "options": "-c search_path=analylit_schema,public"
                }
            }
        })
        
        with _app.app_context():
            try:
                result = db.session.execute(text("SELECT 1")).scalar()
                print("✅ Connexion test DB: OK")
            except Exception as e:
                pytest.fail(f"Cannot connect to test database: {e}")
            
            # Setup DB
            try:
                db.session.execute(text("DROP SCHEMA IF EXISTS analylit_schema CASCADE"))
                db.session.commit()
                
                db.session.execute(text("CREATE SCHEMA analylit_schema"))
                db.session.commit()
                
                db.create_all()
                db.session.commit()
                
                count = db.session.execute(text("""
                    SELECT COUNT(*) FROM information_schema.tables 
                    WHERE table_schema = 'analylit_schema'
                """)).scalar()
                print(f"✅ {count} tables créées dans analylit_schema")
                
            except Exception as e:
                db.session.rollback()
                pytest.fail(f"Cannot create test tables: {e}")
            
            yield _app
            
            # Cleanup
            try:
                db.session.execute(text("DROP SCHEMA IF EXISTS analylit_schema CASCADE"))
                db.session.commit()
            except Exception as e:
                print(f"⚠️ Cleanup warning: {e}")

@pytest.fixture
def client(app):
    """Client de test Flask"""
    return app.test_client()

@pytest.fixture(scope="function")  
def db_session(app):
    """Session DB isolée pour tests"""
    from utils.extensions import db
    from sqlalchemy.orm import sessionmaker
    
    with app.app_context():
        connection = db.engine.connect()
        transaction = connection.begin()
        
        Session = sessionmaker(bind=connection)
        test_session = Session()
        
        original_session = db.session
        db.session = test_session

        yield test_session
        
        try:
            test_session.close()
            transaction.rollback()
        except Exception as e:
            print(f"Warning during session cleanup: {e}")
        finally:
            connection.close()
            db.session = original_session

@pytest.fixture(scope="function")
def setup_project(db_session):
    """Créer projet de test"""
    from utils.models import Project
    import uuid
    
    project = Project(
        id=str(uuid.uuid4()),
        name=f"Test Project {uuid.uuid4().hex[:8]}"
    )
    db_session.add(project)
    db_session.flush()
    return project
