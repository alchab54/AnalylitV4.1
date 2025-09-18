# tests/conftest.py

import pytest
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# FORCER le mode test AVANT tout autre import
os.environ['TESTING'] = 'true'

# Imports retardés pour éviter les dépendances circulaires au démarrage
from utils.db_base import Base 
from utils import models

@pytest.fixture(scope='function')
def session():
    """
    Session ULTRA-ISOLÉE : Crée une base de données en mémoire
    totalement neuve pour CHAQUE test individuel.
    """
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db_session = Session()
    
    yield db_session
    
    db_session.close()
    engine.dispose() # Détruit complètement la DB et ses données après le test

@pytest.fixture(scope='function')
def client(session):
    """
    Fournit un client de test Flask 100% isolé pour CHAQUE test,
    en injectant la session de base de données dédiée.
    """
    from server_v4_complete import create_app
    app = create_app()
    app.config.update({"TESTING": True})
    
    # Injection de session via un "monkeypatch" du décorateur
    from utils.database import with_db_session
    original_decorator = with_db_session
    
    def test_decorator(func):
        def wrapper(*args, **kwargs):
            return func(session, *args, **kwargs)
        return wrapper
    
    import utils.database
    utils.database.with_db_session = test_decorator
    
    with app.test_client() as c:
        yield c
    
    # Restaurer le décorateur original pour ne pas affecter d'autres contextes
    utils.database.with_db_session = original_decorator
