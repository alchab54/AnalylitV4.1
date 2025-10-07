#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════
🎯 TEST WORKFLOW ATN COMPLET - 20 ARTICLES ZOTERO CSL JSON (OPTIMISÉ V2)
═══════════════════════════════════════════════════════════════

AnalyLit V4.2 RTX 2060 SUPER - Validation Empirique Thèse ATN
Source: Export Zotero 20ATN.json + grille-ATN.json
Workflow: Import → Screening (≥70/100) → Extraction 30 champs → PRISMA → Export

🔧 CORRECTIONS MAJEURES V2:
✅ Endpoints API corrigés selon server_v4_complete.py
✅ Gestion robuste des timeouts Ollama (600s max)
✅ IDs articles backend utilisés au lieu de zotero_id
✅ Retry logic pour échecs temporaires
✅ Monitoring temps réel amélioré
✅ Batch processing intelligent

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
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple

# ═══════════════════════════════════════════════════════════════
# ENCODAGE UTF-8 WINDOWS
# ═══════════════════════════════════════════════════════════════
if sys.platform.startswith('win'):
    try:
        sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
        sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')
    except Exception as e:
        print(f"WARNING: Could not set UTF-8 stdout/stderr: {e}")

# ═══════════════════════════════════════════════════════════════
# CONFIGURATION OPTIMISÉE
# ═══════════════════════════════════════════════════════════════
API_BASE = "http://localhost:8080"
PROJECT_ROOT = Path(__file__).resolve().parent.parent
ZOTERO_JSON_PATH = PROJECT_ROOT / "20ATN.json"
GRILLE_ATN_PATH = PROJECT_ROOT / "grille-ATN.json"
OUTPUT_DIR = PROJECT_ROOT / "resultats_atn_zotero"
OUTPUT_DIR.mkdir(exist_ok=True)

# Configuration timeouts optimisée RTX 2060 SUPER
TIMEOUT_CONFIG = {
    "api_request": 30,
    "add_articles": 300,     # 5 min pour ajout 20 articles
    "analysis": 600,         # 10 min par analyse (Ollama peut être lent)
    "extraction": 900,       # 15 min pour extraction complète
    "synthesis": 600,        # 10 min pour synthèse
    "export": 180,           # 3 min pour export
    "task_polling": 15       # Polling toutes les 15s
}

# ═══════════════════════════════════════════════════════════════
# LOGGING UTF-8 AMÉLIORÉ
# ═══════════════════════════════════════════════════════════════
def log(level: str, message: str, indent: int = 0):
    """Affiche un message de log formaté avec timestamp et emoji."""
    ts = datetime.now().strftime("%H:%M:%S")
    indent_str = "  " * indent
    emoji_map = {
        "INFO": "ℹ️", "SUCCESS": "✅", "ERROR": "❌",
        "WARNING": "⚠️", "PROGRESS": "⏳", "DATA": "📊", 
        "API": "📡", "RETRY": "🔄", "TIMEOUT": "⏰"
    }
    emoji = emoji_map.get(level, "📋")
    print(f"[{ts}] {indent_str}{emoji} {level}: {message}")

def log_section(title: str):
    """Affiche un séparateur de section."""
    print("\n" + "═" * 70)
    print(f"  {title}")
    print("═" * 70 + "\n")

# ═══════════════════════════════════════════════════════════════
# API WRAPPER ROBUSTE AVEC RETRY
# ═══════════════════════════════════════════════════════════════
def api_request(method: str, endpoint: str, data: Optional[Dict] = None,
                params: Optional[Dict] = None, timeout: int = 120, 
                max_retries: int = 3) -> Optional[Any]:
    """Wrapper robuste pour les requêtes API avec retry logic."""
    url = f"{API_BASE}{endpoint}"
    
    for attempt in range(max_retries):
        try:
            log("API", f"{method} {url} (tentative {attempt + 1}/{max_retries})", 1)
            
            if method.upper() == "GET":
                resp = requests.get(url, timeout=timeout, params=params)
            elif method.upper() == "POST":
                resp = requests.post(url, json=data, timeout=timeout, params=params)
            elif method.upper() == "PUT":
                resp = requests.put(url, json=data, timeout=timeout, params=params)
            else:
                log("ERROR", f"Méthode HTTP non supportée: {method}")
                return None
                
            if resp.status_code in [200, 201, 202]:
                return resp.json()
            elif resp.status_code == 204:
                return True  # No content
            else:
                log("ERROR", f"{method} {endpoint} a échoué - Code {resp.status_code}: {resp.text[:200]}", 2)
                if resp.status_code >= 500 and attempt < max_retries - 1:
                    log("RETRY", f"Erreur serveur, retry dans 5s...", 2)
                    time.sleep(5)
                    continue
                return None
                
        except requests.exceptions.Timeout:
            log("TIMEOUT", f"Timeout sur {endpoint} après {timeout}s", 2)
            if attempt < max_retries - 1:
                log("RETRY", f"Retry dans 10s...", 2)
                time.sleep(10)
                continue
            return None
            
        except requests.exceptions.RequestException as e:
            log("ERROR", f"Exception API ({attempt + 1}/{max_retries}): {e}", 2)
            if attempt < max_retries - 1:
                log("RETRY", f"Retry dans 5s...", 2)
                time.sleep(5)
                continue
            
    return None

# ═══════════════════════════════════════════════════════════════
# PARSEUR ZOTERO CSL JSON OPTIMISÉ
# ═══════════════════════════════════════════════════════════════
def parse_zotero_csl_json(json_path: Path) -> List[Dict]:
    """
    Parse un export Zotero CSL JSON vers le format attendu par AnalyLit.
    Version optimisée avec meilleure gestion des erreurs.
    """
    log("INFO", f"Chargement et parsing de '{json_path.name}'...")
    
    if not json_path.is_file():
        log("ERROR", f"Fichier Zotero JSON introuvable: {json_path}")
        return []
        
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            zotero_items = json.load(f)
        log("SUCCESS", f"Fichier JSON chargé: {len(zotero_items)} entrées trouvées")
    except (json.JSONDecodeError, IOError) as e:
        log("ERROR", f"Impossible de lire ou parser le fichier JSON: {e}")
        return []

    articles = []
    for i, item in enumerate(zotero_items):
        try:
            # --- Auteurs (robuste avec particules) ---
            authors_csl = item.get("author", [])
            authors = []
            
            for auth in authors_csl[:5]:  # Limite à 5 auteurs
                family = auth.get("family", "")
                given = auth.get("given", "")
                particle = auth.get("non-dropping-particle", "") or auth.get("dropping-particle", "")
                
                # Construction du nom complet avec particule
                name_parts = []
                if given:
                    name_parts.append(given)
                if particle:
                    name_parts.append(particle)
                if family:
                    name_parts.append(family)
                
                full_name = " ".join(name_parts).strip()
                if full_name:
                    authors.append(full_name)
            
            if not authors:
                authors = ["Auteur inconnu"]

            # --- Année robuste ---
            year = datetime.now().year  # Défaut
            issued = item.get("issued", {})
            if issued and "date-parts" in issued and issued["date-parts"]:
                try:
                    year = int(issued["date-parts"][0][0])
                except (IndexError, ValueError, TypeError):
                    pass

            # --- PMID extraction améliorée ---
            pmid = ""
            note_content = f"{item.get('note', '')} {item.get('extra', '')}"
            
            # Recherche patterns PMID courants
            pmid_patterns = ["PMID:", "PMID ", "pmid:", "pmid "]
            for pattern in pmid_patterns:
                if pattern in note_content:
                    try:
                        pmid_text = note_content.split(pattern)[1].split()[0].strip()
                        # Valide que c'est un nombre
                        if pmid_text.isdigit():
                            pmid = pmid_text
                            break
                    except (IndexError, ValueError):
                        continue

            # --- DOI nettoyage ---
            doi = item.get("DOI", "").strip()
            if doi and not doi.startswith("10."):
                doi = ""  # DOI invalide

            title = item.get("title", f"Titre inconnu {i+1}").strip()
            abstract = item.get("abstract", "Aucun abstract disponible.").strip()
            
            article = {
                "title": title,
                "authors": authors,
                "year": year,
                "abstract": abstract,
                "journal": item.get("container-title", "Journal inconnu").strip(),
                "doi": doi,
                "pmid": pmid,
                "type": item.get("type", "article-journal"),
                "language": item.get("language", "en"),
                "keywords": item.get("keywords", ["thèse", "ATN"]),
                "zotero_id": item.get("id", str(uuid.uuid4())),
                # Champs additionnels pour le backend
                "source": "zotero_import",
                "import_timestamp": datetime.now().isoformat()
            }
            
            articles.append(article)
            log("SUCCESS", f"Article {i+1:2d}: {title[:50]}{'...' if len(title) > 50 else ''}", 1)
            
        except Exception as e:
            log("WARNING", f"Erreur parsing article {i+1}: {e}", 1)
            continue

    log("SUCCESS", f"📚 {len(articles)} articles parsés avec succès depuis Zotero.")
    return articles

# ═══════════════════════════════════════════════════════════════
# CHARGEMENT GRILLE ATN
# ═══════════════════════════════════════════════════════════════
def load_grille_atn(json_path: Path) -> Dict:
    """Charge le fichier de configuration de la grille ATN."""
    log("INFO", f"Chargement de la grille d'extraction '{json_path.name}'...")
    
    if not json_path.is_file():
        log("WARNING", f"Fichier de grille ATN introuvable: {json_path}")
        return {}
        
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            grille = json.load(f)
        
        fields_count = len(grille.get('fields', []))
        log("SUCCESS", f"Grille ATN chargée avec {fields_count} champs d'extraction.")
        return grille
        
    except (json.JSONDecodeError, IOError) as e:
        log("ERROR", f"Impossible de charger ou parser la grille ATN: {e}")
        return {}

# ═══════════════════════════════════════════════════════════════
# CLASSE WORKFLOW PRINCIPAL OPTIMISÉE
# ═══════════════════════════════════════════════════════════════
class ATNWorkflowZoteroOptimized:
    """Classe workflow ATN optimisée avec gestion avancée des erreurs."""
    
    def __init__(self):
        self.project_id: Optional[str] = None
        self.articles_data: List[Dict] = []
        self.articles_backend_ids: List[int] = []  # IDs générés par le backend
        self.grille_atn: Dict = {}
        self.results: Dict[str, Any] = {
            "timestamp_start": datetime.now().isoformat(),
            "project_id": None,
            "articles_count": 0,
            "steps": {},
            "final_metrics": {},
            "errors": [],
            "warnings": []
        }

    def add_error(self, step: str, error: str):
        """Ajoute une erreur au rapport."""
        self.results["errors"].append({
            "step": step,
            "error": error,
            "timestamp": datetime.now().isoformat()
        })

    def add_warning(self, step: str, warning: str):
        """Ajoute un avertissement au rapport."""
        self.results["warnings"].append({
            "step": step,
            "warning": warning,
            "timestamp": datetime.now().isoformat()
        })

    def run_step(self, step_name: str, step_func) -> bool:
        """Exécute une étape du workflow avec mesure de performance."""
        start_time = time.time()
        success = False
        error_message = ""
        
        try:
            success = step_func()
        except Exception as e:
            error_message = str(e)
            log("ERROR", f"Exception inattendue à l'étape '{step_name}': {e}")
            self.add_error(step_name, error_message)
            import traceback
            traceback.print_exc()
                
        duration = time.time() - start_time
        self.results["steps"][step_name] = {
            "success": success,
            "duration_seconds": round(duration, 2),
            "error": error_message if error_message else None
        }
                
        if not success:
            log("ERROR", f"Échec de l'étape '{step_name}'. Voir les détails ci-dessus.")
                
        return success

    def check_api_health(self) -> bool:
        """Vérifie la santé de l'API AnalyLit."""
        log_section("ÉTAPE 0/7: VÉRIFICATION DE L'API ANALYLIT")
        
        health = api_request("GET", "/api/health", timeout=10)
        if health and health.get("status") == "healthy":
            log("SUCCESS", "API AnalyLit est opérationnelle.")
            log("DATA", f"Version: {health.get('version', 'N/A')}", 1)
            log("DATA", f"Services: {', '.join(health.get('services', []))}", 1)
            return True
            
        log("ERROR", "L'API AnalyLit n'est pas disponible. Veuillez démarrer le backend.")
        return False

    def load_data_sources(self) -> bool:
        """Charge les données sources (articles Zotero + grille ATN)."""
        log_section("ÉTAPE 1/7: CHARGEMENT DES DONNÉES SOURCES")
        
        # Chargement articles Zotero
        self.articles_data = parse_zotero_csl_json(ZOTERO_JSON_PATH)
        if not self.articles_data:
            self.add_error("load_data", "Aucun article chargé depuis Zotero")
            return False
            
        # Chargement grille ATN
        self.grille_atn = load_grille_atn(GRILLE_ATN_PATH)
        if not self.grille_atn:
            self.add_warning("load_data", "Grille ATN non trouvée - extraction basique sera utilisée")
                    
        self.results["articles_count"] = len(self.articles_data)
        log("DATA", f"Total articles Zotero: {len(self.articles_data)}", 1)
        log("DATA", f"Champs d'extraction ATN: {len(self.grille_atn.get('fields', []))}", 1)
        
        # Validation des données
        valid_articles = [a for a in self.articles_data if a.get('title') and a.get('abstract')]
        if len(valid_articles) < len(self.articles_data):
            missing = len(self.articles_data) - len(valid_articles)
            self.add_warning("load_data", f"{missing} articles sans titre/abstract seront ignorés")
            
        return True

    def create_atn_project(self) -> bool:
        """Crée le projet ATN dans AnalyLit."""
        log_section("ÉTAPE 2/7: CRÉATION DU PROJET ATN")
        
        project_name = f"ATN Zotero Validation - {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        project_description = (
            f"Projet de validation empirique pour la thèse ATN.\n"
            f"Source: {len(self.articles_data)} articles de Zotero (20ATN.json)\n"
            f"Pipeline: Screening → Extraction → Synthèse → Export\n"
            f"Grille: {len(self.grille_atn.get('fields', []))} champs ATN spécialisés\n"
            f"Date: {datetime.now().strftime('%d/%m/%Y %H:%M')}"
        )
        
        data = {
            "name": project_name,
            "description": project_description,
            "type": "atn_validation",  # Type spécialisé
            "metadata": {
                "source": "zotero_export",
                "thesis_validation": True,
                "article_count": len(self.articles_data),
                "grille_fields": len(self.grille_atn.get('fields', []))
            }
        }
        
        result = api_request("POST", "/api/projects", data, timeout=TIMEOUT_CONFIG["api_request"])
                
        if result and "id" in result:
            self.project_id = result["id"]
            self.results["project_id"] = self.project_id
            log("SUCCESS", f"Projet créé avec succès.")
            log("DATA", f"Project ID: {self.project_id}", 1)
            log("DATA", f"URL interface: http://localhost:3000/projects/{self.project_id}", 1)
            return True
            
        log("ERROR", "La création du projet a échoué.")
        self.add_error("create_project", "Échec création projet - vérifier les logs API")
        return False

    def add_articles_to_project(self) -> bool:
        """Ajoute les articles au projet et récupère les IDs backend."""
        log_section("ÉTAPE 3/7: AJOUT DES ARTICLES AU PROJET")
        
        # ✅ CORRECTION: Utilise le bon endpoint et format de données
        data = {
            "items": self.articles_data,
            "source": "zotero_import",
            "batch_size": 10  # Traitement par batch pour éviter surcharge
        }
        
        endpoint = f"/api/projects/{self.project_id}/add-manual-articles"
        result = api_request("POST", endpoint, data, timeout=TIMEOUT_CONFIG["add_articles"])
                
        if result and result.get("task_id"):
            task_id = result["task_id"]
            log("SUCCESS", f"Tâche d'ajout lancée (Job ID: {task_id})")
            log("PROGRESS", f"Ajout de {len(self.articles_data)} articles en cours...", 1)
            
            # Attendre la fin de l'ajout et récupérer les IDs
            if self.wait_for_task(task_id, "ajout des articles", timeout_min=10):
                return self.get_articles_backend_ids()
            else:
                self.add_error("add_articles", f"Timeout sur tâche d'ajout {task_id}")
                return False
                
        log("ERROR", "L'ajout des articles a échoué.")
        self.add_error("add_articles", "Échec lancement tâche d'ajout")
        return False

    def get_articles_backend_ids(self) -> bool:
        """Récupère les IDs des articles générés par le backend."""
        log("INFO", "Récupération des IDs articles du backend...")
        
        # Récupère la liste des articles du projet
        result = api_request("GET", f"/api/projects/{self.project_id}/articles")
        
        if result and "articles" in result:
            articles = result["articles"]
            self.articles_backend_ids = [article["id"] for article in articles]
            log("SUCCESS", f"IDs récupérés: {len(self.articles_backend_ids)} articles", 1)
            
            # Log des premiers IDs pour vérification
            sample_ids = self.articles_backend_ids[:5]
            log("DATA", f"Échantillon IDs: {sample_ids}", 1)
            return True
        else:
            log("WARNING", "Impossible de récupérer les IDs - utilisation des titres comme fallback")
            self.add_warning("get_ids", "Fallback vers titres d'articles au lieu des IDs")
            return True  # Non bloquant

    def run_atn_screening(self) -> bool:
        """Lance le screening ATN avec seuil ≥ 70/100."""
        log_section("ÉTAPE 4/7: SCREENING ATN (SEUIL ≥ 70/100)")
        
        # ✅ CORRECTION: Utilise les IDs backend ou fallback
        if self.articles_backend_ids:
            article_identifiers = self.articles_backend_ids
            log("INFO", f"Utilisation des IDs backend: {len(article_identifiers)} articles")
        else:
            # Fallback vers les titres si pas d'IDs
            article_identifiers = [article["title"] for article in self.articles_data]
            log("WARNING", "Utilisation des titres comme identifiants (fallback)")
            
        data = {
            "type": "screening",
            "articles": article_identifiers,
            "profile": "atn-fast-gpu",  # Profil optimisé RTX 2060 SUPER
            "screening_config": {
                "threshold": 70,
                "auto_validate": True,
                "parallel_processing": True
            },
            "analysis_options": {
                "include_confidence": True,
                "detailed_scoring": True
            }
        }
        
        # ✅ CORRECTION: Bon endpoint
        endpoint = f"/api/projects/{self.project_id}/run-analysis"
        result = api_request("POST", endpoint, data, timeout=TIMEOUT_CONFIG["analysis"])
                
        if result and result.get("job_id"):
            job_id = result["job_id"]
            log("SUCCESS", f"Screening ATN lancé (Job ID: {job_id})")
            
            # Monitoring non-bloquant (screening peut être long)
            if self.wait_for_task(job_id, "screening ATN", timeout_min=15):
                log("SUCCESS", "Screening ATN terminé avec succès")
            else:
                log("WARNING", "Screening ATN en cours - passage à l'étape suivante")
                self.add_warning("screening", "Screening non terminé dans le délai imparti")
                
            return True  # Non bloquant même si timeout
        else:
            log("WARNING", "Impossible de lancer le screening - passage à l'extraction")
            self.add_warning("screening", "Échec lancement screening - étape ignorée")
            return True  # Non bloquant

    def run_atn_extraction(self) -> bool:
        """Lance l'extraction avec la grille ATN spécialisée."""
        log_section("ÉTAPE 5/7: EXTRACTION AVEC GRILLE ATN")
        
        if not self.grille_atn.get("fields"):
            log("WARNING", "Aucune grille d'extraction - extraction basique sera utilisée")
            extraction_fields = []  # Backend utilisera grille par défaut
        else:
            extraction_fields = self.grille_atn["fields"]
            log("INFO", f"Utilisation grille ATN: {len(extraction_fields)} champs")
        
        # Utilise les IDs backend si disponibles
        if self.articles_backend_ids:
            article_identifiers = self.articles_backend_ids
        else:
            article_identifiers = [article["title"] for article in self.articles_data]
            
        data = {
            "type": "extraction",
            "articles": article_identifiers,
            "extraction_config": {
                "grid_fields": extraction_fields,
                "profile": "atn-specialized",  # Profil ATN spécialisé
                "parallel_processing": True,
                "batch_size": 5  # Batch plus petit pour extraction
            },
            "output_format": "detailed_json"
        }
        
        endpoint = f"/api/projects/{self.project_id}/run-analysis"
        result = api_request("POST", endpoint, data, timeout=TIMEOUT_CONFIG["extraction"])
                
        if result and result.get("job_id"):
            job_id = result["job_id"]
            log("SUCCESS", f"Extraction ATN lancée (Job ID: {job_id})")
            
            # Extraction est critique - attendre la fin
            if self.wait_for_task(job_id, "extraction ATN", timeout_min=20):
                log("SUCCESS", "Extraction ATN terminée avec succès")
                return True
            else:
                log("ERROR", "Timeout sur l'extraction ATN")
                self.add_error("extraction", f"Timeout sur tâche d'extraction {job_id}")
                return False
        else:
            log("ERROR", "Le lancement de l'extraction a échoué.")
            self.add_error("extraction", "Échec lancement extraction")
            return False

    def run_synthesis_and_prisma(self) -> bool:
        """Lance la synthèse et génère le diagramme PRISMA."""
        log_section("ÉTAPE 6/7: SYNTHÈSE ET DIAGRAMME PRISMA")
        
        data = {
            "type": "synthesis",
            "synthesis_config": {
                "include_prisma": True,
                "generate_graphs": True,
                "atn_analysis": True,  # Analyse spécialisée ATN
                "export_ready": True
            },
            "prisma_config": {
                "identification": len(self.articles_data),
                "screening_threshold": 70,
                "inclusion_criteria": "ATN relevance",
                "methodology": "PRISMA-ScR"
            },
            "output_formats": ["json", "pdf", "docx"]
        }
        
        endpoint = f"/api/projects/{self.project_id}/run-analysis"
        result = api_request("POST", endpoint, data, timeout=TIMEOUT_CONFIG["synthesis"])
                
        if result and result.get("job_id"):
            job_id = result["job_id"]
            log("SUCCESS", f"Synthèse et PRISMA lancés (Job ID: {job_id})")
            
            if self.wait_for_task(job_id, "synthèse et PRISMA", timeout_min=12):
                log("SUCCESS", "Synthèse et PRISMA terminés avec succès")
                return True
            else:
                log("WARNING", "Synthèse non terminée dans les délais")
                self.add_warning("synthesis", "Synthèse en cours - résultats partiels disponibles")
                return True  # Non bloquant
        else:
            log("ERROR", "Le lancement de la synthèse a échoué.")
            self.add_error("synthesis", "Échec lancement synthèse")
            return False

    def export_thesis_results(self) -> bool:
        """Exporte les résultats pour la thèse doctorale."""
        log_section("ÉTAPE 7/7: EXPORT DES RÉSULTATS POUR LA THÈSE")
        
        # ✅ CORRECTION: Utilise GET pour télécharger le fichier
        endpoint = f"/api/projects/{self.project_id}/export/thesis"
        params = {
            "format": "complete",  # Export complet
            "include_raw_data": True,
            "include_analysis": True,
            "include_prisma": True
        }
        
        url = f"{API_BASE}{endpoint}"
        
        try:
            log("INFO", "Démarrage de l'export des résultats...", 1)
            resp = requests.get(url, params=params, stream=True, timeout=TIMEOUT_CONFIG["export"])
            
            if resp.status_code == 200:
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                export_filename = f"export_these_atn_{self.project_id}_{timestamp}.zip"
                export_path = OUTPUT_DIR / export_filename
                
                # Téléchargement avec progression
                total_size = int(resp.headers.get('content-length', 0))
                downloaded = 0
                
                with open(export_path, 'wb') as f:
                    for chunk in resp.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                            downloaded += len(chunk)
                            
                            if total_size > 0:
                                progress = (downloaded / total_size) * 100
                                log("PROGRESS", f"Export: {progress:.1f}% ({downloaded:,} / {total_size:,} bytes)", 2)
                
                log("SUCCESS", f"Export terminé: {export_path}")
                log("DATA", f"Taille: {export_path.stat().st_size:,} bytes", 1)
                return True
                
            elif resp.status_code == 202:
                log("INFO", "Export en cours de génération... Veuillez patienter.")
                # Pourrait implémenter un polling ici
                return True
            else:
                error_msg = f"Export échoué - Code {resp.status_code}: {resp.text[:200]}"
                log("ERROR", error_msg)
                self.add_error("export", error_msg)
                return False
                
        except requests.RequestException as e:
            error_msg = f"Erreur lors de la requête d'export: {e}"
            log("ERROR", error_msg)
            self.add_error("export", error_msg)
            return False

    def wait_for_task(self, task_id: str, step_name: str, timeout_min: int = 20) -> bool:
        """Attend la fin d'une tâche avec monitoring avancé."""
        log("PROGRESS", f"Monitoring de la tâche '{step_name}' (max {timeout_min} min)...")
        
        start_time = time.time()
        last_progress = ""
        check_interval = TIMEOUT_CONFIG["task_polling"]
        
        while time.time() - start_time < timeout_min * 60:
            endpoint = f"/api/tasks/{task_id}/status"
            status_data = api_request("GET", endpoint, timeout=10)
                        
            if status_data:
                status = status_data.get("status", "unknown")
                progress = status_data.get("progress", {})
                error_info = status_data.get("error")
                
                # Affiche seulement les nouveaux messages pour éviter spam
                current_progress = f"{status} - {progress.get('message', '')}"
                if current_progress != last_progress:
                    log("PROGRESS", f"'{step_name}': {current_progress}", 1)
                    last_progress = current_progress
                
                if status == "finished":
                    log("SUCCESS", f"Tâche '{step_name}' terminée avec succès")
                    return True
                    
                if status == "failed":
                    error_detail = error_info or progress.get('error', 'Erreur inconnue')
                    log("ERROR", f"Tâche '{step_name}' échouée: {error_detail}")
                    self.add_error(step_name, f"Tâche échouée: {error_detail}")
                    return False
            else:
                log("WARNING", f"Impossible de récupérer le statut de la tâche {task_id}", 1)
                        
            time.sleep(check_interval)
                    
        # Timeout atteint
        elapsed = (time.time() - start_time) / 60
        log("TIMEOUT", f"Timeout atteint pour '{step_name}' après {elapsed:.1f} min")
        self.add_warning(step_name, f"Timeout après {elapsed:.1f} minutes")
        return False

    def get_final_metrics(self) -> Dict:
        """Récupère les métriques finales du projet."""
        log("INFO", "Collecte des métriques finales...")
        
        project = api_request("GET", f"/api/projects/{self.project_id}")
        if not project:
            log("WARNING", "Impossible de récupérer les métriques du projet")
            return {}
                
        metrics = {
            "articles_total": len(self.articles_data),
            "articles_processed": project.get("articles_count", 0),
            "mean_atn_score": project.get("mean_score", 0),
            "status": project.get("status", "unknown"),
            "processing_time_minutes": sum(
                step.get("duration_seconds", 0) 
                for step in self.results["steps"].values()
            ) / 60,
            "success_rate": len([
                step for step in self.results["steps"].values() 
                if step.get("success", False)
            ]) / len(self.results["steps"]) * 100,
            "errors_count": len(self.results["errors"]),
            "warnings_count": len(self.results["warnings"])
        }
        
        log("DATA", f"Score ATN moyen: {metrics['mean_atn_score']:.1f}/100", 1)
        log("DATA", f"Temps total: {metrics['processing_time_minutes']:.1f} minutes", 1)
        log("DATA", f"Taux de succès: {metrics['success_rate']:.1f}%", 1)
        
        return metrics

    def save_report(self):
        """Sauvegarde le rapport final détaillé du workflow."""
        self.results["timestamp_end"] = datetime.now().isoformat()
        
        if self.project_id:
            self.results["final_metrics"] = self.get_final_metrics()
                
        # Ajout statistiques de performance
        self.results["performance"] = {
            "total_duration_minutes": (
                datetime.fromisoformat(self.results["timestamp_end"]) - 
                datetime.fromisoformat(self.results["timestamp_start"])
            ).total_seconds() / 60,
            "steps_summary": {
                step_name: {
                    "success": step_data.get("success", False),
                    "duration_seconds": step_data.get("duration_seconds", 0)
                }
                for step_name, step_data in self.results["steps"].items()
            }
        }
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = OUTPUT_DIR / f"rapport_workflow_atn_{timestamp}.json"
        
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(self.results, f, indent=2, ensure_ascii=False)
                
            log("SUCCESS", f"📊 Rapport de workflow sauvegardé: {filename}")
            log("DATA", f"Taille rapport: {filename.stat().st_size:,} bytes", 1)
            
            # Rapport résumé en texte
            self.save_summary_report(timestamp)
            
        except IOError as e:
            log("ERROR", f"Impossible de sauvegarder le rapport: {e}")

    def save_summary_report(self, timestamp: str):
        """Sauvegarde un rapport résumé lisible."""
        summary_path = OUTPUT_DIR / f"resume_workflow_atn_{timestamp}.txt"
        
        try:
            with open(summary_path, 'w', encoding='utf-8') as f:
                f.write("═══════════════════════════════════════════════════════════════\n")
                f.write("   RAPPORT DE VALIDATION EMPIRIQUE ATN - RÉSUMÉ EXÉCUTIF\n")
                f.write("═══════════════════════════════════════════════════════════════\n\n")
                
                f.write(f"📅 Date: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}\n")
                f.write(f"🆔 Projet ID: {self.project_id}\n")
                f.write(f"📚 Articles traités: {len(self.articles_data)}\n\n")
                
                # Résultats par étape
                f.write("🔄 RÉSULTATS PAR ÉTAPE:\n")
                for step_name, step_data in self.results["steps"].items():
                    status = "✅ SUCCÈS" if step_data.get("success") else "❌ ÉCHEC"
                    duration = step_data.get("duration_seconds", 0)
                    f.write(f"   {step_name:20} → {status:8} ({duration:.1f}s)\n")
                
                # Métriques finales
                if "final_metrics" in self.results:
                    metrics = self.results["final_metrics"]
                    f.write(f"\n📊 MÉTRIQUES FINALES:\n")
                    f.write(f"   Score ATN moyen: {metrics.get('mean_atn_score', 0):.1f}/100\n")
                    f.write(f"   Temps total: {metrics.get('processing_time_minutes', 0):.1f} min\n")
                    f.write(f"   Taux de succès: {metrics.get('success_rate', 0):.1f}%\n")
                
                # Erreurs et avertissements
                if self.results["errors"]:
                    f.write(f"\n❌ ERREURS ({len(self.results['errors'])}):\n")
                    for error in self.results["errors"]:
                        f.write(f"   • {error['step']}: {error['error']}\n")
                
                if self.results["warnings"]:
                    f.write(f"\n⚠️  AVERTISSEMENTS ({len(self.results['warnings'])}):\n")
                    for warning in self.results["warnings"]:
                        f.write(f"   • {warning['step']}: {warning['warning']}\n")
                
                f.write(f"\n🔗 Interface web: http://localhost:3000/projects/{self.project_id}\n")
                f.write("═══════════════════════════════════════════════════════════════\n")
                
            log("SUCCESS", f"📋 Rapport résumé sauvegardé: {summary_path}")
            
        except IOError as e:
            log("WARNING", f"Impossible de sauvegarder le rapport résumé: {e}")

    def run_complete_workflow(self):
        """Orchestre l'exécution complète du workflow ATN optimisé."""
        log_section("🚀 DÉMARRAGE DU WORKFLOW ATN COMPLET OPTIMISÉ V2 🚀")
        log("INFO", f"RTX 2060 SUPER - {len(self.articles_data) if hasattr(self, 'articles_data') else 'N/A'} articles Zotero")
        log("INFO", f"Timeouts configurés: Analysis={TIMEOUT_CONFIG['analysis']}s, Extraction={TIMEOUT_CONFIG['extraction']}s")
                
        steps_config = [
            ("health_check", self.check_api_health, True),      # Bloquant
            ("load_data", self.load_data_sources, True),        # Bloquant
            ("create_project", self.create_atn_project, True),  # Bloquant
            ("add_articles", self.add_articles_to_project, True), # Bloquant
            ("screening", self.run_atn_screening, False),       # Non bloquant
            ("extraction", self.run_atn_extraction, True),      # Bloquant
            ("synthesis_prisma", self.run_synthesis_and_prisma, False), # Non bloquant
            ("export_thesis", self.export_thesis_results, False)  # Non bloquant
        ]
        
        try:
            failed_critical = False
            
            for step_name, step_func, is_critical in steps_config:
                success = self.run_step(step_name, step_func)
                
                if not success and is_critical:
                    log("ERROR", f"Étape critique '{step_name}' échouée - Arrêt du workflow")
                    failed_critical = True
                    break
                elif not success:
                    log("WARNING", f"Étape '{step_name}' échouée mais non critique - Continuation")
            
            if not failed_critical:
                log_section("🎉 WORKFLOW TERMINÉ 🎉")
                
                # Affichage des résultats finaux
                if self.project_id:
                    metrics = self.get_final_metrics()
                    log("SUCCESS", "🏆 RÉSULTATS DE LA VALIDATION EMPIRIQUE ATN:")
                    log("DATA", f"Articles traités: {metrics.get('articles_processed', 'N/A')} / {metrics.get('articles_total', 'N/A')}", 1)
                    log("DATA", f"Score ATN moyen: {metrics.get('mean_atn_score', 0):.1f}/100", 1)
                    log("DATA", f"Temps de traitement: {metrics.get('processing_time_minutes', 0):.1f} min", 1)
                    log("DATA", f"Taux de succès: {metrics.get('success_rate', 0):.1f}%", 1)
                    
                    if metrics.get('errors_count', 0) == 0:
                        log("SUCCESS", "✅ Aucune erreur - Validation empirique réussie!")
                    else:
                        log("WARNING", f"⚠️ {metrics.get('errors_count')} erreur(s) - Voir rapport détaillé")
                    
                    log("INFO", f"🔗 Interface: http://localhost:3000/projects/{self.project_id}")
                else:
                    log("WARNING", "Projet non créé - Résultats limités")
            else:
                log("ERROR", "❌ Workflow interrompu suite à une erreur critique")
                
        except Exception as e:
            log("ERROR", f"💥 Erreur critique dans le workflow: {e}")
            self.add_error("workflow", f"Exception critique: {e}")
            import traceback
            traceback.print_exc()
        finally:
            # Toujours sauvegarder le rapport
            self.save_report()
            log("INFO", "📊 Rapport de validation sauvegardé dans:", 1)
            log("INFO", f"   {OUTPUT_DIR}", 1)
            log("INFO", "🏁 Fin du script de validation empirique ATN.")

# ═══════════════════════════════════════════════════════════════
# POINT D'ENTRÉE PRINCIPAL
# ═══════════════════════════════════════════════════════════════
def main():
    """Point d'entrée principal avec gestion des exceptions globales."""
    try:
        workflow = ATNWorkflowZoteroOptimized()
        workflow.run_complete_workflow()
        
    except KeyboardInterrupt:
        log("WARNING", "⚠️ Interruption manuelle du script (Ctrl+C)")
        log("INFO", "Sauvegarde d'urgence en cours...")
        sys.exit(130)
        
    except Exception as e:
        log("ERROR", f"💥 Erreur fatale: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()