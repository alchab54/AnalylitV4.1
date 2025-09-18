# tests/conftest.py

import os
os.environ['TESTING'] = 'true'

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Assurez-vous que Base est importé depuis vos modèles
# Cela peut être utils.database ou utils.models selon votre structure
try:
    from utils.models import Base
except ImportError:
    from utils.database import Base

# Utiliser une base de données en mémoire pour des tests rapides et isolés
TEST_DATABASE_URL = "sqlite:///:memory:"

@pytest.fixture(scope="session")
def engine():
    """
    Crée un moteur de base de données unique pour toute la session de tests.
    Crée toutes les tables au début et les supprime à la fin.
    """
    db_engine = create_engine(TEST_DATABASE_URL)
    Base.metadata.create_all(db_engine)
    yield db_engine
    Base.metadata.drop_all(db_engine)

@pytest.fixture(scope="function")
def db_session(engine):
    """
    Crée une nouvelle session et une transaction pour CHAQUE test.
    À la fin du test, la transaction est annulée (rollback),
    assurant qu'aucun test ne peut influencer le suivant.
    """
    connection = engine.connect()
    transaction = connection.begin()
    
    Session = sessionmaker(bind=connection)
    session = Session()
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()
