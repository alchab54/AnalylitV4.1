import time
import pytest
import threading
from rq import Worker, Queue, Connection
from redis import Redis

POLL_TIMEOUT = 5.0
POLL_STEP = 0.2

@pytest.fixture(scope="module")
def background_worker():
    """Démarre un worker RQ en arrière-plan pour la durée des tests du module."""
    redis_conn = Redis(host="redis", port=6379, db=0)
    stop_flag = {"stop": False}

    def run():
        with Connection(redis_conn):
            # Écoute sur les files utilisées par l'application
            queues = [Queue("high"), Queue("default"), Queue("low"), Queue("background_queue")]
            worker = Worker(queues)
            # Boucle non bloquante
            while not stop_flag["stop"]:
                worker.work(burst=True)
                time.sleep(0.1)

    t = threading.Thread(target=run, daemon=True)
    t.start()
    try:
        yield
    finally:
        stop_flag["stop"] = True
        t.join(timeout=2.0)

@pytest.mark.integration
def test_enqueue_and_complete_via_api(client, test_project, background_worker):
    """
    Teste le cycle de vie complet d'une tâche : envoi via API, 
    exécution par le worker, et vérification du statut.
    """
    # 1. Enqueue une tâche simple via l'API de recherche
    search_data = {
        "project_id": test_project.id,
        "query": "test query",
        "databases": ["pubmed"],
        "max_results_per_db": 1
    }
    resp = client.post("/api/search", json=search_data)
    assert resp.status_code == 202
    data = resp.get_json()
    task_id = data.get("task_id")
    assert task_id

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
def test_failed_task_via_api(client, test_project, background_worker):
    """
    Teste qu'une tâche qui échoue est correctement marquée comme "failed".
    Nous utilisons un endpoint qui peut échouer si les conditions ne sont pas réunies.
    """
    # 1. Enqueue une tâche qui va échouer (ex: analyse sans données)
    resp = client.post(f"/api/projects/{test_project.id}/run-analysis", json={"type": "discussion"})
    assert resp.status_code == 202
    task_id = resp.get_json().get("job_id")
    assert task_id

    # 2. Poll le statut jusqu'à ce qu'il soit "failed"
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
        assert "queues" in info
        assert "workers" in info
        
        # Vérifie la structure des données des files
        for q_name, meta in info["queues"].items():
            assert "pending" in meta
            assert "display" in meta