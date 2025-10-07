#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════
🎯 TEST WORKFLOW ATN COMPLET - 20 ARTICLES PMID RÉELS
═══════════════════════════════════════════════════════════════
AnalyLit V4.2 RTX 2060 SUPER - Validation Empirique Thèse ATN

WORKFLOW COMPLET:
1. Récupération métadonnées PubMed (20 PMIDs)
2. Ajout articles + PDFs Zotero locaux
3. Screening ATN automatique (seuil ≥70/100 validation auto)
4. Extraction grille ATN 30 champs sur PDFs
5. Synthèse PRISMA + graphes + CSV
6. Export académique thèse-ready

Date: 07 octobre 2025
Auteur: Ali Chabaane - Thèse Alliance Thérapeutique Numérique
═══════════════════════════════════════════════════════════════
"""

import sys
import codecs
import requests
import json
import time
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import glob

# ═══════════════════════════════════════════════════════════════
# CORRECTION ENCODAGE UTF-8 WINDOWS
# ═══════════════════════════════════════════════════════════════
if sys.platform.startswith('win'):
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# ═══════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════
API_BASE = "http://localhost:8080"
ZOTERO_STORAGE_PATH = r"C:\Users\alich\Zotero\storage"
OUTPUT_DIR = Path("./resultats_atn_20_articles")
OUTPUT_DIR.mkdir(exist_ok=True)

# ═══════════════════════════════════════════════════════════════
# 20 PMIDS RÉELS - Alliance Thérapeutique Numérique
# ═══════════════════════════════════════════════════════════════
PMIDS_ATN = [
    "40585405", "40562106", "40541374", "40525210", "40512270",
    "40433301", "40423728", "40417271", "40408143", "40390798",
    "40387286", "40385514", "40385249", "40374613", "40343065",
    "40340626", "40328004", "40319938", "40317432", "40313368"
]

# ═══════════════════════════════════════════════════════════════
# GRILLE ATN 30 CHAMPS (Référence)
# ═══════════════════════════════════════════════════════════════
GRILLE_ATN_FIELDS = [
    "ID_étude", "Auteurs", "Année", "Titre", "DOI/PMID",
    "Type_étude", "Niveau_preuve_HAS", "Pays_contexte", "Durée_suivi",
    "Taille_échantillon", "Population_cible", "Type_IA", "Plateforme",
    "Fréquence_usage", "Instrument_empathie", "Score_empathie_IA",
    "Score_empathie_humain", "WAI-SR_modifié", "Taux_adhésion",
    "Confiance_algorithmique", "Interactions_biomodales",
    "Considération_éthique", "Acceptabilité_patients", "Risque_biais",
    "Limites_principales", "Conflits_intérêts", "Financement",
    "RGPD_conformité", "AI_Act_risque", "Transparence_algo"
]

# ═══════════════════════════════════════════════════════════════
# FONCTIONS UTILITAIRES LOGGING
# ═══════════════════════════════════════════════════════════════
def log(level: str, message: str, indent: int = 0):
    """Log robuste UTF-8 avec timestamp et émojis"""
    ts = datetime.now().strftime("%H:%M:%S")
    indent_str = "  " * indent
    
    emoji_map = {
        "INFO": "ℹ️",
        "SUCCESS": "✅",
        "ERROR": "❌",
        "WARNING": "⚠️",
        "PROGRESS": "⏳",
        "DATA": "📊",
        "PDF": "📄",
        "API": "🔌"
    }
    
    emoji = emoji_map.get(level, "📋")
    print(f"[{ts}] {indent_str}{emoji} {level}: {message}")

def log_section(title: str):
    """Séparateur visuel sections"""
    print("\n" + "="*70)
    print(f"  {title}")
    print("="*70 + "\n")

# ═══════════════════════════════════════════════════════════════
# FONCTIONS API WRAPPER
# ═══════════════════════════════════════════════════════════════
def api_request(method: str, endpoint: str, data: Optional[Dict] = None, 
                timeout: int = 60) -> Optional[Dict]:
    """Wrapper API avec gestion erreurs et retry"""
    url = f"{API_BASE}{endpoint}"
    max_retries = 3
    
    for attempt in range(max_retries):
        try:
            if method == "GET":
                resp = requests.get(url, timeout=timeout)
            elif method == "POST":
                resp = requests.post(url, json=data, timeout=timeout)
            elif method == "PUT":
                resp = requests.put(url, json=data, timeout=timeout)
            else:
                log("ERROR", f"Méthode HTTP non supportée: {method}")
                return None
            
            if resp.status_code in [200, 201, 202]:
                return resp.json()
            elif resp.status_code == 404:
                log("WARNING", f"Endpoint introuvable: {endpoint}")
                return None
            else:
                log("ERROR", f"{method} {endpoint} - Code {resp.status_code}: {resp.text[:300]}")
                return None
                
        except requests.exceptions.Timeout:
            if attempt < max_retries - 1:
                log("WARNING", f"Timeout tentative {attempt+1}/{max_retries}, retry...")
                time.sleep(5)
            else:
                log("ERROR", f"Timeout après {max_retries} tentatives")
                return None
        except requests.exceptions.RequestException as e:
            log("ERROR", f"{method} {endpoint} - Exception: {str(e)[:300]}")
            return None
    
    return None

# ═══════════════════════════════════════════════════════════════
# FONCTIONS PUBMED & ZOTERO
# ═══════════════════════════════════════════════════════════════
def fetch_pubmed_metadata(pmids: List[str]) -> List[Dict]:
    """Récupère métadonnées PubMed via API Entrez"""
    log("INFO", f"Récupération métadonnées PubMed pour {len(pmids)} articles...")
    
    # Utilisation de l'endpoint AnalyLit si disponible
    result = api_request("POST", "/api/pubmed/fetch-bulk", 
                        {"pmids": pmids}, timeout=120)
    
    if result and "articles" in result:
        log("SUCCESS", f"{len(result['articles'])} articles récupérés depuis PubMed", 1)
        return result["articles"]
    
    # Fallback: Construction manuelle basique
    log("WARNING", "Endpoint PubMed non disponible, utilisation données basiques", 1)
    articles = []
    for pmid in pmids:
        articles.append({
            "pmid": pmid,
            "title": f"Article PMID {pmid} (métadonnées à compléter)",
            "authors": ["Auteur à déterminer"],
            "year": 2024,
            "abstract": f"Abstract PMID {pmid} - À récupérer manuellement",
            "journal": "Journal à déterminer",
            "doi": f"DOI à déterminer pour PMID {pmid}",
            "keywords": ["therapeutic alliance", "digital health"]
        })
    
    return articles

def find_zotero_pdf(pmid: str) -> Optional[str]:
    """Recherche PDF dans Zotero storage local"""
    if not os.path.exists(ZOTERO_STORAGE_PATH):
        log("WARNING", f"Chemin Zotero inexistant: {ZOTERO_STORAGE_PATH}", 1)
        return None
    
    # Recherche récursive dans sous-dossiers
    search_pattern = os.path.join(ZOTERO_STORAGE_PATH, "**", "*.pdf")
    pdf_files = glob.glob(search_pattern, recursive=True)
    
    # Filtrage par PMID dans nom fichier (heuristique)
    for pdf_path in pdf_files:
        if pmid in os.path.basename(pdf_path) or pmid in pdf_path:
            log("SUCCESS", f"PDF trouvé pour PMID {pmid}: {os.path.basename(pdf_path)}", 2)
            return pdf_path
    
    log("WARNING", f"Aucun PDF trouvé pour PMID {pmid}", 2)
    return None

# ═══════════════════════════════════════════════════════════════
# CLASSE PRINCIPALE WORKFLOW
# ═══════════════════════════════════════════════════════════════
class ATNWorkflowComplete:
    def __init__(self):
        self.project_id = None
        self.articles_data = []
        self.screening_results = {}
        self.extraction_results = {}
        self.synthesis_results = {}
        
        self.results = {
            "timestamp_start": datetime.now().isoformat(),
            "project_id": None,
            "pmids_count": len(PMIDS_ATN),
            "steps": {},
            "final_metrics": {}
        }
    
    # ───────────────────────────────────────────────────────────
    # ÉTAPE 0: VÉRIFICATION SANTÉ API
    # ───────────────────────────────────────────────────────────
    def check_api_health(self) -> bool:
        """Vérifie API AnalyLit disponible"""
        log_section("ÉTAPE 0/7: VÉRIFICATION SANTÉ API")
        
        health = api_request("GET", "/api/health")
        if health and health.get("status") == "healthy":
            log("SUCCESS", "API AnalyLit opérationnelle")
            log("INFO", f"Version: {health.get('version', 'unknown')}", 1)
            return True
        
        log("ERROR", "API non disponible - Vérifier services Docker")
        return False
    
    # ───────────────────────────────────────────────────────────
    # ÉTAPE 1: RÉCUPÉRATION MÉTADONNÉES PUBMED
    # ───────────────────────────────────────────────────────────
    def fetch_articles_metadata(self) -> bool:
        """Récupère métadonnées des 20 PMIDs"""
        log_section("ÉTAPE 1/7: RÉCUPÉRATION MÉTADONNÉES PUBMED")
        
        self.articles_data = fetch_pubmed_metadata(PMIDS_ATN)
        
        if not self.articles_data:
            log("ERROR", "Échec récupération métadonnées")
            return False
        
        log("SUCCESS", f"{len(self.articles_data)} articles récupérés")
        log("DATA", f"Exemple: {self.articles_data[0].get('title', 'N/A')[:80]}...", 1)
        
        self.results["steps"]["metadata_fetch"] = {
            "success": True,
            "articles_count": len(self.articles_data)
        }
        return True
    
    # ───────────────────────────────────────────────────────────
    # ÉTAPE 2: AJOUT PDFs LOCAUX ZOTERO
    # ───────────────────────────────────────────────────────────
    def attach_zotero_pdfs(self) -> bool:
        """Attache PDFs Zotero aux articles"""
        log_section("ÉTAPE 2/7: ATTACHEMENT PDFs ZOTERO LOCAUX")
        
        pdf_found_count = 0
        for article in self.articles_data:
            pmid = article.get("pmid")
            pdf_path = find_zotero_pdf(pmid)
            
            if pdf_path:
                article["pdf_path"] = pdf_path
                article["pdf_source"] = "zotero_local"
                pdf_found_count += 1
        
        log("SUCCESS", f"{pdf_found_count}/{len(self.articles_data)} PDFs trouvés dans Zotero")
        
        self.results["steps"]["pdf_attachment"] = {
            "success": True,
            "pdfs_found": pdf_found_count,
            "pdfs_missing": len(self.articles_data) - pdf_found_count
        }
        return True
    
    # ───────────────────────────────────────────────────────────
    # ÉTAPE 3: CRÉATION PROJET ATN
    # ───────────────────────────────────────────────────────────
    def create_atn_project(self) -> bool:
        """Crée projet AnalyLit pour workflow ATN"""
        log_section("ÉTAPE 3/7: CRÉATION PROJET ATN")
        
        project_name = f"Validation Empirique ATN - 20 Articles PMID - {datetime.now().strftime('%Y%m%d_%H%M')}"
        
        data = {
            "name": project_name,
            "description": "Validation empirique algorithme scoring ATN v2.1 - Thèse Alliance Thérapeutique Numérique. Workflow complet: Screening → Extraction grille 30 champs → Synthèse PRISMA → Export académique.",
            "analysis_mode": "full_extraction_atn",
            "metadata": {
                "pmids_count": len(PMIDS_ATN),
                "algorithm_version": "ATN v2.1",
                "validation_type": "empirique",
                "grille_version": "30_champs_v2.1"
            }
        }
        
        result = api_request("POST", "/api/projects", data)
        
        if result and "project_id" in result:
            self.project_id = result["project_id"]
            self.results["project_id"] = self.project_id
            log("SUCCESS", f"Projet créé: {self.project_id}")
            log("INFO", f"Nom: {project_name}", 1)
            return True
        
        log("ERROR", "Échec création projet")
        return False
    
    # ───────────────────────────────────────────────────────────
    # ÉTAPE 4: AJOUT ARTICLES AU PROJET
    # ───────────────────────────────────────────────────────────
    def add_articles_to_project(self) -> bool:
        """Ajoute les 20 articles avec PDFs au projet"""
        log_section("ÉTAPE 4/7: AJOUT ARTICLES + PDFs AU PROJET")
        
        # Format adapté à l'endpoint réel (voir file:48)
        data = {
            "items": self.articles_data,
            "include_pdfs": True,
            "pdf_extraction_mode": "full_text"
        }
        
        result = api_request("POST", f"/api/projects/{self.project_id}/add-manual-articles", 
                           data, timeout=120)
        
        if result:
            added_count = result.get("added_count", len(self.articles_data))
            log("SUCCESS", f"{added_count} articles ajoutés au projet")
            
            # Attente traitement initial
            log("PROGRESS", "Attente traitement initial (10s)...", 1)
            time.sleep(10)
            
            self.results["steps"]["add_articles"] = {
                "success": True,
                "added_count": added_count
            }
            return True
        
        log("ERROR", "Échec ajout articles")
        return False
    
    # ───────────────────────────────────────────────────────────
    # ÉTAPE 5: SCREENING ATN AUTOMATIQUE
    # ───────────────────────────────────────────────────────────
    def run_atn_screening(self) -> bool:
        """Lance screening ATN avec validation automatique ≥70/100"""
        log_section("ÉTAPE 5/7: SCREENING ATN AUTOMATIQUE (seuil ≥70/100)")
        
        data = {
            "type": "atn_screening",
            "profile_id": "standard-local",  # Profil RTX 2060 SUPER
            "parameters": {
                "algorithm_version": "ATN_v2.1",
                "auto_validate_threshold": 70,  # Validation auto ≥70/100
                "criteria_weights": {
                    "alliance_therapeutique": 25,
                    "sante_numerique": 20,
                    "approche_patient": 15,
                    "acceptation_tech": 15,
                    "communication": 15,
                    "actualite": 10
                }
            }
        }
        
        result = api_request("POST", f"/api/projects/{self.project_id}/run-screening", 
                           data, timeout=300)
        
        if result:
            log("SUCCESS", "Screening ATN lancé")
            success = self.wait_for_step_completion("screening", timeout_min=15)
            
            if success:
                # Récupération résultats screening
                self.screening_results = self.get_screening_results()
                log("DATA", f"Articles validés auto: {self.screening_results.get('auto_validated_count', 0)}", 1)
                log("DATA", f"Score ATN moyen: {self.screening_results.get('mean_score', 0):.1f}/100", 1)
            
            return success
        
        log("WARNING", "Endpoint screening non disponible, passage extraction directe")
        return True  # Non bloquant
    
    # ───────────────────────────────────────────────────────────
    # ÉTAPE 6: EXTRACTION GRILLE ATN 30 CHAMPS
    # ───────────────────────────────────────────────────────────
    def run_atn_extraction(self) -> bool:
        """Extraction grille ATN 30 champs sur PDFs"""
        log_section("ÉTAPE 6/7: EXTRACTION GRILLE ATN 30 CHAMPS (PDFs)")
        
        data = {
            "type": "atn_extraction",
            "profile_id": "standard-local",
            "parameters": {
                "grid_version": "grille-ATN-v2.1",
                "fields": GRILLE_ATN_FIELDS,
                "extract_from_pdfs": True,
                "pdf_ocr_enabled": True,
                "validation_inter_rater": True
            }
        }
        
        result = api_request("POST", f"/api/projects/{self.project_id}/run-analysis", 
                           data, timeout=600)
        
        if result:
            log("SUCCESS", "Extraction grille ATN lancée")
            log("INFO", "30 champs ATN + validation empirique", 1)
            
            success = self.wait_for_step_completion("extraction", timeout_min=30)
            
            if success:
                self.extraction_results = self.get_extraction_results()
                log("DATA", f"Articles extraits: {self.extraction_results.get('extracted_count', 0)}", 1)
            
            return success
        
        log("ERROR", "Échec lancement extraction")
        return False
    
    # ───────────────────────────────────────────────────────────
    # ÉTAPE 7: SYNTHÈSE PRISMA + GRAPHES + CSV
    # ───────────────────────────────────────────────────────────
    def run_synthesis_prisma(self) -> bool:
        """Génère synthèse PRISMA + graphes + exports CSV"""
        log_section("ÉTAPE 7/7: SYNTHÈSE PRISMA + GRAPHES + CSV")
        
        data = {
            "type": "synthesis_prisma",
            "profile_id": "standard-local",
            "parameters": {
                "include_prisma_flow": True,
                "generate_statistical_graphs": True,
                "export_csv": True,
                "export_excel": True,
                "inter_rater_analysis": True,
                "descriptive_stats": True
            }
        }
        
        result = api_request("POST", f"/api/projects/{self.project_id}/run-analysis", 
                           data, timeout=300)
        
        if result:
            log("SUCCESS", "Synthèse PRISMA lancée")
            
            success = self.wait_for_step_completion("synthesis", timeout_min=15)
            
            if success:
                self.synthesis_results = self.get_synthesis_results()
                log("DATA", f"PRISMA Flow: {self.synthesis_results.get('prisma_path', 'Généré')}", 1)
                log("DATA", f"Graphes: {self.synthesis_results.get('graphs_count', 0)} générés", 1)
            
            return success
        
        log("ERROR", "Échec lancement synthèse")
        return False
    
    # ───────────────────────────────────────────────────────────
    # EXPORT FINAL ACADÉMIQUE
    # ───────────────────────────────────────────────────────────
    def export_thesis_ready(self) -> bool:
        """Export final formaté thèse"""
        log_section("EXPORT FINAL ACADÉMIQUE THÈSE-READY")
        
        data = {
            "format": "excel",
            "include_prisma": True,
            "include_extraction_grid": True,
            "include_statistics": True,
            "include_inter_rater": True,
            "template": "these_atn_v2.1"
        }
        
        result = api_request("POST", f"/api/projects/{self.project_id}/export-thesis", 
                           data, timeout=120)
        
        if result and "export_path" in result:
            export_path = result["export_path"]
            log("SUCCESS", f"Export académique créé: {export_path}")
            self.results["export_path"] = export_path
            return True
        
        log("WARNING", "Export non disponible, données accessibles dans application")
        return True  # Non bloquant
    
    # ───────────────────────────────────────────────────────────
    # FONCTIONS AUXILIAIRES
    # ───────────────────────────────────────────────────────────
    def wait_for_step_completion(self, step_name: str, timeout_min: int = 15) -> bool:
        """Polling statut étape avec timeout"""
        log("PROGRESS", f"Attente fin {step_name} (timeout: {timeout_min}min)...")
        
        start = time.time()
        last_status = None
        
        while time.time() - start < timeout_min * 60:
            status_data = api_request("GET", f"/api/projects/{self.project_id}/status")
            
            if not status_data:
                time.sleep(10)
                continue
            
            current_status = status_data.get("status", "unknown")
            progress = status_data.get("progress", 0)
            
            if current_status != last_status:
                log("INFO", f"Statut: {current_status} ({progress}%)", 1)
                last_status = current_status
            
            if current_status in ("completed", "finished", "ready"):
                log("SUCCESS", f"Étape {step_name} terminée")
                return True
            
            if current_status in ("failed", "error"):
                error_msg = status_data.get("error_message", "Erreur inconnue")
                log("ERROR", f"Étape {step_name} échouée: {error_msg}")
                return False
            
            time.sleep(10)
        
        log("WARNING", f"Timeout {timeout_min}min atteint pour {step_name}")
        return False
    
    def get_screening_results(self) -> Dict:
        """Récupère résultats screening"""
        result = api_request("GET", f"/api/projects/{self.project_id}/screening-results")
        return result if result else {}
    
    def get_extraction_results(self) -> Dict:
        """Récupère résultats extraction"""
        result = api_request("GET", f"/api/projects/{self.project_id}/extraction-results")
        return result if result else {}
    
    def get_synthesis_results(self) -> Dict:
        """Récupère résultats synthèse"""
        result = api_request("GET", f"/api/projects/{self.project_id}/synthesis-results")
        return result if result else {}
    
    def get_final_metrics(self) -> Dict:
        """Calcule métriques finales projet"""
        project = api_request("GET", f"/api/projects/{self.project_id}")
        
        if not project:
            return {}
        
        return {
            "articles_total": len(PMIDS_ATN),
            "articles_screened": project.get("screened_count", 0),
            "articles_included": project.get("included_count", 0),
            "articles_extracted": project.get("extracted_count", 0),
            "mean_atn_score": project.get("mean_atn_score", 0),
            "std_atn_score": project.get("std_atn_score", 0),
            "auto_validated_count": project.get("auto_validated_count", 0),
            "inter_rater_kappa": project.get("inter_rater_kappa", 0),
            "prisma_flow_generated": project.get("prisma_flow_path") is not None,
            "extraction_complete": project.get("extraction_status") == "completed"
        }
    
    def save_final_report(self):
        """Sauvegarde rapport JSON final"""
        self.results["timestamp_end"] = datetime.now().isoformat()
        self.results["final_metrics"] = self.get_final_metrics()
        
        filename = OUTPUT_DIR / f"rapport_atn_20_articles_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, indent=2, ensure_ascii=False)
        
        log("SUCCESS", f"Rapport final sauvegardé: {filename}")
    
    # ───────────────────────────────────────────────────────────
    # ORCHESTRATION WORKFLOW COMPLET
    # ───────────────────────────────────────────────────────────
    def run_complete_workflow(self) -> bool:
        """Exécute workflow ATN complet de bout en bout"""
        log("INFO", "═"*70)
        log("INFO", "🚀 WORKFLOW ATN COMPLET - 20 ARTICLES PMID RÉELS")
        log("INFO", "   AnalyLit V4.2 RTX 2060 SUPER - Validation Empirique")
        log("INFO", "═"*70)
        
        steps = [
            ("health_check", self.check_api_health),
            ("fetch_metadata", self.fetch_articles_metadata),
            ("attach_pdfs", self.attach_zotero_pdfs),
            ("create_project", self.create_atn_project),
            ("add_articles", self.add_articles_to_project),
            ("screening", self.run_atn_screening),
            ("extraction", self.run_atn_extraction),
            ("synthesis", self.run_synthesis_prisma),
            ("export", self.export_thesis_ready)
        ]
        
        for step_name, step_func in steps:
            start_time = time.time()
            
            try:
                success = step_func()
                duration = time.time() - start_time
                
                self.results["steps"][step_name] = {
                    "success": success,
                    "duration_seconds": round(duration, 2)
                }
                
                # Screening et export non critiques
                if not success and step_name not in ["screening", "export"]:
                    log("ERROR", f"❌ Arrêt workflow sur échec: {step_name}")
                    self.save_final_report()
                    return False
                    
            except Exception as e:
                log("ERROR", f"Exception étape {step_name}: {str(e)}")
                import traceback
                traceback.print_exc()
                self.save_final_report()
                return False
        
        # ═══════════════════════════════════════════════════════
        # RÉSUMÉ FINAL
        # ═══════════════════════════════════════════════════════
        log_section("🎉 WORKFLOW ATN TERMINÉ AVEC SUCCÈS")
        
        metrics = self.results["final_metrics"]
        
        log("DATA", "📊 MÉTRIQUES FINALES:")
        log("INFO", f"  • Articles traités: {metrics.get('articles_total', 0)}", 1)
        log("INFO", f"  • Articles screenés: {metrics.get('articles_screened', 0)}", 1)
        log("INFO", f"  • Articles inclus: {metrics.get('articles_included', 0)}", 1)
        log("INFO", f"  • Score ATN moyen: {metrics.get('mean_atn_score', 0):.1f}/100", 1)
        log("INFO", f"  • Validation auto (≥70): {metrics.get('auto_validated_count', 0)} articles", 1)
        log("INFO", f"  • Inter-rater Kappa: {metrics.get('inter_rater_kappa', 0):.2f}", 1)
        log("INFO", f"  • PRISMA généré: {'✅' if metrics.get('prisma_flow_generated') else '❌'}", 1)
        log("INFO", f"  • Extraction complète: {'✅' if metrics.get('extraction_complete') else '❌'}", 1)
        
        log("SUCCESS", f"\n📁 Projet ID: {self.project_id}")
        log("SUCCESS", "🌐 Résultats visibles dans l'application: http://localhost:8080")
        
        self.save_final_report()
        return True

# ═══════════════════════════════════════════════════════════════
# POINT D'ENTRÉE PRINCIPAL
# ═══════════════════════════════════════════════════════════════
def main():
    """Point d'entrée script"""
    try:
        workflow = ATNWorkflowComplete()
        success = workflow.run_complete_workflow()
        sys.exit(0 if success else 1)
        
    except KeyboardInterrupt:
        log("WARNING", "\n⚠️ Interruption utilisateur (Ctrl+C)")
        sys.exit(130)
        
    except Exception as e:
        log("ERROR", f"❌ Erreur critique inattendue: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
