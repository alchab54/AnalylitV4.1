#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🚀 IMPORT ARTICLES ATN V4.2 - RDF CORRIGÉ
"""

import requests
import time
import json

print("🚀 IMPORT ARTICLES ATN AVEC RDF CORRIGÉ")
print("=" * 50)

API_BASE = "http://localhost:5000"
project_id = "9a89bdfd-1b18-46a4-a051-a930f440b62d"

try:
    # Import avec RDF corrigé
    data = {
        "rdf_file_path": "/app/output/Analylit_FIXED_ATN.rdf",
        "zotero_storage_path": "/app/zotero-storage"
    }
    
    print(f"📦 RDF: {data['rdf_file_path']}")
    print(f"📁 PDFs: {data['zotero_storage_path']}")
    
    result = requests.post(
        f"{API_BASE}/api/projects/{project_id}/import-zotero-rdf",
        json=data,
        timeout=300
    )
    
    print(f"🎯 Import: {result.status_code}")
    
    if result.status_code in [200, 202]:
        task_data = result.json()
        task_id = task_data.get("task_id", "inconnu")
        print(f"✅ Task ID: {task_id}")
        print("🔥 IMPORT ATN LANCÉ!")
        print("📊 Surveillance en cours...")
        
        # Surveillance 5 minutes
        for i in range(10):
            time.sleep(30)
            
            try:
                articles = requests.get(f"{API_BASE}/api/projects/{project_id}/articles", timeout=10).json()
                extractions = requests.get(f"{API_BASE}/api/projects/{project_id}/extractions", timeout=10).json()
                
                print(f"[{i+1:02d}/10] 📊 Articles: {len(articles)} | Extractions: {len(extractions)}")
                
                if len(articles) > 0:
                    print("🎉 ARTICLES IMPORTÉS AVEC SUCCÈS!")
                    print("🏆 WORKERS ATN EN ACTION!")
                    
                    # Affichage premiers articles
                    for j, art in enumerate(articles[:5]):
                        title = art.get('title', 'Sans titre')[:60]
                        score = art.get('relevance_score', 0)
                        print(f"  {j+1}. {title}... (Score: {score})")
                    break
                    
            except Exception as api_err:
                print(f"[{i+1:02d}/10] ⚠️ API: {str(api_err)[:30]}")
        
        print("🌐 Interface: http://localhost:8080/projects/" + project_id)
        print("📊 Dashboard: http://localhost:9181")
        
    else:
        print(f"❌ Erreur import: {result.text[:200]}")

except Exception as e:
    print(f"💥 Erreur: {e}")
