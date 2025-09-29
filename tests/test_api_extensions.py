# test_api_extensions.py
# Cette suite de tests couvre les endpoints API manquants (Gestion CRUD, Workflows de validation, Rapports, Admin)

import io
import json
import pytest
import uuid
from unittest.mock import patch, MagicMock
from flask.testing import FlaskClient
from sqlalchemy.orm import Session

# Imports des modèles de la DB nécessaires pour le setup des tests
from utils.models import Project, Extraction, Grid, Prompt
# Import de la structure de base de la checklist pour les assertions
from utils.prisma_scr import get_base_prisma_checklist

# =================================================================
# FIXTURES SPÉCIFIQUES À CE FICHIER
# =================================================================

# ================================================================
# CATEGORIE 1: GESTION DES ENTITÉS (GRILLES, PROMPTS)
# ================================================================

def test_api_grid_management_workflow(client: FlaskClient, db_session: Session, setup_project: Project):
    """
    Teste le workflow complet de gestion des grilles : Création (POST) et Récupération (GET).
    """
    # CORRECTION : La fixture setup_project retourne maintenant l'objet projet complet
    project_id = setup_project.id
    
    # 1. Tester l'import d'une grille (POST /projects/<id>/grids/import)
    grid_json_data = {
        "name": "Grille ATN Importée",
        "fields": ["Population", "Intervention", "Resultats"]
    }
    grid_file_data = io.BytesIO(json.dumps(grid_json_data).encode('utf-8'))
    
    response_import = client.post(
        f'/api/projects/{project_id}/grids/import',
        data={'file': (grid_file_data, 'grille_test.json')},
        content_type='multipart/form-data'
    )
    assert response_import.status_code == 201

    # 2. Récupérer les grilles (GET /projects/<id>/grids)
    response_get = client.get(f'/api/projects/{project_id}/grids')
    assert response_get.status_code == 200
    data = response_get.json # Utiliser .json est plus direct
    
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]['name'] == "Grille ATN Importée"
    
    # CORRECTION : La route API transforme les champs, donc on vérifie la nouvelle structure
    fields = data[0]['fields']
    assert isinstance(fields, list)
    assert len(fields) == 3
    assert fields[0]['name'] == "Population"

def test_api_prompts_get_and_update(client: FlaskClient, db_session: Session):
    """
    Teste la récupération (GET) et la mise à jour (POST) des Prompts.
    """
    # 1. GET /prompts (doit retourner une liste, même si vide)
    response_get = client.get('/api/prompts')
    assert response_get.status_code == 200
    assert isinstance(response_get.json, list)
    
    # 2. POST pour créer un prompt
    prompt_payload = {
        "name": f"test_prompt_unique_{uuid.uuid4()}",
        "content": "This is a test template: {{context}}"
    }
    response_post = client.post('/api/prompts', json=prompt_payload)
    assert response_post.status_code == 201
    assert response_post.json['name'] == prompt_payload['name']
    assert response_post.json['content'] == prompt_payload['content']
    
    # 3. Vérifier en base de données
    prompt_db = db_session.query(Prompt).filter_by(name=prompt_payload["name"]).first()
    assert prompt_db is not None
    assert prompt_db.content == prompt_payload["content"]

# ================================================================
# CATEGORIE 2: WORKFLOW DE VALIDATION (DOUBLE AVEUGLE)
# ================================================================

def test_api_full_validation_workflow(client: FlaskClient, db_session: Session, setup_project: Project):
    """
    Teste le workflow de validation complet :
    1. Setup: Créer une extraction (article) vide.
    2. Eval 1: L'évaluateur 1 prend une décision via l'API (PUT).
    3. Assert 1: Vérifie que le JSON et le statut en DB sont corrects.
    4. Eval 2: Importe un CSV pour l'évaluateur 2 (POST).
    5. Assert 2: Vérifie que le JSON en DB contient les DEUX décisions.
    """
    project_id = setup_project.id
    article_id = "pmid_workflow_1"

    # 1. Setup
    extraction = Extraction(project_id=project_id, pmid=article_id, title="Test Workflow Validation")
    db_session.add(extraction)
    db_session.flush()
    extraction_id_db = extraction.id

    # 2. Étape 1: Eval 1 prend une décision
    eval_1_payload = {"decision": "include", "evaluator": "evaluator1"}
    response_eval_1 = client.put(f'/api/projects/{project_id}/extractions/{extraction_id_db}/decision', json=eval_1_payload)
    assert response_eval_1.status_code == 200

    # 3. Assert 1
    db_session.refresh(extraction)
    assert extraction.user_validation_status == "include"
    assert json.loads(extraction.validations) == {"evaluator1": "include"}

    # 4. Étape 2: Eval 2 importe son CSV # CORRECTION: Le test utilise un ID d'article hardcodé, ce qui est OK pour ce workflow spécifique.
    mock_csv_content = f"articleId,decision\n{article_id},exclude\n"
    csv_file_data = io.BytesIO(mock_csv_content.encode('utf-8'))
    
    response_eval_2 = client.post(
        f'/api/projects/{project_id}/import-validations',
        data={'file': (csv_file_data, 'eval2_results.csv'), 'evaluator': 'evaluator2'},
        content_type='multipart/form-data'
    )
    assert response_eval_2.status_code == 200
    assert response_eval_2.json['message'] == "1 validations ont été importées pour l_évaluateur evaluator2."

    # 5. Assert 2
    db_session.refresh(extraction)
    assert json.loads(extraction.validations) == {"evaluator1": "include", "evaluator2": "exclude"}
    assert extraction.user_validation_status == "include"

# ================================================================
# CATEGORIE 3: RAPPORTS & EXPORTS
# ================================================================

def test_api_prisma_checklist_workflow(client: FlaskClient, db_session: Session, setup_project: Project):
    """
    Teste le GET (génération) et le POST (sauvegarde) de la checklist PRISMA-ScR.
    """
    project_id = setup_project.id

    # 1. GET /prisma-checklist (Endpoint GET)
    response_get = client.get(f'/api/projects/{project_id}/prisma-checklist')
    assert response_get.status_code == 200
    checklist_data = response_get.json

    # 2. Vérifier la structure de base
    base_structure = get_base_prisma_checklist()
    assert checklist_data['title'] == base_structure['title']
    assert checklist_data['sections'][0]['items'][0]['checked'] is False

    # 3. Simuler une modification et sauvegarder
    checklist_data['sections'][0]['items'][0]['checked'] = True
    checklist_data['sections'][0]['items'][0]['notes'] = "Titre vérifié"
    
    post_payload = {"checklist": checklist_data}
    response_post = client.post(f'/api/projects/{project_id}/prisma-checklist', json=post_payload)
    assert response_post.status_code == 200

    # 4. Vérifier la sauvegarde en DB
    db_session.refresh(setup_project)
    saved_data = json.loads(setup_project.prisma_checklist)
    assert saved_data['sections'][0]['items'][0]['checked'] is True
    assert saved_data['sections'][0]['items'][0]['notes'] == "Titre vérifié"

# ================================================================
# CATEGORIE 4: ADMIN & INFRASTRUCTURE
# ================================================================

@patch('backend.server_v4_complete.Worker')
@patch('backend.server_v4_complete.processing_queue')
@patch('backend.server_v4_complete.synthesis_queue')
@patch('backend.server_v4_complete.analysis_queue')
@patch('backend.server_v4_complete.background_queue')
def test_api_admin_queues_status(mock_bg_q, mock_an_q, mock_syn_q, mock_proc_q, mock_worker, client: FlaskClient):
    """
    Teste l'endpoint d'administration des files (queues) pour le monitoring.
    """
    # ARRANGE
    mock_proc_q.name = 'analylit_processing_v4'; mock_proc_q.__len__.return_value = 5
    mock_syn_q.name = 'analylit_synthesis_v4'; mock_syn_q.__len__.return_value = 2
    mock_an_q.name = 'analylit_analysis_v4'; mock_an_q.__len__.return_value = 0
    mock_bg_q.name = 'analylit_background_v4'; mock_bg_q.__len__.return_value = 1
    
    mock_worker_instance = MagicMock(); mock_worker_instance.queue_names.return_value = ['analylit_processing_v4', 'analylit_background_v4']
    mock_worker.all.return_value = [mock_worker_instance]

    # ACT
    response = client.get('/api/queues/info') # La route est dans admin_bp
    assert response.status_code == 200
    queues_data = response.json['queues']
    
    # ASSERT
    proc_q_data = next(q for q in queues_data if q['name'] == 'analylit_processing_v4')
    assert proc_q_data['size'] == 5 and proc_q_data['workers'] == 1

@patch('api.projects.background_queue.enqueue')
def test_api_upload_pdfs_bulk(mock_enqueue, client: FlaskClient, setup_project: Project):
    """
    Teste l'endpoint d'upload de PDF en masse.
    """
    # ARRANGE: Configurer le mock pour retourner un objet avec un attribut 'id'
    mock_job = MagicMock()
    mock_job.id = "mock_job_id_123"
    mock_enqueue.return_value = mock_job
    mock_job1 = MagicMock(); mock_job1.id = "mock_job_id_1"
    mock_job2 = MagicMock(); mock_job2.id = "mock_job_id_2"
    mock_enqueue.side_effect = [mock_job1, mock_job2]

    data = {
        'files': [
            (io.BytesIO(b'dummy pdf content'), 'test1.pdf'),
            (io.BytesIO(b'another pdf'), 'test2.pdf')
        ]
    }

    # ACT
    response = client.post(
        f'/api/projects/{setup_project.id}/upload-pdfs-bulk',
        data=data,
        content_type='multipart/form-data'
    )
    
    # ASSERT
    assert response.status_code == 202
    assert '2 PDF(s) mis en file pour traitement' in response.get_json()['message']
    assert mock_enqueue.call_count == 2