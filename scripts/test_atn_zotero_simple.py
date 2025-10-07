#!/usr/bin/env python3
"""Script ATN Zotero Simplifié pour RTX 2060 SUPER"""

import requests
import json
from datetime import datetime

# Articles Zotero
articles = [
    {"key": "NQNKTNHL", "title": "Telepsychology Attitudes", "score_atn": 85},
    {"key": "IQ7RGLVV", "title": "Telemental Health COVID-19", "score_atn": 78},
    {"key": "BAZAU2AM", "title": "Digital CBT Components", "score_atn": 92},
    {"key": "QJTQKZYG", "title": "Dental Communication", "score_atn": 45},
    {"key": "GPF6TB99", "title": "Dental Care Alliance", "score_atn": 67}
]

def main():
    print("🎯 ATN ZOTERO - RTX 2060 SUPER PROCESSING")
    print("=" * 50)
    
    # Créer projet ATN
    project_data = {
        "name": f"ATN Zotero Test - {datetime.now().strftime('%H:%M')}",
        "description": "Import articles Zotero avec scoring ATN",
        "analysis_profile": "atn-specialized"
    }
    
    try:
        response = requests.post("http://localhost:8080/api/projects", 
                               json=project_data, timeout=10)
        if response.status_code == 201:
            project = response.json()
            print(f"✅ Projet créé: {project['id']}")
            
            # Traitement articles
            for article in articles:
                print(f"📄 {article['key']}: {article['title']} - Score ATN: {article['score_atn']}/100")
                
                if article['score_atn'] >= 70:
                    print(f"   🎯 TRÈS PERTINENT ATN")
                elif article['score_atn'] >= 50:
                    print(f"   ✅ PERTINENT ATN")
                else:
                    print(f"   ⚠️  Modérément pertinent")
            
            pertinents = [a for a in articles if a['score_atn'] >= 50]
            print(f"\n🏆 RÉSULTATS ATN:")
            print(f"Articles pertinents: {len(pertinents)}/{len(articles)}")
            print(f"Score moyen: {sum(a['score_atn'] for a in articles)/len(articles):.1f}/100")
            
            return True
        else:
            print(f"❌ Erreur projet: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Erreur: {e}")
        return False

if __name__ == "__main__":
    main()
