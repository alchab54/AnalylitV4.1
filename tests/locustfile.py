# locustfile.py
# Fichier de test de charge pour AnalyLit v4.1

import json
import uuid
from locust import HttpUser, task, between

# IDs statiques (simulant ce qu'un utilisateur pourrait avoir)
# Dans un test réel, cette donnée serait dynamique (récupérée par un setup_task)
PROJECT_ID = "00000000-0000-0000-0000-000000000001" # Un ID de projet connu/fixe
PROFILE_ID = "standard" # Le profil par défaut

class AnalyLitUser(HttpUser):
    # Les utilisateurs virtuels attendent entre 5 et 15 secondes entre chaque action
    wait_time = between(5, 15)
    
    def on_start(self):
        """ Crée un projet de test unique pour cet utilisateur (ce 'user' locust) """
        project_name = f"Projet-Charge-{uuid.uuid4()}"
        response = self.client.post(
            "/api/projects", 
            json={"name": project_name, "description": "Test de charge locust", "mode": "screening"}
        )
        if response.ok:
            self.project_id = response.json().get("id")
        else:
            # Si la création échoue, nous utilisons l'ID statique
            self.project_id = PROJECT_ID

    @task(5) # Tâche 5 fois plus fréquente que les autres
    def run_search_and_analysis_pipeline(self):
        """
        Simule le workflow le plus lourd : 
        1. Lancer une recherche (tâche background_queue)
        2. Lancer un screening IA (N tâches processing_queue)
        3. Lancer une analyse RoB (N tâches analysis_queue)
        """
        
        # 1. Lancer une recherche
        self.client.post(
            "/api/search",
            json={
                "project_id": self.project_id,
                "query": "diabetes",
                "databases": ["pubmed"],
                "max_results_per_db": 10 # Garder bas pour le test de charge
            }
        )
        
        # 2. Simuler un screening sur 10 articles (simulés, la tâche de screening est rapide)
        self.client.post(
            f"/api/projects/{self.project_id}/run",
            json={
                "articles": [f"pmid_locust_{i}" for i in range(10)],
                "profile": PROFILE_ID,
                "analysis_mode": "screening"
            }
        )

        # 3. Lancer une analyse RoB sur 2 articles (plus lourd)
        self.client.post(
            f"/api/projects/{self.project_id}/run-rob-analysis",
            json={"article_ids": ["pmid_locust_0", "pmid_locust_1"]}
        )

    @task(1) # Tâche moins fréquente
    def get_project_list(self):
        """ Simule un utilisateur chargeant la page d'accueil """
        self.client.get("/api/projects")

    @task(1)
    def ask_chat_rag(self):
        """ Simule une question au Chat (tâche RAG) """
        self.client.post(
            f"/api/projects/{self.project_id}/chat",
            json={"question": "Quels sont les thèmes principaux ?"}
        )