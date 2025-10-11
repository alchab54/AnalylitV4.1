#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WORKFLOW ATN GLORY V4.2 - COMPLET AVEC IMPORT
Script pour lancer le workflow complet sur 328 articles
"""

import sys
import requests
import json
import time
from datetime import datetime
from pathlib import Path

# CONFIGURATION
API_BASE = "http://localhost:5000"
WEB_BASE = "http://localhost:8080"
OUTPUT_DIR = Path("/app/output")

def log(level: str, message: str):
    ts = datetime.now().strftime("%H:%M:%S")
    emoji_map = {"INFO": "ℹ️", "SUCCESS": "✅", "ERROR": "❌", "PROGRESS": "⏳", "FINAL": "🏆"}
    emoji = emoji_map.get(level, "📋")
    print(f"[{ts}] {emoji} {level}: {message}")

def api_request(method: str, endpoint: str, data=None, timeout=30):
    url = f"{API_BASE}{endpoint}"
    try:
        if method == "GET":
            resp = requests.get(url, timeout=timeout)
        elif method == "POST":
            resp = requests.post(url, json=data, timeout=timeout)
        
        if resp.status_code in [200, 201, 202]:
            return resp.json()
        else:
            log("ERROR", f"API {resp.status_code}: {endpoint}")
            return None
    except Exception as e:
        log("ERROR", f"API Error: {e}")
        return None

def main():
    print("═" * 80)
    print("  🏆 WORKFLOW ATN COMPLET V4.2 - 328 ARTICLES")
    print("═" * 80)
    
    start_time = datetime.now()
    
    # 1. Vérification API
    log("INFO", "Vérification API...")
    health = api_request("GET", "/api/health")
    if not health:
        log("ERROR", "API non accessible")
        return
    
    # 2. Création projet
    log("INFO", "Création projet ATN pour 328 articles...")
    data = {
        "name": f"🏆 ATN Workflow Complet V4.2 - 328 Articles",
        "description": f"""👑 WORKFLOW COMPLET ANALYLIT V4.2
        
🎯 Traitement: 328 articles Alliance Thérapeutique Numérique
⚡ GPU: RTX 2060 SUPER optimisée (8.0 GB VRAM)
🔧 Workers: 15 workers RQ spécialisés ATN
🧠 Algorithme: ATN v2.2 chargé 20+ fois
📊 Pipeline: Import → Screening → Extraction → Analysis → Synthesis
🕐 Démarrage: {start_time.strftime('%d/%m/%Y %H:%M')}""",
        "mode": "extraction"
    }
    
    result = api_request("POST", "/api/projects", data)
    if not result or "id" not in result:
        log("ERROR", "Échec création projet")
        return
    
    project_id = result["id"]
    log("SUCCESS", f"Projet créé: {project_id}")
    log("INFO", f"Interface: {WEB_BASE}/projects/{project_id}")
    
    # 3. Vérification fichier RDF
    rdf_path = Path("/app/source/Analylit.rdf")
    if not rdf_path.exists():
        log("ERROR", f"Fichier RDF introuvable: {rdf_path}")
        return
    
    log("SUCCESS", f"Fichier RDF prêt: {rdf_path}")
    
    # 4. LANCEMENT IMPORT RDF (Déclenche le workflow)
    log("INFO", "🚀 LANCEMENT IMPORT RDF - 328 ARTICLES...")
    import_data = {
        "rdf_file_path": str(rdf_path),
        "zotero_storage_path": "/app/zotero-storage"
    }
    
    import_result = api_request("POST", f"/api/projects/{project_id}/import-zotero-rdf", 
                               import_data, timeout=120)
    
    if import_result and import_result.get("task_id"):
        task_id = import_result["task_id"]
        log("SUCCESS", f"✅ Import RDF lancé! Task ID: {task_id}")
        log("INFO", "🔥 Workers vont maintenant traiter vos 328 articles ATN!")
        
        # 5. Monitoring actif
        log("INFO", "👀 Monitoring du workflow ATN en cours...")
        for i in range(20):  # 20 cycles de monitoring
            time.sleep(15)  # Attente 15s entre chaque vérification
            
            # Vérifier les extractions
            extractions = api_request("GET", f"/api/projects/{project_id}/extractions")
            ext_count = len(extractions) if extractions else 0
            
            # Vérifier les analyses
            analyses = api_request("GET", f"/api/projects/{project_id}/analyses")
            ana_count = len(analyses) if analyses else 0
            
            log("PROGRESS", f"📊 Cycle {i+1}: {ext_count} extractions, {ana_count} analyses")
            
            # Condition d'arrêt si beaucoup de progrès
            if ext_count > 50:  # Si plus de 50 extractions
                log("SUCCESS", f"🎉 Bon progrès! {ext_count} extractions terminées")
                break
                
        # 6. Rapport final
        elapsed = (datetime.now() - start_time).total_seconds() / 60
        final_extractions = api_request("GET", f"/api/projects/{project_id}/extractions")
        final_analyses = api_request("GET", f"/api/projects/{project_id}/analyses")
        
        rapport = {
            "timestamp": datetime.now().isoformat(),
            "project_id": project_id,
            "duration_minutes": round(elapsed, 1),
            "articles_imported": 328,
            "extractions_completed": len(final_extractions) if final_extractions else 0,
            "analyses_completed": len(final_analyses) if final_analyses else 0,
            "system": "AnalyLit V4.2 ATN",
            "gpu": "RTX 2060 SUPER",
            "status": "WORKFLOW_LAUNCHED"
        }
        
        # Sauvegarde
        filename = OUTPUT_DIR / f"workflow_complet_atn_{datetime.now().strftime('%Y%m%d_%H%M')}.json"
        with open(filename, 'w') as f:
            json.dump(rapport, f, indent=2)
        
        log("FINAL", f"🏆 Workflow ATN lancé avec succès!")
        log("FINAL", f"📊 {rapport['extractions_completed']} extractions en {elapsed:.1f} min")
        log("FINAL", f"🌐 Suivez le progrès: {WEB_BASE}/projects/{project_id}")
        log("FINAL", f"📊 Dashboard: http://localhost:9181")
        
    else:
        log("ERROR", "Échec lancement import RDF")

if __name__ == "__main__":
    main()
