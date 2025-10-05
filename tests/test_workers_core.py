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
    worker = Worker([high_q, low_q], connection=redis_conn)

    # On ajoute des tâches de basse priorité
    low_jobs = [low_q.enqueue(simple_task) for _ in range(5)]
    # On ajoute la tâche prioritaire
    # AJOUT: On s'assure que le résultat du job persiste pendant le test
    high_job = high_q.enqueue(simple_task, result_ttl=60)

    # Le worker ne doit traiter qu'UNE seule tâche
    worker.work(burst=True)

    # On vérifie que la tâche prioritaire est bien terminée
    retrieved_high_job = Job.fetch(high_job.id, connection=redis_conn)
    assert retrieved_high_job.is_finished, "La tâche prioritaire aurait dû être terminée"

    # On vérifie que les autres sont toujours en attente
    for job in low_jobs:
        retrieved_low_job = Job.fetch(job.id, connection=redis_conn)
        assert not retrieved_low_job.is_finished, "Les tâches non prioritaires ne devraient pas avoir été exécutées"

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
    # AJOUT: On utilise un worker différent pour chaque étape pour bien isoler les actions
    worker1 = Worker([q], connection=redis_conn)
    worker2 = Worker([q], connection=redis_conn)
    
    # On configure pour 1 seul réessai
    retry_policy = Retry(max=1)
    job = q.enqueue(fail_task, retry=retry_policy)
    
    # Première exécution : doit échouer et être remise en file d'attente
    worker1.work(burst=True) 
    job.refresh()
    assert job.is_queued, f"La tâche devrait être en attente pour un réessai, mais son statut est {job.get_status()}"

    # Deuxième exécution : doit échouer et être marquée comme 'failed'
    worker2.work(burst=True)
    job.refresh()
    assert job.is_failed, "La tâche devrait être en échec définitif après le réessai"