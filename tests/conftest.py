# tests/conftest.py
import pytest
import os
from sqlalchemy import create_engine
from utils.database import get_session # Assurez-vous que cette fonction existe

@pytest.fixture(scope='session')
def app_config():
    """Fournit une configuration de test propre."""
    # S'assure que l'URL de la base de données de test est utilisée
    # La valeur par défaut 'sqlite:///:memory:' est une sécurité si on lance les tests hors de Docker
    test_db_url = os.environ.get('DATABASE_URL', 'sqlite:///:memory:')
    return {
        'TESTING': True,
        'WTF_CSRF_ENABLED': False,
        'DATABASE_URL': test_db_url,
        'SERVER_NAME': 'localhost' # Essentiel pour url_for dans les tests
    }

@pytest.fixture(scope='session')
def app(app_config):
    """Crée une instance de l'application Flask pour la session de test."""
    from server_v4_complete import create_app # Importation locale
    app = create_app(app_config)
    
    with app.app_context():
        from utils.models import Base # Assurez-vous d'importer votre Base déclarative
        engine = create_engine(app_config['DATABASE_URL'])
        Base.metadata.drop_all(engine) # Nettoie avant les tests
        Base.metadata.create_all(engine) # Crée toutes les tables
    
    yield app

    # Nettoyage après tous les tests
    with app.app_context():
        engine = create_engine(app_config['DATABASE_URL'])
        Base.metadata.drop_all(engine)

@pytest.fixture
def client(app):
    """Client de test Flask pour les requêtes HTTP."""
    with app.test_client() as client:
        yield client

@pytest.fixture
def db_session(app):
    """Fournit une session de base de données par test."""
    with app.app_context():
        session = get_session()
        yield session
        # On annule les transactions pour isoler chaque test.
        # C'est plus rapide que de tout supprimer/recréer.
        session.rollback()
        session.close()

@pytest.fixture
def setup_project(app, db_session):
    """Crée un projet de test."""
    import uuid
    from utils.models import Project # L'import est fait ici pour être dans le contexte de l'app
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
