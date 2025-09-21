# locustfile.py
# Fichier de test de charge pour AnalyLit v4.1

import uuid
from locust import HttpUser, task, between

# IDs statiques (simulant ce qu'un utilisateur pourrait avoir)
# Dans un test réel, cette donnée serait dynamique (récupérée par un setup_task)
# Note: L'ID de profil 'standard' est créé par le seeding de la base de données.
DEFAULT_PROFILE_ID = "standard" 

class AnalyLitUser(HttpUser):
    # Les utilisateurs virtuels attendent entre 5 et 15 secondes entre chaque action
    wait_time = between(5, 15)
    
    def on_start(self):
        """ Crée un projet de test unique pour cet utilisateur (ce 'user' locust) """
        project_name = f"Projet-Charge-{uuid.uuid4()}"
        with self.client.post(
            "/api/projects/", 
            json={"name": project_name, "description": "Test de charge locust", "mode": "screening"},
            name="/api/projects/ (create)",
            catch_response=True
        ) as response:
            if response.ok:
                self.project_id = response.json().get("id")
            else:
                # Si la création échoue, on arrête ce "user" virtuel.
                self.stop()

    @task(5) # Tâche 5 fois plus fréquente que les autres
    def run_search_and_analysis_pipeline(self):
        """
        Simule le workflow le plus lourd : 
        1. Lancer une recherche (tâche background_queue).
        2. Lancer un screening IA (N tâches processing_queue).
        3. Lancer une analyse RoB (N tâches analysis_queue).
        """
        if not hasattr(self, 'project_id'):
            return # Ne rien faire si le projet n'a pas été créé
        
        # 1. Lancer une recherche
        self.client.post(
            "/api/search",
            json={
                "project_id": self.project_id,
                "query": "digital therapeutic alliance",
                "databases": ["pubmed"],
                "max_results_per_db": 20 # Volume modéré pour simuler une recherche réelle
            },
            name="/api/search"
        )
        
        # 2. Simuler un screening sur 20 articles (simulés, la tâche de screening est rapide)
        self.client.post(
            f"/api/projects/{self.project_id}/run",
            json={
                "articles": [f"pmid_locust_{i}" for i in range(20)],
                "profile": DEFAULT_PROFILE_ID,
                "analysis_mode": "screening"
            },
            name="/api/projects/{id}/run"
        )

        # 3. Lancer une analyse RoB sur 5 articles (plus lourd)
        self.client.post(
            f"/api/projects/{self.project_id}/run-rob-analysis",
            json={"article_ids": [f"pmid_locust_{i}" for i in range(5)]},
            name="/api/projects/{id}/run-rob-analysis"
        )

    @task(1) # Tâche moins fréquente
    def get_project_list(self):
        """ Simule un utilisateur chargeant la page d'accueil """
        self.client.get("/api/projects/", name="/api/projects/ (list)")

    @task(1)
    def ask_chat_rag(self):
        """ Simule une question au Chat (tâche RAG) """
        if not hasattr(self, 'project_id'):
            return
            
        self.client.post(
            f"/api/projects/{self.project_id}/chat",
            json={"question": "Quels sont les thèmes principaux dans ce corpus ?"},
            name="/api/projects/{id}/chat"
        )