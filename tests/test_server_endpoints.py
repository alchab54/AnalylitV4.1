# test_server_endpoints.py

# Fichier corrigé (Assertions 'enqueue' finales)

# Fichier COMPLÉTÉ AVEC LES TESTS API MANQUANTS (Search, Run, Analysis, Imports, RoB)

# CORRECTION: Échec I/O sur test_api_import_zotero_file_enqueues_task résolu en patchant la bonne file (q)

import json
import pytest
import uuid
import io
from sqlalchemy import text
from unittest.mock import patch, MagicMock

# --- IMPORTS NÉCESSAIRES POUR LES TESTS D'ASSERTION FINAUX ---
# Nous devons importer les fonctions de tâches réelles pour les comparer
from backend.tasks_v4_complete import (
    run_discussion_generation_task,
    answer_chat_question_task,
    # --- TÂCHES AJOUTÉES POUR LES NOUVEAUX TESTS ---
    multi_database_search_task,
    process_single_article_task,
    import_from_zotero_file_task,
    import_pdfs_from_zotero_task,
    run_risk_of_bias_task,
    run_meta_analysis_task,
    run_atn_score_task,
    run_knowledge_graph_task,
    run_prisma_flow_task
)

# Importer les modèles nécessaires pour la configuration des tests
from utils.models import AnalysisProfile

def test_health_check(client):
    """
    GIVEN un client de test Flask
    WHEN la route '/api/health' est appelée en GET
    THEN vérifier que la réponse est 200 OK.
    """
    response = client.get('/api/health') # CORRECTION: Le blueprint admin est préfixé par /api
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data.get('status') == 'healthy'

def test_create_project(client, db_session): # Utilise session pour l'isolation
    """
    GIVEN un client de test Flask
    WHEN la route '/api/projects' est appelée en POST avec des données valides
    THEN vérifier que la réponse est 201 Created et que le projet est en base de données.
    """
    project_data = {
        'name': 'Mon Projet de Test',
        'description': 'Une description pour le test.',
        'mode': 'screening'
    }

    response = client.post('/api/projects', data=json.dumps(project_data), content_type='application/json')
    assert response.status_code == 201
    response_data = json.loads(response.data)
    assert 'id' in response_data
    assert response_data['name'] == 'Mon Projet de Test'
    assert response_data['analysis_mode'] == 'screening'

def test_get_available_databases(client):
    """
    GIVEN a Flask test client
    WHEN the '/api/databases' route is called with GET
    THEN check that the response is 200 OK and contains a list of databases.
    """
    response = client.get('/api/databases')
    data = json.loads(response.data)
    assert response.status_code == 200
    assert isinstance(data, list)
    assert any(d['id'] == 'pubmed' for d in data)

def test_get_project_details(client, db_session): # Utilise session
    """
    GIVEN a Flask test client and an existing project
    WHEN the '/api/projects/' route is called with GET
    THEN check that the response is 200 OK and contains the project details.
    """
    # 1. Create a project first
    project_data = {'name': 'Project Details', 'description': 'Desc', 'mode': 'screening'}
    create_response = client.post('/api/projects', data=json.dumps(project_data), content_type='application/json')
    created_project = json.loads(create_response.data)
    project_id = created_project['id']

    # 2. Make a GET request
    response = client.get(f'/api/projects/{project_id}')
    data = json.loads(response.data)

    # 3. Assertions
    assert response.status_code == 200
    assert data['id'] == project_id
    assert data['name'] == 'Project Details'

def test_get_project_details_not_found(client, db_session): # session garantit que l'ID n'existe pas
    """
    GIVEN a Flask test client
    WHEN the '/api/projects/' route is called with GET
    THEN check that the response is 404 Not Found.
    """
    non_existent_id = "12345678-1234-5678-1234-567812345678" # Format UUID valide
    response = client.get(f'/api/projects/{non_existent_id}')
    assert response.status_code == 404
    error_data = json.loads(response.data)
    assert error_data['error'] == 'Projet non trouvé'

def test_delete_project(client, db_session): # Utilise session
    """
    GIVEN a Flask test client and an existing project
    WHEN the '/api/projects/' route is called with DELETE
    THEN check that the project is deleted successfully.
    """
    # 1. Create a project
    project_data = {'name': 'Project to Delete', 'description': 'Desc', 'mode': 'screening'}
    create_response = client.post('/api/projects', data=json.dumps(project_data), content_type='application/json')
    assert create_response.status_code == 201
    project_id = json.loads(create_response.data)['id']

    # 2. Make a DELETE request
    delete_response = client.delete(f'/api/projects/{project_id}')

    # 3. Assertions
    assert delete_response.status_code == 204
    assert not delete_response.data  # A 204 response should have no body

    # 4. Verify deletion
    get_response = client.get(f'/api/projects/{project_id}')
    assert get_response.status_code == 404

def test_delete_non_existent_project(client, db_session): # Utilise session
    """
    GIVEN a Flask test client
    WHEN the '/api/projects/' route is called with DELETE
    THEN check that the response is 404 Not Found.
    """
    non_existent_id = "87654321-4321-8765-4321-876543210987"
    response = client.delete(f'/api/projects/{non_existent_id}')
    assert response.status_code == 404
    error_data = json.loads(response.data)
    assert error_data['error'] == 'Projet non trouvé'

def test_get_all_projects(client, db_session): # Utilise session
    """
    GIVEN a Flask test client and multiple projects
    WHEN the '/api/projects' route is called with GET
    THEN check that the response is 200 OK and contains all projects.
    """
    # 1. Create multiple projects
    project1_data = {'name': 'Project One', 'description': 'Desc 1', 'mode': 'screening'}
    project2_data = {'name': 'Project Two', 'description': 'Desc 2', 'mode': 'full_extraction'}

    create_response1 = client.post('/api/projects', data=json.dumps(project1_data), content_type='application/json')
    assert create_response1.status_code == 201
    created_project1 = json.loads(create_response1.data)

    create_response2 = client.post('/api/projects', data=json.dumps(project2_data), content_type='application/json')
    assert create_response2.status_code == 201
    created_project2 = json.loads(create_response2.data)

    # 2. Make a GET request
    response = client.get('/api/projects/')
    data = json.loads(response.data)

    # 3. Assertions
    assert response.status_code == 200
    assert isinstance(data, list)
    assert len(data) >= 2 # Le nombre exact peut varier si d'autres tests polluent la DB

    project_ids = [p['id'] for p in data]
    assert created_project1['id'] in project_ids
    assert created_project2['id'] in project_ids

    found_project1 = next((p for p in data if p['id'] == created_project1['id']), None)
    assert found_project1 is not None
    assert found_project1['name'] == project1_data['name']
    assert found_project1['analysis_mode'] == project1_data['mode']

def test_get_all_projects_empty(client, db_session): # ✅ Utiliser la session transactionnelle
    """
    Test avec base de données vraiment vide grâce à db_session
    WHEN the '/api/projects' route is called with GET
    THEN check that the response is 200 OK and contains an empty list.
    """
    db_session.execute(text("TRUNCATE TABLE analylit_schema.projects CASCADE;"))
    db_session.commit()
    
    response = client.get('/api/projects/')
    assert response.status_code == 200
    assert len(response.json) == 0

@patch('api.projects.discussion_draft_queue.enqueue')
def test_api_run_discussion_draft_enqueues_task(mock_enqueue, client, db_session):
    """
    Teste d'intégration API : Vérifie que l'endpoint de discussion met bien en file (enqueue) la bonne tâche.
    """
    # ARRANGE
    mock_job = MagicMock()
    mock_job.id = "mocked_job_id_123"
    mock_enqueue.return_value = mock_job
    project_data = {'name': 'API Test Discussion', 'mode': 'screening'}
    resp = client.post('/api/projects', data=json.dumps(project_data), content_type='application/json')
    project_id = json.loads(resp.data)['id']

    # ACT
    response = client.post(f'/api/projects/{project_id}/run-discussion-draft')

    # ASSERT
    assert response.status_code == 202
    # ***** CORRECTION DE L'ÉCHEC DU TEST *****
    # Le serveur appelle enqueue avec l'objet fonctionnel (importé), pas avec un string.
    mock_enqueue.assert_called_once_with(
        run_discussion_generation_task, # <-- Vérifie l'objet fonction, pas le string
        project_id=project_id,
        job_timeout=1800
    )

    response_data = json.loads(response.data) # type: ignore
    assert response_data['job_id'] == "mocked_job_id_123"

@patch('api.projects.background_queue.enqueue')
def test_api_post_chat_message_enqueues_task(mock_enqueue, client, db_session):
    """
    Teste d'intégration API : Vérifie que l'endpoint de chat met bien en file la tâche RAG.
    """
    # ARRANGE
    mock_job = MagicMock()
    mock_job.id = "mocked_chat_job_456"
    mock_enqueue.return_value = mock_job
    project_data = {'name': 'API Test Chat', 'mode': 'screening'}
    resp = client.post('/api/projects', data=json.dumps(project_data), content_type='application/json')
    project_id = json.loads(resp.data)['id']

    chat_data = {"question": "Test question?"}

    # ACT
    response = client.post(f'/api/projects/{project_id}/chat', data=json.dumps(chat_data), content_type='application/json')

    # DEBUG: Print response data
    print(f"Response data for chat test: {response.data}")

    # ASSERT
    assert response.status_code == 202
    # ***** CORRECTION DE L'ÉCHEC DU TEST *****
    # Le serveur appelle enqueue avec l'objet fonctionnel (importé), pas avec un string.
    mock_enqueue.assert_called_once_with(
        answer_chat_question_task, # <-- Vérifie l'objet fonction, pas le string
        project_id=project_id,
        question="Test question?",
        job_timeout='15m'
    )

    response_data = json.loads(response.data) # type: ignore
    assert response_data['job_id'] == "mocked_chat_job_456" # La réponse du serveur est bien 'job_id'

# =================================================================
# === DÉBUT DES NOUVEAUX TESTS AJOUTÉS (Couverture restante) ===
# =================================================================

@patch('api.search.background_queue.enqueue')
def test_api_search_enqueues_task(mock_enqueue, client, db_session):
    """
    Teste POST /api/search et vérifie qu'il met en file la tâche de recherche.
    """
    # ARRANGE
    mock_job = MagicMock()
    mock_job.id = "mocked_search_job"
    mock_enqueue.return_value = mock_job
    project_data = {'name': 'API Test Search', 'mode': 'screening'}
    resp = client.post('/api/projects', data=json.dumps(project_data), content_type='application/json')
    project_id = json.loads(resp.data)['id']

    search_payload = {
        "project_id": project_id,
        "query": "diabetes",
        "databases": ["pubmed", "arxiv"]
    }

    # ACT
    response = client.post('/api/search', data=json.dumps(search_payload), content_type='application/json') # Le préfixe /api est déjà dans la route

    # ASSERT
    assert response.status_code == 202
    mock_enqueue.assert_called_once_with(
        multi_database_search_task, # Vérifie la fonction
        project_id=project_id,
        query="diabetes",
        expert_queries=None,
        databases=["pubmed", "arxiv"],
        max_results_per_db=50,
    )

@patch('api.projects.processing_queue.enqueue')
def test_api_run_pipeline_enqueues_tasks(mock_enqueue, client, db_session):
    """
    Teste POST /api/projects/<id>/run et vérifie qu'il met en file plusieurs tâches (une par article).
    """
    # ARRANGE
    # 1. Créer un profil d'analyse valide (nécessaire pour l'endpoint /run)
    profile_id = str(uuid.uuid4()) # Déjà unique, c'est bon.
    profile = AnalysisProfile(id=profile_id, name="Standard Profile", preprocess_model="model1", extract_model="model2", synthesis_model="model3")
    db_session.add(profile)
    db_session.flush()

    # 2. Créer le projet
    project_data = {'name': 'API Test Run', 'mode': 'screening'}
    resp = client.post('/api/projects', data=json.dumps(project_data), content_type='application/json')
    project_id = json.loads(resp.data)['id']

    run_payload = {
        "articles": ["pmid1", "pmid2"], # Deux articles
        "profile": profile_id,
        "analysis_mode": "screening",
        "custom_grid_id": None
    }

    # ACT
    response = client.post(f'/api/projects/{project_id}/run', data=json.dumps(run_payload), content_type='application/json')

    # ASSERT
    assert response.status_code == 202
    # Doit être appelé 2 fois (une pour pmid1, une pour pmid2)
    assert mock_enqueue.call_count == 2

    # ✅ AMÉLIORATION: Assertion plus robuste qui ne dépend pas de l'ordre des appels.
    # On vérifie que la bonne tâche a été appelée pour chaque article.
    calls = mock_enqueue.call_args_list
    # On s'assure que la bonne fonction a été appelée
    for call in calls:
        assert call.args[0] == process_single_article_task
    # On vérifie que les bons article_id ont été passés, peu importe l'ordre.
    called_article_ids = {call.kwargs['article_id'] for call in calls}
    assert called_article_ids == {"pmid1", "pmid2"}

@pytest.mark.parametrize("analysis_type, expected_task", [
    ("meta_analysis", run_meta_analysis_task),
    ("atn_scores", run_atn_score_task),
    ("knowledge_graph", run_knowledge_graph_task),
    ("prisma_flow", run_prisma_flow_task),
])
@patch('api.projects.analysis_queue.enqueue')
def test_api_run_advanced_analysis_enqueues_tasks(mock_enqueue, analysis_type, expected_task, client, db_session):
    """
    Teste POST /api/projects/<id>/run-analysis pour tous les types d'analyse (paramétré).
    """
    # ARRANGE
    mock_job = MagicMock()
    mock_job.id = f"job_for_{analysis_type}"
    mock_enqueue.return_value = mock_job
    project_data = {'name': f'API Test {analysis_type}', 'mode': 'screening'}
    resp = client.post('/api/projects', data=json.dumps(project_data), content_type='application/json')
    project_id = json.loads(resp.data)['id']

    analysis_payload = {"type": analysis_type}

    # ACT
    response = client.post(f'/api/projects/{project_id}/run-analysis', data=json.dumps(analysis_payload), content_type='application/json')

    # ASSERT
    assert response.status_code == 202
    mock_enqueue.assert_called_once_with(
        expected_task, # Vérifie que la bonne fonction tâche est appelée
        project_id=project_id,
        job_timeout=1800
    )

@patch('api.projects.background_queue.enqueue')
def test_api_import_zotero_enqueues_task(mock_enqueue, client, db_session):
    """
    Teste POST /api/projects/<id>/import-zotero (PDF sync)
    """
    # ARRANGE
    mock_job = MagicMock()
    mock_job.id = "zotero_pdf_job"
    mock_enqueue.return_value = mock_job
    project_data = {'name': 'API Test Zotero PDF', 'mode': 'screening'}
    resp = client.post('/api/projects', data=json.dumps(project_data), content_type='application/json')
    project_id = json.loads(resp.data)['id']

    # CORRECTION : Le payload doit contenir les clés Zotero
    # que le serveur attend via data.get()
    import_payload = {
        "articles": ["pmid1", "pmid2"],
        "zotero_user_id": "123",  # <-- AJOUTÉ
        "zotero_api_key": "abc"   # <-- AJOUTÉ
    }

    # ACT
    # CORRECTION: La route est /import-zotero-pdfs, pas /import-zotero/
    response = client.post( # type: ignore
        f'/api/projects/{project_id}/import-zotero/', 
        data=json.dumps(import_payload), 
        content_type='application/json'
    )

    # ASSERT
    assert response.status_code == 202 
    mock_enqueue.assert_called_once_with(
        import_pdfs_from_zotero_task,
        project_id=project_id,
        pmids=["pmid1", "pmid2"],
        zotero_user_id="123",
        zotero_api_key="abc",
        job_timeout='30m'
    )

@patch('api.projects.background_queue.enqueue')
def test_api_import_zotero_file_enqueues_task(mock_q_enqueue, client, db_session):
    """
    Teste POST /api/projects/<id>/upload-zotero-file (File import)
    """
    # ARRANGE
    mock_job = MagicMock()
    mock_job.id = "zotero_file_job_q"
    mock_q_enqueue.return_value = mock_job
    project_data = {'name': 'API Test Zotero File', 'mode': 'screening'}
    resp = client.post('/api/projects/', data=json.dumps(project_data), content_type='application/json')
    project_id = json.loads(resp.data)['id']
 
    file_content = b'{"items": [{"title": "Test Zotero Item"}]}'
    file_data = {'file': (io.BytesIO(file_content), 'test.json')}
 
    # ACT
    # On patche la fonction qui sauvegarde le fichier pour ne pas écrire sur le disque
    with patch('backend.server_v4_complete.save_file_to_project_dir', return_value='/fake/path/to/test.json'):
        response = client.post(
            f'/api/projects/{project_id}/upload-zotero-file', # Correction du nom de la route
            data=file_data,
            content_type='multipart/form-data'
        )
 
        # ASSERT
        assert response.status_code == 202
        assert response.get_json()['job_id'] == "zotero_file_job_q"
        mock_q_enqueue.assert_called_once_with(
            import_from_zotero_file_task,
            project_id=project_id,
            json_file_path='/fake/path/to/test.json',
            job_timeout='15m'
        )

@patch('api.projects.analysis_queue.enqueue')
def test_api_run_rob_analysis_enqueues_task(mock_enqueue, client, db_session):
    """
    Teste POST /api/projects/<id>/run-rob-analysis et vérifie les appels multiples à enqueue.
    """
    # ARRANGE
    project_data = {'name': 'API Test RoB', 'mode': 'screening'}

    # CORRECTION: Configurer le mock pour retourner des objets avec un attribut 'id' sérialisable
    mock_job1 = MagicMock()
    mock_job1.id = "mock_rob_job_1"
    mock_job2 = MagicMock()
    mock_job2.id = "mock_rob_job_2" # CORRECTION: Le mock doit retourner un objet avec un attribut 'id'
    mock_enqueue.side_effect = [mock_job1, mock_job2]

    resp = client.post('/api/projects', data=json.dumps(project_data), content_type='application/json')
    project_id = json.loads(resp.data)['id']

    rob_payload = {"article_ids": ["pmid100", "pmid200"]}

    # ACT
    response = client.post(f'/api/projects/{project_id}/run-rob-analysis', data=json.dumps(rob_payload), content_type='application/json')

    # ASSERT
    assert response.status_code == 202
    response_data = response.get_json() # type: ignore
    assert 'job_ids' in response_data
    assert len(response_data['job_ids']) == 2 # Vérifie le nombre de tâches, pas les IDs exacts

    assert mock_enqueue.call_count == 2 # Doit être appelé pour pmid100 ET pmid200
    
    # AMÉLIORATION: Assertion plus robuste.
    calls = mock_enqueue.call_args_list
    called_article_ids = {call.kwargs['article_id'] for call in calls}
    assert called_article_ids == {"pmid100", "pmid200"}