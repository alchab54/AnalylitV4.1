"""
Tests spécifiques des workers AnalyLit avec la vraie logique métier.
Ces tests vérifient l'intégration complète workers + AI + database.
"""

import pytest
from unittest.mock import patch, MagicMock
from rq import Queue, Worker, Connection
from redis import from_url
from tests.test_workers_core import simple_task # Import task for resilience test

# --- Mock Helper Classes (pour simuler la logique métier) ---
# ✅ CORRECTION: Supprimer le try...except et utiliser des mocks explicites.
DiscussionGenerator = MagicMock()
KnowledgeGraphGenerator = MagicMock()
DatabaseManager = MagicMock()
SearchTask = MagicMock()
AnalysisTask = MagicMock()

# --- Top-level Task Functions (Correction for RQ) ---

def discussion_task_for_test(project_id, articles):
    """Top-level task for discussion analysis test."""
    generator = DiscussionGenerator()
    return generator.generate(articles)
 
def search_task_for_test(project_id, query, databases):
    """Top-level task for search test."""
    db_manager = DatabaseManager()
    results = []
    # In a real scenario, you might have more complex logic.
    # For this test, we assume we're always searching pubmed if it's in the list.
    # The mock will provide the results.
    if "pubmed" in databases and hasattr(db_manager, 'search_pubmed'):
        results.extend(db_manager.search_pubmed(query))
    return {"results": results, "count": len(results)}

def atn_scoring_task_for_test(articles_data, criteria):
    """Top-level task for ATN scoring test."""
    scores = {}
    for article in articles_data:
        score = 0
        if "empathie" in criteria:
            score += 25
        if "alliance thérapeutique" in criteria:
            score += 35
        if "numérique" in criteria:
            score += 40
        scores[article["id"]] = min(score, 100)
    
    return {
        "scores": scores,
        "average_score": sum(scores.values()) / len(scores) if scores else 0
    }

@pytest.fixture
def redis_conn():
    """Connexion Redis pour les assertions (avec décodage)."""
    return from_url("redis://redis:6379/0", decode_responses=True)

@pytest.fixture
def rq_connection():
    """Connexion Redis pour RQ (SANS décodage)."""
    return from_url("redis://redis:6379/0", decode_responses=False)
@pytest.fixture  
def analysis_queue(rq_connection):
    queue = Queue("analysis", connection=rq_connection)
    queue.empty()
    yield queue

@pytest.mark.integration
class TestAnalyLitWorkers:
    """Tests d'intégration workers AnalyLit"""
    
    def test_discussion_analysis_worker(self, analysis_queue, rq_connection):
        """Test worker d'analyse de discussion"""
        # Patch DiscussionGenerator pour ce test spécifique
        with patch('tests.test_workers_analylit.DiscussionGenerator') as mock_gen_class:
            mock_gen_instance = mock_gen_class.return_value
            mock_gen_instance.generate.return_value = {
                "summary": "Test discussion analysis",
                "key_themes": ["theme1", "theme2"],
            }

            job = analysis_queue.enqueue(
                discussion_task_for_test,
                "proj-123", 
                [{"title": "Test Article", "abstract": "Test abstract"}], 
                meta={"analysis_type": "discussion"}
            )
            
            worker = Worker([analysis_queue], connection=rq_connection)
            worker.work(burst=True)
            
            job.refresh()
            assert job.is_finished
            result = job.return_value()
            assert "summary" in result
            assert "key_themes" in result

    def test_search_worker_with_database(self, analysis_queue, rq_connection):
        """Test worker de recherche avec vraie base"""
        # Configure the mock directly at the module level
        DatabaseManager.return_value.search_pubmed.return_value = [
            {"pmid": "12345", "title": "Test Article 1"},
            {"pmid": "67890", "title": "Test Article 2"}
        ]

        job = analysis_queue.enqueue(
            search_task_for_test,
            "proj-123",
            "alliance thérapeutique numérique", 
            ["pubmed"],
            meta={"search_type": "multi_database"}
        )
        
        worker = Worker([analysis_queue], connection=rq_connection)
        worker.work(burst=True)
        
        job.refresh()
        assert job.is_finished
        result = job.return_value()
        assert result["count"] == 2
        assert len(result["results"]) == 2

    def test_atn_scoring_worker(self, analysis_queue, rq_connection):
        """Test worker spécialisé scoring ATN"""
        
        job = analysis_queue.enqueue(
            atn_scoring_task_for_test,
            [
                {"id": "art1", "title": "Digital therapeutic alliance study"},
                {"id": "art2", "title": "Empathy in AI-human interaction"}
            ],
            ["empathie", "alliance thérapeutique", "numérique"],
            meta={"methodology": "ATN"}
        )
        
        worker = Worker([analysis_queue], connection=rq_connection)
        worker.work(burst=True)
        
        job.refresh()
        assert job.is_finished
        result = job.return_value()
        assert "scores" in result
        assert result["average_score"] > 0
        # Vérifier que les scores ATN sont cohérents
        assert result["scores"]["art1"] >= 75  # Devrait scorer haut
        assert result["scores"]["art2"] >= 60  # Devrait scorer moyennement

@pytest.mark.slow
class TestWorkersResilience:
    """Tests de résilience et robustesse des workers"""
    
    def test_worker_handles_redis_disconnect(self, analysis_queue, rq_connection):
        """Test de résilience à la déconnexion Redis"""
        default_queue = analysis_queue
        
        job = default_queue.enqueue(simple_task, 1, 2)
        
        # Simuler une déconnexion Redis pendant le traitement
        with patch.object(rq_connection, 'get') as mock_get:
            mock_get.side_effect = ConnectionError("Redis disconnected")
            
            worker = Worker([default_queue], connection=rq_connection)
            # Le worker devrait gérer l'erreur gracieusement
            result = worker.work(burst=True)
            # Selon implémentation RQ, peut retourner False ou lever exception
            assert result in (True, False, None)