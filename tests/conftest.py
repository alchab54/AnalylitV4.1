# tests/conftest.py
import pytest
import os
import sys
from pathlib import Path

# Ajouter le répertoire racine au PATH pour les imports
root_dir = Path(__file__).parent.parent
sys.path.insert(0, str(root_dir))

# Set TESTING environment variable for models.py
os.environ['TESTING'] = 'true'

# --- IMPORTS DE L'APPLICATION ---
from backend.server_v4_complete import create_app
from utils.database import db, migrate
from utils.models import Project, AnalysisProfile
from sqlalchemy import create_engine, text
from sqlalchemy.exc import ProgrammingError

@pytest.fixture(scope='session')
def app():
    """
    Fixture de session : Crée l'application et FORCE la création des tables
    """
    # ✅ CORRECTION CRITIQUE : URL de test dédiée
    test_db_url = os.getenv('TEST_DATABASE_URL', 
                           'postgresql://analylit_user:strong_password@analylit_test_db:5432/analylit_test_db')
    
    # ✅ CORRECTION : Configuration complète avec search_path
    _app = create_app({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': test_db_url,
        'SQLALCHEMY_ENGINE_OPTIONS': {
            'pool_size': 5,
            'pool_recycle': 120,
            'pool_pre_ping': True,
            "connect_args": {
                "options": "-c search_path=analylit_schema,public"
            }
        }
    })
    
    with _app.app_context():
        # Initialiser migrate
        migrate.init_app(_app, db)

        try:
            # ÉTAPE 1: Nettoyage complet
            db.session.execute(text("DROP SCHEMA IF EXISTS analylit_schema CASCADE;"))
            db.session.commit()
            print("✅ Schéma nettoyé")
        except Exception as e:
            db.session.rollback()
            print(f"⚠️ Nettoyage: {e}")

        try:
            # ÉTAPE 2: Création du schéma
            db.session.execute(text("CREATE SCHEMA IF NOT EXISTS analylit_schema;"))
            db.session.commit()
            print("✅ Schéma créé")
        except Exception as e:
            db.session.rollback()
            print(f"❌ Erreur création schéma: {e}")

        try:
            # ÉTAPE 3: FORCER la création des tables avec SQLAlchemy (plus fiable qu'Alembic pour les tests)
            db.create_all()
            db.session.commit()
            print("✅ Tables créées avec db.create_all()")
            
            # Vérifier que les tables sont bien là
            result = db.session.execute(text("""
                SELECT COUNT(*) FROM information_schema.tables 
                WHERE table_schema = 'analylit_schema'
            """)).scalar()
            print(f"✅ Nombre de tables créées: {result}")
            
        except Exception as e:
            db.session.rollback()
            print(f"❌ Erreur création tables: {e}")
            # En dernier recours, essayer les migrations Alembic
            try:
                from flask_migrate import upgrade
                upgrade()
                print("✅ Tables créées via Alembic")
            except Exception as alembic_error:
                print(f"❌ Échec Alembic: {alembic_error}")

        yield _app

@pytest.fixture
def client(app):
    """Client de test Flask pour les requêtes HTTP."""
    with app.test_client() as client:
        yield client

@pytest.fixture(scope="function")
def db_session(app):
    """
    Fixture de fonction : Isole chaque test dans une transaction
    VERSION CORRIGÉE qui résout définitivement session.remove()
    """
    with app.app_context(): 
        # ✅ CORRECTION CRITIQUE: Créer une session indépendante
        connection = db.engine.connect()
        transaction = connection.begin()
        
        # Créer une session liée à cette transaction
        from sqlalchemy.orm import sessionmaker
        Session = sessionmaker(bind=connection)
        session = Session()
        
        # ✅ CORRECTION: Remplacer la session globale temporairement
        original_session = db.session
        db.session = session

        yield session
        
        try:
            # ✅ CORRECTION: Nettoyage moderne SQLAlchemy
            session.close()  # Utilise close() au lieu de remove()
            transaction.rollback()  # Annule toutes les modifications
            connection.close()  # Ferme la connexion
        except Exception as e:
            print(f"Warning during session cleanup: {e}")
        finally:
            # Restaurer la session originale
            db.session = original_session

@pytest.fixture(scope="function")
def setup_project(db_session):
    """
    Fixture pour créer un projet de test
    """
    import uuid
    project = Project(
        id=str(uuid.uuid4()),
        name=f"Test Project {uuid.uuid4().hex[:6]}"
    )
    db_session.add(project)
    db_session.flush()  # Force l'écriture sans commit
    return project

@pytest.fixture
def clean_db(db_session):
    """Fixture vide - l'isolation est gérée par db_session"""
    yield db_session

@pytest.fixture(scope="function")
def mock_queue():
    """Mock pour la queue Redis."""
    from unittest.mock import MagicMock
    mock_q = MagicMock()
    mock_q.enqueue = MagicMock()
    return mock_q
