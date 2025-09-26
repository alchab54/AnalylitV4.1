import time
import uuid
import pytest
from rq import Queue, Connection, Worker
from redis import Redis

def long_add(a, b, delay=0.1):
    """Fonction de test pour simuler une charge."""
    if delay:
        time.sleep(delay)
    return a + b

def boom(msg="boom"):
    raise RuntimeError(msg)

@pytest.fixture(scope="module")
def redis_conn():
    conn = Redis(host="redis", port=6379, db=0)
    yield conn
    conn.flushdb()

@pytest.fixture
def queues(redis_conn):
    with Connection(redis_conn):
        q_default = Queue("default")
        q_high = Queue("high")
        q_low = Queue("low")
        yield q_default, q_high, q_low
        q_default.empty()
        q_high.empty()
        q_low.empty()

def test_worker_consumes_job(queues, redis_conn):
    q_default, _, _ = queues
    with Connection(redis_conn):
        job = q_default.enqueue(long_add, 2, 3, delay=0)
        worker = Worker([q_default])
        res = worker.work(burst=True)  # exécute les jobs disponibles et s’arrête
        assert res is True
        job.refresh()
        assert job.is_finished
        assert job.return_value == 5

def test_worker_captures_failure(queues, redis_conn):
    q_default, _, _ = queues
    with Connection(redis_conn):
        job = q_default.enqueue(boom, "crash")
        worker = Worker([q_default])
        worker.work(burst=True)
        job.refresh()
        assert job.is_failed
        # RQ >=1.15: latest_result contient l’info d’erreur
        assert job.get_status() == "failed"
        assert "RuntimeError" in (job.exc_info or "")

def test_worker_multi_queues_priority(queues, redis_conn):
    q_default, q_high, q_low = queues
    with Connection(redis_conn):
        j_low = q_low.enqueue(long_add, 1, 1, delay=0)
        j_high = q_high.enqueue(long_add, 2, 2, delay=0)
        # Worker écoute high puis default puis low
        worker = Worker([q_high, q_default, q_low])
        worker.work(burst=True)
        j_high.refresh()
        j_low.refresh()
        assert j_high.is_finished
        assert j_low.is_finished
        assert j_high.return_value == 4
        assert j_low.return_value == 2

def test_worker_retry_on_failure(queues, redis_conn):
    q_default, _, _ = queues
    # Wrapper qui échoue la première fois, réussit ensuite
    calls = {"n": 0}
    def flaky():
        calls["n"] += 1
        if calls["n"] == 1:
            raise ValueError("first fail")
        return 42

    with Connection(redis_conn):
        job = q_default.enqueue(flaky, retry=3)  # autoriser retry
        worker = Worker([q_default])
        worker.work(burst=True)
        job.refresh()
        # Selon timing, RQ peut rescheduler le retry - on force un second passage
        if not job.is_finished:
            worker.work(burst=True)
            job.refresh()
        assert job.is_finished
        assert job.return_value == 42