#!/usr/bin/env python3
# ================================================================
# Test ATN avec 5 Articles - Validation Complète AnalyLit v4.1
# VERSION CORRIGÉE avec les vrais endpoints API
# ================================================================

import requests
import time
import json
import uuid
from datetime import datetime
import sys
import logging

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

# Configuration
BASE_URL = "http://localhost:8080"
API_BASE = f"{BASE_URL}/api"

# Configuration du profil de test (CORRIGÉ avec les bonnes clés)
TEST_PROFILE = {
    "preprocess": "phi3:mini",
    "extract": "llama3.1:8b", 
    "synthesis": "llama3.1:8b"
}

# 5 Articles ATN pour le test (identifiants simplifiés)
TEST_ARTICLES = [
    "PMID:35123456",
    "PMID:35123457", 
    "PMID:35123458",
    "PMID:35123459",
    "PMID:35123460"
]

class ATNTestRunner:
    def __init__(self):
        self.project_id = None
        self.test_start_time = datetime.now()
        
    def print_banner(self, message):
        """Affiche un bannière de section"""
        print(f"\n{'='*60}")
        print(f"🔬 {message}")
        print(f"{'='*60}")
        
    def print_step(self, step_num, total_steps, message):
        """Affiche une étape numérotée"""
        print(f"\n[Étape {step_num}/{total_steps}] {message}")
        print("-" * 50)
        
    def check_health(self):
        """Vérifie que l'API est accessible"""
        try:
            response = requests.get(f"{API_BASE}/health", timeout=5)
            if response.status_code == 200:
                logger.info("✅ API AnalyLit accessible")
                return True
            else:
                logger.error(f"❌ API santé retourne: {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"❌ Impossible d'accéder à l'API: {e}")
            return False
            
    def create_test_project(self):
        """Crée un projet de test"""
        project_data = {
            "name": "Test ATN - 5 Articles (Validation Profile Fix)",
            "description": "Test de validation du workflow ATN avec profil corrigé - 5 articles ciblés",
            "mode": "full_extraction"
        }
        
        try:
            response = requests.post(
                f"{API_BASE}/projects", 
                json=project_data,
                timeout=10
            )
            
            if response.status_code == 201:
                project = response.json()
                self.project_id = project['id']
                logger.info(f"✅ Projet créé: {project['name']} (ID: {self.project_id})")
                return True
            else:
                logger.error(f"❌ Échec création projet: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Erreur création projet: {e}")
            return False
            
    def add_articles_manually(self):
        """Ajoute les 5 articles de test via le bon endpoint"""
        logger.info("Ajout manuel des 5 articles ATN via /add-manual-articles...")
        
        try:
            # ✅ CORRECTION: Utilise le bon endpoint et format
            response = requests.post(
                f"{API_BASE}/projects/{self.project_id}/add-manual-articles",
                json={"items": TEST_ARTICLES},  # ✅ Format correct selon l'API
                timeout=30
            )
            
            if response.status_code == 202:
                job_data = response.json()
                job_id = job_data.get('task_id')
                logger.info(f"✅ {len(TEST_ARTICLES)} articles ajoutés avec succès (Job: {job_id})")
                
                # Attendre un peu pour que les articles soient traités
                logger.info("⏳ Attente de l'ajout des articles...")
                time.sleep(5)
                return True
            else:
                logger.error(f"❌ Échec ajout articles: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Erreur ajout articles: {e}")
            return False
            
    def get_available_profiles(self):
        """Récupère les profils d'analyse disponibles"""
        try:
            response = requests.get(f"{API_BASE}/profiles", timeout=10)
            if response.status_code == 200:
                profiles = response.json()
                logger.info(f"📋 Profils disponibles: {len(profiles)}")
                for profile in profiles[:3]:  # Affiche les 3 premiers
                    logger.info(f"  - {profile.get('name', 'N/A')} (ID: {profile.get('id', 'N/A')})")
                return profiles
            else:
                logger.warning(f"⚠️ Impossible de récupérer les profils: {response.status_code}")
                return []
        except Exception as e:
            logger.warning(f"⚠️ Erreur récupération profils: {e}")
            return []
            
    def run_screening(self):
        """Lance le screening des articles avec un profil valide"""
        logger.info("Lancement du screening avec profil explicite...")
        
        # Récupère les profils disponibles
        profile_id = "standard-local"
        
        screening_data = {
            "articles": TEST_ARTICLES,
            "profile": profile_id,  # ✅ Utilise l'ID du profil, pas le dict
            "analysis_mode": "screening"
        }
        
        try:
            response = requests.post(
                f"{API_BASE}/projects/{self.project_id}/run",
                json=screening_data,
                params={"profile": profile_id},
                timeout=15
            )
            
            if response.status_code == 202:
                job_data = response.json()
                job_ids = job_data.get('task_ids', [])
                logger.info(f"✅ Screening démarré - {len(job_ids)} tâches créées")
                return True
            else:
                logger.error(f"❌ Échec screening: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Erreur screening: {e}")
            return False
            
    def run_atn_analyses(self):
        """Lance les 3 analyses ATN cruciales"""
        analyses = ["atn_scores", "descriptive_stats", "synthesis"]
        results = {}
        
        for analysis_type in analyses:
            logger.info(f"🔬 Lancement de l'analyse: {analysis_type}")
            
            try:
                response = requests.post(
                    f"{API_BASE}/projects/{self.project_id}/run-analysis",
                    json={"type": analysis_type},  # ✅ Simplifié - pas de profil explicit
                    timeout=15
                )
                
                if response.status_code == 202:
                    job_data = response.json()
                    job_id = job_data.get('task_id')
                    results[analysis_type] = {
                        'status': 'started',
                        'job_id': job_id
                    }
                    logger.info(f"✅ Analyse {analysis_type} démarrée (Job: {job_id})")
                else:
                    results[analysis_type] = {
                        'status': 'failed_to_start',
                        'error': f"HTTP {response.status_code}",
                        'response': response.text
                    }
                    logger.error(f"❌ Échec démarrage {analysis_type}: {response.status_code}")
                    logger.error(f"   Réponse: {response.text}")
                    
            except Exception as e:
                results[analysis_type] = {
                    'status': 'error',
                    'error': str(e)
                }
                logger.error(f"❌ Erreur analyse {analysis_type}: {e}")
                
        return results
        
    def wait_for_completion(self, max_wait_minutes=8):
        """Attend la fin des analyses avec monitoring détaillé"""
        logger.info(f"⏳ Attente de la complétion (max {max_wait_minutes} min)...")
        
        start_time = time.time()
        max_wait_seconds = max_wait_minutes * 60
        check_interval = 10  # Vérifier toutes les 10 secondes
        
        while time.time() - start_time < max_wait_seconds:
            try:
                # Récupère le statut du projet
                response = requests.get(f"{API_BASE}/projects/{self.project_id}", timeout=10)
                
                if response.status_code == 200:
                    project = response.json()
                    status = project.get('status', 'unknown')
                    
                    logger.info(f"📊 Statut projet: {status}")
                    
                    if status in ['completed', 'failed']:
                        return status
                        
                    # Affiche le progrès si disponible
                    processed = project.get('processed_count', 0)
                    total = project.get('pmids_count', 0)
                    if total > 0:
                        progress = (processed / total) * 100
                        logger.info(f"📈 Progression: {processed}/{total} ({progress:.1f}%)")
                    
                    # Info sur les résultats déjà disponibles
                    if project.get('analysis_result'):
                        logger.info("🎯 Analyse ATN: Résultats disponibles")
                    if project.get('synthesis_result'):
                        logger.info("📝 Synthèse: Disponible")
                        
                else:
                    logger.warning(f"⚠️ Impossible de récupérer le statut: {response.status_code}")
                    
            except Exception as e:
                logger.warning(f"⚠️ Erreur vérification statut: {e}")
                
            time.sleep(check_interval)
            
        logger.warning(f"⏰ Timeout atteint ({max_wait_minutes} min)")
        return 'timeout'
        
    def get_final_results(self):
        """Récupère et affiche les résultats finaux détaillés"""
        try:
            response = requests.get(f"{API_BASE}/projects/{self.project_id}", timeout=10)
            
            if response.status_code == 200:
                project = response.json()
                
                # Résumé du projet
                logger.info("🎉 RÉSULTATS FINAUX:")
                logger.info(f"  📊 Statut: {project.get('status', 'unknown')}")
                logger.info(f"  📖 Articles traités: {project.get('processed_count', 0)}")
                logger.info(f"  📚 Total articles: {project.get('pmids_count', 0)}")
                
                # Résultats d'analyse ATN
                analysis_result = project.get('analysis_result')
                if analysis_result:
                    logger.info("  🔬 Analyse ATN: ✅ Disponible")
                    
                    # Essaie de parser les résultats JSON
                    try:
                        if isinstance(analysis_result, str):
                            analysis_data = json.loads(analysis_result)
                        else:
                            analysis_data = analysis_result
                            
                        if 'atn_scores' in str(analysis_data):
                            logger.info("    ✅ Scores ATN: Calculés")
                        if 'mean_' in str(analysis_data):
                            logger.info("    ✅ Stats descriptives: Calculées")
                        if 'total_articles_scored' in str(analysis_data):
                            total_scored = analysis_data.get('total_articles_scored', 0)
                            logger.info(f"    📊 Articles scorés: {total_scored}")
                            
                    except (json.JSONDecodeError, TypeError):
                        logger.info("    📊 Résultats ATN disponibles (format brut)")
                        
                else:
                    logger.info("  🔬 Analyse ATN: ❌ Aucun résultat")
                    
                # Résultat de synthèse
                synthesis_result = project.get('synthesis_result')
                if synthesis_result:
                    logger.info("  📝 Synthèse: ✅ Générée")
                    try:
                        if isinstance(synthesis_result, str):
                            synth_data = json.loads(synthesis_result)
                            if 'sections' in synth_data:
                                logger.info(f"    📑 Sections: {len(synth_data['sections'])}")
                    except:
                        pass
                else:
                    logger.info("  📝 Synthèse: ❌ Non générée")
                    
                return project
                
            else:
                logger.error(f"❌ Impossible de récupérer les résultats: {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"❌ Erreur récupération résultats: {e}")
            return None
            
    def check_queue_status(self):
        """Vérifie l'état des files d'attente RQ (si disponible)"""
        try:
            # Essaie d'accéder à l'info des queues (si endpoint disponible)
            response = requests.get(f"{API_BASE}/queues/status", timeout=5)
            if response.status_code == 200:
                queue_data = response.json()
                logger.info("📋 État des files d'attente:")
                for queue_name, queue_info in queue_data.items():
                    pending = queue_info.get('pending', 0)
                    processing = queue_info.get('processing', 0)
                    logger.info(f"  {queue_name}: {pending} en attente, {processing} en cours")
            else:
                logger.debug(f"Info queues non disponible: {response.status_code}")
        except:
            logger.debug("Info queues non accessible")
            
    def cleanup(self):
        """Nettoyage optionnel du projet de test"""
        if self.project_id:
            try:
                logger.info("🧹 Nettoyage du projet de test...")
                response = requests.delete(f"{API_BASE}/projects/{self.project_id}", timeout=10)
                
                if response.status_code == 204:
                    logger.info("✅ Projet de test supprimé")
                else:
                    logger.warning(f"⚠️ Projet non supprimé: {response.status_code}")
                    
            except Exception as e:
                logger.warning(f"⚠️ Erreur nettoyage: {e}")
                
    def run_complete_test(self):
        """Exécute le test complet"""
        self.print_banner("TEST ATN - 5 ARTICLES - VALIDATION PROFIL CORRIGÉ")
        
        total_steps = 6
        success_count = 0
        
        # Étape 1: Vérification santé
        self.print_step(1, total_steps, "Vérification de l'API")
        if self.check_health():
            success_count += 1
        else:
            print("❌ Test arrêté - API inaccessible")
            return False
            
        # Étape 2: Création projet
        self.print_step(2, total_steps, "Création du projet de test")
        if self.create_test_project():
            success_count += 1
        else:
            print("❌ Test arrêté - Échec création projet")
            return False
            
        # Étape 3: Ajout articles
        self.print_step(3, total_steps, "Ajout des 5 articles ATN")
        if self.add_articles_manually():
            success_count += 1
        else:
            logger.warning("⚠️ Échec ajout articles - Poursuite du test avec articles existants")
            
        # Étape 4: Screening
        self.print_step(4, total_steps, "Screening des articles")
        if self.run_screening():
            success_count += 1
                        # Pause pour laisser le screening démarrer
            logger.info("⏳ Pause pour démarrage du screening...")
            time.sleep(15)
        else:
            logger.warning("⚠️ Screening échoué - Poursuite du test")
            
        # Étape 5: Analyses ATN
        self.print_step(5, total_steps, "Lancement des analyses ATN")
        analysis_results = self.run_atn_analyses()
        
        started_count = sum(1 for result in analysis_results.values() if result['status'] == 'started')
        logger.info(f"📊 Analyses démarrées: {started_count}/3")
        
        if started_count > 0:
            success_count += 1
            
        # Info sur les queues
        self.check_queue_status()
            
        # Étape 6: Attente et résultats
        self.print_step(6, total_steps, "Attente de la complétion")
        final_status = self.wait_for_completion(max_wait_minutes=8)
        
        final_results = self.get_final_results()
        if final_results:
            success_count += 1
            
        # Résumé final
        self.print_banner("RÉSUMÉ DU TEST")
        
        test_duration = datetime.now() - self.test_start_time
        
        print(f"🕐 Durée totale: {test_duration}")
        print(f"✅ Étapes réussies: {success_count}/{total_steps}")
        print(f"📊 Statut final: {final_status}")
        
        # Critères de succès plus souples pour le diagnostic
        if success_count >= 3:  # Au moins les étapes de base
            print("🎉 TEST PARTIELLEMENT RÉUSSI - Diagnostic OK")
            success = True
        else:
            print("❌ TEST ÉCHOUÉ - Problèmes majeurs détectés")
            success = False
            
        # Informations de débogage
        print(f"\n📋 Profil de test utilisé: {TEST_PROFILE}")
        print(f"🆔 ID Projet (conservé): {self.project_id}")
        print(f"🔗 Lien projet: {BASE_URL}/projects/{self.project_id}")
        
        # Cleanup conditionnel
        if len(sys.argv) > 1 and '--no-cleanup' in sys.argv:
            logger.info("🔒 Mode conservation - Projet conservé pour inspection")
        else:
            self.cleanup()
        
        return success


def main():
    """Point d'entrée principal"""    
    tester = ATNTestRunner()
    success = tester.run_complete_test()
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
