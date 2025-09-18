# tests/test_database.py

import pytest
from unittest.mock import patch, MagicMock, ANY

# Importer les fonctions à tester et les modèles pour vérification
from utils.database import init_database, seed_default_data
from utils.models import AnalysisProfile, Project, Base

# La fixture `db_session` est automatiquement fournie par conftest.py

def test_init_database_logic():
    """
    Teste la logique d'initialisation en simulant les appels externes.
    """
    with patch('utils.database.create_engine') as mock_create_engine, \
         patch('utils.database.Base.metadata.create_all') as mock_create_all:

        mock_engine = MagicMock()
        mock_create_engine.return_value = mock_engine

        # Appeler la fonction avec une URL de test
        initialized_engine = init_database("mock_db_url")

        # Vérifier que les fonctions critiques ont été appelées
        mock_create_engine.assert_called_once_with("mock_db_url", pool_pre_ping=True, echo=False)
        mock_create_all.assert_called_once_with(bind=mock_engine)
        assert initialized_engine == mock_engine

def test_seed_default_data_when_empty(session):
    """
    Teste que les données par défaut sont créées si la DB est vide.
    `session` est une session propre fournie par notre fixture.
    """
    seed_default_data(session)

    # Vérifier que les objets ont bien été ajoutés à la session
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
    # Pré-remplir la base de données avec les données par défaut
    session.add(AnalysisProfile(name='Standard'))
    session.add(Project(name='Projet par défaut'))
    session.commit()

    # Compter les objets
    profile_count = session.query(AnalysisProfile).count()
    project_count = session.query(Project).count()
    assert profile_count == 1
    assert project_count == 1

    # Lancer la fonction de seeding une seconde fois
    seed_default_data(session)

    # Vérifier que le nombre d'objets n'a pas changé (pas de doublons)
    assert session.query(AnalysisProfile).count() == profile_count
    assert session.query(Project).count() == project_count
