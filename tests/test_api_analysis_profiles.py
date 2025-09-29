import json
import pytest
from utils.models import AnalysisProfile
from utils.database import seed_default_data
import uuid

def test_api_analysis_profiles_crud_workflow(client, db_session):
    """
    Teste le cycle de vie complet (CRUD) pour /api/analysis-profiles.
    Ce test de workflow remplace les anciens tests unitaires pour une meilleure isolation.
    1. POST (Créer) un profil personnalisé.
    2. GET (Lire) tous les profils et retrouver le nouveau.
    3. PUT (Mettre à jour) le profil personnalisé.
    4. DELETE (Supprimer) le profil personnalisé.
    5. DELETE (Échec) la suppression d'un profil par défaut.
    """
    
    # --- 0. Seed Data (Assurer que le profil "Standard" existe) ---
    seed_default_data(db_session)
    
    # --- 1. POST (Créer) ---
    profile_data = {
        "name": f"Mon Profil IA Personnalisé - {uuid.uuid4().hex}",
        "is_custom": True,
        "preprocess_model": "modele-rapide:latest",
        "extract_model": "modele-moyen:latest",
        "synthesis_model": "modele-puissant:latest"
    }
    response = client.post('/api/analysis-profiles', json=profile_data)
    assert response.status_code == 201
    data = response.get_json()
    
    assert data['name'] == profile_data['name']
    assert data['is_custom'] is True
    assert 'id' in data
    profile_id = data['id']

    # --- 2. GET (Lire) ---
    response = client.get('/api/analysis-profiles')
    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data, list)
    assert any(p['id'] == profile_id for p in data)

    # --- 3. PUT (Mettre à jour) ---
    update_data = {
        "name": f"Profil Personnalisé Mis à Jour - {uuid.uuid4().hex}",
        "preprocess_model": "modele-rapide-v2:latest"
    }
    response = client.put(f'/api/analysis-profiles/{profile_id}', json=update_data)
    assert response.status_code == 200
    data = response.get_json()
    assert data['name'] == update_data['name']
    assert data['preprocess_model'] == update_data['preprocess_model']

    # --- 4. DELETE (Supprimer le profil personnalisé) ---
    response = client.delete(f'/api/analysis-profiles/{profile_id}')
    assert response.status_code == 200
    assert "Profil supprimé" in response.get_json()['message']
    deleted = db_session.get(AnalysisProfile, profile_id)
    assert deleted is None

    # --- 5. DELETE (Échec sur profil par défaut) ---
    default_profile = db_session.query(AnalysisProfile).filter_by(name="Standard").first()
    assert default_profile is not None
    response = client.delete(f'/api/analysis-profiles/{default_profile.id}')
    assert response.status_code == 403
    assert "Impossible de supprimer un profil par défaut" in response.get_json()['error']