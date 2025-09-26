#!/usr/bin/env python3
"""
Script pour tester les workers en isolation complète.
Utile pour débugger ou valider que Redis + RQ fonctionnent.
"""

import sys
import time
from rq import Queue, Worker, Connection
from redis import Redis

def test_job(name, duration=1):
    """Job de test simple"""
    print(f"Processing job: {name}")
    time.sleep(duration) 
    return f"Completed: {name}"

def main():
    try:
        # Connexion Redis (ajuster selon ton environnement)
        redis_conn = Redis(host='localhost', port=6379, db=0)
        redis_conn.ping()
        print("✅ Redis connection OK")
        
        with Connection(redis_conn):
            # Créer queue de test
            test_queue = Queue("test_workers")
            test_queue.empty()
            
            print(f"📋 Queue state: {len(test_queue)} jobs")
            
            # Enqueuer des jobs de test
            jobs = []
            for i in range(3):
                job = test_queue.enqueue(test_job, f"Task-{i+1}", duration=0.5)
                jobs.append(job)
                print(f"➕ Enqueued job: {job.id}")
            
            print(f"📋 Queue state: {len(test_queue)} jobs")
            
            # Démarrer worker en mode burst (traite tout et s'arrête)
            print("🔧 Starting worker...")
            worker = Worker([test_queue])
            result = worker.work(burst=True)
            
            print(f"⚡ Worker finished: {result}")
            print(f"📋 Final queue state: {len(test_queue)} jobs")
            
            # Vérifier résultats
            for i, job in enumerate(jobs):
                job.refresh()
                status = job.get_status()
                print(f"📊 Job {i+1}: {status} - {job.return_value}")
                
            print("✅ Workers test completed successfully!")
            
    except Exception as e:
        print(f"❌ Workers test failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()