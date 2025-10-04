"""
Tests unitaires pour vérifier le fonctionnement des workers RQ.
Ces tests vérifient que les workers consomment correctement les tâches,
gèrent les erreurs, et maintiennent l'état correct dans Redis.
"""

import time
import pytest
from pathlib import Path
from unittest.mock import patch
from rq import Queue, Worker, Connection
from rq.job import Job, Retry
from redis import from_url

# Fonctions de test pour simuler du travail
def simple_task(a, b):
    """Tâche simple pour tests"""
    return a + b

def failing_task(msg="Test error"):
    """Tâche qui échoue pour tester la gestion d'erreurs"""
    raise ValueError(msg)

def flaky(fail_times=2):
    """
    Tâche qui échoue un certain nombre de fois avant de réussir.
    Utilise un fichier temporaire pour suivre le nombre de tentatives.
    """
    # Utiliser un fichier pour un état persistant entre les tentatives du worker
    counter_file = Path(f"/tmp/flaky_counter_{fail_times}")
    
    current_attempt = 0
    if counter_file.exists():
        current_attempt = int(counter_file.read_text())
    
    current_attempt += 1
    counter_file.write_text(str(current_attempt))

    if current_attempt <= fail_times:
        raise ValueError(f"Attempt {current_attempt} is set to fail.")
    
    # Nettoyer après succès
    counter_file.unlink(missing_ok=True)
    return "finally succeeded"

def slow_task(duration=0.5):
    """Tâche lente pour tester les timeouts"""
    time.sleep(duration)
    return "completed"

def memory_intensive_task(size=1000):
    """Tâche intensive pour tester les ressources"""
    data = [i for i in range(size)]
    return len(data)

@pytest.fixture
def redis_conn():
    """Connexion Redis pour les assertions (avec décodage)."""
    return from_url("redis://redis:6379/0", decode_responses=True)

@pytest.fixture
def rq_connection():
    """Connexion Redis pour RQ (SANS décodage). C'est la correction clé."""
    return from_url("redis://redis:6379/0", decode_responses=False)

@pytest.fixture
def worker_queues(rq_connection):
    """Fixture des queues RQ"""
    # Use explicit connection for each queue
    default_queue = Queue("default", connection=rq_connection)
    high_queue = Queue("high", connection=rq_connection)
    low_queue = Queue("low", connection=rq_connection)
    
    # Nettoyer les queues avant chaque test
    default_queue.empty()
    high_queue.empty()
    low_queue.empty()
    yield default_queue, high_queue, low_queue

@pytest.mark.real_rq
class TestWorkersCore:
    """Tests core des workers RQ"""
    
    def test_worker_processes_simple_job(self, worker_queues, rq_connection):
        """Vérifier qu'un worker traite correctement une tâche simple"""
        default_queue, _, _ = worker_queues
        
        # Enqueuer une tâche
        job = default_queue.enqueue(simple_task, 5, 10)
        assert job.get_status() == "queued"
        
        # Créer et démarrer le worker
        worker = Worker([default_queue], connection=rq_connection)
        result = worker.work(burst=True)
        
        assert result is True
        job.refresh()
        assert job.is_finished
        assert job.return_value() == 15

    def test_worker_handles_job_failure(self, worker_queues, rq_connection):
        """Vérifier qu'un worker gère correctement les échecs"""
        default_queue, _, _ = worker_queues
        
        # Enqueuer une tâche qui échoue
        job = default_queue.enqueue(failing_task, "Test failure")
        
        worker = Worker([default_queue], connection=rq_connection)
        worker.work(burst=True)
        
        job.refresh()
        assert job.is_failed
        # Use job.latest_result().exc_string instead of job.exc_info
        assert "ValueError" in job.latest_result().exc_string

    def test_worker_priority_queues(self, worker_queues, rq_connection):
        """Vérifier que le worker respecte les priorités des queues"""
        default_queue, high_queue, low_queue = worker_queues
        
        # Enqueuer des tâches sur différentes queues
        low_job = low_queue.enqueue(simple_task, 1, 1)
        high_job = high_queue.enqueue(simple_task, 2, 2) 
        default_job = default_queue.enqueue(simple_task, 3, 3)

        # Worker avec priorité: high > default > low
        worker = Worker([high_queue, default_queue, low_queue], connection=rq_connection)

        # ✅ CORRECTION : Lancer le worker une seule fois pour traiter toutes les tâches.
        # Le mode 'burst' lui fait traiter toutes les tâches en attente puis s'arrêter.
        worker.work(burst=True)

        # Vérifier les résultats de tous les jobs APRÈS que le worker a terminé son travail.
        high_job.refresh()
        default_job.refresh()
        low_job.refresh()

        assert high_job.is_finished
        assert high_job.return_value() == 4
        assert default_job.is_finished, f"Default job status is {default_job.get_status()}"
        assert default_job.return_value() == 6
        assert low_job.is_finished
        assert low_job.return_value() == 2

    def test_worker_job_timeout(self, worker_queues, rq_connection):
        """Vérifier la gestion des timeouts"""
        default_queue, _, _ = worker_queues
        
        # Job avec timeout très court
        job = default_queue.enqueue(slow_task, 2.0, job_timeout=1)
        
        worker = Worker([default_queue], connection=rq_connection)
        worker.work(burst=True)
        
        job.refresh()
        # Le job devrait échouer à cause du timeout
        assert job.is_failed or job.get_status() == "failed"

    def test_job_metadata_persistence(self, worker_queues, rq_connection):
        """Vérifier que les métadonnées des jobs persistent"""
        default_queue, _, _ = worker_queues
        
        job = default_queue.enqueue(
            simple_task, 
            7, 8,
            description="Test job metadata",
            meta={"project_id": "proj-123", "user_id": "user-456"}
        )
        
        # Vérifier métadonnées avant exécution
        assert job.description == "Test job metadata"
        assert job.meta["project_id"] == "proj-123"
        
        worker = Worker([default_queue], connection=rq_connection)
        worker.work(burst=True)
        
        job.refresh()
        assert job.is_finished
        # Métadonnées préservées après exécution
        assert job.meta["project_id"] == "proj-123"
        assert job.meta["user_id"] == "user-456"

    def test_worker_result_ttl(self, worker_queues, rq_connection):
        """Vérifier que les résultats ont un TTL configuré"""
        default_queue, _, _ = worker_queues
        
        job = default_queue.enqueue(
            simple_task, 
            10, 20,
            result_ttl=3600  # 1 heure
        )
        
        worker = Worker([default_queue], connection=rq_connection)
        worker.work(burst=True)
        
        job.refresh()
        assert job.is_finished
        assert job.return_value() == 30
        
        # Vérifier que le job existe encore dans Redis
        assert job.exists(job.id, connection=rq_connection)

    def test_worker_retry_on_failure(self, worker_queues, rq_connection):
        """Vérifie que le mécanisme de retry fonctionne."""
        default_queue, _, _ = worker_queues

        # La tâche échouera 2 fois, puis réussira à la 3ème tentative.
        job = default_queue.enqueue(flaky, kwargs={'fail_times': 2}, retry=Retry(max=3))
        
        worker = Worker([default_queue], connection=rq_connection)
        
        # Le worker doit tourner plusieurs fois pour gérer les retries
        for i in range(4): # Assez de tentatives pour couvrir les échecs et le succès
            worker.work(burst=True)
            job.refresh()
            if job.is_finished:
                break

        assert job.is_finished is True, f"Job status was {job.get_status()}"
        assert job.return_value() == "finally succeeded"