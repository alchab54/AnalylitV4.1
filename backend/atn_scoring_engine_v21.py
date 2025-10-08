#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🧠 ALGORITHME SCORING ATN V2.2 - OPTIMISÉ RECHERCHES 2024
═══════════════════════════════════════════════════════════

✅ Intégration recherches JMIR/MDPI 2024 sur Digital Therapeutic Alliance
✅ 8 critères pondérés (vs 5 précédemment) 
✅ Empathie IA & conversationnelle (critère thèse principal)
✅ Équité & accessibilité (enjeu 2024 majeur)
✅ Validation clinique (applications prescriptibles)
✅ Distribution scores plus discriminante
"""

import re
import json
import statistics
from datetime import datetime  
from typing import Dict, List, Tuple, Any

class ATNScoringEngineV22:
    """Moteur de scoring ATN v2.2 - Optimisé recherches 2024."""

    def __init__(self):
        # CRITÈRES ATN V2.2 - OPTIMISÉS RECHERCHES 2024
        self.criteria = {
            "alliance_therapeutique": {
                "weight": 20,  # Réduit pour équilibrer nouveaux critères
                "terms": [
                    ("therapeutic alliance", 6),
                    ("working alliance", 6), 
                    ("treatment alliance", 6),
                    ("digital therapeutic alliance", 8),  # NOUVEAU 2024
                    ("alliance", 4),
                    ("therapeutic relationship", 4),
                    ("patient-provider relationship", 4)
                ]
            },

            "sante_numerique": {
                "weight": 18,
                "terms": [
                    ("digital health", 3),
                    ("digital therapy", 3),
                    ("digital therapeutic", 4),  # Augmenté (prescriptible)
                    ("telemedicine", 3),
                    ("telehealth", 3),
                    ("telemental", 4),
                    ("telepsychology", 4),
                    ("digital intervention", 3),
                    ("prescribable app", 5),  # NOUVEAU 2024
                    ("diga", 5),  # Applications prescriptibles allemandes
                    ("blended care", 3),
                    ("hybrid care", 3)
                ]
            },

            # NOUVEAU CRITÈRE - EMPATHIE IA & CONVERSATIONNELLE
            "empathie_ia_conversationnelle": {
                "weight": 15,  # CRITÈRE PRINCIPAL THÈSE
                "terms": [
                    ("artificial empathy", 8),
                    ("ai empathy", 8),
                    ("empathic ai", 8),
                    ("conversational ai", 6),
                    ("chatbot", 5),
                    ("virtual assistant", 5),
                    ("artificial intelligence therapy", 6),
                    ("ai-powered therapy", 6),
                    ("natural language processing", 4),
                    ("machine learning therapy", 4),
                    ("deep learning mental health", 5)
                ]
            },

            "approche_patient_centre": {
                "weight": 15,
                "terms": [
                    ("patient-centered", 4),
                    ("patient-centred", 4),
                    ("patient experience", 4),
                    ("patient satisfaction", 4),
                    ("patient engagement", 5),  # Augmenté
                    ("patient care", 4),
                    ("quality of care", 4),
                    ("care delivery", 4),
                    ("user experience", 4),  # NOUVEAU
                    ("patient empowerment", 5)  # NOUVEAU
                ]
            },

            "acceptation_technologique": {
                "weight": 12,
                "terms": [
                    ("technology acceptance", 4),
                    ("technology adoption", 4),
                    ("attitudes toward", 3),
                    ("perceptions", 3),
                    ("acceptance", 3),
                    ("adoption", 3),
                    ("user experience", 4),  # Augmenté
                    ("technology use", 3),
                    ("digital literacy", 4)  # NOUVEAU
                ]
            },

            # NOUVEAU CRITÈRE - ÉQUITÉ & ACCESSIBILITÉ  
            "equite_accessibilite": {
                "weight": 10,  # Enjeu majeur 2024
                "terms": [
                    ("health equity", 5),
                    ("digital divide", 5),
                    ("accessibility", 4),
                    ("inclusive design", 4),
                    ("underrepresented", 4),
                    ("minority", 4),
                    ("disparities", 4),
                    ("vulnerable populations", 5),
                    ("cultural adaptation", 4),
                    ("multilingual", 3)
                ]
            },

            # NOUVEAU CRITÈRE - VALIDATION CLINIQUE
            "validation_clinique": {
                "weight": 10,  # Applications prescriptibles 2024
                "terms": [
                    ("clinical validation", 5),
                    ("randomized controlled trial", 5),
                    ("rct", 4),
                    ("clinical trial", 4),
                    ("evidence-based", 4),
                    ("clinical effectiveness", 5),
                    ("clinical outcomes", 4),
                    ("peer-reviewed", 3),
                    ("fda approved", 6),  # FDA/CE marquage
                    ("ce marking", 6)
                ]
            }
        }

    def calculate_atn_score_v22(self, article: Dict) -> Dict[str, Any]:
        """Calcule score ATN v2.2 avec nouveaux critères 2024."""

        # Préparation texte complet
        title = str(article.get("title", "")).lower()
        abstract = str(article.get("abstract", "")).lower()
        journal = str(article.get("journal", "")).lower()
        keywords = " ".join(str(k) for k in article.get("keywords", [])).lower()

        full_text = f"{title} {abstract} {journal} {keywords}"

        total_score = 0
        detailed_justifications = []
        criteria_found = 0

        # Évaluation des 7 critères principaux
        for criterion_name, criterion_data in self.criteria.items():
            criterion_score = 0
            found_terms = []

            for term, points in criterion_data["terms"]:
                if term in full_text:
                    criterion_score += points
                    found_terms.append(f"{term} (+{points})")

            # Plafonnement au poids maximum
            criterion_score = min(criterion_score, criterion_data["weight"])

            if criterion_score > 0:
                criteria_found += 1
                detailed_justifications.append({
                    "criterion": criterion_name.replace("_", " ").title(),
                    "score": criterion_score,
                    "max_score": criterion_data["weight"],
                    "terms_found": found_terms,
                    "percentage": round((criterion_score / criterion_data["weight"]) * 100, 1)
                })

            total_score += criterion_score

        # Bonus actualité (0-10 points)
        year = int(article.get("year", datetime.now().year))

        if year >= 2022:
            recency_score = 10  # Post-ChatGPT ère IA conversationnelle
            recency_justification = f"Recherche IA conversationnelle {year} (ère post-ChatGPT)"
        elif year >= 2020:
            recency_score = 7   # Post-pandémie santé numérique
            recency_justification = f"Recherche post-pandémie {year} (boom santé numérique)"
        elif year >= 2015:
            recency_score = 4   # Émergence santé numérique
            recency_justification = f"Recherche émergente {year} (début santé numérique)"
        else:
            recency_score = 0
            recency_justification = f"Recherche ancienne {year} (pré-révolution numérique)"

        # Bonus études longitudinales (NOUVEAU)
        longitudinal_bonus = 0
        longitudinal_terms = ["longitudinal", "follow-up", "long-term", "cohort study"]
        for term in longitudinal_terms:
            if term in full_text:
                longitudinal_bonus = 5
                recency_justification += f" + Étude longitudinale (+5)"
                break

        total_score += recency_score + longitudinal_bonus

        # Normalisation à 100 (total possible = 110)
        final_score = min(100, round((total_score / 110) * 100, 1))

        # Catégorisation améliorée
        if final_score >= 75:
            category = {"name": "TRÈS PERTINENT ATN", "symbol": "[+++]", "color": "green"}
        elif final_score >= 60:
            category = {"name": "PERTINENT ATN", "symbol": "[++]", "color": "blue"}
        elif final_score >= 40:
            category = {"name": "MODÉRÉMENT PERTINENT", "symbol": "[+]", "color": "orange"}
        elif final_score >= 25:
            category = {"name": "FAIBLEMENT PERTINENT", "symbol": "[~]", "color": "yellow"}
        else:
            category = {"name": "PEU PERTINENT ATN", "symbol": "[-]", "color": "red"}

        return {
            "atn_score": final_score,
            "atn_category": category["name"],
            "atn_symbol": category["symbol"],
            "atn_color": category["color"],
            "criteria_found": criteria_found,
            "detailed_justifications": detailed_justifications,
            "scoring_timestamp": datetime.now().isoformat(),
            "algorithm_version": "ATN v2.2 Research 2024 Optimized",
            "total_possible_score": 100,
            "raw_score": total_score,
            "normalization_factor": 110
        }

# Test amélioré
if __name__ == "__main__":
    test_articles = [
        {
            "title": "Artificial empathy in conversational AI for digital therapeutic alliance",
            "abstract": "This randomized controlled trial examines artificial empathy in chatbot interventions for underrepresented populations, focusing on patient-centered digital health equity and clinical validation.",
            "journal": "Journal of Medical Internet Research", 
            "year": 2024,
            "keywords": ["ai empathy", "digital health", "health equity", "rct"]
        },
        {
            "title": "Traditional psychotherapy effectiveness study",
            "abstract": "A clinical study examining face-to-face therapy outcomes in controlled settings with standard therapeutic approaches.",
            "journal": "Journal of Clinical Psychology",
            "year": 2018,
            "keywords": ["psychotherapy", "clinical outcomes"]  
        }
    ]

    engine = ATNScoringEngineV22()

    print("🧠 TEST ALGORITHME ATN V2.2 - OPTIMISÉ 2024")
    print("=" * 50)

    for i, article in enumerate(test_articles, 1):
        results = engine.calculate_atn_score_v22(article)

        print(f"\nARTICLE {i}:")
        print(f"Score: {results['atn_score']}/100 (brut: {results['raw_score']}/110)")
        print(f"Catégorie: {results['atn_category']}")
        print(f"Critères trouvés: {results['criteria_found']}")

        if results['detailed_justifications']:
            print("\nJustifications:")
            for justif in results['detailed_justifications']:
                print(f"  • {justif['criterion']}: {justif['score']}/{justif['max_score']} ({justif['percentage']:.1f}%)")
