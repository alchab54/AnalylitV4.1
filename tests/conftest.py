# tests/conftest.py

import pytest
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# FORCER le mode test AVANT tout autre import
os.environ['TESTING'] = 'true'

from utils.db_base import Base
from utils import models  # Force l'enregistrement des modèles
from utils.database import with_db_session

TEST_DATABASE_URL = "sqlite:///:memory:"

@pytest.fixture(scope='session')
def engine():
    """Crée un moteur SQLite en mémoire une seule fois."""
    return create_engine(TEST_DATABASE_URL)

@pytest.fixture(scope='session')  
def tables(engine):
    """Crée toutes les tables une seule fois au début des tests."""
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)

@pytest.fixture(scope='function')
def session(engine, tables):
    """
    Fournit une session DB 100% ISOLÉE pour CHAQUE test.
    """
    connection = engine.connect()
    transaction = connection.begin()
    Session = sessionmaker(bind=connection)
    db_session = Session()
    
    yield db_session
    
    # Nettoyage explicite
    for table in reversed(Base.metadata.sorted_tables):
        db_session.execute(table.delete())
    db_session.commit()
    
    db_session.close()
    transaction.close()
    connection.close()

@pytest.fixture(scope='function')
def client(session):
    """
    Fournit un client de test Flask avec injection de session AVANT la première requête.
    """
    # Import retardé pour éviter les conflits
    from server_v4_complete import create_app
    
    app = create_app()
    app.config.update({"TESTING": True})
    
    # Injection de la session AVANT que l'app traite sa première requête
    with app.app_context():
        # Monkeypatch du décorateur with_db_session pour qu'il utilise notre session de test
        original_with_db_session = with_db_session
        
        def test_with_db_session(func):
            def wrapper(*args, **kwargs):
                return func(session, *args, **kwargs)
            return wrapper
        
        # Remplacer temporairement le décorateur
        import utils.database
        utils.database.with_db_session = test_with_db_session
        
        with app.test_client() as c:
            yield c
        
        # Restaurer le décorateur original
        utils.database.with_db_session = original_with_db_session
