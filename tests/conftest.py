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
    # Les plugins comme 'pytest-mock', 'pytest-xdist', 'pytest-cov', et 'pytest-asyncio'
    # sont automatiquement découverts par pytest lorsqu'ils sont installés.
    # sont automatiquement découverts par pytest lorsqu'ils sont installés.
    # Les déclarer ici peut parfois causer des conflits d'import.
]

# Set TESTING environment variable for models.py
os.environ['TESTING'] = 'true'

# --- IMPORTS DE L'APPLICATION ---
from backend.server_v4_complete import create_app
from utils.database import db, migrate
from utils.models import Project, AnalysisProfile
# ✅ CORRECTION: Imports nécessaires pour la création/suppression de DB
from sqlalchemy import create_engine, text
from sqlalchemy.exc import ProgrammingError

@pytest.fixture(scope='session')
def app():
    """
    Fixture de session : Crée l'application et la base de données UNE SEULE FOIS
    pour toute la session de test. C'est beaucoup plus rapide.
    """
    # ✅ CORRECTION : Le nom d'hôte doit correspondre au `container_name` défini dans docker-compose.yml.
    test_db_url = os.getenv('TEST_DATABASE_URL', 'postgresql://analylit_user:strong_password@analylit_test_db:5432/analylit_test_db')
    
    # ✅ CORRECTION : Forcer une configuration de test isolée.
    _app = create_app({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': test_db_url,
        'SQLALCHEMY_ENGINE_OPTIONS': {
            'pool_size': 5,
            'pool_recycle': 120,
            'pool_pre_ping': True,
            "connect_args": {
                "options": f"-csearch_path={AnalysisProfile.__table_args__['schema']}"
            }
        }
    })
    with _app.app_context():
        # Initialiser migrate AVANT les opérations
        migrate.init_app(_app, db)

        # Nettoyer complètement avant de commencer
        try:
            db.session.execute(text(f"DROP SCHEMA IF EXISTS {AnalysisProfile.__table_args__['schema']} CASCADE;"))
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            print(f"Avertissement lors du nettoyage du schéma : {e}")

        # Créer le schéma et appliquer les migrations
        db.session.execute(text(f"CREATE SCHEMA IF NOT EXISTS {AnalysisProfile.__table_args__['schema']};"))
        db.session.commit()

        # Appliquer les migrations Alembic
        from flask_migrate import upgrade
        upgrade() # Applique toutes les migrations Alembic

        yield _app

# ✅ SOLUTION: Remplacer la fixture 'clean_db' par une fixture 'autouse'
# qui s'assure que chaque test utilise une session transactionnelle.
# Cela rend la fixture 'clean_db' obsolète et supprime la cause des deadlocks.
@pytest.fixture
def client(app):
    """Client de test Flask pour les requêtes HTTP."""
    with app.test_client() as client:
        yield client

@pytest.fixture(scope="function")
def db_session(app):
    """
    Fixture de fonction : Isole chaque test dans une transaction.
    C'est la méthode la plus rapide et la plus fiable pour l'isolation des tests.
    Chaque test voit une base de données "propre", et ses modifications sont annulées
    à la fin, sans affecter les autres tests.
    """
    with app.app_context(): 
        connection = db.engine.connect()
        transaction = connection.begin()
        
        # Lier la session de l'application à cette connexion transactionnelle
        session = db.Session(bind=connection)
        db.session = session # Remplacer la session globale par notre session de test

        yield session
        
        session.close()
        transaction.rollback()
        connection.close()

@pytest.fixture(scope="function")
def setup_project(db_session):
    """
    Fixture pour créer un projet de test unique pour chaque fonction.
    Cette fixture était manquante et causait des erreurs.
    """
    import uuid
    project = Project(
        id=str(uuid.uuid4()),
        name=f"Test Project {uuid.uuid4().hex[:6]}"
    )
    db_session.add(project)
    db_session.flush()
    return project

# ❌ SUPPRESSION: Cette fixture est la principale cause des deadlocks en mode parallèle.
# Chaque test tentait de supprimer des données en même temps, créant des verrous.
# L'isolation par transaction de `db_session` la rend inutile.
@pytest.fixture
def clean_db(db_session):
    """Fixture dépréciée et maintenant vide. L'isolation est gérée par db_session."""
    yield db_session

@pytest.fixture(scope="function")
def mock_queue():
    """Mock pour la queue Redis."""
    from unittest.mock import MagicMock
    mock_q = MagicMock()
    mock_q.enqueue = MagicMock()
    return mock_q
