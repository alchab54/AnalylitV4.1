#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
📊 MONITEUR ATN V4.2 - Surveillance Continue
"""

import requests
import time
import json
from datetime import datetime

print("📊 SURVEILLANCE SYSTÈME ATN V4.2")
print("=" * 50)

API_BASE = "http://localhost:5000"
project_id = "9a89bdfd-1b18-46a4-a051-a930f440b62d"

try:
    print(f"🎯 Projet ATN: {project_id}")
    print(f"🌐 Interface: http://localhost:8080/projects/{project_id}")
    print(f"📊 Dashboard: http://localhost:9181")
    print()
    
    start_time = datetime.now()
    
    for cycle in range(40):  # 20 minutes surveillance
        try:
            ts = datetime.now().strftime("%H:%M:%S")
            
            # Status API
            articles = requests.get(f"{API_BASE}/api/projects/{project_id}/articles", timeout=15).json()
            extractions = requests.get(f"{API_BASE}/api/projects/{project_id}/extractions", timeout=15).json()
            analyses = requests.get(f"{API_BASE}/api/projects/{project_id}/analyses", timeout=15).json()
            
            # Calculs
            total_articles = len(articles)
            total_extractions = len(extractions) 
            total_analyses = len(analyses)
            
            # Scoring
            scores = [e.get("relevance_score", 0) for e in extractions if isinstance(e, dict)]
            avg_score = sum(scores) / len(scores) if scores else 0
            validated = len([s for s in scores if s >= 8])
            
            # Affichage
            print(f"[{ts}] Cycle {cycle+1:02d}/40")
            print(f"  📚 Articles: {total_articles}")
            print(f"  📄 Extractions: {total_extractions}")
            print(f"  📊 Analyses: {total_analyses}")
            
            if scores:
                print(f"  🎯 Score moyen ATN: {avg_score:.2f}")
                print(f"  ✅ Validés (≥8): {validated}/{len(scores)}")
            
            # Progression
            if total_articles > 0:
                extract_rate = (total_extractions / total_articles) * 100
                print(f"  📈 Progression: {extract_rate:.1f}%")
                
                if extract_rate >= 70:
                    print("🏆 OBJECTIF ATTEINT - 70%+ EXTRACTIONS!")
                    break
                elif extract_rate >= 30 and cycle > 10:
                    print("✅ SYSTÈME FONCTIONNEL - Arrêt surveillance")
                    break
            
            print()
            
            # Articles récents
            if cycle % 5 == 0 and articles:
                print("📋 Derniers articles ATN:")
                for i, art in enumerate(articles[-3:]):
                    title = art.get('title', 'Sans titre')[:50]
                    authors = art.get('authors', 'Auteur inconnu')[:30]
                    print(f"  • {title}... ({authors})")
                print()
                
        except Exception as api_err:
            print(f"[{ts}] ⚠️ Erreur API: {str(api_err)[:40]}")
        
        time.sleep(30)  # 30 secondes entre cycles
    
    # Rapport final
    elapsed = (datetime.now() - start_time).total_seconds() / 60
    print("🏁 SURVEILLANCE TERMINÉE")
    print(f"⏱️ Durée: {elapsed:.1f} minutes")
    print(f"🎯 Résultats finals: {total_articles} articles, {total_extractions} extractions")

except Exception as e:
    print(f"💥 Erreur: {e}")
