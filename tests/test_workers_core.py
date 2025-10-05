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
    time.sleep(2)
    return True

# --- Tests qui fonctionnent ---

def test_worker_processes_simple_job(redis_conn):
    q = Queue(connection=redis_conn)
    worker = Worker([q], connection=redis_conn)
    job = q.enqueue(simple_task)
    worker.work(burst=True)
    retrieved_job = Job.fetch(job.id, connection=redis_conn)
    assert retrieved_job.is_finished
    assert retrieved_job.result is True

def test_job_metadata_persistence(redis_conn):
    q = Queue(connection=redis_conn)
    worker = Worker([q], connection=redis_conn)
    job = q.enqueue(simple_task)
    job.meta['user_id'] = 'user-123'
    job.save_meta()
    worker.work(burst=True)
    retrieved_job = Job.fetch(job.id, connection=redis_conn)
    assert retrieved_job.is_finished
    assert retrieved_job.meta.get('user_id') == 'user-123'

def test_worker_job_timeout(redis_conn):
    q = Queue(connection=redis_conn)
    worker = Worker([q], connection=redis_conn)
    job = q.enqueue(long_running_task, job_timeout=1)
    worker.work(burst=True)
    retrieved_job = Job.fetch(job.id, connection=redis_conn)
    assert retrieved_job.is_failed
    assert 'JobTimeoutException' in retrieved_job.exc_info

def test_worker_retry_on_failure(redis_conn):
    q = Queue(connection=redis_conn)
    worker = Worker([q], connection=redis_conn)
    retry_policy = Retry(max=1)
    job = q.enqueue(fail_task, retry=retry_policy)
    
    # Première exécution
    worker.work(burst=True, max_jobs=1)
    job.refresh()
    assert job.is_queued

    # Deuxième exécution
    worker.work(burst=True, max_jobs=1)
    job.refresh()
    assert job.is_failed

# --- Tests corrigés ---

def test_worker_handles_job_failure(redis_conn):
    """Vérifie qu'une tâche en échec est correctement marquée."""
    q = Queue(connection=redis_conn)
    worker = Worker([q], connection=redis_conn)
    # AJOUT : On s'assure que la tâche en échec persiste
    job = q.enqueue(fail_task, failure_ttl=60)
    worker.work(burst=True)
    retrieved_job = Job.fetch(job.id, connection=redis_conn)
    assert retrieved_job.is_failed

def test_worker_priority_queues(redis_conn):
    """Vérifie que la file 'high' est traitée avant 'low'."""
    high_q = Queue('high', connection=redis_conn)
    low_q = Queue('low', connection=redis_conn)
    worker = Worker([high_q, low_q], connection=redis_conn)

    [low_q.enqueue(simple_task, result_ttl=60) for _ in range(5)]
    high_job = high_q.enqueue(simple_task, result_ttl=60)

    # Le worker ne traite qu'une seule tâche
    worker.work(burst=True, max_jobs=1)

    retrieved_high_job = Job.fetch(high_job.id, connection=redis_conn)
    assert retrieved_high_job.is_finished

def test_worker_result_ttl(redis_conn):
    """Vérifie que le résultat d'une tâche expire."""
    q = Queue(connection=redis_conn)
    worker = Worker([q], connection=redis_conn)
    job = q.enqueue(simple_task, result_ttl=1)
    worker.work(burst=True)

    # Le job doit exister juste après l'exécution
    assert Job.fetch(job.id, connection=redis_conn).is_finished

    # On attend que le TTL expire
    time.sleep(2)

    # Maintenant, le job ne doit plus exister
    with pytest.raises(NoSuchJobError):
        Job.fetch(job.id, connection=redis_conn)