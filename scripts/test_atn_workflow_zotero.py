#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════
🎯 TEST WORKFLOW ATN COMPLET - 20 ARTICLES ZOTERO CSL JSON (OPTIMISÉ)
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
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

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
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════
API_BASE = "http://localhost:8080"
PROJECT_ROOT = Path(__file__).resolve().parent.parent
ZOTERO_JSON_PATH = PROJECT_ROOT / "20ATN.json"
GRILLE_ATN_PATH = PROJECT_ROOT / "grille-ATN.json"
OUTPUT_DIR = PROJECT_ROOT / "resultats_atn_zotero"
OUTPUT_DIR.mkdir(exist_ok=True)

# ═══════════════════════════════════════════════════════════════
# LOGGING UTF-8
# ═══════════════════════════════════════════════════════════════
def log(level: str, message: str, indent: int = 0):
    """Affiche un message de log formaté avec timestamp et emoji."""
    ts = datetime.now().strftime("%H:%M:%S")
    indent_str = "  " * indent
    emoji_map = {
        "INFO": "ℹ️", "SUCCESS": "✅", "ERROR": "❌",
        "WARNING": "⚠️", "PROGRESS": "⏳", "DATA": "📊", "API": "📡"
    }
    emoji = emoji_map.get(level, "📋")
    print(f"[{ts}] {indent_str}{emoji} {level}: {message}")

def log_section(title: str):
    """Affiche un séparateur de section."""
    print("\n" + "═" * 70)
    print(f"  {title}")
    print("═" * 70 + "\n")

# ═══════════════════════════════════════════════════════════════
# API WRAPPER
# ═══════════════════════════════════════════════════════════════
def api_request(method: str, endpoint: str, data: Optional[Dict] = None,
                params: Optional[Dict] = None, timeout: int = 120) -> Optional[Any]:
    """Wrapper robuste pour les requêtes API avec gestion des erreurs et retries."""
    url = f"{API_BASE}{endpoint}"
    for attempt in range(3):
        try:
            log("API", f"{method} {url}", 1)
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
                return True # No content
            else:
                log("ERROR", f"{method} {endpoint} a échoué - Code {resp.status_code}: {resp.text[:200]}", 2)
                return None

        except requests.exceptions.RequestException as e:
            log("ERROR", f"Exception API ({attempt + 1}/3): {e}", 2)
            time.sleep(5)
    return None

# ═══════════════════════════════════════════════════════════════
# PARSEUR ZOTERO CSL JSON (OPTIMISÉ)
# ═══════════════════════════════════════════════════════════════
def parse_zotero_csl_json(json_path: Path) -> List[Dict]:
    """
    Parse un export Zotero CSL JSON vers le format attendu par AnalyLit.
    - Gère les particules de noms (`non-dropping-particle`).
    - Extrait le PMID depuis les champs 'note' ou 'extra'.
    - Robuste aux données manquantes.
    """
    log("INFO", f"Chargement et parsing de '{json_path.name}'...")
    if not json_path.is_file():
        log("ERROR", f"Fichier Zotero JSON introuvable: {json_path}")
        return []

    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            zotero_items = json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        log("ERROR", f"Impossible de lire ou parser le fichier JSON: {e}")
        return []

    articles = []
    for i, item in enumerate(zotero_items):
        # --- Auteurs (robuste) ---
        authors_csl = item.get("author", [])
        authors = []
        for auth in authors_csl[:5]: # Limite à 5 auteurs pour la clarté
            family = auth.get("family", "")
            given = auth.get("given", "")
            particle = auth.get("non-dropping-particle", "")
            
            full_name = family
            if particle:
                full_name = f"{particle} {family}"
            if given:
                full_name += f", {given}"
            
            if full_name:
                authors.append(full_name.strip())

        # --- Année ---
        issued = item.get("issued", {}).get("date-parts", [[]])
        year = issued[0][0] if issued and issued[0] else datetime.now().year

        # --- PMID (depuis 'note' ou 'extra') ---
        pmid = ""
        note_content = item.get("note", "") + " " + item.get("extra", "")
        if "PMID:" in note_content:
            try:
                pmid = note_content.split("PMID:")[1].split()[0].strip()
            except IndexError:
                pass # Pas de PMID trouvé après le préfixe

        title = item.get("title", f"Titre inconnu {i+1}")

        article = {
            "title": title,
            "authors": authors if authors else ["Auteur inconnu"],
            "year": int(year),
            "abstract": item.get("abstract", "Aucun abstract disponible."),
            "journal": item.get("container-title", "Journal inconnu"),
            "doi": item.get("DOI", ""),
            "pmid": pmid,
            "type": item.get("type", "article-journal"),
            "language": item.get("language", "en"),
            "keywords": item.get("keywords", ["thèse", "ATN"]),
            "zotero_id": item.get("id", str(uuid.uuid4()))
        }
        articles.append(article)
        log("SUCCESS", f"Article parsé: {title[:60]}...", 1)

    log("SUCCESS", f"📚 {len(articles)} articles chargés depuis Zotero.")
    return articles

# ═══════════════════════════════════════════════════════════════
# CHARGEMENT GRILLE ATN
# ═══════════════════════════════════════════════════════════════
def load_grille_atn(json_path: Path) -> Dict:
    """Charge le fichier de configuration de la grille ATN."""
    log("INFO", f"Chargement de la grille d'extraction '{json_path.name}'...")
    if not json_path.is_file():
        log("ERROR", f"Fichier de grille ATN introuvable: {json_path}")
        return {}
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            grille = json.load(f)
        log("SUCCESS", f"Grille ATN chargée avec {len(grille.get('fields', []))} champs.")
        return grille
    except (json.JSONDecodeError, IOError) as e:
        log("ERROR", f"Impossible de charger ou parser la grille ATN: {e}")
        return {}

# ═══════════════════════════════════════════════════════════════
# CLASSE WORKFLOW PRINCIPAL
# ═══════════════════════════════════════════════════════════════
class ATNWorkflowZotero:
    def __init__(self):
        self.project_id: Optional[str] = None
        self.articles_data: List[Dict] = []
        self.grille_atn: Dict = {}
        self.results: Dict[str, Any] = {
            "timestamp_start": datetime.now().isoformat(),
            "project_id": None,
            "articles_count": 0,
            "steps": {},
            "final_metrics": {}
        }

    def run_step(self, step_name: str, step_func) -> bool:
        """Exécute une étape du workflow, mesure sa durée et gère les erreurs."""
        start_time = time.time()
        success = False
        try:
            success = step_func()
        except Exception as e:
            log("ERROR", f"Exception inattendue à l'étape '{step_name}': {e}")
            import traceback
            traceback.print_exc()
        
        duration = time.time() - start_time
        self.results["steps"][step_name] = {
            "success": success,
            "duration_seconds": round(duration, 2)
        }
        
        if not success:
            log("ERROR", f"Échec de l'étape '{step_name}'. Arrêt du workflow.")
        
        return success

    def check_api_health(self) -> bool:
        log_section("ÉTAPE 0/7: VÉRIFICATION DE L'API ANALYLIT")
        health = api_request("GET", "/api/health")
        if health and health.get("status") == "healthy":
            log("SUCCESS", "API AnalytLit est opérationnelle.")
            return True
        log("ERROR", "L'API AnalytLit n'est pas disponible. Veuillez démarrer le backend.")
        return False

    def load_data_sources(self) -> bool:
        log_section("ÉTAPE 1/7: CHARGEMENT DES DONNÉES SOURCES")
        self.articles_data = parse_zotero_csl_json(ZOTERO_JSON_PATH)
        self.grille_atn = load_grille_atn(GRILLE_ATN_PATH)
        
        if not self.articles_data:
            return False
            
        self.results["articles_count"] = len(self.articles_data)
        log("DATA", f"Total articles: {len(self.articles_data)}", 1)
        log("DATA", f"Total champs de grille: {len(self.grille_atn.get('fields', []))}", 1)
        return True

    def create_atn_project(self) -> bool:
        log_section("ÉTAPE 2/7: CRÉATION DU PROJET ATN")
        project_name = f"ATN Zotero - {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        data = {
            "name": project_name,
            "description": f"Projet de validation pour la thèse ATN avec {len(self.articles_data)} articles de Zotero."
        }
        result = api_request("POST", "/api/projects", data)
        
        if result and "id" in result:
            self.project_id = result["id"]
            self.results["project_id"] = self.project_id
            log("SUCCESS", f"Projet créé avec succès. ID: {self.project_id}")
            return True
        log("ERROR", "La création du projet a échoué.")
        return False

    def add_articles_to_project(self) -> bool:
        log_section("ÉTAPE 3/7: AJOUT DES ARTICLES AU PROJET")
        # ✅ CORRECTION: L'endpoint attend une clé "items" et une liste d'identifiants.
        # Nous envoyons les données complètes pour que le backend puisse les créer.
        data = {
            "items": self.articles_data 
        }
        endpoint = f"/api/projects/{self.project_id}/add-manual-articles"
        result = api_request("POST", endpoint, data, timeout=180)
        
        if result and result.get("task_id"):
            log("SUCCESS", f"Tâche d'ajout de {len(self.articles_data)} articles lancée (Job ID: {result['task_id']}).")
            return self.wait_for_task(result["task_id"], "ajout des articles")
        log("ERROR", "L'ajout des articles a échoué.")
        return False

    def run_atn_screening(self) -> bool:
        log_section("ÉTAPE 4/7: SCREENING ATN (SEUIL ≥ 70/100)")
        # ✅ CORRECTION: Endpoint et payload ajustés.
        article_ids = [article.get('zotero_id') for article in self.articles_data]
        data = {
            "articles": article_ids,
            "profile_id": "atn-fast-gpu",  # Au lieu de "atn-specialized"
            "analysis_mode": "screening",
            "auto_validate_threshold": 70
        }
        endpoint = f"/api/projects/{self.project_id}/run"
        result = api_request("POST", endpoint, data, timeout=300)
        
        if result and result.get("job_ids"):
            log("SUCCESS", f"Screening ATN lancé (Job IDs: {result['job_ids']}).")
            # For this test, we don't wait for each individual job, we just check if they were launched.
            return True
        log("WARNING", "Impossible de lancer le screening. Passage à l'extraction.")
        return True # Non bloquant

    def run_atn_extraction(self) -> bool:
        log_section("ÉTAPE 5/7: EXTRACTION AVEC GRILLE ATN")
        if not self.grille_atn.get("fields"):
            log("WARNING", "Aucune grille d'extraction définie. Étape ignorée.")
            return True

        data = {
            "type": "atn_specialized_extraction",
            "grid_fields": self.grille_atn["fields"],
        }
        endpoint = f"/api/projects/{self.project_id}/run-analysis"
        result = api_request("POST", endpoint, data, timeout=600)
        
        if result and result.get("job_id"):
            log("SUCCESS", f"Extraction sur grille ATN lancée (Job ID: {result['job_id']}).")
            return self.wait_for_task(result["job_id"], "extraction")
        log("ERROR", "Le lancement de l'extraction a échoué.")
        return False

    def run_synthesis_and_prisma(self) -> bool:
        log_section("ÉTAPE 6/7: SYNTHÈSE ET DIAGRAMME PRISMA")
        data = {
            "type": "synthesis",
            "include_prisma": True,
            "generate_graphs": True,
        }
        endpoint = f"/api/projects/{self.project_id}/run-analysis"
        result = api_request("POST", endpoint, data, timeout=300)
        
        if result and result.get("job_id"):
            log("SUCCESS", f"Synthèse et PRISMA lancés (Job ID: {result['job_id']}).")
            return self.wait_for_task(result["job_id"], "synthèse")
        log("ERROR", "Le lancement de la synthèse a échoué.")
        return False

    def export_thesis_results(self) -> bool:
        log_section("ÉTAPE 7/7: EXPORT DES RÉSULTATS POUR LA THÈSE")
        # ✅ CORRECTION: Utilisation de la méthode GET et du bon endpoint.
        endpoint = f"/api/projects/{self.project_id}/export/thesis"
        # Cette requête retourne un fichier, pas un JSON. Nous vérifions juste le succès.
        url = f"{API_BASE}{endpoint}"
        try:
            resp = requests.get(url, stream=True, timeout=180)
            if resp.status_code == 200:
                export_filename = f"export_these_{self.project_id}_{datetime.now().strftime('%Y%m%d')}.zip"
                export_path = OUTPUT_DIR / export_filename
                with open(export_path, 'wb') as f:
                    for chunk in resp.iter_content(chunk_size=8192):
                        f.write(chunk)
                log("SUCCESS", f"Export des résultats de la thèse sauvegardé dans: {export_path}")
                return True
            else:
                log("ERROR", f"L'export a échoué avec le code {resp.status_code}: {resp.text[:200]}")
                return False
        except requests.RequestException as e:
            log("ERROR", f"Erreur lors de la requête d'export: {e}")
            return False

    def wait_for_task(self, task_id: str, step_name: str, timeout_min: int = 20) -> bool:
        """Attend la fin d'une tâche en polluant l'API de statut."""
        log("PROGRESS", f"En attente de la fin de la tâche '{step_name}' (max {timeout_min} min)...")
        start_time = time.time()
        
        while time.time() - start_time < timeout_min * 60:
            endpoint = f"/api/tasks/{task_id}/status"
            status_data = api_request("GET", endpoint)
            
            if status_data:
                status = status_data.get("status", "unknown")
                progress = status_data.get("progress", {})
                log("PROGRESS", f"Statut de '{step_name}': {status} - {progress.get('message', '')}", 1)
                
                if status == "finished":
                    log("SUCCESS", f"Tâche '{step_name}' terminée avec succès.")
                    return True
                if status == "failed":
                    log("ERROR", f"La tâche '{step_name}' a échoué: {status_data.get('error', 'Erreur inconnue')}")
                    return False
            
            time.sleep(15)
            
        log("WARNING", f"Timeout dépassé en attente de la tâche '{step_name}'.")
        return False

    def get_final_metrics(self) -> Dict:
        """Récupère les métriques finales du projet."""
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
        """Sauvegarde le rapport final du workflow en JSON."""
        self.results["timestamp_end"] = datetime.now().isoformat()
        if self.project_id:
            self.results["final_metrics"] = self.get_final_metrics()
        
        filename = OUTPUT_DIR / f"resultats_atn_zotero_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(self.results, f, indent=2, ensure_ascii=False)
            log("SUCCESS", f"📊 Rapport de workflow sauvegardé: {filename}")
        except IOError as e:
            log("ERROR", f"Impossible de sauvegarder le rapport: {e}")

    def run_complete_workflow(self):
        """Orchestre l'exécution complète du workflow ATN."""
        log_section("🚀 DÉMARRAGE DU WORKFLOW ATN COMPLET AVEC ZOTERO 🚀")
        
        try:
            if not self.run_step("health_check", self.check_api_health): return
            if not self.run_step("load_data", self.load_data_sources): return
            if not self.run_step("create_project", self.create_atn_project): return
            if not self.run_step("add_articles", self.add_articles_to_project): return
            if not self.run_step("screening", self.run_atn_screening): pass # Non bloquant
            if not self.run_step("extraction", self.run_atn_extraction): return
            if not self.run_step("synthesis_prisma", self.run_synthesis_and_prisma): return
            if not self.run_step("export_thesis", self.export_thesis_results): pass # Non bloquant

            log_section("🎉 WORKFLOW TERMINÉ AVEC SUCCÈS 🎉")
            metrics = self.get_final_metrics()
            log("DATA", f"Articles traités: {metrics.get('articles_processed', 'N/A')} / {metrics.get('articles_total', 'N/A')}")
            log("DATA", f"Score ATN moyen: {metrics.get('mean_atn_score', 0):.1f}/100")
            log("SUCCESS", f"Consultez les résultats du projet ici: http://localhost:3000/projects/{self.project_id}")

        except Exception as e:
            log("ERROR", f"Une erreur critique a interrompu le workflow: {e}")
            import traceback
            traceback.print_exc()
        finally:
            self.save_report()
            log("INFO", "Fin du script.")

# ═══════════════════════════════════════════════════════════════
# POINT D'ENTRÉE
# ═══════════════════════════════════════════════════════════════
def main():
    try:
        workflow = ATNWorkflowZotero()
        workflow.run_complete_workflow()
    except KeyboardInterrupt:
        log("WARNING", "⚠️ Interruption manuelle du script (Ctrl+C).")
        sys.exit(130)

if __name__ == "__main__":
    main()
