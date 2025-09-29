# tests/test_database.py

import uuid
from utils.database import seed_default_data
from utils.models import AnalysisProfile, Project

# La fixture `session` est automatiquement injectée par conftest.py

def test_seed_default_data_when_empty(db_session):
    """Teste que le seeding fonctionne sur une base de données vide."""
    # Act
    seed_default_data(db_session)
 
    # Assert
    profile = db_session.query(AnalysisProfile).filter_by(name='Standard').first()
    project = db_session.query(Project).filter_by(name='Projet par défaut').first()
    assert profile is not None
    assert project is not None
 
def test_seed_default_data_when_exists(db_session):
    """Teste que le seeding ne crée pas de doublons."""
    # Arrange: Assume default data is already seeded by test_app fixture
    # ✅ CORRECTION: Appeler le seeding une première fois pour s'assurer que les données existent.
    seed_default_data(db_session)

    # Assert initial state (data should exist from initial seeding)
    profile_before = db_session.query(AnalysisProfile).filter_by(name='Standard').first()
    project_before = db_session.query(Project).filter_by(name='Projet par défaut').first()
    assert profile_before is not None
    assert project_before is not None

    count_profiles_before = db_session.query(AnalysisProfile).count()
    count_projects_before = db_session.query(Project).count()
 
    # Act: lancer le seeding une deuxième fois
    seed_default_data(db_session)
 
    # Assert: vérifier que le nombre d'entrées n'a pas changé
    assert db_session.query(AnalysisProfile).count() == count_profiles_before
    assert db_session.query(Project).count() == count_projects_before
