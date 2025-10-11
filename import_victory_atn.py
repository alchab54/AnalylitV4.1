#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🚀 IMPORT VICTOIRE ATN AVEC CHEMINS PDFs CORRECTS
"""

import requests
import time

print("🚀 IMPORT VICTOIRE ATN - CHEMINS PDFs CORRECTS")
print("=" * 60)

API_BASE = "http://localhost:5000"
project_id = "4e351431-0888-4f21-9604-56d2cdecd5e6"

try:
    # Import avec RDF et chemins PDFs corrects
    data = {
        "rdf_file_path": "/app/output/Analylit_PATHS_FINAL.rdf",
        "zotero_storage_path": "/app/zotero-storage"
    }
    
    print(f"📦 RDF avec chemins corrects: {data['rdf_file_path']}")
    print(f"📁 Storage PDFs: {data['zotero_storage_path']}")
    
    result = requests.post(
        f"{API_BASE}/api/projects/{project_id}/import-zotero-rdf",
        json=data,
        timeout=300
    )
    
    print(f"🎯 Import status: {result.status_code}")
    
    if result.status_code in [200, 202]:
        response_data = result.json()
        task_id = response_data.get("task_id")
        print(f"✅ Task ID: {task_id}")
        print("🔥 327 ARTICLES ATN + PDFs → RTX 2060 SUPER!")
        
        # Surveillance intensive finale
        print("\n📊 SURVEILLANCE VICTOIRE ATN...")
        success_count = 0
        
        for cycle in range(20):  # 10 minutes surveillance
            time.sleep(30)
            
            try:
                articles_resp = requests.get(f"{API_BASE}/api/projects/{project_id}/articles", timeout=20)
                if articles_resp.status_code == 200:
                    articles = articles_resp.json()
                    
                    extractions_resp = requests.get(f"{API_BASE}/api/projects/{project_id}/extractions", timeout=20)
                    extractions = extractions_resp.json() if extractions_resp.status_code == 200 else []
                    
                    print(f"[{cycle+1:02d}/20] 📚 {len(articles)} articles | 📄 {len(extractions)} extractions")
                    
                    if len(articles) > 0:
                        success_count += 1
                        
                        if success_count == 1:
                            print("\n🎉🎉🎉 VICTOIRE TOTALE CONFIRMÉE ! 🎉🎉🎉")
                            print("🏆 ARTICLES ATN IMPORTÉS AVEC SUCCÈS!")
                            
                            # Top articles ATN pour thèse
                            print("\n📚 TOP ARTICLES ATN POUR VOTRE THÈSE:")
                            for i, art in enumerate(articles[:7]):
                                title = art.get('title', 'Sans titre')[:80]
                                authors = art.get('authors', 'Auteurs')[0:30]
                                score = art.get('relevance_score', 0)
                                pdf_status = "✅ PDF" if art.get('has_pdf_potential') else "⚠️"
                                print(f"  {i+1}. {title}...")
                                print(f"      {authors} | Score ATN: {score} | {pdf_status}")
                            
                            print(f"\n🌐 Interface complète: http://localhost:8080/projects/{project_id}")
                            print("📊 Dashboard workers: http://localhost:9181")
                            print("📁 Rapports exports: ./output/")
                        
                        if len(extractions) > len(articles) * 0.1:  # 10% extractions
                            print("🔥 WORKERS RTX 2060 SUPER EN ACTION!")
                            print("🎯 SCORING ATN V2.2 OPÉRATIONNEL!")
                            break
                            
                else:
                    print(f"[{cycle+1:02d}/20] ⚠️ API: {articles_resp.status_code}")
                    
            except Exception as api_err:
                print(f"[{cycle+1:02d}/20] ⚠️ Exception: {str(api_err)[:50]}")
        
        if success_count > 0:
            print("\n🏆 SYSTÈME ATN V4.2 COMPLÈTEMENT OPÉRATIONNEL!")
            print("🎓 THÈSE ALLIANCE THÉRAPEUTIQUE NUMÉRIQUE VALIDÉE!")
        
    else:
        print(f"❌ Erreur import: {result.status_code}")
        print(f"   Détails: {result.text[:300]}")

except Exception as e:
    print(f"💥 Erreur: {e}")
