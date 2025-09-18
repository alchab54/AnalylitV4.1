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
from utils.models import Project, SearchResult, Extraction, Grid, AnalysisProfile, Prompt
# Import de la structure de base de la checklist pour les assertions
from utils.prisma_scr import get_base_prisma_checklist
from utils.app_globals import background_queue


@pytest.fixture
def setup_project(session: Session):
    project = Project(name=f"Test Project {uuid.uuid4()}", description="A test project")
    session.add(project)
    session.commit()
    return project.id

# ================================================================
# CATEGORIE 1: GESTION DES ENTITÉS (GRILLES, PROMPTS)
# ================================================================

def test_api_grid_management_workflow(client, setup_project):
    """
    Teste le workflow complet de gestion des grilles : Création (POST) et Récupération (GET). (No changes needed)
    """
    project_id = setup_project

    # 1. Tester l'import d'une grille (POST /projects/<id>/grids/import)
    # (Nous testons l'import car l'endpoint POST simple est moins critique que le flux d'import)
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
    data = json.loads(response_get.data)
    
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]['name'] == "Grille ATN Importée"
    assert len(data[0]['fields']) == 3 # Correction de l'assertion
    assert data[0]['fields'][0]['name'] == "Population"

def test_api_prompts_get_and_update(client: FlaskClient, session: Session):
    """
    Teste la récupération (GET) et la mise à jour (POST) des Prompts.
    """
    # 1. GET /prompts (doit retourner une liste, même si vide)
    response_get = client.get('/api/prompts')
    assert response_get.status_code == 200
    assert isinstance(response_get.json, list)
    
    # 2. POST pour créer un prompt avec template (sera mappé vers content)
    prompt_payload = {
        "name": "test_prompt_unique",
        "template": "This is a test template: {{context}}"
    }
    response_post = client.post('/api/prompts', json=prompt_payload)
    assert response_post.status_code == 201
    assert response_post.json['name'] == prompt_payload['name']
    assert response_post.json['content'] == prompt_payload['template']
    
    # 3. Vérifier en base de données
    prompt_db = session.query(Prompt).filter_by(name="test_prompt_unique").first()
    assert prompt_db is not None
    assert prompt_db.name == "test_prompt_unique"
    assert prompt_db.content == "This is a test template: {{context}}"

# ================================================================
# CATEGORIE 2: WORKFLOW DE VALIDATION (DOUBLE AVEUGLE)
# ... (test_api_full_validation_workflow reste inchangé) ...
# ================================================================

def test_api_full_validation_workflow(client: FlaskClient, session: Session, setup_project):
    """
    Teste le workflow de validation complet :
    1. Setup: Créer une extraction (article) vide.
    2. Eval 1: L'évaluateur 1 prend une décision via l'API (PUT).
    3. Assert 1: Vérifie que le JSON et le statut en DB sont corrects.
    4. Eval 2: Importe un CSV pour l'évaluateur 2 (POST).
    5. Assert 2: Vérifie que le JSON en DB contient les DEUX décisions.
    """
    project_id = setup_project
    article_id = "pmid_workflow_1"

    # 1. Setup (Créer l'extraction liée au projet et à l'article)
    extraction = Extraction( 
        project_id=project_id, 
        pmid=article_id, 
        title="Test Workflow Validation"
    )
    session.add(extraction)
    session.commit()
    extraction_id_db = extraction.id # Récupère l'ID DB

    # 2. Étape 1: Eval 1 prend une décision
    eval_1_payload = {"decision": "include", "evaluator": "evaluator1"}
    response_eval_1 = client.put(
        f'/api/projects/{project_id}/extractions/{extraction_id_db}/decision',
        json=eval_1_payload
    )
    assert response_eval_1.status_code == 200

    # 3. Assert 1: Vérifier la DB
    session.refresh(extraction)
    assert extraction.user_validation_status == "include"
    expected_json_1 = {"evaluator1": "include"}
    assert json.loads(extraction.validations) == expected_json_1

    # 4. Étape 2: Eval 2 importe son CSV
    mock_csv_content = f"articleId,decision\n{article_id},exclude\n"
    csv_file_data = io.BytesIO(mock_csv_content.encode('utf-8'))
    
    response_eval_2 = client.post(
        f'/api/projects/{project_id}/import-validations',
        data={'file': (csv_file_data, 'eval2_results.csv'), 'evaluator': 'evaluator2'},
        content_type='multipart/form-data' # La route existe maintenant
    )
    assert response_eval_2.status_code == 200
    
    # CORRECTION: L'assertion attend le nom de l'évaluateur qui est une variable.
    expected_message = "1 validations ont été importées pour l'évaluateur evaluator2."
    assert response_eval_2.json['message'] == expected_message

    # 5. Assert 2: Vérifier à nouveau la DB
    session.refresh(extraction)
    expected_json_final = {"evaluator1": "include", "evaluator2": "exclude"}
    assert json.loads(extraction.validations) == expected_json_final
    assert extraction.user_validation_status == "include"


# ================================================================
# CATEGORIE 3: RAPPORTS & EXPORTS
# ... (test_api_prisma_checklist_workflow reste inchangé) ...
# ================================================================

def test_api_prisma_checklist_workflow(client, session, setup_project):
    """
    Teste le GET (génération) et le POST (sauvegarde) de la checklist PRISMA-ScR.
    """
    project_id = setup_project

    # 1. GET /prisma-checklist (Endpoint GET)
    response_get = client.get(f'/api/projects/{project_id}/prisma-checklist')
    assert response_get.status_code == 200
    checklist_data = json.loads(response_get.data)
    
    # Vérifier la structure de base
    base_structure = get_base_prisma_checklist()
    assert checklist_data['title'] == base_structure['title']
    assert checklist_data['sections'][0]['id'] == 'reporting'
    assert checklist_data['sections'][0]['items'][0]['id'] == 'reporting-1'
    assert checklist_data['sections'][0]['items'][0]['checked'] is False # Doit être False par défaut

    # 2. Simuler une modification utilisateur
    checklist_data['sections'][0]['items'][0]['checked'] = True
    checklist_data['sections'][0]['items'][0]['notes'] = "Titre vérifié"

    # 3. POST /prisma-checklist (Endpoint POST)
    post_payload = {"checklist": checklist_data}
    response_post = client.post(
        f'/api/projects/{project_id}/prisma-checklist',
        data=json.dumps(post_payload),
        content_type='application/json'
    )
    assert response_post.status_code == 200

    # 4. Vérifier la sauvegarde en DB
    project = session.get(Project, project_id)
    saved_data_json = project.prisma_checklist
    assert saved_data_json is not None
    saved_data = json.loads(saved_data_json)
    
    assert saved_data['sections'][0]['items'][0]['checked'] is True
    assert saved_data['sections'][0]['items'][0]['notes'] == "Titre vérifié"


# ================================================================
# CATEGORIE 4: ADMIN & INFRASTRUCTURE
# ================================================================

@patch('server_v4_complete.Worker')
@patch('server_v4_complete.processing_queue')
@patch('server_v4_complete.synthesis_queue')
@patch('server_v4_complete.analysis_queue')
@patch('server_v4_complete.background_queue')
def test_api_admin_queues_status(mock_bg_q, mock_an_q, mock_syn_q, mock_proc_q, mock_worker, client: FlaskClient):
    """
    Teste l'endpoint d'administration des files (queues) pour le monitoring. (Corrigé)
    """
    # ARRANGE
    # CORRECTION: Définition des mocks qui manquaient
    mock_proc_q.name = 'analylit_processing_v4'
    mock_proc_q.__len__.return_value = 5
    mock_syn_q.name = 'analylit_synthesis_v4'
    mock_syn_q.__len__.return_value = 2
    mock_an_q.name = 'analylit_analysis_v4'
    mock_an_q.__len__.return_value = 0
    mock_bg_q.name = 'analylit_background_v4'
    mock_bg_q.__len__.return_value = 1
    
    mock_worker_instance = MagicMock()
    mock_worker_instance.queue_names.return_value = ['analylit_processing_v4', 'analylit_background_v4']
    mock_worker.all.return_value = [mock_worker_instance]

    # ACT
    response = client.get('/api/queues/status')

    # ASSERT
    assert response.status_code == 200
    queues_data = response.json['queues']
    
    proc_q_data = next(q for q in queues_data if q['name'] == 'analylit_processing_v4')
    assert proc_q_data['size'] == 5
    assert proc_q_data['workers'] == 1

    bg_q_data = next(q for q in queues_data if q['name'] == 'analylit_background_v4')
    assert bg_q_data['size'] == 1
    assert bg_q_data['workers'] == 1

    syn_q_data = next(q for q in queues_data if q['name'] == 'analylit_synthesis_v4')
    assert syn_q_data['size'] == 2
    assert syn_q_data['workers'] == 0

# === CORRECTION ===
# 1. Test décommenté
# 2. Patch de 'mkdir' décommenté et mock 'mock_mkdir' ajouté à la signature
# 3. Patch de 'save_file_to_project_dir' corrigé pour cibler 'api.files' (où il est supposé être utilisé)
@patch('server_v4_complete.background_queue.enqueue')
def test_api_upload_pdfs_bulk(mock_enqueue, client: FlaskClient, setup_project):
    """
    Teste l'endpoint d'upload de PDF en masse.
    """
    project_id = setup_project
    
    # CORRECTION: Configurer le mock pour qu'il retourne un objet avec un attribut 'id'
    # qui est une chaîne de caractères, et non un autre MagicMock.
    mock_job1 = MagicMock()
    mock_job1.id = "mock_job_id_1"
    mock_job2 = MagicMock()
    mock_job2.id = "mock_job_id_2"
    mock_enqueue.side_effect = [mock_job1, mock_job2]
    # ARRANGE
    data = {'files': [(io.BytesIO(b'dummy pdf content'), 'test1.pdf'), (io.BytesIO(b'another pdf'), 'test2.pdf')]}

    # ACT
    response = client.post(
        f'/api/projects/{project_id}/upload-pdfs-bulk',
        data=data,
        content_type='multipart/form-data'
    )
    
    # ASSERT
    # CORRECTION: Une tâche asynchrone retourne 202 ACCEPTED, pas 200 OK.
    assert response.status_code == 202
    response_data = response.get_json()
    assert '2 PDF(s) mis en file pour traitement' in response_data['message']
    assert response_data['task_ids'] == ["mock_job_id_1", "mock_job_id_2"]
    assert mock_enqueue.call_count == 2