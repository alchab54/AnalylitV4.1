# tests/test_missing_coverage.py

import pytest
import json
import uuid
from datetime import datetime, timedelta

# Import des modèles nécessaires depuis votre application
from utils.models import Project, AnalysisProfile, SearchResult, ChatMessage

# --- Fixture pour un projet de test (utilisée par plusieurs tests) ---

@pytest.fixture
def setup_project(db_session)
    """Crée un projet simple et le stocke en BDD."""
    project = Project(
        id=str(uuid.uuid4()),
        name=Projet de Test pour Couverture
    )
    db_session.add(project)
    db_session.commit()
    return project

# =================================================================
# 1. Tests pour le CRUD des Profils d'Analyse
# =================================================================

def test_api_analysis_profiles_crud_workflow(client, db_session)
    """
    Teste le cycle de vie complet (CRUD) pour /api/analysis-profiles.
    1. POST (Créer) un profil personnalisé.
    2. GET (Lire) tous les profils et retrouver le nouveau.
    3. PUT (Mettre à jour) le profil personnalisé.
    4. DELETE (Supprimer) le profil personnalisé.
    5. DELETE (Échec) la suppression d'un profil par défaut.
    """
    
    # --- 1. POST (Créer) ---
    profile_data = {
        name Mon Profil IA Personnalisé,
        is_custom True,
        preprocess_model modele-rapidelatest,
        extract_model modele-moyenlatest,
        synthesis_model modele-puissantlatest
    }
    response_post = client.post('apianalysis-profiles', json=profile_data)
    assert response_post.status_code == 201
    created_profile = response_post.json
    
    assert created_profile['name'] == profile_data['name']
    assert created_profile['is_custom'] is True
    assert 'id' in created_profile
    profile_id = created_profile['id']

    # --- 2. GET (Lire) ---
    response_get = client.get('apianalysis-profiles')
    assert response_get.status_code == 200
    profiles_list = response_get.json
    
    # Vérifie que le profil créé est bien dans la liste
    assert isinstance(profiles_list, list)
    assert any(p['id'] == profile_id for p in profiles_list)

    # --- 3. PUT (Mettre à jour) ---
    update_data = {
        name Profil Personnalisé Mis à Jour,
        preprocess_model modele-rapide-v2latest
    }
    response_put = client.put(f'apianalysis-profiles{profile_id}', json=update_data)
    assert response_put.status_code == 200
    updated_profile = response_put.json
    
    assert updated_profile['name'] == update_data['name']
    assert updated_profile['preprocess_model'] == update_data['preprocess_model']
    # Vérifie que les autres champs n'ont pas été écrasés
    assert updated_profile['extract_model'] == profile_data['extract_model']

    # --- 4. DELETE (Supprimer le profil personnalisé) ---
    response_del_custom = client.delete(f'apianalysis-profiles{profile_id}')
    assert response_del_custom.status_code == 200
    assert response_del_custom.json['message'] == Profil supprimé

    # Vérifie qu'il n'est plus en BDD
    deleted = db_session.get(AnalysisProfile, profile_id)
    assert deleted is None

    # --- 5. DELETE (Échec sur profil par défaut) ---
    # Ajoute un profil par défaut
    default_profile = AnalysisProfile(
        id=str(uuid.uuid4()),
        name=Profil Standard (Défaut),
        is_custom=False # Important
    )
    db_session.add(default_profile)
    db_session.commit()

    response_del_default = client.delete(f'apianalysis-profiles{default_profile.id}')
    assert response_del_default.status_code == 403
    assert Impossible de supprimer un profil par défaut in response_del_default.json['error']

# =================================================================
# 2. Tests pour la Pagination des Résultats de Recherche
# =================================================================

def test_api_get_search_results_pagination(client, db_session, setup_project)
    """
    Teste la pagination de la route GET /api/projects/<id>/search-results.
    Crée 25 articles et les récupère par pages de 10.
    """
    project_id = setup_project.id
    
    # --- Setup  Créer 25 résultats de recherche ---
    articles_to_create = []
    for i in range(25)
        articles_to_create.append(
            SearchResult(
                id=str(uuid.uuid4()),
                project_id=project_id,
                article_id=fPMID{i},
                title=fArticle Titre {i}
            )
        )
    db_session.add_all(articles_to_create)
    db_session.commit()

    # --- Test Page 1 ---
    response_p1 = client.get(f'apiprojects{project_id}search-resultspage=1&per_page=10')
    assert response_p1.status_code == 200
    data_p1 = response_p1.json
    
    assert data_p1['total'] == 25
    assert data_p1['page'] == 1
    assert data_p1['per_page'] == 10
    assert data_p1['total_pages'] == 3  # 25 articles  10 par page = 3 pages
    assert len(data_p1['results']) == 10
    assert data_p1['results'][0]['title'] == Article Titre 0 # Vérifie l'ordre

    # --- Test Page 2 ---
    response_p2 = client.get(f'apiprojects{project_id}search-resultspage=2&per_page=10')
    assert response_p2.status_code == 200
    data_p2 = response_p2.json
    
    assert data_p2['page'] == 2
    assert len(data_p2['results']) == 10
    assert data_p2['results'][0]['title'] == Article Titre 10 # Vérifie l'offset

    # --- Test Page 3 (Partielle) ---
    response_p3 = client.get(f'apiprojects{project_id}search-resultspage=3&per_page=10')
    assert response_p3.status_code == 200
    data_p3 = response_p3.json
    
    assert data_p3['page'] == 3
    assert data_p3['total_pages'] == 3
    assert len(data_p3['results']) == 5 # Il ne reste que 5 articles
    assert data_p3['results'][0]['title'] == Article Titre 20

    # --- Test Page 4 (Vide) ---
    response_p4 = client.get(f'apiprojects{project_id}search-resultspage=4&per_page=10')
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
        role=user,
        content=Quelle est ma question ,
        timestamp=now - timedelta(minutes=5) # Le plus ancien
    )
    msg3_final = ChatMessage(
        id=str(uuid.uuid4()),
        project_id=project_id,
        role=user,
        content=Merci !,
        timestamp=now # Le plus récent
    )
    msg2_assistant = ChatMessage(
        id=str(uuid.uuid4()),
        project_id=project_id,
        role=assistant,
        content=Voici la réponse.,
        timestamp=now - timedelta(minutes=2) # Au milieu
    )
    
    db_session.add_all([msg1_user, msg3_final, msg2_assistant])
    
    # Créer un message pour un AUTRE projet (qui ne doit pas apparaître)
    other_project = Project(id=str(uuid.uuid4()), name=Autre Projet)
    msg_other = ChatMessage(
        id=str(uuid.uuid4()),
        project_id=other_project.id,
        role=user,
        content="Message d'un autre projet"
    )
    db_session.add(other_project)
    db_session.add(msg_other)
    db_session.commit()

    # --- Test GET History ---
    response = client.get(f'apiprojects{project_id}chat-history')
    assert response.status_code == 200
    history = response.json
    
    assert isinstance(history, list)
    # Doit contenir 3 messages, et exclure celui de l'autre projet
    assert len(history) == 3
    
    # --- Vérifier l'ordre chronologique ---
    assert history[0]['content'] == Quelle est ma question 
    assert history[0]['role'] == user
    
    assert history[1]['content'] == Voici la réponse.
    assert history[1]['role'] == assistant
    
    assert history[2]['content'] == Merci !
    assert history[2]['role'] == user