#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════
🎯 TEST WORKFLOW ATN COMPLET - 20 ARTICLES ZOTERO CSL JSON
═══════════════════════════════════════════════════════════════
AnalyLit V4.2 RTX 2060 SUPER - Validation Empirique Thèse ATN

Source: Export Zotero 20ATN.json + grille-ATN.json
Workflow: Import → Screening (≥70/100) → Extraction 30 champs → PRISMA → Export

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
from typing import Dict, List, Optional

# ═══════════════════════════════════════════════════════════════
# ENCODAGE UTF-8 WINDOWS
# ═══════════════════════════════════════════════════════════════
if sys.platform.startswith('win'):
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# ═══════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════
API_BASE = "http://localhost:8080"
PROJECT_ROOT = Path(__file__).parent.parent  # Racine projet
ZOTERO_JSON_PATH = PROJECT_ROOT / "20ATN.json"
GRILLE_ATN_PATH = PROJECT_ROOT / "grille-ATN.json"
OUTPUT_DIR = PROJECT_ROOT / "resultats_atn_20_articles"
OUTPUT_DIR.mkdir(exist_ok=True)

# ═══════════════════════════════════════════════════════════════
# LOGGING UTF-8
# ═══════════════════════════════════════════════════════════════
def log(level: str, message: str, indent: int = 0):
    ts = datetime.now().strftime("%H:%M:%S")
    indent_str = "  " * indent
    emoji_map = {
        "INFO": "ℹ️", "SUCCESS": "✅", "ERROR": "❌",
        "WARNING": "⚠️", "PROGRESS": "⏳", "DATA": "📊"
    }
    emoji = emoji_map.get(level, "📋")
    print(f"[{ts}] {indent_str}{emoji} {level}: {message}")

def log_section(title: str):
    print("\n" + "="*70)
    print(f"  {title}")
    print("="*70 + "\n")

# ═══════════════════════════════════════════════════════════════
# API WRAPPER
# ═══════════════════════════════════════════════════════════════
def api_request(method: str, endpoint: str, data: Optional[Dict] = None, 
                timeout: int = 60) -> Optional[Dict]:
    """Wrapper API avec retry"""
    url = f"{API_BASE}{endpoint}"
    
    try:
        if method == "GET":
            resp = requests.get(url, timeout=timeout)
        elif method == "POST":
            resp = requests.post(url, json=data, timeout=timeout)
        elif method == "PUT":
            resp = requests.put(url, json=data, timeout=timeout)
        else:
            return None
        
        if resp.status_code in [200, 201, 202]:
            return resp.json()
        else:
            log("ERROR", f"{method} {endpoint} - Code {resp.status_code}")
            return None
    except Exception as e:
        log("ERROR", f"{method} {endpoint} - Exception: {str(e)[:200]}")
        return None

# ═══════════════════════════════════════════════════════════════
# PARSEUR ZOTERO CSL JSON
# ═══════════════════════════════════════════════════════════════
def parse_zotero_csl_json(json_path: Path) -> List[Dict]:
    """Parse export Zotero CSL JSON vers format AnalyLit"""
    log("INFO", f"Chargement {json_path.name}...")
    
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            zotero_items = json.load(f)
        
        articles = []
        for item in zotero_items:
            # Extraction métadonnées CSL JSON
            authors_csl = item.get("author", [])
            authors = []
            for auth in authors_csl[:5]:  # Max 5 auteurs
                family = auth.get("family", "")
                given = auth.get("given", "")
                particle = auth.get("non-dropping-particle", "")
                if particle:
                    full_name = f"{particle} {family}, {given}"
                else:
                    full_name = f"{family}, {given}" if family else given
                authors.append(full_name.strip())
            
            # Extraction année
            issued = item.get("issued", {}).get("date-parts", [[]])[0]
            year = issued[0] if issued else 2024
            
            # Extraction PMID depuis note
            pmid = ""
            note = item.get("note", "")
            if "PMID:" in note:
                pmid = note.split("PMID:")[1].split("\n")[0].strip()
            
            # DOI
            doi = item.get("DOI", "")
            
            # Abstract
            abstract = item.get("abstract", "")[:1000]  # Max 1000 chars
            
            # Titre
            title = item.get("title", "Unknown Title")
            
            # Journal
            journal = item.get("container-title", "Unknown Journal")
            
            # Construction article format AnalyLit
            article = {
                "title": title,
                "authors": authors if authors else ["Unknown Author"],
                "year": int(year),
                "abstract": abstract,
                "journal": journal,
                "doi": doi,
                "pmid": pmid,
                "type": item.get("type", "article-journal"),
                "language": item.get("language", "eng"),
                "keywords": ["therapeutic alliance", "digital health"],  # Tags par défaut ATN
                "zotero_id": item.get("id", "")
            }
            
            articles.append(article)
            log("SUCCESS", f"Parsé: {title[:60]}...", 1)
        
        log("SUCCESS", f"{len(articles)} articles Zotero chargés")
        return articles
        
    except Exception as e:
        log("ERROR", f"Erreur parsing Zotero JSON: {str(e)}")
        return []

# ═══════════════════════════════════════════════════════════════
# CHARGEMENT GRILLE ATN
# ═══════════════════════════════════════════════════════════════
def load_grille_atn(json_path: Path) -> Dict:
    """Charge grille-ATN.json"""
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            grille = json.load(f)
        log("SUCCESS", f"Grille ATN chargée: {len(grille.get('fields', []))} champs")
        return grille
    except Exception as e:
        log("ERROR", f"Erreur chargement grille ATN: {str(e)}")
        return {}

# ═══════════════════════════════════════════════════════════════
# CLASSE WORKFLOW PRINCIPAL
# ═══════════════════════════════════════════════════════════════
class ATNWorkflowZotero:
    def __init__(self):
        self.project_id = None
        self.articles_data = []
        self.grille_atn = {}
        self.results = {
            "timestamp_start": datetime.now().isoformat(),
            "project_id": None,
            "articles_count": 0,
            "steps": {},
            "final_metrics": {}
        }
    
    def load_data_sources(self) -> bool:
        """Charge données Zotero + Grille ATN"""
        log_section("ÉTAPE 1/7: CHARGEMENT DONNÉES SOURCES")
        
        # Vérifier existence fichiers
        if not ZOTERO_JSON_PATH.exists():
            log("ERROR", f"Fichier introuvable: {ZOTERO_JSON_PATH}")
            return False
        
        if not GRILLE_ATN_PATH.exists():
            log("WARNING", f"Grille ATN introuvable: {GRILLE_ATN_PATH}")
        else:
            self.grille_atn = load_grille_atn(GRILLE_ATN_PATH)
        
        # Parser articles Zotero
        self.articles_data = parse_zotero_csl_json(ZOTERO_JSON_PATH)
        
        if not self.articles_data:
            log("ERROR", "Aucun article chargé depuis Zotero")
            return False
        
        self.results["articles_count"] = len(self.articles_data)
        log("DATA", f"Articles: {len(self.articles_data)}", 1)
        log("DATA", f"Grille ATN: {len(self.grille_atn.get('fields', []))} champs", 1)
        
        return True
    
    def check_api_health(self) -> bool:
        """Vérifie API disponible"""
        log_section("ÉTAPE 0/7: VÉRIFICATION API")
        
        health = api_request("GET", "/api/health")
        if health and health.get("status") == "healthy":
            log("SUCCESS", "API opérationnelle")
            return True
        
        log("ERROR", "API non disponible")
        return False
    
    def create_atn_project(self) -> bool:
        """Crée projet ATN"""
        log_section("ÉTAPE 2/7: CRÉATION PROJET ATN")
        
        data = {
            "name": f"ATN 20 Articles Zotero - {datetime.now().strftime('%Y%m%d_%H%M')}",
            "description": f"Validation empirique ATN v2.1 - {len(self.articles_data)} articles Zotero - Thèse Alliance Thérapeutique Numérique"
        }
        
        result = api_request("POST", "/api/projects", data)
        
        # ✅ CORRECTION: API retourne "id" pas "project_id"
        if result and "id" in result:
            self.project_id = result["id"]
            self.results["project_id"] = self.project_id
            log("SUCCESS", f"Projet créé: {self.project_id}")
            return True
        
        log("ERROR", "Échec création projet")
        return False
    
    def add_articles_to_project(self) -> bool:
        """Ajoute articles Zotero au projet"""
        log_section("ÉTAPE 3/7: AJOUT 20 ARTICLES ZOTERO")
        
        data = {
            "articles_data": self.articles_data,
            "source": "zotero_csl_json"
        }
        
        result = api_request("POST",
                           f"/api/projects/{self.project_id}/add-manual-articles",
                           data, timeout=120)
        
        if result:
            log("SUCCESS", f"{len(self.articles_data)} articles ajoutés")
            time.sleep(10)  # Traitement initial
            return True
        
        log("ERROR", "Échec ajout articles")
        return False
    
    def run_atn_screening(self) -> bool:
        """Lance screening ATN ≥70/100"""
        log_section("ÉTAPE 4/7: SCREENING ATN (≥70/100)")
        
        data = {
            "profile_id": "atn-specialized",
            "auto_validate_threshold": 70
        }
        
        result = api_request("POST",
                           f"/api/projects/{self.project_id}/run-screening",
                           data, timeout=300)
        
        if result:
            log("SUCCESS", "Screening ATN lancé")
            return self.wait_for_completion("screening", 15)
        
        log("WARNING", "Screening non disponible, passage extraction")
        return True
    
    def run_atn_extraction(self) -> bool:
        """Extraction grille ATN 30 champs"""
        log_section("ÉTAPE 5/7: EXTRACTION GRILLE ATN 30 CHAMPS")
        
        data = {
            "analysis_type": "atn_extraction",
            "profile_id": "atn-specialized",
            "grid_fields": self.grille_atn.get("fields", []),
            "extract_from_pdfs": True
        }
        
        result = api_request("POST",
                           f"/api/projects/{self.project_id}/run-analysis",
                           data, timeout=600)
        
        if result:
            log("SUCCESS", "Extraction grille ATN lancée")
            return self.wait_for_completion("extraction", 30)
        
        log("ERROR", "Échec extraction")
        return False
    
    def run_synthesis_prisma(self) -> bool:
        """Génère synthèse PRISMA + graphes"""
        log_section("ÉTAPE 6/7: SYNTHÈSE PRISMA + GRAPHES")
        
        data = {
            "analysis_type": "synthesis",
            "include_prisma": True,
            "generate_graphs": True,
            "export_csv": True
        }
        
        result = api_request("POST",
                           f"/api/projects/{self.project_id}/run-analysis",
                           data, timeout=300)
        
        if result:
            log("SUCCESS", "Synthèse PRISMA lancée")
            return self.wait_for_completion("synthesis", 15)
        
        log("ERROR", "Échec synthèse")
        return False
    
    def export_thesis_ready(self) -> bool:
        """Export académique final"""
        log_section("ÉTAPE 7/7: EXPORT ACADÉMIQUE THÈSE")
        
        data = {
            "format": "excel",
            "include_prisma": True,
            "include_extraction_grid": True,
            "include_statistics": True
        }
        
        result = api_request("POST",
                           f"/api/projects/{self.project_id}/export-thesis",
                           data, timeout=120)
        
        if result and "export_path" in result:
            log("SUCCESS", f"Export: {result['export_path']}")
            return True
        
        log("WARNING", "Export via application web")
        return True
    
    def wait_for_completion(self, step: str, timeout_min: int) -> bool:
        """Polling status projet"""
        log("PROGRESS", f"Attente {step} ({timeout_min}min)...")
        
        start = time.time()
        while time.time() - start < timeout_min * 60:
            status = api_request("GET", f"/api/projects/{self.project_id}")
            
            if status:
                current = status.get("status", "unknown")
                if current in ("completed", "finished", "ready"):
                    log("SUCCESS", f"{step} terminé")
                    return True
                if current in ("failed", "error"):
                    log("ERROR", f"{step} échoué")
                    return False
            
            time.sleep(10)
        
        log("WARNING", f"Timeout {timeout_min}min")
        return False
    
    def get_final_metrics(self) -> Dict:
        """Récupère métriques finales"""
        project = api_request("GET", f"/api/projects/{self.project_id}")
        if not project:
            return {}
        
        return {
            "articles_total": len(self.articles_data),
            "articles_processed": project.get("articles_count", 0),
            "mean_atn_score": project.get("mean_score", 0),
            "status": project.get("status", "unknown")
        }
    
    def save_report(self):
        """Sauvegarde rapport JSON"""
        self.results["timestamp_end"] = datetime.now().isoformat()
        self.results["final_metrics"] = self.get_final_metrics()
        
        filename = OUTPUT_DIR / f"rapport_atn_zotero_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, indent=2, ensure_ascii=False)
        
        log("SUCCESS", f"Rapport: {filename}")
    
    def run_complete_workflow(self) -> bool:
        """Orchestration workflow complet"""
        log("INFO", "═"*70)
        log("INFO", "🚀 WORKFLOW ATN - 20 ARTICLES ZOTERO CSL JSON")
        log("INFO", "═"*70)
        
        steps = [
            ("health_check", self.check_api_health),
            ("load_data", self.load_data_sources),
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
                
                if not success and step_name not in ["screening", "export"]:
                    log("ERROR", f"Arrêt sur échec: {step_name}")
                    self.save_report()
                    return False
                    
            except Exception as e:
                log("ERROR", f"Exception {step_name}: {str(e)}")
                self.save_report()
                return False
        
        log_section("🎉 WORKFLOW TERMINÉ")
        metrics = self.get_final_metrics()
        log("DATA", f"Articles: {metrics.get('articles_processed', 0)}/{metrics.get('articles_total', 0)}")
        log("DATA", f"Score ATN moyen: {metrics.get('mean_atn_score', 0):.1f}/100")
        log("SUCCESS", f"Projet: http://localhost:8080/projects/{self.project_id}")
        
        self.save_report()
        return True

# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════
def main():
    try:
        workflow = ATNWorkflowZotero()
        success = workflow.run_complete_workflow()
        sys.exit(0 if success else 1)
        
    except KeyboardInterrupt:
        log("WARNING", "\n⚠️ Interruption (Ctrl+C)")
        sys.exit(130)
    except Exception as e:
        log("ERROR", f"❌ Erreur: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
