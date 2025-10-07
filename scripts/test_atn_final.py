#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ATN Zotero Final - 100% Compatible Windows RTX 2060 SUPER"""

import requests
import json
import sys
from datetime import datetime

# Configuration encodage Windows
import codecs
import locale

# Forcer l'encodage UTF-8 pour Windows
if sys.platform.startswith('win'):
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# Articles Zotero avec données complètes
ARTICLES_ZOTERO = [
    {
        "key": "NQNKTNHL",
        "title": "Clinicians Attitudes Toward Telepsychology in Addiction and Mental Health Services",
        "abstract": "telepsychology services therapeutic alliance clinicians attitudes virtual technologies video services telephone services addiction mental health",
        "tags": ["mental health", "therapeutic alliance", "clinician attitude", "telepsychology", "technology acceptance"],
        "year": 2022
    },
    {
        "key": "IQ7RGLVV", 
        "title": "Perceptions of Telemental Health Care Delivery During COVID-19",
        "abstract": "telemental health providers remote patient care telemedicine therapeutic alliance patient-centered communication multicultural counseling",
        "tags": ["mental health", "COVID-19", "telemedicine", "telemental health", "quality of care"],
        "year": 2022
    },
    {
        "key": "BAZAU2AM",
        "title": "Digital Components Blended Care Cognitive Behavioral Therapy Intervention Depression Anxiety",
        "abstract": "blended care therapy digital components cognitive behavioral therapy depression anxiety digital video lessons digital exercises therapy sessions",
        "tags": ["digital health", "blended care", "cognitive-behavioral therapy", "digital therapy", "depression", "anxiety"],
        "year": 2021
    },
    {
        "key": "QJTQKZYG",
        "title": "Communicating With Parents and Preschool Children Dental Professional Interactions",
        "abstract": "communication interactions dental professionals parents children triadic treatment alliance social talking containing worries task-focusing",
        "tags": ["communication", "Parent-Child Relations", "dental care", "treatment alliance", "professional interactions"],
        "year": 2021
    },
    {
        "key": "GPF6TB99",
        "title": "Dental care of patients exposed to sexual abuse Need for alliance between staff and patients",
        "abstract": "sexually abused individuals dental patients working alliance patient-centered approach treatment alliance formation power relationship",
        "tags": ["dental care", "patient-centered", "alliance", "therapeutic relationship", "healthcare alliance"],
        "year": 2021
    }
]

def calculate_optimized_atn_score(article):
    """Algorithme ATN optimisé et plus précis"""
    score = 0
    details = []
    
    # Convertir en minuscules pour analyse
    title = article.get("title", "").lower()
    abstract = article.get("abstract", "").lower()
    tags = " ".join(article.get("tags", [])).lower()
    text_all = f"{title} {abstract} {tags}".lower()
    
    # 1. Alliance thérapeutique (25 points)
    alliance_terms = [
        "therapeutic alliance", "treatment alliance", "working alliance", "alliance", 
        "therapeutic relationship", "patient-provider relationship", "healthcare alliance"
    ]
    alliance_score = 0
    for term in alliance_terms:
        if term in text_all:
            if "alliance" in term:
                alliance_score += 8
            else:
                alliance_score += 5
            details.append(f"Alliance: {term}")
    score += min(25, alliance_score)
    
    # 2. Santé numérique/Digital (20 points)
    digital_terms = [
        "digital health", "digital therapy", "digital therapeutic", "telemedicine", 
        "telehealth", "telemental", "telepsychology", "digital intervention",
        "digital component", "blended care", "hybrid care", "digital care"
    ]
    digital_score = 0
    for term in digital_terms:
        if term in text_all:
            digital_score += 4
            details.append(f"Digital: {term}")
    score += min(20, digital_score)
    
    # 3. Approche centrée patient (15 points)
    patient_terms = [
        "patient-centered", "patient centered", "patient-centred", 
        "patient experience", "patient satisfaction", "patient engagement",
        "patient care", "quality of care", "care delivery"
    ]
    patient_score = 0
    for term in patient_terms:
        if term in text_all:
            patient_score += 5
            details.append(f"Patient: {term}")
    score += min(15, patient_score)
    
    # 4. Technologies d'acceptation (15 points)
    tech_acceptance_terms = [
        "technology acceptance", "technology adoption", "attitudes toward", 
        "perceptions", "acceptance", "adoption", "user experience",
        "technology use", "digital adoption"
    ]
    tech_score = 0
    for term in tech_acceptance_terms:
        if term in text_all:
            tech_score += 4
            details.append(f"Tech: {term}")
    score += min(15, tech_score)
    
    # 5. Communication thérapeutique (15 points)
    communication_terms = [
        "communication", "interaction", "conversation", "therapeutic communication",
        "patient communication", "provider communication", "clinical communication"
    ]
    comm_score = 0
    for term in communication_terms:
        if term in text_all:
            comm_score += 3
            details.append(f"Comm: {term}")
    score += min(15, comm_score)
    
    # 6. Année récente (10 points)
    year = article.get("year", 2000)
    if year >= 2020:
        score += 10
        details.append("Année: 2020+")
    elif year >= 2015:
        score += 5
        details.append("Année: 2015+")
    
    # Normaliser sur 100
    final_score = min(100, score)
    
    # Catégories ATN (sans emojis pour Windows)
    if final_score >= 70:
        category = "TRÈS PERTINENT ATN"
        symbol = "[+++]"
    elif final_score >= 50:
        category = "PERTINENT ATN" 
        symbol = "[++]"
    elif final_score >= 30:
        category = "MODÉRÉMENT PERTINENT"
        symbol = "[+]"
    else:
        category = "PEU PERTINENT ATN"
        symbol = "[-]"
    
    return {
        "score": final_score,
        "category": category,
        "symbol": symbol,
        "details": details,
        "criteria_found": len(details)
    }

def main():
    """Traitement ATN optimisé"""
    print("ATN ZOTERO OPTIMISÉ - RTX 2060 SUPER")
    print("=" * 50)
    
    # Créer projet ATN
    project_data = {
        "name": f"ATN Zotero Final - {datetime.now().strftime('%H:%M')}",
        "description": "Algorithme ATN final optimisé - RTX 2060 SUPER",
        "analysis_profile": "atn-specialized"
    }
    
    try:
        response = requests.post("http://localhost:8080/api/projects", 
                               json=project_data, timeout=10)
        if response.status_code == 201:            
            project = response.json()            
            print(f"[OK] Projet créé: {project['id']}")
            
            articles_results = []
            total_score = 0
            
            print(f"\n--- TRAITEMENT {len(ARTICLES_ZOTERO)} ARTICLES ATN ---")
            
            # Traitement articles
            for i, article in enumerate(ARTICLES_ZOTERO, 1):
                relevance = calculate_optimized_atn_score(article)
                total_score += relevance['score']
                
                print(f"\n[{i}/{len(ARTICLES_ZOTERO)}] {article['key']}")
                print(f"    Titre: {article['title'][:50]}...")
                print(f"    {relevance['symbol']} Score ATN: {relevance['score']}/100")
                print(f"    Statut: {relevance['category']}")
                print(f"    Critères: {relevance['criteria_found']} détectés")
                print(f"    Détails: {', '.join(relevance['details'][:2])}")
                
                articles_results.append({
                    "article": article,
                    "relevance": relevance
                })
            
            # Résultats finaux
            pertinents = [a for a in articles_results if a['relevance']['score'] >= 50]
            tres_pertinents = [a for a in articles_results if a['relevance']['score'] >= 70]
            avg_score = total_score / len(ARTICLES_ZOTERO)
            
            print(f"\n--- RÉSULTATS ATN FINAL ---")
            print(f"Articles traités: {len(ARTICLES_ZOTERO)}")
            print(f"Très pertinents (70+): {len(tres_pertinents)}")
            print(f"Pertinents (50+): {len(pertinents)}")
            print(f"Score ATN moyen: {avg_score:.1f}/100")
            print(f"Taux de pertinence: {len(pertinents)/len(ARTICLES_ZOTERO)*100:.1f}%")
            
            # Top articles ATN
            print(f"\n--- TOP ARTICLES ATN ---")
            sorted_articles = sorted(articles_results, key=lambda x: x['relevance']['score'], reverse=True)
            for i, result in enumerate(sorted_articles[:3], 1):
                article = result['article']
                relevance = result['relevance']
                print(f"{i}. {article['key']} - {relevance['score']}/100 - {relevance['category']}")
            
            # Sauvegarde 
            results = {
                "project_id": project['id'],
                "timestamp": datetime.now().isoformat(),
                "articles_results": articles_results,
                "summary": {
                    "total_articles": len(ARTICLES_ZOTERO),
                    "pertinents": len(pertinents),
                    "tres_pertinents": len(tres_pertinents),
                    "average_score": avg_score,
                    "success_rate": len(pertinents)/len(ARTICLES_ZOTERO)*100
                }
            }
            
            filename = f"atn_results_final_{datetime.now().strftime('%H%M%S')}.json"
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(results, f, ensure_ascii=False, indent=2)
                
            print(f"\n[OK] Résultats sauvegardés: {filename}")
            print(f"[OK] Projet AnalyLit: {project['id']}")
            
            return True
        else:
            print(f"[ERROR] Erreur création projet: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"[ERROR] Erreur: {e}")
        return False

if __name__ == "__main__":
    success = main()
    if success:
        print(f"\n*** SUCCÈS TOTAL - ATN RTX 2060 SUPER ***")
    else:
        print(f"\n*** ÉCHEC - Vérifier configuration ***")
    sys.exit(0 if success else 1)
