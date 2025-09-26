import json
import pytest
from utils.models import AnalysisProfile

def test_create_analysis_profile(client, db_session):
    """Test de la création d'un nouveau profil d'analyse."""
    profile_data = {
        "name": "Profil de Test",
        "description": "Description de test",
        "preprocess_model": "test-model"
    }
    response = client.post('/api/analysis-profiles', json=profile_data)
    assert response.status_code == 201
    data = response.get_json()
    assert data['name'] == "Profil de Test"
    assert data['id'] is not None

    # Vérifier en base de données
    profile = db_session.query(AnalysisProfile).filter_by(name="Profil de Test").first()
    assert profile is not None

def test_create_profile_no_name(client):
    """Test de la création d'un profil sans nom."""
    response = client.post('/api/analysis-profiles', json={"description": "test"})
    assert response.status_code == 400
    assert "Le nom du profil est requis" in response.get_json()['error']

def test_get_all_analysis_profiles(client, db_session):
    """Test de la récupération de tous les profils."""
    # Ajouter un profil pour le test
    profile = AnalysisProfile(name="Profil Existant", description="Test")
    db_session.add(profile)
    db_session.commit()

    response = client.get('/api/analysis-profiles')
    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert "Profil Existant" in [p['name'] for p in data]

def test_get_profile_details(client, db_session):
    """Test de la récupération des détails d'un profil."""
    profile = AnalysisProfile(name="Profil Détaillé")
    db_session.add(profile)
    db_session.commit()

    response = client.get(f'/api/analysis-profiles/{profile.id}')
    assert response.status_code == 200
    data = response.get_json()
    assert data['name'] == "Profil Détaillé"

def test_get_profile_not_found(client):
    """Test de la récupération d'un profil inexistant."""
    response = client.get('/api/analysis-profiles/non-existent-id')
    assert response.status_code == 404

def test_update_analysis_profile(client, db_session):
    """Test de la mise à jour d'un profil."""
    profile = AnalysisProfile(name="Profil à Mettre à Jour")
    db_session.add(profile)
    db_session.commit()

    update_data = {"name": "Profil Mis à Jour", "synthesis_model": "updated-model"}
    response = client.put(f'/api/analysis-profiles/{profile.id}', json=update_data)
    assert response.status_code == 200
    data = response.get_json()
    assert data['name'] == "Profil Mis à Jour"
    assert data['synthesis_model'] == "updated-model"

    # Vérifier en base de données
    updated_profile = db_session.query(AnalysisProfile).get(profile.id)
    assert updated_profile.name == "Profil Mis à Jour"

def test_delete_analysis_profile(client, db_session):
    """Test de la suppression d'un profil."""
    profile = AnalysisProfile(name="Profil à Supprimer", is_default=False)
    db_session.add(profile)
    db_session.commit()
    profile_id = profile.id

    response = client.delete(f'/api/analysis-profiles/{profile_id}')
    assert response.status_code == 200
    assert "Profil supprimé" in response.get_json()['message']

    # Vérifier qu'il a bien été supprimé
    deleted_profile = db_session.query(AnalysisProfile).get(profile_id)
    assert deleted_profile is None

def test_delete_default_profile(client, db_session):
    """Test de la tentative de suppression d'un profil par défaut."""
    profile = AnalysisProfile(name="Profil par Défaut", is_default=True)
    db_session.add(profile)
    db_session.commit()

    response = client.delete(f'/api/analysis-profiles/{profile.id}')
    assert response.status_code == 403
    assert "Impossible de supprimer un profil par défaut" in response.get_json()['error']