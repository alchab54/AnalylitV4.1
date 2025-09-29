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

@pytest.fixture(scope='session')
def app():
    """
    Fixture de session : Crée l'application et la base de données UNE SEULE FOIS
    pour toute la session de test. C'est beaucoup plus rapide.
    """
    # ✅ CORRECTION : Le nom d'hôte doit correspondre au `container_name` défini dans docker-compose.yml.
    # L'ancien nom 'test-db' n'est plus résolu par le DNS de Docker.
    test_db_url = 'postgresql://analylit_user:strong_password@analylit_test_db:5432/analylit_test_db'
    
    # ✅ CORRECTION : Forcer une configuration de test isolée.
    _app = create_app({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': test_db_url
    })
    with _app.app_context():
        # ✅ CORRECTION FINALE: Appliquer les migrations sur la base de données de TEST.
        # C'est l'étape cruciale qui manquait. Cela garantit que la base de données
        # de test a le bon schéma (`analylit_schema`) et toutes les tables avant
        # que les tests ne commencent.
        migrate.init_app(_app, db)
        db.drop_all() # Assure un état propre avant les migrations
        migrate.upgrade() # Applique toutes les migrations Alembic

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

        # ✅ CORRECTION: Forcer le chemin de recherche au bon schéma pour cette transaction.
        # Cela résout les erreurs "relation does not exist" dans les tests de tâches.
        connection.execute(text("SET search_path TO analylit_schema"))
        
        # Lier la session de l'application à cette transaction
        session = db.create_scoped_session(options={'bind': connection, 'binds': {}})
        db.session = session
        
        try:
            yield session
        finally:
            # Après chaque test :
            session.remove()
            transaction.rollback()
            connection.close()

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
