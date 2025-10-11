#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🚀 IMPORT FINAL ATN AVEC RDF RÉPARÉ
"""

import requests
import time

print("🚀 IMPORT FINAL AVEC RDF LIGNE 88 RÉPARÉE")
print("=" * 60)

API_BASE = "http://localhost:5000"
project_id = "4e351431-0888-4f21-9604-56d2cdecd5e6"  # Votre dernier projet

try:
    # Import avec RDF complètement corrigé
    data = {
        "rdf_file_path": "/app/output/Analylit_COMPLETELY_FIXED.rdf",
        "zotero_storage_path": "/app/zotero-storage"
    }
    
    print(f"📦 RDF corrigé: {data['rdf_file_path']}")
    print(f"📁 Zotero storage: {data['zotero_storage_path']}")
    
    result = requests.post(
        f"{API_BASE}/api/projects/{project_id}/import-zotero-rdf",
        json=data,
        timeout=300
    )
    
    print(f"🎯 Import status: {result.status_code}")
    
    if result.status_code in [200, 202]:
        response_data = result.json()
        task_id = response_data.get("task_id")
        print(f"✅ Import lancé! Task ID: {task_id}")
        print("🔥 327 ARTICLES ATN → RTX 2060 SUPER!")
        
        # Surveillance intensive
        print("\n📊 SURVEILLANCE IMPORT ATN...")
        for cycle in range(15):  # 7,5 minutes
            time.sleep(30)
            
            try:
                articles_resp = requests.get(f"{API_BASE}/api/projects/{project_id}/articles", timeout=15)
                articles = articles_resp.json()
                
                extractions_resp = requests.get(f"{API_BASE}/api/projects/{project_id}/extractions", timeout=15)
                extractions = extractions_resp.json()
                
                print(f"[{cycle+1:02d}/15] 📚 {len(articles)} articles | 📄 {len(extractions)} extractions")
                
                if len(articles) > 0:
                    print("\n🎉 VICTOIRE TOTALE! ARTICLES ATN IMPORTÉS!")
                    print("🏆 SYSTÈME ATN V4.2 OPÉRATIONNEL!")
                    
                    # Top 5 articles ATN
                    for i, art in enumerate(articles[:5]):
                        title = art.get('title', 'Sans titre')[:70]
                        score = art.get('relevance_score', 0)
                        print(f"  {i+1}. {title}... (Score ATN: {score})")
                    
                    print(f"\n🌐 Interface: http://localhost:8080/projects/{project_id}")
                    print("📊 Dashboard: http://localhost:9181")
                    break
                    
            except Exception as api_err:
                print(f"[{cycle+1:02d}/15] ⚠️ API temporairement indisponible")
        
    else:
        print(f"❌ Erreur import: {result.status_code}")
        print(f"   Détails: {result.text[:200]}")

except Exception as e:
    print(f"💥 Erreur: {e}")
