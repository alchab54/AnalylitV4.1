# tests/conftest.py
import pytest
import os
import sys
import threading
from pathlib import Path

# Ajouter le répertoire racine au PATH pour les imports
root_dir = Path(__file__).parent.parent
sys.path.insert(0, str(root_dir))

# Set TESTING environment variable
os.environ['TESTING'] = 'true'

# ✅ CORRECTION CRITIQUE : Importer les modèles pour que SQLAlchemy les découvre.
# ✅ CORRECTION CRITIQUE : Import explicite de TOUS les modèles
from utils.models import (
    Project, Article, SearchResult, Extraction, Grid, GridField, 
    Validation, Analysis, ChatMessage, AnalysisProfile, PRISMARecord, 
    ScreeningDecision, RiskOfBias, Prompt, GreyLiterature, 
    ProcessingLog, Stakeholder
)
# ✅ CORRECTION CRITIQUE : Utiliser un verrou pour éviter les conflits de concurrence
_db_lock = threading.Lock()

# --- IMPORTS DE L'APPLICATION ---
from backend.server_v4_complete import create_app
from utils.extensions import db, migrate
from sqlalchemy import text

@pytest.fixture(scope='session')
def app():
    """
    Fixture de session avec isolation COMPLÈTE et gestion de concurrence
    """
    with _db_lock:  # ✅ Verrou pour éviter les conflits
        # ✅ URL de base de test SÉPARÉE
        test_db_url = 'postgresql://analylit_user:strong_password@analylit_test_db:5432/analylit_test_db'
        
        _app = create_app({
            'TESTING': True,
            'SQLALCHEMY_DATABASE_URI': test_db_url,
            'SQLALCHEMY_ENGINE_OPTIONS': {
                'pool_size': 1,  # ✅ Pool réduit pour les tests
                'pool_recycle': 30,
                'pool_pre_ping': True,
                "connect_args": {
                    "options": "-c search_path=analylit_schema,public"
                }
            }
        })
        
        with _app.app_context():
            # ✅ CORRECTION : Vérifier d'abord si on peut se connecter
            try:
                result = db.session.execute(text("SELECT 1")).scalar()
                print(f"✅ Connexion test DB: OK")
            except Exception as e:
                print(f"❌ Connexion test DB: {e}")
                pytest.fail(f"Cannot connect to test database: {e}")
            
            # ✅ NETTOYAGE BRUTAL mais sûr
            try:
                # Terminer toutes les connexions actives au schéma
                db.session.execute(text("""
                    SELECT pg_terminate_backend(pg_stat_activity.pid)
                    FROM pg_stat_activity
                    WHERE pg_stat_activity.datname = 'analylit_test_db'
                    AND pid <> pg_backend_pid()
                """))
                
                # Supprimer complètement le schéma
                db.session.execute(text("DROP SCHEMA IF EXISTS analylit_schema CASCADE"))
                db.session.commit()
                print("✅ Schéma nettoyé")
                
            except Exception as e: # noqa: E722
                db.session.rollback()
                print(f"⚠️ Nettoyage: {e}")
            
            # ✅ CRÉATION PROPRE
            try:
                # Créer le schéma
                db.session.execute(text("CREATE SCHEMA analylit_schema"))
                db.session.commit()
                # ✅ Créer les tables avec SQLAlchemy (plus fiable que Alembic pour tests)
                db.create_all()
                db.session.commit()
                print("✅ Tables de test créées")
                
                # Vérifier le résultat
                count = db.session.execute(text("""
                    SELECT COUNT(*) FROM information_schema.tables 
                    WHERE table_schema = 'analylit_schema'
                """)).scalar()
                print(f"✅ {count} tables créées dans analylit_schema")

                if count == 0:
                    pytest.fail("No tables created in test schema")
                
            except Exception as e: # noqa: E722
                db.session.rollback()
                print(f"❌ Erreur création test: {e}")
                pytest.fail(f"Cannot create test tables: {e}")
            
            yield _app
            
            # ✅ NETTOYAGE FINAL
            try:
                db.session.execute(text("DROP SCHEMA IF EXISTS analylit_schema CASCADE"))
                db.session.commit()
                print("✅ Schéma de test nettoyé")
            except Exception as e:
                print(f"⚠️ Cleanup warning: {e}")

@pytest.fixture
def client(app):
    """Client de test Flask."""
    return app.test_client()

@pytest.fixture(scope="function")
def db_session(app):
    """
    Fixture de fonction avec isolation transactionnelle SIMPLIFIÉE
    """
    with app.app_context():
        # ✅ TRANSACTION SIMPLE et propre
        connection = db.engine.connect()
        transaction = connection.begin()
        
        # Créer une session temporaire
        from sqlalchemy.orm import sessionmaker
        Session = sessionmaker(bind=connection)
        test_session = Session()
        
        # ✅ Sauvegarder et remplacer temporairement db.session
        original_session = db.session
        db.session = test_session

        yield test_session
        
        # ✅ NETTOYAGE SIMPLE ET FIABLE
        try:
            test_session.close()
            transaction.rollback()  # Annule tout
        except Exception as e:
            print(f"Warning during session cleanup: {e}")
        finally:
            connection.close()
            db.session = original_session  # Restaurer la session originale

@pytest.fixture(scope="function")
def setup_project(db_session):
    """
    Créer un projet de test propre.
    """
    from utils.models import Project
    import uuid
    
    project = Project(
        id=str(uuid.uuid4()),
        name=f"Test Project {uuid.uuid4().hex[:8]}"
    )
    db_session.add(project)
    db_session.flush()  # Écriture sans commit
    return project

@pytest.fixture
def clean_db(db_session):
    """
    Fixture pour nettoyer la base de données de test de manière efficace et sûre.
    Tronque toutes les tables au lieu de dropper le schéma, ce qui évite les deadlocks.
    """
    # ✅ NOUVELLE LOGIQUE BEAUCOUP PLUS SÛRE
    meta = db.metadata
    for table in reversed(meta.sorted_tables):
        db_session.execute(table.delete())
    db_session.commit()
    yield
    # Le nettoyage se fait avant le test pour garantir un état propre
