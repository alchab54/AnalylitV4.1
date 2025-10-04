"""
Tests unitaires pour vérifier le fonctionnement des workers RQ.
Ces tests vérifient que les workers consomment correctement les tâches,
gèrent les erreurs, et maintiennent l'état correct dans Redis.
"""

import time
import pytest
from pathlib import Path
from threading import Thread
from rq import Queue, Worker
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
    counter_file = Path(f"/tmp/flaky_counter_{fail_times}")
    
    current_attempt = 0
    if counter_file.exists():
        current_attempt = int(counter_file.read_text())
    
    current_attempt += 1
    counter_file.write_text(str(current_attempt))

    if current_attempt <= fail_times:
        raise ValueError(f"Attempt {current_attempt} is set to fail.")
    
    counter_file.unlink(missing_ok=True)
    return "finally succeeded"

def slow_task(duration=0.5):
    """Tâche lente pour tester les timeouts"""
    time.sleep(duration)
    return "completed"

@pytest.fixture
def redis_conn():
    """Connexion Redis pour les assertions (avec décodage)."""
    return from_url("redis://redis:6379/1", decode_responses=True)

@pytest.fixture
def rq_connection():
    """Connexion Redis pour RQ (SANS décodage)."""
    return from_url("redis://redis:6379/1", decode_responses=False)

@pytest.fixture
def worker_queues(rq_connection):
    """Fixture des queues RQ"""
    default_queue = Queue("default", connection=rq_connection)
    high_queue = Queue("high", connection=rq_connection)
    low_queue = Queue("low", connection=rq_connection)
    
    default_queue.empty()
    high_queue.empty()
    low_queue.empty()
    yield default_queue, high_queue, low_queue

def wait_for_job(job, timeout=5):
    start_time = time.time()
    while not job.is_finished and not job.is_failed:
        if time.time() - start_time > timeout:
            raise TimeoutError(f"Job {job.id} did not finish in time. Status: {job.get_status()}")
        time.sleep(0.1)
        job.refresh()

@pytest.mark.real_rq
class TestWorkersCore:
    """Tests core des workers RQ"""
    
    def test_worker_processes_simple_job(self, worker_queues, rq_connection):
        default_queue, _, _ = worker_queues
        
        worker = Worker([default_queue], connection=rq_connection)
        worker_thread = Thread(target=worker.work, kwargs={'burst': False})
        worker_thread.start()
        
        job = default_queue.enqueue(simple_task, 5, 10)
        wait_for_job(job)
        
        assert job.is_finished
        assert job.return_value() == 15
        
        worker.schedule_for_shutdown()
        worker_thread.join()

    def test_worker_handles_job_failure(self, worker_queues, rq_connection):
        default_queue, _, _ = worker_queues
        
        worker = Worker([default_queue], connection=rq_connection)
        worker_thread = Thread(target=worker.work, kwargs={'burst': False})
        worker_thread.start()

        job = default_queue.enqueue(failing_task, "Test failure")
        
        with pytest.raises(TimeoutError):
            wait_for_job(job, timeout=2) # Should not finish successfully

        job.refresh()
        assert job.is_failed
        assert "ValueError" in job.latest_result().exc_string

        worker.schedule_for_shutdown()
        worker_thread.join()

    def test_worker_priority_queues(self, worker_queues, rq_connection):
        default_queue, high_queue, low_queue = worker_queues
        
        worker = Worker([high_queue, default_queue, low_queue], connection=rq_connection)
        worker_thread = Thread(target=worker.work, kwargs={'burst': False})
        worker_thread.start()

        low_job = low_queue.enqueue(simple_task, 1, 1)
        high_job = high_queue.enqueue(simple_task, 2, 2) 
        default_job = default_queue.enqueue(simple_task, 3, 3)

        wait_for_job(high_job)
        wait_for_job(default_job)
        wait_for_job(low_job)

        assert high_job.is_finished
        assert default_job.is_finished
        assert low_job.is_finished
        
        worker.schedule_for_shutdown()
        worker_thread.join()

    def test_worker_job_timeout(self, worker_queues, rq_connection):
        default_queue, _, _ = worker_queues
        
        worker = Worker([default_queue], connection=rq_connection)
        worker_thread = Thread(target=worker.work, kwargs={'burst': False})
        worker_thread.start()

        job = default_queue.enqueue(slow_task, 2.0, job_timeout=1)
        
        with pytest.raises(TimeoutError):
            wait_for_job(job, timeout=3)

        job.refresh()
        assert job.is_failed
        
        worker.schedule_for_shutdown()
        worker_thread.join()

    def test_worker_retry_on_failure(self, worker_queues, rq_connection):
        default_queue, _, _ = worker_queues

        worker = Worker([default_queue], connection=rq_connection)
        worker_thread = Thread(target=worker.work, kwargs={'burst': False})
        worker_thread.start()

        job = default_queue.enqueue(flaky, kwargs={'fail_times': 2}, retry=Retry(max=3))
        
        wait_for_job(job, timeout=10)

        assert job.is_finished
        assert job.return_value() == "finally succeeded"
        
        worker.schedule_for_shutdown()
        worker_thread.join()
