#!/usr/bin/env python3
"""
Script de test pour AnalyLit v4.1
Teste le workflow de base avec l'équation ATN
"""

import requests
import time
import sys
from datetime import datetime

class AnalyLitTest:
    def __init__(self, base_url="http://localhost:5000"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.project_id = None
        self.session = requests.Session()
        self.found_articles = []

    def log(self, message):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {message}")

    def check_health(self):
        """Vérifier que l'application répond"""
        try:
            response = self.session.get(f"{self.api_url}/health", timeout=10)
            if response.status_code == 200:
                self.log("✓ Application accessible")
                return True
        except Exception as e:
            self.log(f"✗ Application inaccessible: {e}")
        return False

    def create_project(self):
        """Crée un projet de test via l'API."""
        self.log("Création d'un projet de test...")
        try:
            payload = {
                "name": f"Test ATN Workflow {datetime.now().strftime('%Y-%m-%d %H:%M')}",
                "description": "Projet de test automatisé pour le workflow ATN.",
                "analysis_mode": "screening"
            }
            response = self.session.post(f"{self.api_url}/projects", json=payload, timeout=15)
            response.raise_for_status()
            project_data = response.json()
            self.project_id = project_data.get("id")
            if self.project_id:
                self.log(f"✓ Projet créé avec succès (ID: {self.project_id})")
                return True
            else:
                self.log(f"✗ Erreur: L'ID du projet n'a pas été retourné. Réponse: {project_data}")
                return False
        except Exception as e:
            self.log(f"✗ Échec de la création du projet: {e}")
            return False

    def test_atn_search_equation(self):
        """Tester l'équation de recherche ATN fournie"""
        atn_query = '''("Therapeutic Alliance"[Mesh] OR "therapeutic alliance"[tiab] OR "working alliance"[tiab] OR "treatment alliance"[tiab]) AND ("Digital Technology"[Mesh] OR "Virtual Reality"[Mesh] OR "Virtual Reality Exposure Therapy"[Mesh] OR "Artificial Intelligence"[Mesh] OR "Empathy"[Mesh] OR "Digital Health"[Mesh] OR mHealth[tiab] OR eHealth[tiab] OR digital*[tiab] OR virtual*[tiab] OR "artificial intelligence"[tiab] OR chatbot*[tiab] OR "empathy"[tiab]) AND ("2020/01/01"[Date - Publication] : "2025/06/25"[Date - Publication])'''
        
        self.log("Lancement de la recherche ATN...")
        self.log(f"Équation: {atn_query[:100]}...")
        
        try:
            payload = {
                "query": atn_query,
                "databases": ["pubmed"],
                "max_results_per_db": 500
            }
            response = self.session.post(f"{self.api_url}/projects/{self.project_id}/search", json=payload, timeout=15)
            response.raise_for_status()
            task_data = response.json()
            task_id = task_data.get("job_id")
            if not task_id:
                self.log(f"✗ Erreur: La tâche de recherche n'a pas été créée. Réponse: {task_data}")
                return False

            self.log(f"✓ Tâche de recherche lancée (ID: {task_id}). Attente du résultat...")

            # Attendre la fin de la tâche
            for _ in range(30): # Timeout après 5 minutes
                time.sleep(10)
                status_response = self.session.get(f"{self.api_url}/tasks/{task_id}/status", timeout=10)
                status_data = status_response.json()
                status = status_data.get("status")
                self.log(f"  Statut de la tâche: {status}")
                if status == "completed":
                    self.log("✓ Tâche de recherche terminée.")
                    result = status_data.get("result", {})
                    articles_found_count = result.get("articles_found", 0)
                    self.log(f"  Nombre d'articles trouvés: {articles_found_count}")
                    
                    # Récupérer les articles pour l'étape suivante
                    articles_response = self.session.get(f"{self.api_url}/projects/{self.project_id}/articles", timeout=30)
                    articles_response.raise_for_status()
                    self.found_articles = articles_response.json().get("articles", [])
                    self.log(f"  {len(self.found_articles)} articles récupérés pour le screening.")

                    if articles_found_count >= 325:
                        self.log(f"✓ Succès: {articles_found_count} articles trouvés (seuil >= 325 atteint).")
                        return True
                    else:
                        self.log(f"✗ Échec: {articles_found} articles trouvés, ce qui est inférieur au seuil de 325.")
                        return False
                if status == "failed":
                    self.log(f"✗ La tâche de recherche a échoué. Détails: {status_data.get('result')}")
                    return False
            
            self.log("✗ Timeout: La tâche de recherche a pris trop de temps.")
            return False
        except Exception as e:
            self.log(f"✗ Échec du lancement de la recherche: {e}")
            return False

    def run_screening(self):
        """Lance le screening IA sur les articles trouvés."""
        if not self.found_articles:
            self.log("✗ Aucun article à screener. Étape ignorée.")
            return False

        self.log(f"Lancement du screening IA sur {len(self.found_articles)} articles...")
        article_ids = [article['id'] for article in self.found_articles]

        try:
            payload = {
                "article_ids": article_ids,
                "analysis_mode": "screening",
                "profile": "fast" # Utilise le profil rapide pour un test plus court
            }
            response = self.session.post(f"{self.api_url}/projects/{self.project_id}/run", json=payload, timeout=15)
            response.raise_for_status()
            task_data = response.json()
            task_id = task_data.get("job_id")
            if not task_id:
                self.log(f"✗ Erreur: La tâche de screening n'a pas été créée. Réponse: {task_data}")
                return False

            self.log(f"✓ Tâche de screening lancée (ID: {task_id}). Attente du résultat...")

            for _ in range(60): # Timeout après 10 minutes
                time.sleep(10)
                status_response = self.session.get(f"{self.api_url}/tasks/{task_id}/status", timeout=10)
                status_data = status_response.json()
                status = status_data.get("status")
                self.log(f"  Statut de la tâche: {status}")
                if status == "completed":
                    self.log("✓ Screening terminé avec succès.")
                    return True
                if status == "failed":
                    self.log(f"✗ La tâche de screening a échoué. Détails: {status_data.get('result')}")
                    return False
            
            self.log("✗ Timeout: La tâche de screening a pris trop de temps.")
            return False
        except Exception as e:
            self.log(f"✗ Échec du lancement du screening: {e}")
            return False

    def export_results(self):
        """Exporte les résultats du projet."""
        self.log("Lancement de l'export des résultats en Excel...")
        try:
            response = self.session.get(f"{self.api_url}/projects/{self.project_id}/export/excel", timeout=30)
            response.raise_for_status()
            if response.headers.get('Content-Type') == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
                self.log(f"✓ Export réussi. {len(response.content)} bytes reçus.")
                return True
            return False
        except Exception as e:
            self.log(f"✗ Échec de l'export: {e}")
            return False

    def run_basic_test(self):
        """Exécute les tests de base"""
        self.log("🔬 Test de base AnalyLit v4.1")
        self.log("=" * 50)
        
        if not self.check_health() or not self.create_project() or not self.test_atn_search_equation() or not self.run_screening() or not self.export_results():
            self.log("\n❌ Le test du workflow de base a échoué.")
            return False
        
        self.log("=" * 50)
        self.log("🎉 ✓ Le workflow complet (création, recherche, screening, export) a été validé avec succès !")
        
        return True

if __name__ == "__main__":
    test = AnalyLitTest()
    success = test.run_basic_test()
    sys.exit(0 if success else 1)