# tests/test_validation_workflow.py
import pytest
import json
import uuid
import io 
from unittest.mock import patch, MagicMock
from utils.models import Project, SearchResult, Extraction

# ----- SETUP DES DONNÉES DE TEST -----
@pytest.fixture
def setup_double_coding_data(db_session, client):
    """Crée un projet et deux articles pour tester le double codage."""
    project = Project(name="Project for Validation Test")
    db_session.add(project)
    db_session.flush()

    articles_data = [
        {"id": "pmid_kappa_1", "title": "Article A"},
        {"id": "pmid_kappa_2", "title": "Article B"},
    ]

    for article_data in articles_data:
        article = SearchResult(project_id=project.id, article_id=article_data["id"], title=article_data["title"])
        extraction = Extraction(project_id=project.id, pmid=article_data["id"], validations=json.dumps({"evaluator1": "include"}))
        db_session.add(article)
        db_session.add(extraction)
    
    db_session.flush()
    return project.id

# ----- TESTS DU WORKFLOW DE VALIDATION ET KAPPA -----

@pytest.mark.usefixtures("mock_redis_and_rq")
def test_update_decision_for_second_evaluator(client, db_session, setup_double_coding_data):
    """
    Vérifie que la décision d'un deuxième évaluateur est correctement enregistrée.
    Objectif : Valider le mécanisme de base du double codage.
    """
    project_id = setup_double_coding_data
    
    # Récupérer l'extraction pour le premier article
    extraction = db_session.query(Extraction).filter_by(project_id=project_id, pmid="pmid_kappa_1").first()
    assert extraction is not None

    # Mettre à jour la décision pour le deuxième évaluateur
    response = client.put(
        f'/api/projects/{project_id}/extractions/{extraction.id}/decision',
        data=json.dumps({'decision': 'exclude', 'evaluator': 'evaluator2'}),
        content_type='application/json'
    )

    assert response.status_code == 200
    db_session.refresh(extraction)
    validations = json.loads(extraction.validations)
    
    assert "evaluator1" in validations and validations["evaluator1"] == "include"
    assert "evaluator2" in validations and validations["evaluator2"] == "exclude"

@patch('api.projects.analysis_queue.enqueue')
@pytest.mark.usefixtures("mock_redis_and_rq")
def test_calculate_kappa_job_enqueued(mock_enqueue, client, setup_double_coding_data):
    """
    Vérifie que la tâche de calcul Kappa peut être mise en file d'attente via l'endpoint dédié.
    Objectif : Confirmer que l'analyse de l'accord inter-juges peut être lancée.
    """
    project_id = setup_double_coding_data

    mock_job = MagicMock()
    mock_job.id = "kappa_job_123"
    mock_enqueue.return_value = mock_job

    # Appel de l'API de calcul Kappa
    response = client.post(
        f'/api/projects/{project_id}/calculate-kappa'
    )
    
    assert response.status_code == 202, "L'endpoint de calcul Kappa doit répondre 202."
    assert response.get_json()['job_id'] == "kappa_job_123"
    
    # Vérifier que la bonne tâche a été mise en file d'attente
    from backend.tasks_v4_complete import calculate_kappa_task
    mock_enqueue.assert_called_once_with(
        calculate_kappa_task, 
        project_id=project_id,
        job_timeout='5m'
    )