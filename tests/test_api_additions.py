import pytest
import json
from backend.server_v4_complete import create_app
from utils.database import db

@pytest.fixture(scope='function')
def test_client():
    """Crée un client de test avec une base de données propre pour chaque test."""
    app = create_app({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:',
        'WTF_CSRF_ENABLED': False,
    })

    with app.app_context():
        db.create_all()
        with app.test_client() as client:
            yield client
        db.session.remove()
        db.drop_all()

@pytest.fixture(scope='function')
def new_project(test_client):
    """Fixture pour créer un nouveau projet pour chaque test."""
    response = test_client.post('/api/projects/', json={
        'name': 'Pytest Project',
        'description': 'Un projet pour tester les nouvelles APIs'
    })
    assert response.status_code == 201
    return response.get_json()

def test_run_analysis_new_types(test_client, new_project):
    """Teste l'endpoint /api/projects/<id>/run-analysis avec les nouveaux types d'analyse."""
    project_id = new_project['id']
    
    # Teste atn_specialized_extraction
    response_atn = test_client.post(f'/api/projects/{project_id}/run-analysis', json={
        'type': 'atn_specialized_extraction'
    })
    assert response_atn.status_code == 202
    json_data = response_atn.get_json()
    assert 'task_id' in json_data
    assert json_data['message'] == "Analyse atn_specialized_extraction lancée"

    # Teste empathy_comparative_analysis
    response_empathy = test_client.post(f'/api/projects/{project_id}/run-analysis', json={
        'type': 'empathy_comparative_analysis'
    })
    assert response_empathy.status_code == 202
    json_data_empathy = response_empathy.get_json()
    assert 'task_id' in json_data_empathy
    assert json_data_empathy['message'] == "Analyse empathy_comparative_analysis lancée"

def test_get_task_status(test_client, new_project):
    """Teste le nouvel endpoint /api/tasks/<id>/status."""
    project_id = new_project['id']
    
    # Lance une tâche pour obtenir un ID de tâche valide
    response = test_client.post(f'/api/projects/{project_id}/run-analysis', json={
        'type': 'prisma_flow'  # Utilise une tâche simple et existante
    })
    assert response.status_code == 202
    task_id = response.get_json()['task_id']
    
    # Interroge l'endpoint de statut
    status_response = test_client.get(f'/api/tasks/{task_id}/status')
    assert status_response.status_code == 200
    status_data = status_response.get_json()
    assert status_data['task_id'] == task_id
    assert 'status' in status_data
    assert status_data['status'] in ['queued', 'started', 'finished', 'failed']

def test_save_rob_assessment(test_client, new_project):
    """Teste l'endpoint POST /api/projects/<id>/rob/<article_id>."""
    project_id = new_project['id']
    article_id = 'pmid:123456'  # ID d'article factice

    assessment_data = {
        'random_sequence_generation': 'low',
        'random_sequence_generation_notes': 'Utilisation d\'un générateur de nombres aléatoires.',
        'allocation_concealment': 'high',
        'allocation_concealment_notes': 'Non mentionné.',
    }
    
    response = test_client.post(f'/api/projects/{project_id}/rob/{article_id}', json={
        'rob_assessment': assessment_data
    })
    
    assert response.status_code == 200
    assert response.get_json()['message'] == 'Évaluation RoB sauvegardée avec succès'

def test_get_task_status_not_found(test_client):
    """Teste le cas où l'ID de la tâche n'existe pas."""
    non_existent_task_id = 'task-qui-n-existe-pas'
    response = test_client.get(f'/api/tasks/{non_existent_task_id}/status')
    assert response.status_code == 404
    assert response.get_json()['error'] == 'Tâche non trouvée'