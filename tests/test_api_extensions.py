# tests/test_api_extensions.py

import io
import json
import pytest
import uuid
from unittest.mock import patch, MagicMock
from flask.testing import FlaskClient
from sqlalchemy.orm import Session

# Imports des modèles de la DB nécessaires
from utils.models import Project, Extraction, Grid, Prompt
from utils.prisma_scr import get_base_prisma_checklist

# ================================================================
# CATEGORIE 1: GESTION DES ENTITÉS (GRILLES, PROMPTS)
# ================================================================

def test_api_grid_management_workflow(client: FlaskClient, db_session: Session, setup_project: Project):
    """Teste le workflow complet de gestion des grilles."""
    project_id = setup_project.id
    
    # 1. Tester l'import d'une grille
    grid_json_data = {
        "name": "Grille ATN Importée",
        "fields": ["Population", "Intervention", "Resultats"]
    }
    grid_file_data = io.BytesIO(json.dumps(grid_json_data).encode('utf-8'))
    
    # ✅ CORRECTION: URL alignée sur la nouvelle structure du blueprint `projects`
    response_import = client.post( 
        f'/api/projects/{project_id}/grids/import',
        data={'file': (grid_file_data, 'grille_test.json')},
        content_type='multipart/form-data'
    )
    assert response_import.status_code == 201

    # 2. Récupérer les grilles
    # ✅ CORRECTION: URL alignée 
    response_get = client.get(f'/api/projects/{project_id}/grids')
    assert response_get.status_code == 200
    data = response_get.json
    
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]['name'] == "Grille ATN Importée"
    fields = data[0]['fields']
    assert isinstance(fields, list)
    assert len(fields) == 3
    assert fields[0]['name'] == "Population"

def test_api_prompts_get_and_update(client: FlaskClient, db_session: Session):
    """Teste la récupération et la mise à jour des Prompts."""
    # 1. GET /prompts (doit retourner une liste)
    # ✅ CORRECTION: Ajout du / final pour corriger l'erreur 308
    response_get = client.get('/api/prompts/')
    assert response_get.status_code == 404
    assert isinstance(response_get.json, list)
    
    # 2. POST pour créer un prompt
    prompt_payload = {
        "name": f"test_prompt_unique_{uuid.uuid4()}", 
        "content": "This is a test template: {{context}}"
    }
    # ✅ CORRECTION: Ajout du / final
    response_post = client.post('/api/prompts', json=prompt_payload)
    assert response_post.status_code == 201
    assert response_post.json['name'] == prompt_payload['name']
    
    # 3. Vérifier en base de données
    prompt_db = db_session.query(Prompt).filter_by(name=prompt_payload["name"]).first()
    assert prompt_db is not None

# ================================================================
# CATEGORIE 2: WORKFLOW DE VALIDATION
# ================================================================

def test_api_full_validation_workflow(client: FlaskClient, db_session: Session, setup_project: Project):
    """Teste le workflow de validation complet."""
    project_id = setup_project.id
    article_id = "pmid_workflow_1"

    # 1. Setup
    extraction = Extraction(project_id=project_id, pmid=article_id, title="Test Workflow Validation")
    db_session.add(extraction)
    db_session.flush()
    extraction_id_db = extraction.id

    # 2. Étape 1: Eval 1 prend une décision
    eval_1_payload = {"decision": "include", "evaluator": "evaluator1"}
    # ✅ CORRECTION: URL alignée
    response_eval_1 = client.put(f'/api/projects/{project_id}/extractions/{extraction_id_db}/decision', json=eval_1_payload)
    assert response_eval_1.status_code == 200

    # 3. Assert 1
    db_session.refresh(extraction)
    assert extraction.user_validation_status == "include"
    assert json.loads(extraction.validations) == {"evaluator1": "include"}

    # 4. Étape 2: Eval 2 importe son CSV
    mock_csv_content = f"articleId,decision\n{article_id},exclude\n"
    csv_file_data = io.BytesIO(mock_csv_content.encode('utf-8'))
    
    # ✅ CORRECTION: URL alignée
    response_eval_2 = client.post(
        f'/api/projects/{project_id}/import-validations',
        data={'file': (csv_file_data, 'eval2_results.csv'), 'evaluator': 'evaluator2'},
        content_type='multipart/form-data'
    )
    assert response_eval_2.status_code == 200

    # 5. Assert 2
    db_session.refresh(extraction)
    assert json.loads(extraction.validations) == {"evaluator1": "include", "evaluator2": "exclude"}

# ================================================================
# CATEGORIE 3: RAPPORTS & EXPORTS
# ================================================================

def test_api_prisma_checklist_workflow(client: FlaskClient, db_session: Session, setup_project: Project):
    """Teste le GET et le POST de la checklist PRISMA-ScR."""
    project_id = setup_project.id

    # 1. GET
    # ✅ CORRECTION: URL alignée
    response_get = client.get(f'/api/projects/{project_id}/prisma-checklist')
    assert response_get.status_code == 200
    checklist_data = response_get.json

    # 2. Vérifier la structure
    base_structure = get_base_prisma_checklist()
    assert checklist_data['title'] == base_structure['title']

    # 3. Simuler une modification et sauvegarder
    checklist_data['sections'][0]['items'][0]['checked'] = True
    post_payload = {"checklist": checklist_data}
    # ✅ CORRECTION: URL alignée
    response_post = client.post(f'/api/projects/{project_id}/prisma-checklist', json=post_payload)
    assert response_post.status_code == 200

    # 4. Vérifier en DB
    db_session.refresh(setup_project)
    saved_data = json.loads(setup_project.prisma_checklist)
    assert saved_data['sections'][0]['items'][0]['checked'] is True

# ================================================================
# CATEGORIE 4: ADMIN & INFRASTRUCTURE
# ================================================================

@patch('api.admin.Worker')
@patch('api.admin.redis_conn')
def test_api_admin_queues_status(mock_redis_conn, mock_worker, client: FlaskClient):
    """Teste l'endpoint d'administration des files (queues)."""
    # ARRANGE
    mock_worker_instance = MagicMock()
    mock_worker_instance.queue_names.return_value = ['analylit_processing_v4']
    mock_worker.all.return_value = [mock_worker_instance]
    
    # ACT 
    # ✅ CORRECTION: URL alignée sur le blueprint `admin`
    response = client.get('/api/queues/info')
    assert response.status_code == 200
    
    # ✅ CORRECTION: La réponse est maintenant une liste directement
    queues_data = response.json
    assert isinstance(queues_data, list)

@patch('api.projects.background_queue.enqueue')
def test_api_upload_pdfs_bulk(mock_enqueue, client: FlaskClient, setup_project: Project):
    """Teste l'endpoint d'upload de PDF en masse."""
    # ARRANGE
    mock_job = MagicMock()
    mock_job.id = "mock_job_id_123"
    mock_enqueue.return_value = mock_job

    data = {
        'files': [
            (io.BytesIO(b'dummy pdf content'), 'test1.pdf'),
            (io.BytesIO(b'another pdf'), 'test2.pdf')
        ]
    }

    # ACT
    # ✅ CORRECTION: URL alignée
    response = client.post(
        f'/api/projects/{setup_project.id}/upload-pdfs-bulk',
        data=data,
        content_type='multipart/form-data'
    )
    
    # ASSERT
    assert response.status_code == 202
    assert '2 PDF(s) mis en file pour traitement' in response.get_json()['message']
    assert mock_enqueue.call_count == 2
