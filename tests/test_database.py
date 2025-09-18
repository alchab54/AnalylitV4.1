import pytest
from unittest.mock import MagicMock, patch, call
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

# Importer les fonctions à tester
from utils.database import init_database, seed_default_data, Base
from utils.models import AnalysisProfile, Project

# -- Fixture pour une base de données en mémoire --
@pytest.fixture(scope="function")
def in_memory_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
    Base.metadata.drop_all(engine)

# -- Tests simplifiés --

def test_init_database_creates_tables():
    """Vérifie que init_database crée bien les tables."""
    with patch('utils.database.create_engine') as mock_create_engine:
        mock_engine = MagicMock()
        mock_create_engine.return_value = mock_engine
        
        init_database(database_url="mock_db_url")
        
        mock_create_engine.assert_called_once_with("mock_db_url", pool_pre_ping=True, echo=False, future=True)
        mock_engine.connect.assert_called()
        Base.metadata.create_all.assert_called_once_with(bind=mock_engine)

def test_seed_default_data_no_data(in_memory_db):
    """Teste le seeding quand la base est vide."""
    session = in_memory_db
    # Supprimer les warnings de test en mockant l'env
    with patch('os.getenv', return_value="production"):
        seed_default_data(session)

    profile = session.query(AnalysisProfile).filter_by(name='Standard').first()
    project = session.query(Project).filter_by(name='Projet par défaut').first()
    
    assert profile is not None
    assert profile.name == 'Standard'
    assert project is not None
    assert project.name == 'Projet par défaut'

def test_seed_default_data_already_exists(in_memory_db):
    """Teste le seeding quand les données existent déjà."""
    session = in_memory_db
    
    # Ajouter des données existantes
    session.add(AnalysisProfile(name='Standard', description='Existant'))
    session.add(Project(name='Projet par défaut', description='Existant'))
    session.commit()
    
    with patch('os.getenv', return_value="production"):
        seed_default_data(session)
    
    # S'assurer qu'il n'y a pas de doublons
    assert session.query(AnalysisProfile).count() == 1
    assert session.query(Project).count() == 1
