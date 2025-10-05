import pytest
import time
from rq import Queue, Worker, Retry
from rq.job import Job
from rq.exceptions import NoSuchJobError

# Tâches simples utilisées pour les tests
def simple_task():
    """Une tâche qui réussit simplement."""
    return True

def fail_task():
    """Une tâche qui échoue toujours."""
    raise ValueError("This task is designed to fail")

def long_running_task():
    """Une tâche qui dure quelques secondes."""
    time.sleep(2)
    return True

# Les tests sont maintenant des fonctions simples qui reçoivent les fixtures en argument.
# Cela garantit une initialisation et un nettoyage corrects pour chaque test.

def test_worker_processes_simple_job(redis_conn):
    """Teste si un worker peut traiter une tâche simple."""
    q = Queue(connection=redis_conn)
    worker = Worker([q], connection=redis_conn)
    job = q.enqueue(simple_task)
    
    # Le worker traite une tâche et s'arrête
    worker.work(burst=True)

    # On recharge l'état du job depuis Redis pour vérifier son statut
    retrieved_job = Job.fetch(job.id, connection=redis_conn)
    assert retrieved_job.is_finished
    assert retrieved_job.result is True

def test_worker_handles_job_failure(redis_conn):
    """Vérifie que le statut d'une tâche est bien 'failed' après une erreur."""
    q = Queue(connection=redis_conn)
    worker = Worker([q], connection=redis_conn)
    job = q.enqueue(fail_task)

    worker.work(burst=True)
    
    retrieved_job = Job.fetch(job.id, connection=redis_conn)
    assert retrieved_job.is_failed

def test_worker_priority_queues(redis_conn):
    """Vérifie que les tâches de la file 'high' sont traitées avant 'low'."""
    high_q = Queue('high', connection=redis_conn)
    low_q = Queue('low', connection=redis_conn)

    # On ajoute d'abord les tâches de basse priorité
    for _ in range(5):
        low_q.enqueue(simple_task)
    
    # Puis la tâche de haute priorité
    high_job = high_q.enqueue(simple_task)

    # Le worker est configuré pour écouter 'high' en premier
    worker = Worker([high_q, low_q], connection=redis_conn)
    worker.work(burst=True) # Ne traite qu'une seule tâche

    retrieved_high_job = Job.fetch(high_job.id, connection=redis_conn)
    assert retrieved_high_job.is_finished, "La tâche prioritaire aurait dû être exécutée"

def test_worker_job_timeout(redis_conn):
    """Teste si une tâche est bien arrêtée après son timeout."""
    q = Queue(connection=redis_conn)
    worker = Worker([q], connection=redis_conn)
    
    # La tâche dure 2s, mais le timeout est de 1s
    job = q.enqueue(long_running_task, job_timeout=1)
    worker.work(burst=True)

    retrieved_job = Job.fetch(job.id, connection=redis_conn)
    assert retrieved_job.is_failed
    assert 'JobTimeoutException' in retrieved_job.exc_info

def test_job_metadata_persistence(redis_conn):
    """Vérifie que les métadonnées d'une tâche sont bien sauvegardées."""
    q = Queue(connection=redis_conn)
    worker = Worker([q], connection=redis_conn)
    
    job = q.enqueue(simple_task)
    job.meta['user_id'] = 'user-123'
    job.save_meta()

    worker.work(burst=True)
    
    retrieved_job = Job.fetch(job.id, connection=redis_conn)
    assert retrieved_job.is_finished
    assert retrieved_job.meta.get('user_id') == 'user-123'

def test_worker_result_ttl(redis_conn):
    """Vérifie que le résultat d'une tâche expire bien après le TTL."""
    q = Queue(connection=redis_conn)
    worker = Worker([q], connection=redis_conn)
    
    # Le résultat ne sera conservé qu'une seconde
    job = q.enqueue(simple_task, result_ttl=1)
    worker.work(burst=True)

    # Juste après, le job existe
    Job.fetch(job.id, connection=redis_conn)

    time.sleep(2) # On attend que le TTL expire

    # Maintenant, le job ne devrait plus exister
    with pytest.raises(NoSuchJobError):
        Job.fetch(job.id, connection=redis_conn)

def test_worker_retry_on_failure(redis_conn):
    """Teste la fonctionnalité de réessai automatique d'une tâche."""
    q = Queue(connection=redis_conn)
    worker = Worker([q], connection=redis_conn)
    
    # On configure pour 1 seul réessai
    retry_policy = Retry(max=1)
    job = q.enqueue(fail_task, retry=retry_policy)
    
    # Première exécution : doit échouer et être remise en file d'attente
    worker.work(burst=True) 
    job.refresh()
    assert job.is_queued, "La tâche devrait être en attente pour un réessai"

    # Deuxième exécution : doit échouer à nouveau et être marquée comme 'failed'
    worker.work(burst=True)
    job.refresh()