# tests/test_e2e_workflow.py
import pytest
import json
import time
import uuid # Added import
from unittest.mock import patch, MagicMock
from utils.models import Project, SearchResult, Extraction, AnalysisProfile

# Ce test simule le workflow complet d'un utilisateur.
# C'est la preuve la plus forte que votre application fonctionne comme un tout cohérent.

def test_full_end_to_end_workflow(client, db_session):
    """
    Simule un workflow complet :
    1. Création d'un projet.
    2. Ajout d'articles (simulé).
    3. Prise de décision de screening.
    4. Lancement d'une synthèse.
    5. Export des résultats pour la thèse.
    """
    # === ÉTAPE 1: Création du Projet ===
    project_data = {
        "name": "E2E Workflow Project",
        "description": "A full workflow test",
        "mode": "screening"
    }
    response = client.post('/api/projects', data=json.dumps(project_data), content_type='application/json')
    assert response.status_code == 201
    project_id = response.get_json()['id']
    
    # === ÉTAPE 2: Ajout d'articles (on simule le résultat d'une recherche) ===
    articles_to_add = [
        SearchResult(project_id=project_id, article_id="e2e_pmid_1", title="Article 1 to include"),
        SearchResult(project_id=project_id, article_id="e2e_pmid_2", title="Article 2 to exclude")
    ]
    db_session.add_all(articles_to_add)
    # Créer les extractions correspondantes
    extractions_to_add = [
        Extraction(project_id=project_id, pmid="e2e_pmid_1"),
        Extraction(project_id=project_id, pmid="e2e_pmid_2")
    ]
    db_session.add_all(extractions_to_add)
    db_session.flush()
    
    # === ÉTAPE 3: Prise de décision de screening ===
    extraction_to_include = db_session.query(Extraction).filter_by(project_id=project_id, pmid="e2e_pmid_1").one()
    decision_data = {"decision": "include", "evaluator": "user1"}
    response = client.put(f'/api/projects/{project_id}/extractions/{extraction_to_include.id}/decision', data=json.dumps(decision_data), content_type='application/json')
    assert response.status_code == 200
    
    # === ÉTAPE 4: Lancement d'une synthèse (on s'assure que la tâche est bien mise en file) ===
    # Il faut un profil d'analyse
    profile = AnalysisProfile(name=f"Default Profile E2E - {uuid.uuid4().hex}", is_custom=False)
    db_session.add(profile)
    db_session.flush()
    profile_id = profile.id
    
    synthesis_data = {"profile": profile_id}
    # On utilise "patch" pour vérifier que la bonne tâche est appelée, sans l'exécuter.
    with patch('server_v4_complete.synthesis_queue.enqueue') as mock_enqueue:
        # CORRECTION: Le mock doit retourner un objet avec un attribut .id sérialisable
        mock_job = MagicMock()
        mock_job.id = "mock_job_id_123"
        mock_enqueue.return_value = mock_job

        response = client.post(f'/api/projects/{project_id}/run-synthesis', data=json.dumps(synthesis_data), content_type='application/json')
        assert response.status_code == 202
        # Vérifie que la fonction `run_synthesis_task` a bien été appelée
        mock_enqueue.assert_called_once()
        # On peut même vérifier les arguments si besoin
        args, kwargs = mock_enqueue.call_args
        assert kwargs['project_id'] == project_id
        
    # === ÉTAPE 5: Export des résultats pour la thèse ===
    # L'export ne devrait contenir que l'article "inclus"
    response = client.get(f'/api/projects/{project_id}/export/thesis')
    assert response.status_code == 200
    assert response.mimetype == 'application/zip'
    assert 'export_these' in response.headers['Content-Disposition']