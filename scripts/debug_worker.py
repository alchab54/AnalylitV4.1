#!/usr/bin/env python3
"""
Worker de debugging pour analyser les jobs en attente
"""
import redis
from rq import Queue, Worker
import sys
import time

def debug_queues():
    """Debug les queues Redis"""
    r = redis.from_url('redis://localhost:6379/0')
    
    queues = ['default', 'analysis', 'synthesis_queue', 'discussion_draft_queue']
    
    print("🔍 ÉTAT DES QUEUES REDIS:")
    print("=" * 50)
    
    for queue_name in queues:
        q = Queue(queue_name, connection=r)
        jobs = q.get_jobs()
        
        print(f"📋 Queue '{queue_name}':")
        print(f"   - Jobs en attente: {len(jobs)}")
        print(f"   - Taille: {q.count}")
        
        for job in jobs[:3]:  # Affiche les 3 premiers
            print(f"   - Job {job.id}: {job.func_name} ({job.get_status()})")
        
        if len(jobs) > 3:
            print(f"   - ... et {len(jobs)-3} autres")
        print()

def run_debug_worker():
    """Lance un worker avec logs verbeux"""
    r = redis.from_url('redis://localhost:6379/0')
    
    # Worker qui écoute toutes les queues importantes
    queues = [
        Queue('analysis', connection=r),
        Queue('default', connection=r),
        Queue('synthesis_queue', connection=r)
    ]
    
    worker = Worker(queues, connection=r)
    print("🚀 Worker de debugging démarré - écoute toutes les queues")
    print("📊 Appuyez Ctrl+C pour arrêter")
    
    try:
        worker.work(with_scheduler=True, logging_level='DEBUG')
    except KeyboardInterrupt:
        print("⚠️ Worker arrêté")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "debug":
        debug_queues()
    else:
        run_debug_worker()
