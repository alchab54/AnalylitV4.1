def get_base_prisma_checklist():
    """
    Returns the base structure for the PRISMA-ScR checklist.
    Each item has an ID, text, and an optional status/notes field.
    """
    return {
        "title": "PRISMA-ScR Checklist",
        "sections": [
            {
                "id": "reporting",
                "title": "Reporting (Rapport)",
                "items": [
                    {"id": "reporting-1", "text": "Titre (Title)", "notes": "", "checked": False},
                    {"id": "reporting-2", "text": "Résumé (Abstract)", "notes": "", "checked": False},
                    {"id": "reporting-3", "text": "Introduction (Introduction)", "notes": "", "checked": False}
                ]
            },
            {
                "id": "methods",
                "title": "Methods (Méthodes)",
                "items": [
                    {"id": "methods-4", "text": "Critères d'éligibilité (Eligibility criteria)", "notes": "", "checked": False},
                    {"id": "methods-5", "text": "Sources d'information (Sources of information)", "notes": "", "checked": False},
                    {"id": "methods-6", "text": "Stratégie de recherche (Search strategy)", "notes": "", "checked": False},
                    {"id": "methods-7", "text": "Processus de sélection (Selection process)", "notes": "", "checked": False},
                    {"id": "methods-8", "text": "Processus d'extraction des données (Data extraction process)", "notes": "", "checked": False},
                    {"id": "methods-9", "text": "Éléments de données (Data items)", "notes": "", "checked": False},
                    {"id": "methods-10", "text": "Synthèse des résultats (Synthesis of results)", "notes": "", "checked": False}
                ]
            },
            {
                "id": "results",
                "title": "Results (Résultats)",
                "items": [
                    {"id": "results-11", "text": "Sélection des sources d'information (Selection of sources of evidence)", "notes": "", "checked": False},
                    {"id": "results-12", "text": "Caractéristiques des sources d'information (Characteristics of sources of evidence)", "notes": "", "checked": False},
                    {"id": "results-13", "text": "Résultats de la synthèse (Results of synthesis)", "notes": "", "checked": False}
                ]
            },
            {
                "id": "discussion",
                "title": "Discussion (Discussion)",
                "items": [
                    {"id": "discussion-14", "text": "Résumé des preuves (Summary of evidence)", "notes": "", "checked": False},
                    {"id": "discussion-15", "text": "Limites (Limitations)", "notes": "", "checked": False},
                    {"id": "discussion-16", "text": "Conclusion (Conclusion)", "notes": "", "checked": False}
                ]
            },
            {
                "id": "funding",
                "title": "Funding (Financement)",
                "items": [
                    {"id": "funding-17", "text": "Financement (Funding)", "notes": "", "checked": False}
                ]
            }
        ]
    }

def get_prisma_scr_completion_rate(checklist_data):
    """
    Calculates the completion rate of the PRISMA-ScR checklist.
    """
    total_items = 0
    checked_items = 0
    for section in checklist_data.get('sections', []):
        for item in section.get('items', []):
            total_items += 1
            if item.get('checked'):
                checked_items += 1
    if total_items == 0:
        return 0.0
    return (checked_items / total_items) * 100.0
