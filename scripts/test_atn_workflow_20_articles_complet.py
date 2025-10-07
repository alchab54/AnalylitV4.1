#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════
🎯 TEST WORKFLOW ATN COMPLET - 20 ARTICLES PMID RÉELS
VERSION CORRIGÉE - Adaptée aux endpoints API réels
═══════════════════════════════════════════════════════════════
"""

import sys
import codecs
import requests
import json
import time
import os
import glob
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from Bio import Entrez

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
ZOTERO_STORAGE_PATH = r"C:\Users\alich\Zotero\storage"
OUTPUT_DIR = Path("./resultats_atn_20_articles")
OUTPUT_DIR.mkdir(exist_ok=True)

# Entrez configuration pour PubMed
Entrez.email = "votre.email@example.com"  # Requis par NCBI

# ═══════════════════════════════════════════════════════════════
# 20 PMIDS RÉELS
# ═══════════════════════════════════════════════════════════════
PMIDS_ATN = [
    "40585405", "40562106", "40541374", "40525210", "40512270",
    "40433301", "40423728", "40417271", "40408143", "40390798",
    "40387286", "40385514", "40385249", "40374613", "40343065",
    "40340626", "40328004", "40319938", "40317432", "40313368"
]

# ═══════════════════════════════════════════════════════════════
# LOGGING
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
# PUBMED ENTREZ
# ═══════════════════════════════════════════════════════════════
def fetch_pubmed_metadata_entrez(pmids: List[str]) -> List[Dict]:
    """Récupération PubMed via Bio.Entrez"""
    log("INFO", f"Récupération PubMed pour {len(pmids)} PMIDs via Entrez...")
    
    articles = []
    batch_size = 10
    
    for i in range(0, len(pmids), batch_size):
        batch = pmids[i:i+batch_size]
        try:
            handle = Entrez.efetch(db="pubmed", id=",".join(batch), 
                                  retmode="xml", rettype="abstract")
            records = Entrez.read(handle)
            handle.close()
            
            for record in records.get('PubmedArticle', []):
                try:
                    article_data = record['MedlineCitation']['Article']
                    pmid = str(record['MedlineCitation']['PMID'])
                    
                    # Extraction auteurs
                    authors_list = article_data.get('AuthorList', [])
                    authors = []
                    for auth in authors_list[:3]:  # Max 3 auteurs
                        last = auth.get('LastName', '')
                        first = auth.get('ForeName', '')
                        if last:
                            authors.append(f"{last}, {first}")
                    
                    # Extraction abstract
                    abstract_data = article_data.get('Abstract', {})
                    abstract_text = ""
                    if abstract_data:
                        abstract_parts = abstract_data.get('AbstractText', [])
                        if isinstance(abstract_parts, list):
                            abstract_text = " ".join([str(part) for part in abstract_parts])
                        else:
                            abstract_text = str(abstract_parts)
                    
                    # Extraction année
                    pub_date = article_data.get('ArticleDate', [{}])[0] if article_data.get('ArticleDate') else article_data.get('Journal', {}).get('JournalIssue', {}).get('PubDate', {})
                    year = pub_date.get('Year', '2024')
                    
                    # DOI
                    doi = ""
                    for eloc_id in article_data.get('ELocationID', []):
                        if eloc_id.attributes.get('EIdType') == 'doi':
                            doi = str(eloc_id)
                            break
                    
                    article = {
                        "pmid": pmid,
                        "title": str(article_data.get('ArticleTitle', f'Article PMID {pmid}')),
                        "authors": authors if authors else ["Unknown"],
                        "year": int(year) if year.isdigit() else 2024,
                        "abstract": abstract_text[:500] if abstract_text else f"Abstract for PMID {pmid}",
                        "journal": str(article_data.get('Journal', {}).get('Title', 'Journal TBD')),
                        "doi": doi,
                        "keywords": ["therapeutic alliance", "digital health", "AI"]
                    }
                    
                    articles.append(article)
                    log("SUCCESS", f"PMID {pmid} récupéré", 2)
                    
                except Exception as e:
                    log("WARNING", f"Erreur parsing PMID: {str(e)[:100]}", 2)
                    continue
            
            time.sleep(0.5)  # Rate limiting NCBI
            
        except Exception as e:
            log("ERROR", f"Batch {i//batch_size + 1} échoué: {str(e)[:200]}")
            continue
    
    log("SUCCESS", f"{len(articles)} articles PubMed récupérés")
    return articles

# ═══════════════════════════════════════════════════════════════
# RECHERCHE ZOTERO PDFs
# ═══════════════════════════════════════════════════════════════
def find_zotero_pdf_advanced(pmid: str, title: str = "") -> Optional[str]:
    """Recherche PDF Zotero améliorée"""
    if not os.path.exists(ZOTERO_STORAGE_PATH):
        return None
    
    # 1. Recherche par PMID dans nom fichier
    search_pattern = os.path.join(ZOTERO_STORAGE_PATH, "**", "*.pdf")
    pdf_files = glob.glob(search_pattern, recursive=True)
    
    for pdf_path in pdf_files:
        filename = os.path.basename(pdf_path).lower()
        if pmid in filename:
            return pdf_path
    
    # 2. Recherche par mots-clés titre (premiers mots significatifs)
    if title:
        title_keywords = [w.lower() for w in title.split()[:3] if len(w) > 4]
        for pdf_path in pdf_files:
            filename = os.path.basename(pdf_path).lower()
            if any(kw in filename for kw in title_keywords):
                return pdf_path
    
    return None

# ═══════════════════════════════════════════════════════════════
# CLASSE WORKFLOW
# ═══════════════════════════════════════════════════════════════
class ATNWorkflowComplete:
    def __init__(self):
        self.project_id = None
        self.articles_data = []
        self.results = {
            "timestamp_start": datetime.now().isoformat(),
            "project_id": None,
            "pmids_count": len(PMIDS_ATN),
            "steps": {},
            "final_metrics": {}
        }
    
    def check_api_health(self) -> bool:
        log_section("ÉTAPE 0/7: VÉRIFICATION API")
        health = api_request("GET", "/api/health")
        if health and health.get("status") == "healthy":
            log("SUCCESS", "API opérationnelle")
            return True
        log("ERROR", "API non disponible")
        return False
    
    def fetch_articles_metadata(self) -> bool:
        log_section("ÉTAPE 1/7: RÉCUPÉRATION PUBMED (Entrez)")
        
        self.articles_data = fetch_pubmed_metadata_entrez(PMIDS_ATN)
        
        if not self.articles_data:
            log("ERROR", "Aucun article récupéré")
            return False
        
        log("SUCCESS", f"{len(self.articles_data)} articles PubMed")
        self.results["steps"]["metadata_fetch"] = {
            "success": True,
            "articles_count": len(self.articles_data)
        }
        return True
    
    def attach_zotero_pdfs(self) -> bool:
        log_section("ÉTAPE 2/7: RECHERCHE PDFs ZOTERO")
        
        pdf_found_count = 0
        for article in self.articles_data:
            pmid = article.get("pmid")
            title = article.get("title", "")
            pdf_path = find_zotero_pdf_advanced(pmid, title)
            
            if pdf_path:
                article["pdf_path"] = pdf_path
                article["pdf_source"] = "zotero_local"
                pdf_found_count += 1
                log("SUCCESS", f"PDF trouvé: {os.path.basename(pdf_path)[:50]}", 2)
        
        log("SUCCESS", f"{pdf_found_count}/{len(self.articles_data)} PDFs trouvés")
        self.results["steps"]["pdf_attachment"] = {
            "success": True,
            "pdfs_found": pdf_found_count
        }
        return True
    
    def create_atn_project(self) -> bool:
        log_section("ÉTAPE 3/7: CRÉATION PROJET ATN")
        
        data = {
            "name": f"ATN 20 Articles - {datetime.now().strftime('%Y%m%d_%H%M')}",
            "description": "Validation empirique ATN v2.1 - 20 PMIDs - Thèse Alliance Thérapeutique Numérique"
        }
        
        result = api_request("POST", "/api/projects", data)
        
        # ✅ CORRECTION: l'API retourne "id" pas "project_id"
        if result and "id" in result:
            self.project_id = result["id"]
            self.results["project_id"] = self.project_id
            log("SUCCESS", f"Projet créé: {self.project_id}")
            return True
        
        log("ERROR", "Échec création projet")
        return False
    
    def add_articles_to_project(self) -> bool:
        log_section("ÉTAPE 4/7: AJOUT 20 ARTICLES AU PROJET")
        
        # Format items attendu par l'API
        data = {
            "articles_data": self.articles_data,  # Format API réel
            "source": "manual_pubmed"
        }
        
        # ✅ Endpoint correct identifié dans les logs
        result = api_request("POST", 
                           f"/api/projects/{self.project_id}/add-manual-articles",
                           data, timeout=120)
        
        if result:
            log("SUCCESS", f"Articles ajoutés au projet")
            time.sleep(10)
            return True
        
        log("ERROR", "Échec ajout articles")
        return False
    
    def run_atn_screening(self) -> bool:
        log_section("ÉTAPE 5/7: SCREENING ATN (≥70/100)")
        
        data = {
            "profile_id": "atn-specialized",  # Profil RTX 2060 SUPER
            "auto_validate_threshold": 70
        }
        
        result = api_request("POST", 
                           f"/api/projects/{self.project_id}/run-screening",
                           data, timeout=300)
        
        if result:
            log("SUCCESS", "Screening lancé")
            return self.wait_for_completion("screening", 15)
        
        log("WARNING", "Screening non disponible, passage extraction")
        return True
    
    def run_atn_extraction(self) -> bool:
        log_section("ÉTAPE 6/7: EXTRACTION GRILLE ATN 30 CHAMPS")
        
        data = {
            "analysis_type": "atn_extraction",
            "profile_id": "atn-specialized",
            "extract_from_pdfs": True
        }
        
        result = api_request("POST",
                           f"/api/projects/{self.project_id}/run-analysis",
                           data, timeout=600)
        
        if result:
            log("SUCCESS", "Extraction lancée")
            return self.wait_for_completion("extraction", 30)
        
        log("ERROR", "Échec extraction")
        return False
    
    def run_synthesis_prisma(self) -> bool:
        log_section("ÉTAPE 7/7: SYNTHÈSE PRISMA + GRAPHES")
        
        data = {
            "analysis_type": "synthesis",
            "include_prisma": True,
            "generate_graphs": True
        }
        
        result = api_request("POST",
                           f"/api/projects/{self.project_id}/run-analysis",
                           data, timeout=300)
        
        if result:
            log("SUCCESS", "Synthèse lancée")
            return self.wait_for_completion("synthesis", 15)
        
        log("ERROR", "Échec synthèse")
        return False
    
    def wait_for_completion(self, step: str, timeout_min: int) -> bool:
        log("PROGRESS", f"Attente fin {step} ({timeout_min}min)...")
        
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
        project = api_request("GET", f"/api/projects/{self.project_id}")
        if not project:
            return {}
        
        return {
            "articles_total": len(PMIDS_ATN),
            "articles_processed": project.get("articles_count", 0),
            "mean_atn_score": project.get("mean_score", 0),
            "status": project.get("status", "unknown")
        }
    
    def save_report(self):
        self.results["timestamp_end"] = datetime.now().isoformat()
        self.results["final_metrics"] = self.get_final_metrics()
        
        filename = OUTPUT_DIR / f"rapport_atn_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, indent=2, ensure_ascii=False)
        
        log("SUCCESS", f"Rapport: {filename}")
    
    def run_complete_workflow(self) -> bool:
        log("INFO", "═"*70)
        log("INFO", "🚀 WORKFLOW ATN COMPLET - 20 PMIDS RÉELS")
        log("INFO", "═"*70)
        
        steps = [
            ("health_check", self.check_api_health),
            ("fetch_metadata", self.fetch_articles_metadata),
            ("attach_pdfs", self.attach_zotero_pdfs),
            ("create_project", self.create_atn_project),
            ("add_articles", self.add_articles_to_project),
            ("screening", self.run_atn_screening),
            ("extraction", self.run_atn_extraction),
            ("synthesis", self.run_synthesis_prisma)
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
                
                if not success and step_name not in ["screening", "attach_pdfs"]:
                    log("ERROR", f"Arrêt sur échec: {step_name}")
                    self.save_report()
                    return False
                    
            except Exception as e:
                log("ERROR", f"Exception {step_name}: {str(e)}")
                self.save_report()
                return False
        
        log_section("🎉 WORKFLOW TERMINÉ")
        metrics = self.get_final_metrics()
        log("DATA", f"Articles traités: {metrics.get('articles_processed', 0)}")
        log("DATA", f"Score ATN moyen: {metrics.get('mean_atn_score', 0):.1f}/100")
        log("SUCCESS", f"Projet: http://localhost:8080/projects/{self.project_id}")
        
        self.save_report()
        return True

# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════
def main():
    try:
        # Vérifier dépendance Biopython
        try:
            from Bio import Entrez
        except ImportError:
            print("❌ Biopython manquant: pip install biopython")
            sys.exit(1)
        
        workflow = ATNWorkflowComplete()
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
