# teststest_remaining_api_coverage.py

import pytest
import json
import uuid
from unittest.mock import patch, MagicMock

# Import des modèles nécessaires
from utils.models import Project, Grid, Prompt, Extraction
from utils.helpers import seed_default_data
# Import des tâches pour les mocks
from backend.tasks_v4_complete import pull_ollama_model_task, run_extension_task



# =================================================================
# 1. Tests pour le CRUD des Grilles et Prompts
# =================================================================

@pytest.mark.usefixtures("mock_redis_and_rq")
def test_api_grids_create_and_update(client, db_session, setup_project):
    """
    Teste le workflow de création manuelle (POST) et de mise à jour (PUT) 
    d'une grille d'extraction.
   """
    project_id = setup_project.id
    
    # --- 1. POST (Créer manuellement) ---
    grid_data = {
        "name": "Grille de Test Manuelle",
        "fields": [
            {"name": "Population", "type": "text"},
            {"name": "Score", "type": "number"}
        ]
    }
    response_post = client.post(f'/api/projects/{project_id}/grids', json=grid_data)
    
    assert response_post.status_code == 201
    created_grid = response_post.json
    assert created_grid['name'] == "Grille de Test Manuelle"
    assert len(created_grid['fields']) == 2
    grid_id = created_grid['id']

    # --- 2. PUT (Mettre à jour) ---
    update_data = {
        "name": "Grille Manuelle Mise à Jour",
        "fields": [
            {"name": "Population", "type": "text"},
            {"name": "Score", "type": "number"},
            {"name": "Conclusion", "type": "textarea"} # Ajout d'un champ
        ]
    }
    response_put = client.put(f'/api/projects/{project_id}/grids/{grid_id}', json=update_data)
    
    assert response_put.status_code == 200
    updated_grid = response_put.json
    assert updated_grid['name'] == "Grille Manuelle Mise à Jour"
    assert len(updated_grid['fields']) == 3

    # Vérification en BDD
    grid_from_db = db_session.get(Grid, grid_id)
    assert grid_from_db.name == "Grille Manuelle Mise à Jour"
    assert len(json.loads(grid_from_db.fields)) == 3

@pytest.mark.usefixtures("mock_redis_and_rq")
def test_api_prompt_update(client, db_session):
    """
    Teste la mise à jour d'un prompt spécifique via PUT /api/prompts/<id>.
    """
    # --- Setup  Créer un prompt initial en BDD ---
    prompt = Prompt(
        id=str(uuid.uuid4()),
        name="test_prompt_to_update",
        content="Ancien template."
    )
    db_session.add(prompt)
    db_session.flush()
    prompt_id = prompt.id

    # --- 1. PUT (Mettre à jour) ---
    update_data = {"content": "Nouveau template mis à jour."}
    response_put = client.put(f'/api/prompts/{prompt_id}', json=update_data)

    assert response_put.status_code == 200
    assert response_put.json['content'] == "Nouveau template mis à jour."

    # Vérification en BDD
    db_session.refresh(prompt)
    assert prompt.content == "Nouveau template mis à jour."

# =================================================================
# 2. Tests pour la Consultation de Données
# =================================================================

@pytest.mark.usefixtures("mock_redis_and_rq")
def test_api_get_extractions(client, db_session, setup_project):
    """
    Teste la route GET apiprojectsidextractions pour lister les extractions.
    """
    project_id = setup_project.id
    
    # --- Setup  Créer 2 extractions pour ce projet ---
    ext1 = Extraction(id=str(uuid.uuid4()), project_id=project_id, pmid="pmid1", title="Titre 1")
    ext2 = Extraction(id=str(uuid.uuid4()), project_id=project_id, pmid="pmid2", title="Titre 2")
    db_session.add_all([ext1, ext2])
    
    db_session.flush()

    # --- 1. GET (Lire) ---
    response_get = client.get(f'/api/projects/{project_id}/extractions')
    assert response_get.status_code == 200
    extractions_list = response_get.json
    
    assert isinstance(extractions_list, list)
    assert len(extractions_list) == 2 # Ne doit pas inclure l'extraction de l'autre projet
    
    pmids_in_response = {ext['pmid'] for ext in extractions_list}
    assert "pmid1" in pmids_in_response
    assert "pmid2" in pmids_in_response

# =================================================================
# 3. Tests pour les Paramètres et l'Administration
# =================================================================

@pytest.mark.usefixtures("mock_redis_and_rq")
def test_api_settings_endpoints(client, db_session):
    """
    Teste les routes de l'API de paramètres (Settings).
    """
    seed_default_data(db_session)
    response = client.get('/api/analysis-profiles')
    assert response.status_code == 200
    assert len(response.json) > 0 # L'assertion devient plus robuste
    assert response.json[0]['name'] == 'Standard'

@pytest.mark.usefixtures("mock_redis_and_rq")
def test_api_admin_endpoints(client):
    """
    Teste les routes de l'API d'administration (Ollama pull, Queue clear).
    """
    from unittest.mock import ANY
    from backend.tasks_v4_complete import pull_ollama_model_task

    # --- 1. POST /api/pull-models (Vérifie la mise en file) ---
    with patch('api.admin.models_queue.enqueue') as mock_enqueue:
        mock_job = MagicMock()
        mock_job.get_id.return_value = "mock_pull_task_id"
        mock_enqueue.return_value = mock_job
        
        response_pull = client.post('/api/pull-models', json={'model_name': 'test-model:latest'})

        assert response_pull.status_code == 202
        response_data = response_pull.json
        assert 'task_id' in response_data
        assert response_data['task_id'] == "mock_pull_task_id"
        
        mock_enqueue.assert_called_once_with(
            pull_ollama_model_task,
            'test-model:latest',
            job_timeout='30m'
        )

    # --- 2. POST /api/queues/clear (Vérifie l'appel .empty()) ---
    with patch('rq.Queue.empty') as mock_queue_empty:
        mock_queue_empty.return_value = 5 # Simule la suppression de 5 tâches
        response_clear = client.post('/api/queues/clear', json={'queue_name': 'analylit_processing_v4'})
        
        assert response_clear.status_code == 200
        assert "vidée" in response_clear.json['message']
        assert response_clear.json['cleared_tasks'] == 5
        mock_queue_empty.assert_called_once()

    # --- 3. POST /api/queues/clear (Test avec une file vide) ---
    with patch('rq.Queue.empty') as mock_queue_empty_2:
        mock_queue_empty_2.return_value = 0
        response_clear_fail = client.post('/api/queues/clear', json={'queue_name': 'file_inexistante'})
        assert response_clear_fail.status_code == 200
        assert response_clear_fail.json['cleared_tasks'] == 0

# =================================================================
# 4. Tests pour l'Extension API
# =================================================================

@pytest.mark.usefixtures("mock_redis_and_rq")
def test_api_extensions_endpoint(client):
    """
    Teste l'endpoint générique POST /api/extensions.
    """
    with patch('api.extensions.extension_queue.enqueue') as mock_enqueue:
        mock_job = MagicMock()
        mock_job.id = "mock_extension_task_id"
        mock_enqueue.return_value = mock_job

        payload = {
            "project_id": "projet_ext_123",
            "extension_name": "maSuperExtension"
        }   
        response = client.post('/api/extensions', json=payload) # Fixed URL

        assert response.status_code == 202
        assert response.json['job_id'] == "mock_extension_task_id"
        
        # ✅ Remplacer par une vérification des arguments
        assert mock_enqueue.call_count == 1
        call_args = mock_enqueue.call_args
        assert call_args.kwargs['project_id'] == 'projet_ext_123'
        assert call_args.kwargs['extension_name'] == 'maSuperExtension'