#!/usr/bin/env python3
"""
Test du workflow ATN complet pour AnalyLit v4.1
Teste l'équation PubMed spécialisée Alliance Thérapeutique Numérique
"""

import requests
import time
import json
import sys
from datetime import datetime

class AnalyLitATNWorkflow:
    def __init__(self, base_url="http://localhost:5000"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.project_id = None
        self.results = {}
        
    def log(self, message, **kwargs):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {message}", **kwargs)
        
    def check_health(self):
        """Vérifier que l'application répond"""
        try:
            response = requests.get(f"{self.api_url}/health", timeout=10)
            if response.status_code == 200:
                self.log("✓ AnalyLit v4.1 accessible")
                return True
        except Exception as e:
            self.log(f"✗ Application inaccessible: {e}")
        return False
    
    def create_project(self, name, description):
        """Créer un nouveau projet ATN"""
        payload = {
            "name": name,
            "description": description,
            "analysis_mode": "full"
        }
        
        try:
            response = requests.post(
                f"{self.api_url}/projects",
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            
            if response.status_code == 201:
                project_data = response.json()
                self.project_id = project_data.get('id')
                self.log(f"✓ Projet créé: {name} (ID: {self.project_id})")
                return True
            else:
                self.log(f"✗ Échec création projet: {response.status_code} - {response.text}")
                
        except Exception as e:
            self.log(f"✗ Erreur création projet: {e}")
            
        return False

    def run_atn_search(self):
        """Lancer la recherche avec l'équation ATN spécialisée"""
        if not self.project_id:
            self.log("✗ Pas de projet actif")
            return False
            
        atn_query = '''("Therapeutic Alliance"[Mesh] OR "therapeutic alliance"[tiab] OR "working alliance"[tiab] OR "treatment alliance"[tiab]) AND ("Digital Technology"[Mesh] OR "Virtual Reality"[Mesh] OR "Virtual Reality Exposure Therapy"[Mesh] OR "Artificial Intelligence"[Mesh] OR "Empathy"[Mesh] OR "Digital Health"[Mesh] OR mHealth[tiab] OR eHealth[tiab] OR digital*[tiab] OR virtual*[tiab] OR "artificial intelligence"[tiab] OR chatbot*[tiab] OR "empathy"[tiab]) AND ("2020/01/01"[Date - Publication] : "2025/06/25"[Date - Publication])'''
        
        search_payload = {
            "query": atn_query,
            "databases": ["pubmed"],
            "max_results_per_db": 50,
            "project_id": self.project_id
        }
        
        try:
            response = requests.post(
                f"{self.api_url}/search",
                json=search_payload,
                timeout=300
            )
            
            if response.status_code == 202:
                job_data = response.json()
                job_id = job_data.get('job_id')
                self.log(f"✓ Recherche lancée (Job: {job_id})")
                
                return self.wait_for_task(job_id, "recherche ATN", timeout=900) # ✅ TIMEOUT AJUSTÉ
            else:
                self.log(f"✗ Échec recherche: {response.status_code}")
                
        except Exception as e:
            self.log(f"✗ Erreur recherche: {e}")
            
        return False

    def wait_for_task(self, job_id, task_name="tâche", timeout=900): # ✅ TIMEOUT PAR DÉFAUT AUGMENTÉ
        """Attendre qu'une tâche asynchrone se termine"""
        if not job_id:
            return False
            
        start_time = time.time()
        self.log(f"⏳ Attente de la {task_name}...")
        
        while time.time() - start_time < timeout:
            try:
                response = requests.get(
                    f"{self.api_url}/tasks/{job_id}/status",
                    timeout=10
                )
                
                if response.status_code == 200:
                    task_data = response.json()
                    status = task_data.get('status')
                    queue_name = task_data.get('queue_name', 'N/A') # Pour le debug
                    
                    if status == 'finished': # ✅ CORRECTION: RQ utilise 'finished'
                        self.log(f"✓ {task_name} terminée avec succès")
                        return True
                    elif status == 'failed':
                        error = task_data.get('exc_info', 'Erreur inconnue') # ✅ CORRECTION: Utiliser exc_info
                        self.log(f"✗ {task_name} échouée: {error}")
                        return False
                    elif status in ['queued', 'started']: # ✅ CORRECTION: RQ utilise 'started'
                        progress = task_data.get('progress')
                        if progress:
                            self.log(f"⏳ {task_name} en cours... ({progress:.1%})", end='\r')
                        else:
                            self.log(f"⏳ {task_name} en cours (statut: {status}, file: {queue_name})...", end='\r')
                        
            except Exception as e:
                self.log(f"⚠️ Erreur vérification statut ({job_id}): {e}")
                # Petite pause en cas d'erreur réseau avant de réessayer
                time.sleep(2)
                
            time.sleep(5) # Pause entre chaque vérification

        self.log(f"⏰ Timeout: {task_name} trop longue")
        return False

    def get_search_results(self):
        """Récupérer les résultats de recherche"""
        if not self.project_id:
            return []
            
        try:
            response = requests.get(
                f"{self.api_url}/projects/{self.project_id}/search-results",
                params={"page": 1, "per_page": 100},
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                results = data.get('results', [])
                total = data.get('total', 0)
                
                self.log(f"✓ {len(results)} articles récupérés (total: {total})")
                
                for i, article in enumerate(results[:5]):
                    title = article.get('title', 'Titre non disponible')[:100]
                    self.log(f"  [{i+1}] {title}...")
                    
                return results
                
        except Exception as e:
            self.log(f"✗ Erreur récupération résultats: {e}")
            
        return []

    def run_atn_analysis(self):
        """Lancer les analyses spécialisées ATN"""
        if not self.project_id:
            return False
            
        analyses = ["atn_scores", "descriptive_stats", "synthesis"]
        results = {}
        
        for analysis_type in analyses:
            self.log(f"🔬 Lancement analyse: {analysis_type}")
            payload = {
                "type": analysis_type,
                "parameters": {
                    "atn_focused": True,
                    "include_digital_health": True,
                    "therapeutic_alliance_priority": True
                }
            }
            
            try:
                response = requests.post(
                    f"{self.api_url}/projects/{self.project_id}/run-analysis",
                    json=payload,
                    timeout=60
                )
                
                if response.status_code == 202:
                    job_data = response.json()
                    job_id = job_data.get('job_id')
                    
                    if self.wait_for_task(job_id, f"analyse {analysis_type}", timeout=900): # ✅ TIMEOUT AUGMENTÉ
                        results[analysis_type] = "success"
                    else:
                        results[analysis_type] = "failed"
                else:
                    self.log(f"✗ Échec lancement {analysis_type}: {response.status_code}")
                    results[analysis_type] = "failed"
                    
            except Exception as e:
                self.log(f"✗ Erreur {analysis_type}: {e}")
                results[analysis_type] = "failed"
                
            time.sleep(2)
        
        success_count = sum(1 for status in results.values() if status == "success")
        self.log(f"📊 Analyses terminées: {success_count}/{len(analyses)} réussies")
        
        return success_count > 0

    def export_results(self):
        """Exporte les résultats du projet."""
        self.log("Lancement de la tâche d'export Excel...")
        try:
            # ✅ CORRECTION: Utiliser le bon endpoint qui enfile une tâche
            response = requests.post(f"{self.api_url}/projects/{self.project_id}/reports/excel-export", timeout=60)
            
            if response.status_code == 202:
                job_data = response.json()
                job_id = job_data.get('job_id')
                self.log(f"✓ Tâche d'export lancée (Job: {job_id})")
                
                # Attendre la fin de la tâche d'export
                return self.wait_for_task(job_id, "export Excel", timeout=300)
            else:
                self.log(f"✗ Échec du lancement de l'export: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            self.log(f"✗ Échec de l'export: {e}")
            return False

    def run_complete_atn_workflow(self):
        """Exécuter le workflow ATN complet"""
        self.log("🚀 Test Workflow ATN - Alliance Thérapeutique Numérique")
        self.log("=" * 60)
        
        steps = [
            ("Vérification application", self.check_health),
            ("Création projet ATN", lambda: self.create_project(
                "Test ATN - Alliance Thérapeutique Numérique",
                "Test automatique de l'équation PubMed ATN avec workflow complet"
            )),
            ("Recherche PubMed ATN", self.run_atn_search),
            ("Récupération résultats", lambda: len(self.get_search_results()) > 0),
            ("Analyses ATN", self.run_atn_analysis),
            ("Export final", self.export_results)
        ]
        
        success_count = 0
        total_steps = len(steps)
        
        for step_name, step_func in steps:
            self.log(f"📋 Étape: {step_name}")
            try:
                if step_func():
                    self.log(f"✓ {step_name} - Succès")
                    success_count += 1
                else:
                    self.log(f"✗ {step_name} - Échec")
            except Exception as e:
                self.log(f"✗ {step_name} - Erreur: {e}")
            
            self.log("-" * 40)
        
        success_rate = (success_count / total_steps) * 100
        self.log("=" * 60)
        self.log(f"📊 RÉSULTATS: {success_count}/{total_steps} étapes réussies ({success_rate:.1f}%)")
        
        if success_count >= total_steps * 0.8:
            self.log("🎉 Workflow ATN fonctionnel !")
            return True
        else:
            self.log("⚠️ Workflow partiellement fonctionnel - vérifications manuelles recommandées")
            return False

if __name__ == "__main__":
    workflow = AnalyLitATNWorkflow()
    
    print("\n" + "="*60)
    print("🔬 TEST WORKFLOW ATN - ANALYLIT V4.1")
    print("Équation PubMed: Alliance Thérapeutique Numérique")
    print("⚠️  IMPORTANT: Résultats à valider manuellement")
    print("="*60 + "\n")
    
    success = workflow.run_complete_atn_workflow()
    
    print("\n" + "="*60)
    if success:
        print("✅ Test terminé avec succès")
        print("➡️  Vérifiez les résultats dans l'interface web")
    else:
        print("❌ Test partiellement échoué")
        print("➡️  Consultez les logs pour diagnostic")
    print("="*60)
    
    sys.exit(0 if success else 1)