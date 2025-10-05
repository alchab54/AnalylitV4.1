# -*- coding: utf-8 -*-

"""
Tests spécifiques des workers AnalyLit avec la vraie logique métier.
Ces tests vérifient l'intégration complète workers + AI + database.
"""

import pytest
import time
from unittest.mock import patch, MagicMock
from rq import Queue, Worker
from redis import from_url

# Ce test ne nécessite plus l'import de simple_task car il se concentre sur les vraies tâches
# from tests.test_workers_core import simple_task 

# --- Les Mocks ne sont plus nécessaires pour le test d'intégration principal,
# mais peuvent être gardés pour d'autres tests unitaires si besoin.
DiscussionGenerator = MagicMock()
KnowledgeGraphGenerator = MagicMock()
DatabaseManager = MagicMock()
SearchTask = MagicMock()
AnalysisTask = MagicMock()

# --- Les fonctions de tâches de test (comme discussion_task_for_test) ne sont plus
# utilisées par le test d'intégration, car nous appelons les vraies tâches.
# Elles peuvent être gardées pour des tests unitaires plus simples.

@pytest.fixture
def redis_conn():
    """Connexion Redis pour les assertions (avec décodage)."""
    return from_url("redis://redis:6379/0", decode_responses=True)

@pytest.fixture
def rq_connection():
    """Connexion Redis pour RQ (SANS décodage)."""
    return from_url("redis://redis:6379/0", decode_responses=False)

@pytest.fixture
def discussion_queue(rq_connection):
    """
    Fixture qui fournit une connexion à la file d'attente 'discussion_draft_queue'.
    Cette file est supposée être écoutée par un des workers actifs.
    """
    # Cible la bonne file d'attente
    queue = Queue("discussion_draft_queue", connection=rq_connection)
    queue.empty() # Nettoie la file avant le test
    yield queue

@pytest.mark.integration
class TestAnalyLitWorkers:
    """Tests d'intégration réels pour les workers AnalyLit."""
    
    def test_discussion_analysis_worker(self, discussion_queue, db_session, setup_project):
        """
        Test d'intégration COMPLET :
        1. Met une vraie tâche dans une vraie file d'attente Redis.
        2. Attend qu'un des workers actifs (lancés par docker-compose) la traite.
        3. Vérifie que le statut du job est bien 'finished' et que l'effet en base de données a eu lieu.
        """
        # Étape 1 : Préparation des données
        # On utilise le projet créé par la fixture 'setup_project' qui a maintenant un nom.
        project_id = setup_project.id
        
        # Étape 2 : Mettre en file d'attente la VRAIE tâche
        # On passe le chemin de la tâche sous forme de chaîne, c'est la pratique la plus robuste pour RQ.
        job = discussion_queue.enqueue(
            'backend.tasks_v4_complete.run_discussion_generation_task',
            project_id=project_id,
        )
        
        print(f"\n[TEST] Tâche {job.id} mise dans la file '{discussion_queue.name}'. En attente d'un worker...")

        # Étape 3 : Attendre que le worker termine la tâche (Polling)
        # C'est la partie clé qui rend le test fiable. On vérifie le statut du job à intervalles réguliers.
        timeout = 20  # secondes
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            # On rafraîchit l'état du job depuis Redis
            job.refresh()
            if job.is_finished:
                print(f"[TEST] La tâche {job.id} est terminée avec le statut : {job.get_status()}")
                break
            if job.is_failed:
                # Affiche l'erreur complète du worker pour un débogage facile
                pytest.fail(f"La tâche {job.id} a échoué. Traceback du worker:\n{job.exc_info}")
            
            time.sleep(1) # Attendre 1 seconde avant de vérifier à nouveau

        # Étape 4 : Assertions finales
        assert job.is_finished, f"La tâche n'a pas terminé dans le temps imparti de {timeout}s. Statut actuel: {job.get_status()}"
        
        # Puisque la tâche 'run_discussion_generation_task' ne retourne pas de valeur mais met à jour la DB,
        # nous vérifions son effet de bord.
        db_session.refresh(setup_project)
        
        # On s'attend à 'failed' car il n'y a pas de données d'extraction pour un projet de test vide,
        # ce qui est un comportement métier correct pour la tâche.
        # 'completed' serait aussi une fin valide si la tâche gérait ce cas.
        assert setup_project.status in ['failed', 'completed'], f"Le statut final du projet est inattendu : {setup_project.status}"
        
        # Le brouillon ne devrait pas être généré si la tâche échoue logiquement
        assert setup_project.discussion_draft is None, "Un brouillon de discussion a été généré alors qu'il ne devrait pas."
        
        print(f"[TEST] Validation réussie. Statut final du projet : {setup_project.status}")


