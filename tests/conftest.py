# conftest.py
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, scoped_session
import uuid
from datetime import datetime

# --- Imports corrigés ---
from utils.database import init_database, Base # Importer Base pour la création des tables
from server_v4_complete import create_app

# Créer une instance de moteur unique pour la session de test
engine = create_engine("sqlite:///:memory:")

@pytest.fixture(scope="session")
def app():
    """Crée l'application Flask pour les tests."""
    app = create_app() # Le mode 'testing' est déjà géré dans create_app
    app.config['TESTING'] = True
    with app.app_context():
        yield app

@pytest.fixture(scope="function")
def client(app):
    """
    Provides a Flask test client for each test.
    """
    with app.test_client() as c:
        yield c

@pytest.fixture(scope="function", autouse=True)
def db_session(app):
    """
    Fixture transactionnelle qui assure l'isolation entre les tests.
    Utilise des transactions imbriquées avec rollback automatique.
    """
    # S'assurer que les tables sont créées une seule fois par session de test
    Base.metadata.create_all(bind=engine)

    # Création d'une connexion dédiée aux tests
    connection = engine.connect()
    transaction = connection.begin()
    
    # Configuration d'une session avec transaction imbriquée
    session = scoped_session(
        sessionmaker(bind=connection, expire_on_commit=False)
    )
        
    # Démarre une transaction imbriquée (savepoint)
    session.begin_nested()
    
    # Configure l'écoute pour redémarrer automatiquement les savepoints
    @event.listens_for(session, "after_transaction_end")
    def restart_savepoint(current_session, previous_transaction):
        if previous_transaction.nested and not previous_transaction._parent.nested:
            current_session.begin_nested()
    
    yield session
    
    # Nettoyage : supprime l'écouteur et effectue le rollback
    event.remove(session, "after_transaction_end", restart_savepoint)
    session.close()
    transaction.rollback()
    connection.close()
    # Supprime toutes les données après chaque test pour une isolation complète
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
    
    yield project.id
    
    # Le nettoyage est automatique grâce au rollback transactionnel

@pytest.fixture
def mock_queue():
    """Mock de la queue pour les tests."""
    from unittest.mock import MagicMock
    mock_q = MagicMock()
    mock_q.enqueue = MagicMock()
    return mock_q