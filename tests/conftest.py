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
# ✅ CORRECTION: Imports nécessaires pour la création/suppression de DB
from sqlalchemy import create_engine, text
from sqlalchemy.exc import ProgrammingError

@pytest.fixture(scope='session')
def app(request):
    """
    Fixture de session pour créer et configurer une instance de l'application Flask
    pour la durée de la session de test.
    ✅ CORRECTION: Gère la création de bases de données uniques pour les tests parallèles (pytest-xdist).
    ✅ CORRECTION DÉFINITIVE: Crée et supprime physiquement les bases de données de test pour chaque worker.
    """
    # Détecte si on est dans un worker xdist
    worker_id = getattr(request.config, "workerinput", {}).get("workerid", "master")

    if worker_id == "master":
        # Pour le worker principal ou sans xdist, utiliser une DB en mémoire est le plus rapide et propre.
        db_uri = "sqlite:///:memory:"
        db_name = None # Pas de nom de DB pour sqlite en mémoire
    else:
        # Pour les workers parallèles, on utilise PostgreSQL.
        base_db_url = os.environ.get("DATABASE_URL", "postgresql+psycopg2://analylit_user:strong_password@db:5432/analylit_db")
        db_name = f"test_db_{worker_id}"
        db_uri = base_db_url.replace('/analylit_db', f'/{db_name}')

        # Se connecter au moteur PostgreSQL (DB 'postgres') pour créer la nouvelle DB
        maintenance_uri = base_db_url.replace('/analylit_db', '/postgres')
        # ✅ CORRECTION: Utiliser l'isolation_level "AUTOCOMMIT" pour CREATE/DROP DATABASE
        engine = create_engine(maintenance_uri, isolation_level="AUTOCOMMIT")
        with engine.connect() as conn:
            try:
                # Supprime la base si elle existe d'une session de test précédente
                conn.execute(text(f"DROP DATABASE IF EXISTS {db_name}"))
            except ProgrammingError:
                pass # Peut échouer si des connexions sont actives, mais on continue
            conn.execute(text(f"CREATE DATABASE {db_name}"))

    test_config = {
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": db_uri,
        "SQLALCHEMY_TRACK_MODIFICATIONS": False,
        "WTF_CSRF_ENABLED": False,
        "SERVER_NAME": "localhost",
        "SQLALCHEMY_ECHO": False # Désactive les logs SQL bruyants pendant les tests
    }
    _app = create_app(test_config)

    with _app.app_context():
        db.create_all()
        yield _app
        db.drop_all()

    # Si on a utilisé PostgreSQL, on nettoie la base de données créée
    if worker_id != "master" and db_name:
        # Réutiliser la même logique d'engine pour le nettoyage
        engine = create_engine(maintenance_uri, isolation_level="AUTOCOMMIT")
        with engine.connect() as conn:
            conn.execute(text(f"DROP DATABASE {db_name}"))

@pytest.fixture
def client(app):
    """Client de test Flask pour les requêtes HTTP."""
    with app.test_client() as client:
        yield client

@pytest.fixture
def db_session(app):
    """Fournit une session de base de données par test."""
    with app.app_context():
        yield db.session
        db.session.rollback()
        db.session.remove()

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
    db_session.commit()
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
    db_session.commit()
    yield db_session

@pytest.fixture(scope="function")
def mock_queue():
    """Mock pour la queue Redis."""
    from unittest.mock import MagicMock
    mock_q = MagicMock()
    mock_q.enqueue = MagicMock()
    return mock_q
