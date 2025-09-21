import pytest
import json
from unittest.mock import patch
from utils.models import Project, SearchResult, Extraction

# ----- SETUP DES DONNÉES DE TEST -----
@pytest.fixture
def setup_test_data(db_session):
    """Crée un projet, un article et une extraction pour les tests."""
    # Créer un projet
    project = Project(name="Project for RoB Test")
    db_session.add(project)
    db_session.commit()

    # Créer un article associé au projet
    article = SearchResult(
        project_id=project.id,
        article_id="pmid_rob_123",
        title="Test Article for RoB",
        abstract="This is an abstract."
    )
    db_session.add(article)
    db_session.commit()

    # Créer une extraction pour cet article
    extraction = Extraction(
        project_id=project.id,
        pmid="pmid_rob_123"
    )
    db_session.add(extraction)
    db_session.commit()

    return project.id, "pmid_rob_123"

# ----- TESTS DU WORKFLOW DE RISQUE DE BIAIS -----

def test_run_rob_analysis_success(client, setup_test_data):
    """
    Vérifie que l'analyse de risque de biais peut être lancée avec succès pour un article.
    Objectif : Prouver que la fonctionnalité de base est opérationnelle.
    """
    project_id, article_id = setup_test_data
    
    # Simuler l'appel API pour lancer l'analyse
    response = client.post(
        f'/api/projects/{project_id}/run-rob-analysis',
        data=json.dumps({'article_ids': [article_id]}),
        content_type='application/json'
    )

    # Vérifier les résultats
    assert response.status_code == 202, "L'API doit accepter la tâche et répondre 202."
    data = response.get_json()
    assert "message" in data, "La réponse doit contenir un message de confirmation."
    assert "task_ids" in data, "La réponse doit contenir une liste d'IDs de tâches."
    assert len(data['task_ids']) == 1, "Une tâche doit être créée pour un article."
    assert data['message'] == "RoB analysis initiated"

def test_run_rob_analysis_no_articles(client, setup_test_data):
    """
    Vérifie le comportement de l'API lorsqu'aucun article n'est fourni.
    Objectif : Prouver la robustesse de l'API face à une entrée vide.
    """
    project_id, _ = setup_test_data
    
    response = client.post(
        f'/api/projects/{project_id}/run-rob-analysis',
        data=json.dumps({'article_ids': []}),
        content_type='application/json'
    )

    assert response.status_code == 202
    data = response.get_json()
    assert len(data['task_ids']) == 0, "Aucune tâche ne doit être créée si aucun article n'est fourni."

def test_run_rob_analysis_project_not_found(client):
    """
    Vérifie que l'API renvoie une erreur 404 pour un projet inexistant.
    Objectif : Prouver la bonne gestion des erreurs.
    """
    invalid_project_id = "99999999-9999-9999-9999-999999999999"
    response = client.post(
        f'/api/projects/{invalid_project_id}/run-rob-analysis',
        data=json.dumps({'article_ids': ["pmid123"]}),
        content_type='application/json'
    )
    
    # L'erreur 404 est gérée par le wrapper @with_db_session et le serveur Flask
    assert response.status_code == 404, "Doit retourner 404 si le projet n'existe pas."
