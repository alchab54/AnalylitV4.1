# tests/test_missing_coverage.py

import pytest
import json
import uuid
from datetime import datetime, timedelta

# Import des modèles nécessaires depuis votre application
from utils.models import Project, AnalysisProfile, SearchResult, ChatMessage

# --- Fixture pour un projet de test (utilisée par plusieurs tests) ---

# =================================================================
# 1. Tests pour le CRUD des Profils d'Analyse
# =================================================================

# =================================================================
# 2. Tests pour la Pagination des Résultats de Recherche
# =================================================================

def test_api_get_search_results_pagination(client, db_session, setup_project):
    """
    Teste la pagination de la route GET /api/projects/<id>/search-results.
    Crée 25 articles et les récupère par pages de 10.
    """
    project_id = setup_project.id
    
    # --- Setup  Créer 25 résultats de recherche ---
    articles_to_create = []
    for i in range(25):
        articles_to_create.append(
            SearchResult(
                id=str(uuid.uuid4()),
                project_id=project_id,
                article_id=f"PMID{i}",
                title=f"Article Titre {i:02d}"  # Pad with zero for correct sorting
            )
        )
    db_session.add_all(articles_to_create)
    db_session.flush()

    # --- Test Page 1 ---
    response_p1 = client.get(f'/api/projects/{project_id}/search-results?page=1&per_page=10&sort_by=title&sort_order=asc')
    assert response_p1.status_code == 200
    data_p1 = response_p1.json
    
    assert data_p1['total'] == 25
    assert data_p1['page'] == 1
    assert data_p1['per_page'] == 10
    assert data_p1['total_pages'] == 3  # 25 articles  10 par page = 3 pages
    assert len(data_p1['results']) == 10
    assert data_p1['results'][0]['title'] == "Article Titre 00" # Vérifie l'ordre

    # --- Test Page 2 ---
    response_p2 = client.get(f'/api/projects/{project_id}/search-results?page=2&per_page=10&sort_by=title&sort_order=asc')
    assert response_p2.status_code == 200
    data_p2 = response_p2.json
    
    assert data_p2['page'] == 2
    assert len(data_p2['results']) == 10
    assert data_p2['results'][0]['title'] == "Article Titre 10" # Vérifie l'offset

    # --- Test Page 3 (Partielle) ---
    response_p3 = client.get(f'/api/projects/{project_id}/search-results?page=3&per_page=10&sort_by=title&sort_order=asc')
    assert response_p3.status_code == 200
    data_p3 = response_p3.json
    
    assert data_p3['page'] == 3
    assert data_p3['total_pages'] == 3
    assert len(data_p3['results']) == 5 # Il ne reste que 5 articles
    assert data_p3['results'][0]['title'] == "Article Titre 20"

    # --- Test Page 4 (Vide) ---
    response_p4 = client.get(f'/api/projects/{project_id}/search-results?page=4&per_page=10&sort_by=title&sort_order=asc')
    assert response_p4.status_code == 200
    data_p4 = response_p4.json
    assert data_p4['page'] == 4
    assert len(data_p4['results']) == 0 # Page vide

# =================================================================
# 3. Tests pour l'Historique du Chat
# =================================================================

def test_api_get_chat_history(client, db_session, setup_project):
    """
    Teste la récupération de l'historique du chat pour un projet.
    Vérifie que les messages sont retournés dans le bon ordre (chronologique).
    """
    project_id = setup_project.id
    now = datetime.utcnow()

    # --- Setup  Créer 3 messages dans le désordre ---
    msg1_user = ChatMessage(
        id=str(uuid.uuid4()),
        project_id=project_id,
        role="user",
        content="Quelle est ma question ?",
        timestamp=now - timedelta(minutes=5) # Le plus ancien
    )
    msg3_final = ChatMessage(
        id=str(uuid.uuid4()),
        project_id=project_id,
        role="user",
        content="Merci !",
        timestamp=now # Le plus récent
    )
    msg2_assistant = ChatMessage(
        id=str(uuid.uuid4()),
        project_id=project_id,
        role="assistant",
        content="Voici la réponse.",
        timestamp=now - timedelta(minutes=2) # Au milieu
    )
    
    db_session.add_all([msg1_user, msg3_final, msg2_assistant])
    
    db_session.flush()

    # --- Test GET History ---
    response = client.get(f'/api/projects/{project_id}/chat-history')
    assert response.status_code == 200
    history = response.json
    
    assert isinstance(history, list)
    # Doit contenir 3 messages, et exclure celui de l'autre projet
    assert len(history) == 3
    
    # --- Vérifier l'ordre chronologique ---
    assert history[0]['content'] == "Quelle est ma question ?"
    assert history[0]['role'] == "user"
    
    assert history[1]['content'] == "Voici la réponse."
    assert history[1]['role'] == "assistant"
    
    assert history[2]['content'] == "Merci !"
    assert history[2]['role'] == "user"

# =================================================================
# 2. Tests pour la Pagination des Résultats de Recherche
# =================================================================

def test_api_get_search_results_pagination(client, db_session, setup_project):
    """
    Teste la pagination de la route GET /api/projects/<id>/search-results.
    Crée 25 articles et les récupère par pages de 10.
    """
    project_id = setup_project.id
    
    # --- Setup  Créer 25 résultats de recherche ---
    articles_to_create = []
    for i in range(25):
        articles_to_create.append(
            SearchResult(
                id=str(uuid.uuid4()),
                project_id=project_id,
                article_id=f"PMID{i}",
                title=f"Article Titre {i:02d}"
            )
        )
    db_session.add_all(articles_to_create)
    db_session.flush()

    # --- Test Page 1 ---
    response_p1 = client.get(f'/api/projects/{project_id}/search-results?page=1&per_page=10&sort_by=title&sort_order=asc')
    assert response_p1.status_code == 200
    data_p1 = response_p1.json
    
    assert data_p1['total'] == 25
    assert data_p1['page'] == 1
    assert data_p1['per_page'] == 10
    assert data_p1['total_pages'] == 3  # 25 articles  10 par page = 3 pages
    assert len(data_p1['results']) == 10
    assert data_p1['results'][0]['title'] == "Article Titre 00" # Vérifie l'ordre

    # --- Test Page 2 ---
    response_p2 = client.get(f'/api/projects/{project_id}/search-results?page=2&per_page=10&sort_by=title&sort_order=asc')
    assert response_p2.status_code == 200
    data_p2 = response_p2.json
    
    assert data_p2['page'] == 2
    assert len(data_p2['results']) == 10
    assert data_p2['results'][0]['title'] == "Article Titre 10" # Vérifie l'offset

    # --- Test Page 3 (Partielle) ---
    response_p3 = client.get(f'/api/projects/{project_id}/search-results?page=3&per_page=10&sort_by=title&sort_order=asc')
    assert response_p3.status_code == 200
    data_p3 = response_p3.json
    
    assert data_p3['page'] == 3
    assert data_p3['total_pages'] == 3
    assert len(data_p3['results']) == 5 # Il ne reste que 5 articles
    assert data_p3['results'][0]['title'] == "Article Titre 20"

    # --- Test Page 4 (Vide) ---
    response_p4 = client.get(f'/api/projects/{project_id}/search-results?page=4&per_page=10&sort_by=title&sort_order=asc')
    assert response_p4.status_code == 200
    data_p4 = response_p4.json
    assert data_p4['page'] == 4
    assert len(data_p4['results']) == 0 # Page vide

# =================================================================
# 3. Tests pour l'Historique du Chat
# =================================================================

def test_api_get_chat_history(client, db_session, setup_project):
    """
    Teste la récupération de l'historique du chat pour un projet.
    Vérifie que les messages sont retournés dans le bon ordre (chronologique).
    """
    project_id = setup_project.id
    now = datetime.utcnow()

    # --- Setup  Créer 3 messages dans le désordre ---
    msg1_user = ChatMessage(
        id=str(uuid.uuid4()),
        project_id=project_id,
        role="user",
        content="Quelle est ma question ?",
        timestamp=now - timedelta(minutes=5) # Le plus ancien
    )
    msg3_final = ChatMessage(
        id=str(uuid.uuid4()),
        project_id=project_id,
        role="user",
        content="Merci !",
        timestamp=now # Le plus récent
    )
    msg2_assistant = ChatMessage(
        id=str(uuid.uuid4()),
        project_id=project_id,
        role="assistant",
        content="Voici la réponse.",
        timestamp=now - timedelta(minutes=2) # Au milieu
    )
    
    db_session.add_all([msg1_user, msg3_final, msg2_assistant])
    
    db_session.flush()

    # --- Test GET History ---
    response = client.get(f'/api/projects/{project_id}/chat-history')
    assert response.status_code == 200
    history = response.json
    
    assert isinstance(history, list)
    # Doit contenir 3 messages, et exclure celui de l'autre projet
    assert len(history) == 3
    
    # --- Vérifier l'ordre chronologique ---
    assert history[0]['content'] == "Quelle est ma question ?"
    assert history[0]['role'] == "user"
    
    assert history[1]['content'] == "Voici la réponse."
    assert history[1]['role'] == "assistant"
    
    assert history[2]['content'] == "Merci !"
    assert history[2]['role'] == "user"