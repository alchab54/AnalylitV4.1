# tests/test_database.py

from utils.database import seed_default_data
from utils.models import AnalysisProfile, Project

# La fixture `session` est automatiquement injectée par conftest.py

def test_seed_default_data_when_empty(session):
    """Teste que le seeding fonctionne sur une base de données vide."""
    # Act
    seed_default_data(session)

    # Assert
    profile = session.query(AnalysisProfile).filter_by(name='Standard').first()
    project = session.query(Project).filter_by(name='Projet par défaut').first()
    assert profile is not None
    assert project is not None

def test_seed_default_data_when_exists(session):
    """Teste que le seeding ne crée pas de doublons."""
    # Arrange: insérer les données une première fois
    session.add(AnalysisProfile(name='Standard'))
    session.add(Project(name='Projet par défaut'))
    session.commit()
    count_before = session.query(Project).count()

    # Act: lancer le seeding une deuxième fois
    seed_default_data(session)

    # Assert: vérifier que le nombre d'entrées n'a pas changé
    assert session.query(Project).count() == count_before
