# conftest.py
import pytest
import os
import uuid
from datetime import datetime

# --- Imports corrigés ---
from utils.database import Base, get_session as get_db_session # Importer Base pour la création des tables
from server_v4_complete import create_app

@pytest.fixture(scope="session")
def app():
    """Crée une instance de l'application Flask pour la session de test."""
    # Configurer l'application pour utiliser la base de données de test PostgreSQL
    test_db_url = os.getenv("TEST_DATABASE_URL", "postgresql://analylit_user:strong_password@db/analylit_db_test")
    
    # Forcer le mode test et l'URL de la DB
    os.environ['TESTING'] = 'true'
    os.environ['DATABASE_URL'] = test_db_url
    
    app = create_app()
    
    # Crée un contexte d'application pour que les sessions fonctionnent
    with app.app_context():
        yield app

@pytest.fixture(scope="function")
def client(app):
    """Fournit un client de test Flask pour chaque test."""
    with app.test_client() as c:
        yield c

@pytest.fixture(scope="function")
def db_session(app, request):
    """
    Fixture qui assure une base de données propre pour chaque test en utilisant la connexion de l'app.
    """
    from utils.database import engine
    
    # Crée les tables au début de chaque test
    Base.metadata.create_all(bind=engine)
    
    session = get_db_session()
    
    yield session
    
    # Nettoyage après chaque test
    session.close()
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def clean_db(db_session):
    """Assure une base de données vide pour les tests qui en ont besoin."""
    # Supprime toutes les données des tables dans l'ordre inverse des dépendances
    for table in reversed(Base.metadata.sorted_tables):
        db_session.execute(table.delete())
    db_session.commit()
    yield db_session

@pytest.fixture
def setup_project(db_session): # Renommé de 'test_project' pour correspondre à l'usage
    """Crée un projet de test avec toutes les dépendances nécessaires."""
    from utils.models import Project
    
    project = Project(
        id=str(uuid.uuid4()),
        name="Test Project",
        description="Projet de test",
        analysis_mode="screening",
        created_at=datetime.utcnow()
    )
    
    db_session.add(project)
    db_session.commit()
    
    yield project # Retourne l'objet projet complet, pas seulement l'ID
    
    # Le nettoyage est automatique grâce au rollback transactionnel

@pytest.fixture
def mock_queue():
    """Mock de la queue pour les tests."""
    from unittest.mock import MagicMock
    mock_q = MagicMock()
    mock_q.enqueue = MagicMock()
    return mock_q