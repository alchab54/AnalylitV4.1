import pytest
from unittest.mock import patch, MagicMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Importer les fonctions à tester
from utils.database import init_database, seed_default_data, Base
from utils.models import AnalysisProfile, Project

@pytest.fixture(scope="function")
def session():
    """Crée une session de base de données en mémoire pour chaque test."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db_session = Session()
    yield db_session
    db_session.close()
    Base.metadata.drop_all(engine)

def test_database_initialization():
    """
    Teste si init_database configure correctement le moteur et les tables.
    """
    with patch('utils.database.create_engine') as mock_create_engine:
        mock_engine = MagicMock()
        mock_create_engine.return_value = mock_engine

        # Appeler la fonction d'initialisation
        init_database("sqlite:///:memory:")

        # Vérifier que create_engine a été appelé
        mock_create_engine.assert_called_once_with("sqlite:///:memory:", pool_pre_ping=True, echo=False)
        # Vérifier que les tables ont été créées
        Base.metadata.create_all.assert_called_once_with(bind=mock_engine)

def test_seed_default_data_when_empty(session):
    """
    Teste que les données par défaut sont créées si la base de données est vide.
    """
    # La base de données est vide grâce à la fixture
    seed_default_data(session)

    # Vérifier que les objets ont été créés
    profile = session.query(AnalysisProfile).filter_by(name='Standard').first()
    project = session.query(Project).filter_by(name='Projet par défaut').first()

    assert profile is not None
    assert profile.name == 'Standard'
    assert project is not None
    assert project.name == 'Projet par défaut'

def test_seed_default_data_when_exists(session):
    """
    Teste que rien n'est ajouté si les données par défaut existent déjà.
    """
    # Ajouter manuellement les données par défaut
    session.add(AnalysisProfile(name='Standard'))
    session.add(Project(name='Projet par défaut', description='Existant'))
    session.commit()

    # Compter les objets avant de seeder
    profile_count_before = session.query(AnalysisProfile).count()
    project_count_before = session.query(Project).count()

    # Lancer le seeding
    seed_default_data(session)

    # Vérifier que le nombre d'objets n'a pas changé
    assert session.query(AnalysisProfile).count() == profile_count_before
    assert session.query(Project).count() == project_count_before
