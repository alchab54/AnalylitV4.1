# ==============================================================================
# 🏆 MOTEUR DE SCORING ATN V2.2 - VERSION FINALE ET GARANTIE
# ==============================================================================
# Date: 08 octobre 2025
# Correction: Intégrale, incluant la structure de la classe et l'indentation.
# Ce fichier est maintenant GARANTI sans erreur de syntaxe ou de référence.
# ==============================================================================

import re
import json
from datetime import datetime
from typing import Dict, List, Any

ATN_SCORING_AVAILABLE = True

class ATNScoringEngineV22:
    """Moteur de scoring ATN v2.2 - Optimisé recherches 2024."""

    def __init__(self):
        """Initialise les critères pondérés pour l'évaluation ATN."""
        self.criteria = {
            "alliance_therapeutique": {
                "weight": 20,
                "terms": [("therapeutic alliance", 6), ("working alliance", 6), ("digital therapeutic alliance", 8)],
            },
            "sante_numerique": {
                "weight": 18,
                "terms": [("digital health", 3), ("digital therapeutic", 4), ("prescribable app", 5), ("diga", 5)],
            },
            "empathie_ia_conversationnelle": {
                "weight": 15,
                "terms": [("artificial empathy", 8), ("ai empathy", 8), ("empathic ai", 8), ("conversational ai", 6)],
            },
            "approche_patient_centre": {
                "weight": 15,
                "terms": [("patient-centered", 4), ("patient engagement", 5), ("user experience", 4)],
            },
            "acceptation_technologique": {
                "weight": 12,
                "terms": [("technology acceptance", 4), ("user experience", 4), ("digital literacy", 4)],
            },
            "equite_accessibilite": {
                "weight": 10,
                "terms": [("health equity", 5), ("digital divide", 5), ("accessibility", 4), ("inclusive design", 4)],
            },
            "validation_clinique": {
                "weight": 10,
                "terms": [("clinical validation", 5), ("randomized controlled trial", 5), ("rct", 4), ("fda approved", 6)],
            }
        }

    def calculate_atn_score_v22(self, article: Dict) -> Dict[str, Any]:
        """Calcule score ATN v2.2 avec nouveaux critères 2024 et justification corrigée."""
        
        title = str(article.get("title", "")).lower()
        abstract = str(article.get("abstract", "")).lower()
        journal = str(article.get("journal", "")).lower()
        keywords = " ".join(str(k) for k in article.get("keywords", [])).lower()
        full_text = f"{title} {abstract} {journal} {keywords}"

        total_score = 0
        detailed_justifications = []
        criteria_found = 0

        for criterion_name, criterion_data in self.criteria.items():
            criterion_score = 0
            found_terms = []
            for term, points in criterion_data["terms"]:
                if term in full_text:
                    criterion_score += points
                    found_terms.append(f"{term} (+{points})")
            
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

        try:
            year = int(str(article.get("year", datetime.now().year))[:4])
        except (ValueError, TypeError):
            year = datetime.now().year
            
        recency_justification = f"Année: {year}"
        recency_score = 0
        if year >= 2022:
            recency_score = 10
            recency_justification = f"Recherche {year} (ère post-ChatGPT)"
        elif year >= 2020:
            recency_score = 7
            recency_justification = f"Recherche {year} (boom santé numérique)"

        longitudinal_bonus = 0
        if any(term in full_text for term in ["longitudinal", "follow-up", "long-term", "cohort study"]):
            longitudinal_bonus = 5
            recency_justification += " + Étude longitudinale"

        total_score += recency_score + longitudinal_bonus
        final_score = min(100, round((total_score / 110) * 100, 1))

        if final_score >= 75: category = {"name": "TRÈS PERTINENT ATN", "symbol": "[+++]", "color": "green"}
        elif final_score >= 60: category = {"name": "PERTINENT ATN", "symbol": "[++]", "color": "blue"}
        else: category = {"name": "PEU PERTINENT ATN", "symbol": "[-]", "color": "red"}

        if not detailed_justifications and total_score > 0:
            bonus_score = recency_score + longitudinal_bonus
            detailed_justifications.append({
                "criterion": "Analyse Contextuelle (Bonus)",
                "score": bonus_score, "max_score": 15,
                "terms_found": [recency_justification],
                "percentage": round((bonus_score / 15) * 100, 1)
            })

        return {
            "atn_score": final_score,
            "atn_category": category["name"],
            "atn_symbol": category["symbol"],
            "atn_color": category["color"],
            "criteria_found": criteria_found,
            "detailed_justifications": detailed_justifications,
            "scoring_timestamp": datetime.now().isoformat(),
            "algorithm_version": "ATN v2.2 Final Fix",
            "raw_score": total_score,
            "normalization_factor": 110
        }
