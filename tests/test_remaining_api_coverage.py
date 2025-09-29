# teststest_remaining_api_coverage.py

import pytest
import json
import uuid
from unittest.mock import patch, MagicMock

# Import des modèles nécessaires
from utils.models import Project, Grid, Prompt, Extraction
# Import des tâches pour les mocks
from tasks_v4_complete import pull_ollama_model_task, run_extension_task



# =================================================================
# 1. Tests pour le CRUD des Grilles et Prompts
# =================================================================

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

def test_api_settings_endpoints(client):
    """
    Teste les routes de l'API de paramètres (Settings).
    """
    # --- 1. GET apisettingsprofiles (Mocke la lecture du fichier profiles.json) ---
    mock_json_data = {"profiles": [{"id": "test_profile", "name": "Test Profile"}]}
    # Mocker la fonction qui lit le fichier
    with patch("builtins.open", new_callable=MagicMock) as mock_open:
        mock_open.return_value.read.return_value = json.dumps(mock_json_data)
        response_profiles = client.get('/api/settings/profiles') # La route est dans server_v4_complete.py
    
    assert response_profiles.status_code == 200
    assert response_profiles.json == mock_json_data

def test_api_admin_endpoints(client):
    """
    Teste les routes de l'API d'administration (Ollama pull, Queue clear).
    """
    from unittest.mock import ANY
    # --- 1. POST /api/ollama/pull (Vérifie la mise en file) ---
    with patch('backend.server_v4_complete.models_queue.enqueue') as mock_enqueue:
        mock_job = MagicMock()
        mock_job.get_id.return_value = "mock_pull_task_id"
        mock_enqueue.return_value = mock_job
        
        response_pull = client.post('/api/ollama/pull', json={'model': 'test-model:latest'})
        
        assert response_pull.status_code == 200
        response_data = response_pull.json # type: ignore
        assert 'job_id' in response_data
        assert response_data['job_id'] == "mock_pull_task_id"
        # Vérifie que la bonne tâche a été appelée avec le bon argument
        mock_enqueue.assert_called_with( # Utiliser assert_called_with pour ignorer les autres appels potentiels
            ANY, # On ignore la référence de la fonction
            'test-model:latest', # On vérifie les arguments
            job_timeout='30m'
        )

    # --- 2. POST /api/queues/clear (Vérifie l'appel .empty()) ---
    # On mock la méthode .empty() de l'objet 'processing_queue' là où elle est utilisée
    with patch('backend.server_v4_complete.processing_queue.empty') as mock_queue_empty:
        response_clear = client.post('/api/admin/queues/clear', json={'queue_name': 'analylit_processing_v4'})
        
        assert response_clear.status_code == 200
        assert "vidés" in response_clear.json['message']
        mock_queue_empty.assert_called_once() # Vérifie que la file a bien été vidée

    # --- 3. POST apiqueuesclear (Test échec) ---
    response_clear_fail = client.post('/api/queues/clear', json={'queue_name': 'file_inexistante'})
    assert response_clear_fail.status_code == 404
    assert "non trouvée" in response_clear_fail.json['error']

# =================================================================
# 4. Tests pour l'Extension API
# =================================================================

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
        response = client.post('/api/extensions/run', json=payload)

        assert response.status_code == 202
        assert response.json['task_id'] == "mock_extension_task_id"
        
        # Vérifie que la tâche générique 'run_extension_task' est appelée
        mock_enqueue.assert_called_once_with(
            run_extension_task,
            project_id="projet_ext_123",
            extension_name="maSuperExtension",
            job_timeout=1800,
            result_ttl=3600
        )