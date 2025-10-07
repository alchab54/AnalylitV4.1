#!/usr/bin/env python3
"""
Orchestrateur de Workflow ATN - Exécution Séquentielle Optimisée
================================================================
Garantit l'ordre d'exécution correct des tâches pour l'analyse ATN
"""
import time
import logging
from datetime import datetime
from typing import List, Dict, Any
from redis import Redis
from rq import Queue, Job
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from backend.config.config_v4 import get_config
from utils.notifications import send_project_notification

logger = logging.getLogger(__name__)
config = get_config()

class ATNWorkflowOrchestrator:
    """Orchestrateur pour pipeline ATN séquentiel"""
    
    def __init__(self):
        self.redis_conn = Redis.from_url(config.REDIS_URL)
        
        # QUEUES SPÉCIALISÉES par ÉTAPE
        self.queue_import = Queue('import_queue', connection=self.redis_conn)        # Articles + PDFs
        self.queue_screening = Queue('screening_queue', connection=self.redis_conn)  # Tri initial
        self.queue_extraction = Queue('extraction_queue', connection=self.redis_conn) # IA lourde
        self.queue_analysis = Queue('analysis_queue', connection=self.redis_conn)    # Calculs finaux
        self.queue_reporting = Queue('reporting_queue', connection=self.redis_conn)  # Synthèses
    
    def launch_atn_workflow(self, project_id: str, articles_data: List[Dict], 
                           profile: Dict, fetch_pdfs: bool = True) -> Dict[str, str]:
        """Lance le workflow ATN complet en séquence"""
        
        logger.info(f"🚀 Lancement workflow ATN séquentiel pour projet {project_id}")
        
        # ÉTAPE 1: Import des articles (PRIORITÉ HAUTE)
        import_job = self.queue_import.enqueue(
            'backend.tasks_v4_complete.add_manual_articles_task',
            project_id=project_id,
            identifiers=[article.get('pmid', article.get('id', f'MANUAL_{i}')) 
                        for i, article in enumerate(articles_data)],
            job_timeout='5m',
            priority='high'
        )
        
        # ÉTAPE 2: Récupération PDFs en parallèle (si demandé)
        pdf_jobs = []
        if fetch_pdfs:
            for article in articles_data[:10]:  # Limite à 10 pour éviter surcharge
                article_id = article.get('pmid', article.get('id'))
                if article_id:
                    pdf_job = self.queue_import.enqueue(
                        'backend.tasks_v4_complete.fetch_online_pdf_task',
                        project_id=project_id,
                        article_id=article_id,
                        job_timeout='3m',
                        depends_on=import_job
                    )
                    pdf_jobs.append(pdf_job)
        
        # ÉTAPE 3: Screening (attendre import)
        screening_job = self.queue_screening.enqueue(
            'backend.tasks_v4_complete.run_batch_screening_task',
            project_id=project_id,
            profile=profile,
            job_timeout='10m',
            depends_on=import_job  # Attendre que l'import soit terminé
        )
        
        # ÉTAPE 4: Extraction ATN (attendre screening)
        extraction_job = self.queue_extraction.enqueue(
            'backend.tasks_v4_complete.run_atn_extraction_task',
            project_id=project_id,
            profile=profile,
            use_atn_grid=True,
            job_timeout='20m',
            depends_on=screening_job
        )
        
        # ÉTAPE 5: Analyse des scores (attendre extractions)  
        analysis_job = self.queue_analysis.enqueue(
            'backend.tasks_v4_complete.run_atn_score_task',
            project_id=project_id,
            job_timeout='5m',
            depends_on=extraction_job
        )
        
        # ÉTAPE 6: Synthèse finale (attendre analyses)
        synthesis_job = self.queue_reporting.enqueue(
            'backend.tasks_v4_complete.run_synthesis_task',
            project_id=project_id,
            profile=profile,
            job_timeout='15m', 
            depends_on=analysis_job
        )
        
        # Notification du lancement
        send_project_notification(
            project_id, 
            'workflow_started',
            'Workflow ATN séquentiel démarré (6 étapes)',
            {
                'steps': ['import', 'pdfs', 'screening', 'extraction', 'analysis', 'synthesis'],
                'total_articles': len(articles_data),
                'fetch_pdfs': fetch_pdfs
            }
        )
        
        return {
            'import_job': import_job.id,
            'screening_job': screening_job.id,
            'extraction_job': extraction_job.id,
            'analysis_job': analysis_job.id,
            'synthesis_job': synthesis_job.id,
            'pdf_jobs': [job.id for job in pdf_jobs]
        }

# Instance globale
orchestrator = ATNWorkflowOrchestrator()
