import pytest
import uuid
from unittest.mock import patch, MagicMock
from sqlalchemy import text

# Import de la tâche à tester
from tasks_v4_complete import multi_database_search_task

@pytest.fixture
def mock_db_session(session):
    """Fixture qui utilise la session de test existante."""
    return session

def test_multi_database_search_task_expert_mode(mock_db_session, mocker):
    """
    Teste le mode 'Recherche Experte' où des requêtes spécifiques sont fournies
    pour chaque base de données.
    """
    project_id = str(uuid.uuid4())
    mock_db_session.execute(text("INSERT INTO projects (id, name) VALUES (:id, :name)"), {'id': project_id, 'name': 'Test Project Expert'})
    mock_db_session.commit()

    databases = ['pubmed', 'arxiv']
    
    # La requête simple est fournie mais doit être ignorée en mode expert
    simple_query = "ignored query"
    
    # Requêtes expertes spécifiques
    expert_queries = {
        "pubmed": "(cancer[MeSH Terms] AND review[pt])",
        "arxiv": 'ti:"diabetes" AND abs:"treatment"'
    }

    # Mock des méthodes de recherche du db_manager
    mock_search_pubmed = mocker.patch('utils.fetchers.DatabaseManager.search_pubmed', return_value=[])
    mock_search_arxiv = mocker.patch('utils.fetchers.DatabaseManager.search_arxiv', return_value=[])
    mocker.patch('tasks_v4_complete.send_project_notification')

    # Exécute la tâche
    multi_database_search_task.__wrapped__(
        mock_db_session, 
        project_id=project_id, 
        query=simple_query, 
        databases=databases, 
        max_results_per_db=50,
        expert_queries=expert_queries
    )

    # Assertions
    # Vérifie que search_pubmed a été appelé avec la requête experte pubmed
    mock_search_pubmed.assert_called_once_with(expert_queries["pubmed"], 50)
    
    # Vérifie que search_arxiv a été appelé avec la requête experte arxiv
    mock_search_arxiv.assert_called_once_with(expert_queries["arxiv"], 50)

def test_multi_database_search_task_expert_mode_partial(mock_db_session, mocker):
    """
    Teste le mode 'Recherche Experte' où une source est cochée 
    mais le champ de requête est laissé vide. La source doit être ignorée.
    """
    project_id = str(uuid.uuid4())
    mock_db_session.execute(text("INSERT INTO projects (id, name) VALUES (:id, :name)"), {'id': project_id, 'name': 'Test Project Partial'})
    mock_db_session.commit()

    databases = ['pubmed', 'arxiv'] # L'utilisateur a coché les deux
    simple_query = "ignored query"
    
    # L'utilisateur a rempli pubmed, mais pas arxiv
    expert_queries = {
        "pubmed": "expert query for pubmed",
        "arxiv": "  " # Champ laissé vide ou avec des espaces
    }

    # Mock des méthodes de recherche
    mock_search_pubmed = mocker.patch('utils.fetchers.DatabaseManager.search_pubmed', return_value=[])
    mock_search_arxiv = mocker.patch('utils.fetchers.DatabaseManager.search_arxiv', return_value=[])
    mocker.patch('tasks_v4_complete.send_project_notification')

    # Exécute la tâche
    multi_database_search_task.__wrapped__(
        mock_db_session, 
        project_id=project_id, 
        query=simple_query, 
        databases=databases, 
        max_results_per_db=50,
        expert_queries=expert_queries
    )

    # Vérifie que pubmed a bien été appelé
    mock_search_pubmed.assert_called_once_with("expert query for pubmed", 50)
    
    # Vérifie que arxiv n'a PAS été appelé, car sa requête était vide
    mock_search_arxiv.assert_not_called()