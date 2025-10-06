import pytest
import json
from utils.models import Project, RiskOfBias
import uuid

import time

@pytest.fixture(scope='function')
def new_project(db_session):
    """
    Fixture pour créer un nouveau projet pour chaque test.
    ✅ CORRECTION: Crée le projet directement via la session de base de données
    transactionnelle pour éviter les deadlocks en mode parallèle.
    """
    project = Project(
        id=str(uuid.uuid4()),
        name='Pytest Project',
        description='Un projet pour tester les nouvelles APIs'
    )
    db_session.add(project)
    db_session.flush() # Utiliser flush pour obtenir l'ID sans commiter
    return project

@pytest.mark.usefixtures("mock_redis_and_rq")
def test_run_analysis_new_types(client, new_project):
    """Teste l'endpoint /api/projects/<id>/run-analysis avec les nouveaux types d'analyse."""
    project_id = new_project.id
    
    # Test atn_specialized_extraction
    response_atn = client.post(f'/api/projects/{project_id}/run-analysis', json={
        'type': 'atn_specialized_extraction'
    })
    assert response_atn.status_code == 202, f"Expected 202, got {response_atn.status_code} with data: {response_atn.text}"
    json_data = response_atn.get_json()
    assert 'job_id' in json_data
    assert json_data['message'] == "Analyse 'atn_specialized_extraction' lancée"
    
    # Teste empathy_comparative_analysis
    response_empathy = client.post(f'/api/projects/{project_id}/run-analysis', json={
        'type': 'empathy_comparative_analysis'
    })
    assert response_empathy.status_code == 202, f"Expected 202, got {response_empathy.status_code} with data: {response_empathy.text}"
    json_data_empathy = response_empathy.get_json()
    assert 'job_id' in json_data_empathy
    
    assert json_data_empathy['message'] == "Analyse 'empathy_comparative_analysis' lancée"

@pytest.mark.usefixtures("mock_redis_and_rq")
def test_get_task_status(client, new_project):
    """Teste le nouvel endpoint /api/jobs/<id>/status avec un mécanisme de polling robuste."""
    project_id = new_project.id
    
    # Lance une tâche pour obtenir un ID de job valide
    response = client.post(f'/api/projects/{project_id}/run-analysis', json={
        'type': 'prisma_flow'
    })
    assert response.status_code == 202, f"Expected 202, got {response.status_code} with data: {response.text}"
    job_id = response.get_json()['job_id']
    
    status_response = None
    # Boucle de polling pour attendre que la tâche soit initialisée
    for _ in range(5):  # Tente jusqu'à 5 fois
        status_response = client.get(f'/api/jobs/{job_id}/status')
        if status_response.status_code == 200:
            break  # La tâche est prête, on sort de la boucle
        time.sleep(1)  # Attend 1 seconde avant de réessayer

    # Vérifie que la réponse a bien été obtenue et que le statut est 200
    assert status_response is not None, "N'a jamais reçu de réponse valide de l'endpoint de statut."
    assert status_response.status_code == 200, f"Expected 200 after polling, got {status_response.status_code} with data: {response.text}"
    
    status_data = status_response.get_json()
    assert status_data['job_id'] == job_id
    assert 'status' in status_data
    assert status_data['status'] in ['queued', 'started', 'finished', 'failed', 'canceled']

@pytest.mark.usefixtures("mock_redis_and_rq")
def test_save_rob_assessment(client, db_session, new_project):
    """Teste l'endpoint POST /api/projects/<id>/rob/<article_id>."""
    project_id = new_project.id
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

@pytest.mark.usefixtures("mock_redis_and_rq")
def test_get_job_status_not_found(client):
    """Teste le cas où l'ID du job n'existe pas."""
    non_existent_job_id = 'job-qui-n-existe-pas'
    response = client.get(f'/api/jobs/{non_existent_job_id}/status')
    
    assert response.status_code == 404
    assert response.get_json() is not None
    assert response.get_json()['error'] == 'Job not found'
