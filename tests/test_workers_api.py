import time
import pytest
import uuid
from rq import Worker, Queue, Connection
from redis import from_url
from utils.models import Extraction, Project, AnalysisProfile # Import pour le setup

POLL_TIMEOUT = 5.0
POLL_STEP = 0.2

@pytest.fixture
def setup_project(db_session):
    """Crée un projet avec un profil d'analyse par défaut."""
    # Rendre le nom du profil unique pour chaque test pour éviter les conflits.
    profile = AnalysisProfile(name=f"Default Test Profile {uuid.uuid4()}")
    db_session.add(profile)
    db_session.flush() # Assure que le profil a un ID avant de l'assigner.
    
    # Créer le projet et l'associer au profil.
    project = Project(id=str(uuid.uuid4()), name="Test Project for API")
    project.analysis_profile = profile
    
    db_session.add(project)
    db_session.commit()
    return project.id

@pytest.mark.integration
def test_enqueue_and_complete_via_api(client, setup_project):
    """
    Teste le cycle de vie complet d'une tâche : envoi via API, 
    exécution par le worker, et vérification du statut.
    """
    # 1. Enqueue une tâche simple via l'API de recherche
    search_data = {
        "project_id": setup_project,
        "query": "test query",
        "databases": ["pubmed"],
        "max_results_per_db": 1
    }
    resp = client.post("/api/search", json=search_data)
    assert resp.status_code == 202
    data = resp.get_json()
    task_id = data.get("task_id")
    assert task_id

    # Attendre que le job apparaisse dans la file pour éviter une race condition
    redis_conn = from_url("redis://redis:6379/0")
    with Connection(redis_conn):
        q = Queue('background_queue') # La recherche est dans la background_queue
        
        # Poll the queue until the job is there
        start_wait = time.time()
        while len(q) == 0 and time.time() - start_wait < POLL_TIMEOUT:
            time.sleep(POLL_STEP)
        
        assert len(q) > 0, "Le job n'est jamais apparu dans la file d'attente."

        worker = Worker([q], connection=redis_conn)
        worker.work(burst=True)

    # 2. Poll le statut de la tâche jusqu'à sa complétion
    start = time.time()
    status = None
    while time.time() - start < POLL_TIMEOUT:
        s_resp = client.get(f"/api/tasks/{task_id}/status")
        assert s_resp.status_code == 200
        sdata = s_resp.get_json()
        status = sdata.get("status")
        if status in ("finished", "success", "completed"):
            break
        time.sleep(POLL_STEP)

    assert status in ("finished", "success", "completed")

@pytest.mark.integration
def test_failed_task_via_api(client, setup_project, db_session):
    """
    Teste qu'une tâche qui échoue est correctement marquée comme "failed".
    Nous utilisons un endpoint qui peut échouer si les conditions ne sont pas réunies.
    """
    # 1. Setup: Ajouter une extraction pour que la requête soit valide
    extraction = Extraction(project_id=setup_project, pmid="pmid_for_fail_test", relevance_score=8.0, extracted_data='{"conclusion": "This is a valid conclusion.", "limites": "Some limits."}')
    db_session.add(extraction)
    db_session.commit()

    # 2. Enqueue une tâche qui va échouer (ex: analyse de discussion)
    resp = client.post(f"/api/projects/{setup_project}/run-analysis", json={"type": "discussion"})
    assert resp.status_code == 202
    task_id = resp.get_json().get("job_id")
    assert task_id

    # 3. Exécuter le worker
    redis_conn = from_url("redis://redis:6379/0")
    with Connection(redis_conn):
        q = Queue('analysis_queue')
        worker = Worker([q], connection=redis_conn)
        worker.work(burst=True)

    # 4. Poll le statut jusqu'à ce qu'il soit "failed"
    start = time.time()
    status = None
    error_msg = None
    while time.time() - start < POLL_TIMEOUT:
        s_resp = client.get(f"/api/tasks/{task_id}/status")
        assert s_resp.status_code == 200
        sdata = s_resp.get_json()
        status = sdata.get("status")
        error_msg = sdata.get("error") or sdata.get("exc_info")
        if status in ("failed", "error"):
            break
        time.sleep(POLL_STEP)

    assert status in ("failed", "error")
    assert error_msg is None or isinstance(error_msg, str)

def test_queues_info_exposes_reality(client):
    """
    Vérifie que l'endpoint de monitoring des files retourne des données cohérentes.
    """
    r = client.get("/api/queues/info")
    assert r.status_code in (200, 404)
    if r.status_code == 200:
        info = r.get_json()
        assert isinstance(info, dict)
        # La structure de l'API a changé, on vérifie la nouvelle structure
        assert isinstance(info.get('queues'), list)
        
        # Vérifie la structure des données des files
        for queue_info in info['queues']:
            assert "name" in queue_info
            assert "size" in queue_info