# utils/prisma_scr.py - Checklist PRISMA-ScR pour scoping reviews

PRISMA_SCR_CHECKLIST = {
    "title": [
        {"id": "title_1", "item": "Identifier le rapport comme une scoping review dans le titre", "completed": False}
    ],
    "abstract": [
        {"id": "abs_1", "item": "Fournir un résumé structuré incluant : contexte, objectifs, critères d'éligibilité, sources, méthodes de sélection, extraction des données, résultats et conclusions", "completed": False}
    ],
    "introduction": [
        {"id": "intro_1", "item": "Décrire la justification de la revue dans le contexte de ce qui est déjà connu", "completed": False},
        {"id": "intro_2", "item": "Fournir une explication de pourquoi les objectifs de la revue nécessitent une approche scoping review", "completed": False}
    ],
    "objectives": [
        {"id": "obj_1", "item": "Fournir un énoncé explicite des questions et objectifs abordés avec référence aux éléments (participants, concept, contexte)", "completed": False}
    ],
    "methods": [
        {"id": "meth_1", "item": "Indiquer si un protocole de revue existe et où il peut être consulté", "completed": False},
        {"id": "meth_2", "item": "Décrire et justifier toute modification du protocole", "completed": False},
        {"id": "meth_3", "item": "Décrire les sources d'information utilisées", "completed": False},
        {"id": "meth_4", "item": "Présenter la stratégie de recherche complète pour au moins une base de données", "completed": False},
        {"id": "meth_5", "item": "Décrire le processus de sélection des études", "completed": False},
        {"id": "meth_6", "item": "Décrire la méthode d'extraction des données des rapports", "completed": False},
        {"id": "meth_7", "item": "Décrire toute hypothèse concernant les langues, la disponibilité des données", "completed": False}
    ],
    "results": [
        {"id": "res_1", "item": "Décrire les résultats du processus de recherche et de sélection", "completed": False},
        {"id": "res_2", "item": "Fournir les caractéristiques des sources de preuves incluses", "completed": False},
        {"id": "res_3", "item": "Présenter les résultats individuellement pour chaque objectif ou question", "completed": False}
    ],
    "discussion": [
        {"id": "disc_1", "item": "Résumer les preuves principales par rapport aux objectifs de la revue", "completed": False},
        {"id": "disc_2", "item": "Discuter des limitations au niveau de l'étude et de la revue", "completed": False},
        {"id": "disc_3", "item": "Fournir une interprétation générale des résultats dans le contexte d'autres preuves", "completed": False}
    ],
    "other": [
        {"id": "other_1", "item": "Décrire les sources de financement de la revue", "completed": False},
        {"id": "other_2", "item": "Décrire le rôle des bailleurs de fonds dans la revue", "completed": False}
    ]
}

def get_prisma_scr_completion_rate(checklist_data):
    """Calcule le taux de completion de la checklist PRISMA-ScR."""
    total_items = sum(len(section) for section in checklist_data.values())
    completed_items = sum(
        len([item for item in section if item.get('completed', False)])
        for section in checklist_data.values()
    )
    return (completed_items / total_items * 100) if total_items > 0 else 0
