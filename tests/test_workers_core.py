import pytest
import time
from rq import Queue, Worker, Retry
from rq.job import Job
from rq.exceptions import NoSuchJobError

# Tâches simples utilisées pour les tests
def simple_task():
    return True

def fail_task():
    raise ValueError("This task is designed to fail")

def long_running_task():
    time.sleep(3)  # Augmenté pour garantir le timeout
    return True

# --- Tests de base ---

def test_worker_processes_simple_job(redis_conn):
    """Teste si un worker peut traiter une tâche simple."""
    q = Queue(connection=redis_conn)
    worker = Worker([q], connection=redis_conn)
    #✅Keep the results long enough to get it
    job = q.enqueue(simple_task, result_ttl=60)
    high_q = Queue('high', connection=redis_conn)
    high_job = high_q.enqueue(simple_task, result_ttl=60)
    worker.work(burst=True)
    retrieved_job = Job.fetch(job.id, connection=redis_conn)
    assert retrieved_job.is_finished

def test_worker_handles_job_failure(redis_conn):
    """Vérifie qu'une tâche en échec est bien marquée."""
    q = Queue(connection=redis_conn)
    worker = Worker([q], connection=redis_conn)
    
    #✅Try only once before failing the job to avoid the retry stuff
    job = q.enqueue(fail_task, failure_ttl=60)
    
    worker.work(burst=True, max_jobs=1)
    retrieved_job = Job.fetch(job.id, connection=redis_conn)
    assert retrieved_job.is_failed

def test_job_metadata_persistence(redis_conn):
    q = Queue(connection=redis_conn)
    worker = Worker([q], connection=redis_conn)
    job = q.enqueue(simple_task, result_ttl=60)
    job.meta['user_id'] = 'user-123'
    job.save_meta()
    worker.work(burst=True)
    retrieved_job = Job.fetch(job.id, connection=redis_conn)
    assert retrieved_job.is_finished
    assert retrieved_job.meta.get('user_id') == 'user-123'

# --- Tests de synchronisation corrigés ---

def test_worker_job_timeout(redis_conn):
    """Teste si une tâche est bien arrêtée après son timeout."""
    q = Queue(connection=redis_conn)
    job = q.enqueue(long_running_task, job_timeout=1, failure_ttl=60) 
    
    worker = Worker([q], connection=redis_conn)
    worker.work(burst=True, max_jobs=1) # Only get the enqueued job
    retrieved_job = Job.fetch(job.id, connection=redis_conn)
    assert 'JobTimeoutException' in retrieved_job.exc_info

def test_worker_priority_queues(redis_conn):
    """Teste si un worker peut traiter une tâche simple."""
    q = Queue(connection=redis_conn)
    high_q = Queue('high', connection=redis_conn)
    low_q = Queue('low', connection=redis_conn)
    worker = Worker([high_q, q, low_q], connection=redis_conn)
    #✅Keep the results long enough to get it
    high_job = high_q.enqueue(simple_task, result_ttl=60)
    job = q.enqueue(simple_task, result_ttl=60)

    # Le worker ne doit traiter qu'UNE seule tâche
    worker.work(burst=True, max_jobs=1)
    retrieved_job = Job.fetch(job.id, connection=redis_conn)
    assert retrieved_job.is_finished

    retrieved_high_job = Job.fetch(high_job.id, connection=redis_conn)
    assert retrieved_high_job.is_finished

def test_worker_retry_on_failure(redis_conn):
    """Teste la fonctionnalité de réessai automatique."""
    q = Queue(connection=redis_conn, default_timeout=5)
    worker = Worker([q], connection=redis_conn)
    retry_policy = Retry(max=1)
    job = q.enqueue(fail_task, retry=retry_policy, failure_ttl=60)
    
    # Première exécution (échoue)
    worker.work(burst=True, max_jobs=1)
    job.refresh()
    assert job.is_failed, "Job should be failed"

    # Deuxième exécution (échoue définitivement)
    worker.work(burst=True, max_jobs=1)
    job.refresh()
    assert job.is_failed

def test_worker_result_ttl(redis_conn):
    """Vérifie que le résultat d'une tâche expire."""
    q = Queue(connection=redis_conn, default_timeout=5)
    worker = Worker([q], connection=redis_conn)
    job = q.enqueue(simple_task, result_ttl=1)
    worker.work(burst=True)

    # Juste après, le job existe et est terminé
    assert Job.fetch(job.id, connection=redis_conn).is_finished

    # On attend que le TTL expire
    time.sleep(2)

    # Maintenant, le job ne doit plus exister
    with pytest.raises(NoSuchJobError):
        Job.fetch(job.id, connection=redis_conn)