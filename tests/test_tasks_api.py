# tests/test_tasks_api.py

import json
import uuid
import pytest
from datetime import datetime, timedelta
from unittest import mock
from unittest.mock import patch, MagicMock, ANY

from utils.models import Project
from utils.app_globals import redis_conn # Import redis_conn

@pytest.fixture
def test_project(db_session):
    """Fixture pour créer un projet de test réutilisable."""
    project = Project(id=str(uuid.uuid4()), name="Test Project for Tasks")
    db_session.add(project)
    db_session.flush()
    return project

def test_search_returns_task_id(client, test_project):
    """
    Vérifie que la route POST /api/search retourne bien un task_id.
    """
    search_data = {
        "project_id": test_project.id,
        "query": "diabetes",
        "databases": ["pubmed"],
        "max_results_per_db": 10
    }

    # 3. Appeler la route et vérifier la réponse
    response = client.post('/api/search', data=json.dumps(search_data), content_type='application/json')

    # 4. Assertions
    assert response.status_code == 202, "La route devrait retourner un statut 202 Accepted"
    response_data = response.get_json() # type: ignore
    assert 'job_id' in response_data, "La réponse JSON doit contenir une clé 'job_id'"
    assert isinstance(response_data['job_id'], str), "Le job_id doit être une chaîne de caractères"
    assert len(response_data['job_id']) > 10, "Le job_id doit avoir une longueur raisonnable"

def test_run_discussion_draft_returns_task_id(client, test_project):
    """
    Vérifie que la route POST /api/projects/<id>/run-discussion-draft retourne un task_id.
    """
    response = client.post(f'/api/projects/{test_project.id}/run-discussion-draft', content_type='application/json')
    assert response.status_code == 202
    response_data = response.get_json() # type: ignore
    assert 'job_id' in response_data
    assert response_data['message'] == 'Génération du brouillon de discussion lancée'

def test_run_knowledge_graph_returns_task_id(client, test_project):
    """
    Vérifie que la route POST /api/projects/<id>/run-knowledge-graph retourne un job_id.
    """
    response = client.post(f'/api/projects/{test_project.id}/run-knowledge-graph', content_type='application/json')
    assert response.status_code == 202
    response_data = response.get_json()
    assert 'task_id' in response_data
    assert response_data['message'] == 'Génération du graphe de connaissances lancée'

def test_add_manual_articles_returns_task_id(client, test_project):
    """
    Vérifie que la route POST /api/projects/<id>/add-manual-articles retourne un job_id.
    """
    articles_data = {
        "items": [
            {"title": "Article 1", "abstract": "Abstract 1"},
            {"title": "Article 2", "abstract": "Abstract 2"}
        ]
    }

    response = client.post(f'/api/projects/{test_project.id}/add-manual-articles', data=json.dumps(articles_data), content_type='application/json')
    assert response.status_code == 202
    response_data = response.get_json() # type: ignore
    assert 'job_id' in response_data
    assert 'Ajout de 2 article(s)' in response_data['message']

def test_cancel_task(client):
    """
    Vérifie que la route d'annulation de tâche répond correctement.
    """
    # Patch Job.fetch et la connexion qu'il utilise en interne.
    mock_get_redis = patch('api.tasks.redis_conn', new=MagicMock())
    with patch('rq.job.Job.fetch') as mock_fetch:
        mock_job = MagicMock()
        mock_fetch.return_value = mock_job
        mock_job.cancel.return_value = None # simule la méthode cancel()
        
        fake_task_id = str(uuid.uuid4())
        response = client.post(f'/api/tasks/{fake_task_id}/cancel') # La route est dans api/tasks.py
        
        assert response.status_code == 200
        assert response.get_json()['message'] == "Demande d_annulation envoyée."
        mock_fetch.assert_called_once_with(fake_task_id, connection=ANY)
        mock_job.cancel.assert_called_once()

def test_get_tasks_status(client):
    """
    Vérifie que la route GET /api/tasks/status retourne une liste de tâches.
    Ce test utilise un mock pour simuler des tâches dans les files RQ.
    """
    now = datetime.utcnow()
    
    # Créer des objets Job simulés avec des attributs réalistes
    mock_started_job = MagicMock()
    mock_started_job.id = 'task_started_1'
    mock_started_job.description = 'Analyse en cours'
    mock_started_job.get_status.return_value = 'started'
    mock_started_job.started_at = now - timedelta(minutes=1)
    mock_started_job.created_at = now - timedelta(minutes=2)
    mock_started_job.ended_at = None
    mock_started_job.exc_info = None
    
    mock_queued_job = MagicMock()
    mock_queued_job.id = 'task_queued_1'
    mock_queued_job.description = 'Indexation en attente'
    mock_queued_job.get_status.return_value = 'queued'
    mock_queued_job.started_at = None
    mock_queued_job.created_at = now
    mock_queued_job.ended_at = None
    mock_queued_job.exc_info = None
    
    # 1. Simuler des tâches dans différentes files (en cours, terminée, etc.)
    with patch('api.tasks.Job.fetch_many') as mock_fetch_many:
        # Simuler la réponse de fetch_many pour chaque type de registre
        # La fonction get_all_tasks_status appelle fetch_many plusieurs fois par queue:
        # 1. started_job_registry
        # 2. get_job_ids() (pour les queued jobs)
        # 3. finished_job_registry
        # 4. failed_job_registry 
        # Et cela pour chaque queue (processing_queue, synthesis_queue, analysis_queue, background_queue)
        # Pour ce test, nous allons simuler les réponses pour la première queue seulement
        # et des listes vides pour les appels suivants pour les autres queues.
        mock_fetch_many.side_effect = [
            [mock_started_job], # processing_queue.started
            [mock_queued_job],  # processing_queue.queued
            [],                 # processing_queue.finished
            [],                 # processing_queue.failed

            # Répéter des listes vides pour les autres queues
            [], [], [], [], # synthesis_queue
            [], [], [], [], # analysis_queue
            [], [], [], [], # background_queue
            [], [], [], []  # <-- AJOUTEZ CETTE LIGNE (pour extension_queue)
        ]
        
        # 2. Appeler la route
        response = client.get('/api/tasks/status')
        
        # 3. Assertions
        assert response.status_code == 200
        tasks_data = response.get_json()
        assert isinstance(tasks_data, list)
        assert len(tasks_data) == 2
        
        # Vérifier que la tâche la plus récente (queued) est bien la première
        assert tasks_data[0]['id'] == 'task_queued_1'
        assert tasks_data[0]['status'] == 'queued'
        assert tasks_data[1]['id'] == 'task_started_1'
        assert tasks_data[1]['status'] == 'started'
