#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ATN Zotero Optimized - Algorithme de scoring ATN amélioré
"""

import requests
import json
import re
import sys
from datetime import datetime

# Articles Zotero avec données complètes
ARTICLES_ZOTERO = [
    {
        "key": "NQNKTNHL",
        "title": "Clinicians' Attitudes Toward Telepsychology in Addiction and Mental Health Services",
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
    
    # === CRITÈRES ATN PRIORITAIRES (90 points max) ===
    
    # 1. Alliance thérapeutique (25 points)
    alliance_terms = [
        "therapeutic alliance", "alliance thérapeutique", "treatment alliance", 
        "working alliance", "alliance", "therapeutic relationship",
        "patient-provider relationship", "clinician-patient", "healthcare alliance"
    ]
    alliance_score = 0
    for term in alliance_terms:
        if term in text_all:
            if "alliance" in term:
                alliance_score += 8  # Bonus pour "alliance"
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
    
    # === CRITÈRES COMPLÉMENTAIRES (10 points max) ===
    
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
    
    # Catégories ATN
    if final_score >= 70:
        category = "TRÈS PERTINENT ATN"
        emoji = "🎯"
    elif final_score >= 50:
        category = "PERTINENT ATN" 
        emoji = "✅"
    elif final_score >= 30:
        category = "MODÉRÉMENT PERTINENT"
        emoji = "⚠️"
    else:
        category = "PEU PERTINENT ATN"
        emoji = "❌"
    
    # Check if stdout supports UTF-8 encoding, if not, use text based alternatives
    if sys.stdout.encoding != 'utf-8':
        emoji = ""
        category = category.replace("ATN", "")

    return {
        "score": final_score,
        "category": category,
        "emoji": emoji,
        "details": details,
        "criteria_found": len(details)
    }

def main():
    """Traitement ATN optimisé"""
    emoji_support = sys.stdout.encoding == 'utf-8'
    print(f"{'🎯 ' if emoji_support else ''}ATN ZOTERO OPTIMISÉ - RTX 2060 SUPER")
    print("=" * 50)
    
    # Créer projet ATN
    project_data = {
        "name": f"ATN Zotero Optimisé - {datetime.now().strftime('%H:%M')}",
        "description": "Algorithme ATN optimisé pour détection pertinence",
        "analysis_profile": "atn-specialized"
    }
    
    try:
        response = requests.post("http://localhost:8080/api/projects", 
                               json=project_data, timeout=10)
        if response.status_code == 201:            
            project = response.json()            
            print(f"✅ Projet créé: {project['id']}")
            
            articles_results = []
            total_score = 0
            
            # Traitement articles
            for article in ARTICLES_ZOTERO:
                relevance = calculate_optimized_atn_score(article)
                total_score += relevance['score']
                
                print(f"\n📄 {article['key']}: {article['title'][:60]}...")
                print(f"   {relevance['emoji'] if emoji_support else ''} Score ATN: {relevance['score']}/100 - {relevance['category']}")
                print(f"   Critères détectés: {relevance['criteria_found']} - {relevance['details'][:3]}")
                
                articles_results.append({
                    "article": article,
                    "relevance": relevance
                })
            
            # Résultats finaux
            pertinents = [a for a in articles_results if a['relevance']['score'] >= 50]
            avg_score = total_score / len(ARTICLES_ZOTERO)
            
            print(f"\n🏆 RÉSULTATS ATN OPTIMISÉS:")
            print(f"Articles très pertinents (70+): {len([a for a in articles_results if a['relevance']['score'] >= 70])}")
            print(f"Articles pertinents (50+): {len(pertinents)}/{len(ARTICLES_ZOTERO)}")
            print(f"Score ATN moyen: {avg_score:.1f}/100")
            
            # Sauvegarde 
            results = {
                "project_id": project['id'],
                "timestamp": datetime.now().isoformat(),
                "articles_results": articles_results,
                "summary": {
                    "total_articles": len(ARTICLES_ZOTERO),
                    "pertinents": len(pertinents),
                    "average_score": avg_score
                }
            }
            
            filename = f"atn_results_optimized_{datetime.now().strftime('%H%M%S')}.json"
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(results, f, ensure_ascii=False, indent=2)
                
            print(f"💾 Résultats sauvegardés: {filename}")
            
            return True
        else:
            print(f"❌ Erreur projet: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"{'❌ ' if emoji_support else ''}Erreur: {e}")
        return False

if __name__ == "__main__":
    main()
