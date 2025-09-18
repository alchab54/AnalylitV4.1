# tests/conftest.py

import pytest
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

# FORCER le mode test AVANT tout autre import
os.environ['TESTING'] = 'true'

from server_v4_complete import app as flask_app
from utils.db_base import Base
from utils import models  # Force l'enregistrement des modèles

TEST_DATABASE_URL = "sqlite:///:memory:"

@pytest.fixture(scope="session")
def engine():
    """Crée un moteur SQLite en mémoire une seule fois."""
    return create_engine(TEST_DATABASE_URL)

@pytest.fixture(scope="session")
def tables(engine):
    """Crée toutes les tables une seule fois au début des tests."""
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)

@pytest.fixture(scope="function")
def session(engine, tables):
    """
    Fournit une session DB 100% ISOLÉE pour CHAQUE test en vidant les tables.
    Ceci est la solution définitive à tous les problèmes d'isolation.
    """
    connection = engine.connect()
    transaction = connection.begin()
    db_session = Session(bind=connection)
    
    yield db_session
    
    # Nettoyage explicite de toutes les tables
    for table in reversed(Base.metadata.sorted_tables):
        db_session.execute(table.delete())
    db_session.commit()
    
    db_session.close()
    transaction.close() # Remplacé rollback par close
    connection.close()


@pytest.fixture(scope="function")
def client(session):
    """Fournit un client de test Flask pour chaque test."""
    # Injection de la session dans le contexte de l'application Flask
    # pour que les routes API utilisent la session de test.
    @flask_app.before_request
    def provide_session():
        from flask import g
        g.db_session = session

    with flask_app.test_client() as c:
        yield c
