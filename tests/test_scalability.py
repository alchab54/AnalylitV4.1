# tests/test_scalability.py

import pytest
import uuid
import json
from unittest.mock import patch, MagicMock

# Imports des modèles et tâches
from utils.models import Project, SearchResult
from tasks_v4_complete import add_manual_articles_task, run_meta_analysis_task

# Ce fichier teste la capacité de l'application à gérer de grands volumes de données.

@pytest.fixture
def large_project(db_session):
    """
    Crée un projet et simule la présence de 10 000 articles dans la base de données.
    """
    project = Project(name="Projet Scalabilité (10k articles)")
    db_session.add(project)
    db_session.commit()

    # Utiliser une insertion en masse pour la performance
    articles_to_insert = [
        SearchResult(
            id=str(uuid.uuid4()),
            project_id=project.id,
            article_id=f"PMID_{i}",
            title=f"Article de test de charge {i}",
            abstract=f"Résumé de l'article {i}."
        ) for i in range(10000)
    ]
    db_session.bulk_save_objects(articles_to_insert)
    db_session.commit()
    
    return project.id

def test_api_response_time_with_large_dataset(client, large_project):
    """
    Test de performance : Mesure le temps de réponse de l'API pour lister
    les résultats d'un projet contenant 10 000 articles.
    Le temps de réponse doit rester raisonnable grâce à la pagination.
    """
    project_id = large_project

    # L'appel API ne doit pas charger les 10 000 articles, seulement la première page.
    response = client.get(f'/api/projects/{project_id}/search-results?page=1&per_page=50')
    
    assert response.status_code == 200
    # Vérifier que la pagination fonctionne et ne retourne que 50 résultats
    data = response.get_json()
    assert len(data['results']) == 50
    assert data['total'] == 10000
    
    # Assertion de performance : le temps de réponse doit être inférieur à 2 secondes.
    # C'est une hypothèse généreuse, mais elle détectera les régressions majeures.
    assert response.elapsed.total_seconds() < 2.0
    print(f"\n[OK] Performance API : Temps de réponse pour 10k articles paginés : {response.elapsed.total_seconds():.2f}s")


def test_analysis_task_on_large_dataset(db_session, large_project, mocker):
    """
    Test de scalabilité : Exécute une tâche d'analyse (méta-analyse)
    sur un projet avec 10 000 extractions simulées.
    """
    project_id = large_project
    
    # Simuler 10 000 extractions avec des scores
    # On mock la requête SQL pour ne pas réellement insérer 10k extractions
    mock_scores = [7.5] * 10000
    mocker.patch('sqlalchemy.orm.session.Session.execute').return_value.scalars.return_value.all.return_value = mock_scores
    mocker.patch('tasks_v4_complete.send_project_notification')

    # Exécuter la tâche de méta-analyse
    run_meta_analysis_task.__wrapped__(db_session, project_id)

    # Vérifier que l'analyse a réussi et que les calculs sont corrects
    project = db_session.get(Project, project_id)
    results = json.loads(project.analysis_result)
    
    assert results['n_articles'] == 10000
    assert results['mean_score'] == pytest.approx(7.5)
    print(f"\n[OK] Scalabilité Tâches : Méta-analyse sur 10k extractions simulées réussie.")