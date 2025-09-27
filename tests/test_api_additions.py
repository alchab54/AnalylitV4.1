import pytest
import json
from utils.models import Project, RiskOfBias # Import Project for type hinting if needed

@pytest.fixture(scope='function')
def new_project(client):
    """
    Fixture pour créer un nouveau projet pour chaque test.
    ✅ CORRECTION: Utilise le 'client' global de conftest.py qui est 
    correctement configuré avec la base de données de test.
    """
    response = client.post('/api/projects/', json={
        'name': 'Pytest Project',
        'description': 'Un projet pour tester les nouvelles APIs'
    })
    assert response.status_code == 201
    return response.get_json()

def test_run_analysis_new_types(client, new_project):
    """Teste l'endpoint /api/projects/<id>/run-analysis avec les nouveaux types d'analyse."""
    project_id = new_project['id']
    
    # Teste atn_specialized_extraction
    response_atn = client.post(f'/api/projects/{project_id}/run-analysis', json={
        'type': 'atn_specialized_extraction'
    })
    assert response_atn.status_code == 202
    json_data = response_atn.get_json()
    assert 'task_id' in json_data
    assert json_data['message'] == "Analyse 'atn_specialized_extraction' lancée"

    # Teste empathy_comparative_analysis
    response_empathy = client.post(f'/api/projects/{project_id}/run-analysis', json={
        'type': 'empathy_comparative_analysis'
    })
    assert response_empathy.status_code == 202
    json_data_empathy = response_empathy.get_json()
    assert 'task_id' in json_data_empathy
    assert json_data_empathy['message'] == "Analyse 'empathy_comparative_analysis' lancée"

def test_get_task_status(client, new_project):
    """Teste le nouvel endpoint /api/tasks/<id>/status."""
    project_id = new_project['id']
    
    # Lance une tâche pour obtenir un ID de tâche valide
    response = client.post(f'/api/projects/{project_id}/run-analysis', json={
        'type': 'prisma_flow'  # Utilise une tâche simple et existante
    })
    assert response.status_code == 202
    task_id = response.get_json()['task_id']
    
    # Interroge l'endpoint de statut
    status_response = client.get(f'/api/tasks/{task_id}/status')
    assert status_response.status_code == 200
    status_data = status_response.get_json()
    assert status_data['task_id'] == task_id
    assert 'status' in status_data
    assert status_data['status'] in ['queued', 'started', 'finished', 'failed']
def test_save_rob_assessment(client, db_session, new_project):
    """Teste l'endpoint POST /api/projects/<id>/rob/<article_id>."""
    project_id = new_project['id']
    article_id = 'pmid:123456'  # ID d'article factice

    assessment_data = {
        'random_sequence_generation': 'low',
        'random_sequence_generation_notes': 'Utilisation d\'un générateur de nombres aléatoires.',
        'allocation_concealment': 'high',
        'allocation_concealment_notes': 'Non mentionné.',
    }
    
    response = client.post(f'/api/projects/{project_id}/rob/{article_id}', json={
        'rob_assessment': assessment_data
    })
    
    # 1. Vérifier que la requête a réussi et que la réponse contient les données
    assert response.status_code == 201
    saved_assessment_data = response.get_json()
    
    # 2. Vérifier que les données retournées par l'API sont correctes
    assert saved_assessment_data is not None
    assert saved_assessment_data['project_id'] == project_id
    assert saved_assessment_data['article_id'] == article_id
    assert saved_assessment_data['random_sequence_generation'] == 'low'
    assert saved_assessment_data['allocation_concealment_notes'] == 'Non mentionné.'

def test_get_task_status_not_found(client):
    """Teste le cas où l'ID de la tâche n'existe pas."""
    non_existent_task_id = 'task-qui-n-existe-pas'
    response = client.get(f'/api/tasks/{non_existent_task_id}/status')
    assert response.status_code == 404
    assert response.get_json()['error'] == 'Tâche non trouvée'