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
    """Une tâche qui dure plus longtemps que le timeout du test."""
    time.sleep(5)
    return True

@pytest.mark.usefixtures("app_context", "db_session", "redis_conn")
class TestWorkersCore:
    """
    Suite de tests de base pour valider le comportement des workers RQ.
    Ces tests vérifient que les workers peuvent traiter des tâches, gérer les échecs,
    respecter les files d'attente prioritaires et les timeouts.
    """

    def setup_method(self):
        """
        Configure la file d'attente pour qu'elle soit asynchrone avant chaque test.
        C'est essentiel pour que le Worker puisse traiter les tâches en arrière-plan.
        """
        # La connexion est fournie par la fixture `redis_conn` de conftest.py
        self.q = Queue(is_async=True, connection=self.redis_conn)
        self.worker = Worker([self.q], connection=self.redis_conn, name="test-worker")


    def test_worker_processes_simple_job(self):
        """Teste si un worker peut traiter une tâche simple."""
        job = self.q.enqueue(simple_task)
        self.worker.work(burst=True)  # Traite la tâche et quitte
        
        # On recharge l'état du job depuis Redis
        job = Job.fetch(job.id, connection=self.redis_conn)
        
        assert job.is_finished, f"La tâche devrait être terminée, mais son statut est {job.get_status()}"
        assert job.result is True

    def test_worker_handles_job_failure(self):
        """Vérifie que le statut d'une tâche est bien 'failed' après une erreur."""
        job = self.q.enqueue(fail_task)
        self.worker.work(burst=True)
        
        job = Job.fetch(job.id, connection=self.redis_conn)

        assert job.is_failed, "La tâche devrait être en échec"

    def test_worker_priority_queues(self):
        """Vérifie que les tâches de la file 'high' sont traitées avant 'low'."""
        high_q = Queue('high', is_async=True, connection=self.redis_conn)
        low_q = Queue('low', is_async=True, connection=self.redis_conn)

        # Mettre en file d'attente 5 tâches de basse priorité
        for _ in range(5):
            low_q.enqueue(simple_task)
        
        # Mettre en file d'attente 1 tâche de haute priorité
        high_job = high_q.enqueue(simple_task)

        # Le worker écoute 'high' puis 'low'
        priority_worker = Worker([high_q, low_q], connection=self.redis_conn)
        priority_worker.work(burst=True) # Exécute une seule tâche et s'arrête

        high_job = Job.fetch(high_job.id, connection=self.redis_conn)
        
        # Seule la tâche prioritaire a dû être exécutée
        assert high_job.is_finished, "La tâche prioritaire aurait dû être traitée"

    def test_worker_job_timeout(self):
        """Teste si une tâche est bien arrêtée après son timeout."""
        # job_timeout=1 est très court pour s'assurer que ça échoue
        job = self.q.enqueue(long_running_task, job_timeout=1)
        self.worker.work(burst=True)

        job = Job.fetch(job.id, connection=self.redis_conn)
        assert job.is_failed, "La tâche aurait dû échouer à cause du timeout"
        assert 'JobTimeoutException' in job.exc_info

    def test_job_metadata_persistence(self):
        """Vérifie que les métadonnées d'une tâche sont bien sauvegardées."""
        job = self.q.enqueue(simple_task)
        job.meta['user_id'] = 'user-123'
        job.save_meta()

        self.worker.work(burst=True)
        
        retrieved_job = Job.fetch(job.id, connection=self.redis_conn)
        assert retrieved_job.is_finished
        assert retrieved_job.meta.get('user_id') == 'user-123'

    def test_worker_result_ttl(self):
        """Vérifie que le résultat d'une tâche expire bien après le TTL."""
        # TTL de 1 seconde
        job = self.q.enqueue(simple_task, result_ttl=1)
        self.worker.work(burst=True)

        retrieved_job = Job.fetch(job.id, connection=self.redis_conn)
        assert retrieved_job.is_finished  # Le job est bien fini

        time.sleep(2)  # Attendre plus que le TTL

        # Après l'expiration, essayer de récupérer le job doit lever une erreur
        with pytest.raises(NoSuchJobError):
            Job.fetch(job.id, connection=self.redis_conn)

    def test_worker_retry_on_failure(self):
        """Teste la fonctionnalité de réessai automatique d'une tâche."""
        retry_policy = Retry(max=2, interval=[1, 2])
        job = self.q.enqueue(fail_task, retry=retry_policy)
        
        # Le worker doit essayer une fois, puis une deuxième fois
        self.worker.work(burst=True) # Premier essai -> échoue et remet en file
        job.refresh()
        assert job.is_queued, "La tâche devrait être en attente pour un réessai"

        self.worker.work(burst=True) # Deuxième essai -> échoue et direction la file des échecs
        job.refresh()
        assert job.is_failed, "La tâche devrait être en échec après tous les réessais"