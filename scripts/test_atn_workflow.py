#!/usr/bin/env python3
"""
Test du workflow ATN complet pour AnalyLit v4.1
Teste l'équation PubMed spécialisée Alliance Thérapeutique Numérique
"""

import requests
import time
import json
import os
import sys
from datetime import datetime

class AnalyLitATNWorkflow:
    def __init__(self):
        host = os.environ.get("API_HOST", "localhost")
        port = os.environ.get("API_PORT", "5000")
        base_url = f"http://{host}:{port}"
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.project_id = None
        self.results = {}
        
    def log(self, message, **kwargs):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] {message}", **kwargs)

    def __init__(self):
        if os.path.exists('/.dockerenv'):  # Dans un container
            host = os.environ.get("API_HOST", "web")  # Service web interne
            port = os.environ.get("API_PORT", "80")   # Port interne
        else:  # Depuis l'extérieur
            host = os.environ.get("API_HOST", "localhost")
            port = os.environ.get("API_PORT", "8080")  # Port exposé
        
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

    def upload_local_pdfs(self, pdf_folder_path):
        """Upload des PDFs locaux vers le projet."""
        import os
        
        if not os.path.exists(pdf_folder_path):
            self.log(f"✗ Dossier introuvable: {pdf_folder_path}")
            return False
        
        pdf_files = [f for f in os.listdir(pdf_folder_path) if f.endswith('.pdf')]
        if not pdf_files:
            self.log("✗ Aucun PDF trouvé dans le dossier")
            return False
        
        self.log(f"📁 Upload de {len(pdf_files)} PDFs...")
        
        # Préparer les fichiers pour l'upload
        files = []
        for pdf_file in pdf_files[:10]:  # Limite pour test
            filepath = os.path.join(pdf_folder_path, pdf_file)
            try:
                files.append(('files', (pdf_file, open(filepath, 'rb'), 'application/pdf')))
            except Exception as e:
                self.log(f"⚠️ Impossible d'ouvrir {pdf_file}: {e}")
                continue
        
        if not files:
            self.log("✗ Aucun PDF lisible")
            return False
        
        try:
            response = requests.post(
                f"{self.api_url}/projects/{self.project_id}/upload-pdfs-bulk",
                files=files,
                timeout=300
            )
            
            # Fermer les fichiers
            for _, (_, file_obj, _) in files:
                file_obj.close()
            
            if response.status_code == 202:
                job_data = response.json()
                job_id = job_data.get('job_id')
                self.log(f"✓ Upload PDFs lancé (Job: {job_id})")
                return self.wait_for_task(job_id, "upload PDFs", timeout=600)
            else:
                self.log(f"✗ Échec upload PDFs: {response.status_code}")
                return False
                
        except Exception as e:
            self.log(f"✗ Erreur upload PDFs: {e}")
            return False

    def import_from_zotero_export(self, zotero_json_path):
        """Import depuis un export JSON Zotero."""
        import os
        
        if not os.path.exists(zotero_json_path):
            self.log(f"✗ Fichier Zotero introuvable: {zotero_json_path}")
            return False
        
        self.log(f"📚 Import export Zotero: {zotero_json_path}")
        
        try:
            with open(zotero_json_path, 'rb') as f:
                response = requests.post(
                    f"{self.api_url}/projects/{self.project_id}/upload-zotero",
                    files={'file': ('zotero_export.json', f, 'application/json')},
                    timeout=300
                )
            
            if response.status_code == 202:
                job_data = response.json()
                job_id = job_data.get('job_id')
                self.log(f"✓ Import Zotero lancé (Job: {job_id})")
                return self.wait_for_task(job_id, "import Zotero", timeout=600)
            else:
                self.log(f"✗ Échec import Zotero: {response.status_code}")
                return False
                
        except Exception as e:
            self.log(f"✗ Erreur import Zotero: {e}")
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
            "max_results_per_db": 500,
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
                
                return self.wait_for_task(job_id, "recherche ATN", timeout=900)
            else:
                self.log(f"✗ Échec recherche: {response.status_code}")
                
        except Exception as e:
            self.log(f"✗ Erreur recherche: {e}")
            
        return False

    def wait_for_task(self, job_id, task_name="tâche", timeout=900):
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
                    queue_name = task_data.get('queue_name', 'N/A')
                    
                    if status == 'finished':
                        if task_data.get('exc_info'):
                            self.log(f"✗ {task_name} terminée avec une erreur: {task_data.get('exc_info')}")
                            return False
                        else:
                            self.log(f"✓ {task_name} terminée avec succès")
                            return True
                    elif status == 'failed':
                        error = task_data.get('exc_info', 'Erreur inconnue')
                        self.log(f"✗ {task_name} échouée: {error}")
                        return False
                    elif status in ['queued', 'started']:
                        progress = task_data.get('progress')
                        if progress:
                            self.log(f"⏳ {task_name} en cours... ({progress:.1%})", end='\r')
                        else:
                            self.log(f"⏳ {task_name} en cours (statut: {status}, file: {queue_name})...", end='\r')
                        
            except Exception as e:
                self.log(f"⚠️ Erreur vérification statut ({job_id}): {e}")
                time.sleep(2)
                
            time.sleep(5)

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
                    
                    if self.wait_for_task(job_id, f"analyse {analysis_type}", timeout=900):
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
            response = requests.post(f"{self.api_url}/projects/{self.project_id}/reports/excel-export", timeout=60)
            
            if response.status_code == 202:
                job_data = response.json()
                job_id = job_data.get('job_id')
                self.log(f"✓ Tâche d'export lancée (Job: {job_id})")
                
                return self.wait_for_task(job_id, "export Excel", timeout=300)
            else:
                self.log(f"✗ Échec du lancement de l'export: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            self.log(f"✗ Échec de l'export: {e}")
            return False

    def run_complete_atn_workflow(self, pdf_folder=None, zotero_export=None):
        """Exécuter le workflow ATN complet avec PDFs optionnels."""
        self.log("🚀 Test Workflow ATN - Alliance Thérapeutique Numérique")
        self.log("=" * 60)
        
        steps = [
            ("Vérification application", self.check_health),
            ("Création projet ATN", lambda: self.create_project(
                "Test ATN - Alliance Thérapeutique Numérique",
                "Test automatique avec PDFs et Zotero"
            )),
            ("Recherche PubMed ATN", self.run_atn_search),
            ("Récupération résultats", lambda: len(self.get_search_results()) > 0),
        ]
        
        # 🔥 AJOUT: Étapes PDF/Zotero conditionnelles
        if pdf_folder:
            steps.append(("Import PDFs locaux", lambda: self.upload_local_pdfs(pdf_folder)))
        
        if zotero_export:
            steps.append(("Import export Zotero", lambda: self.import_from_zotero_export(zotero_export)))
        
        steps.extend([
            ("Analyses ATN", self.run_atn_analysis),
            ("Export final", self.export_results)
        ])
        
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
                    break
            except Exception as e:
                self.log(f"✗ {step_name} - Erreur: {e}")
                break
            
            self.log("-" * 40)
        
        success_rate = (success_count / total_steps) * 100
        self.log("=" * 60)
        self.log(f"📊 RÉSULTATS: {success_count}/{total_steps} étapes réussies ({success_rate:.1f}%)")
        
        if success_count == total_steps:
            self.log("🎉 Workflow ATN fonctionnel !")
            return True
        else:
            self.log("⚠️ Workflow partiellement fonctionnel - vérifications manuelles recommandées")
            return False

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Test Workflow ATN - AnalyLit v4.1")
    parser.add_argument("--pdf-folder", help="Dossier contenant les PDFs à importer")
    parser.add_argument("--zotero-export", help="Fichier JSON d'export Zotero")
    args = parser.parse_args()
    
    workflow = AnalyLitATNWorkflow()
    
    print("\n" + "="*60)
    print("🔬 TEST WORKFLOW ATN - ANALYLIT V4.1")
    print("Équation PubMed: Alliance Thérapeutique Numérique")
    if args.pdf_folder:
        print(f"📁 Avec PDFs: {args.pdf_folder}")
    if args.zotero_export:
        print(f"📚 Avec Zotero: {args.zotero_export}")
    print("⚠️  IMPORTANT: Résultats à valider manuellement")
    print("="*60 + "\n")
    
    success = workflow.run_complete_atn_workflow(
        pdf_folder=args.pdf_folder,
        zotero_export=args.zotero_export
    )
    
    print("\n" + "="*60)
    if success:
        print("✅ Test terminé avec succès")
        print("➡️  Vérifiez les résultats dans l'interface web")
    else:
        print("❌ Test partiellement échoué")
        print("➡️  Consultez les logs pour diagnostic")
    print("="*60)
    
    sys.exit(0 if success else 1)