# utils/prompt_templates.py

def get_screening_prompt_template() -> str:
    # Modèle de screening: JSON de sortie avec accolades échappées
    return (
        "En tant qu'assistant de recherche spécialisé, analysez cet article et déterminez sa pertinence.\n\n"
        "Titre: {title}\n\n"
        "Résumé: {abstract}\n\n"
        "Source: {database_source}\n\n"
        "Répondez UNIQUEMENT en JSON:\n"
        "{{\"relevance_score\": 0-10, \"decision\": \"À inclure\"|\"À exclure\", \"justification\": \"...\"}}\n"
    )

def get_full_extraction_prompt_template(fields: list) -> str:
    # Construit un JSON cible avec toutes les clés demandées, accolades échappées
    # 'fields' attendu: liste de dicts [{"name": "...", "description": "..."}]
    # On utilise uniquement les noms pour générer le squelette
    keys = [f.get("name", "").strip() for f in fields if isinstance(f, dict) and f.get("name")]
    # Par défaut si vide
    if not keys:
        keys = ["type_etude", "population", "intervention", "resultats_principaux", "limites", "methodologie"]

    json_lines = []
    for i, k in enumerate(keys):
        comma = "," if i < len(keys) - 1 else ""
        # chaque ligne du JSON échappe les accolades via doublement
        json_lines.append(f"\"{k}\": \"...\"{comma}")

    json_block = "{{\n{body}\n}}".format(body=",\n".join(json_lines))

    return (
        "ROLE: Assistant expert. Répondez UNIQUEMENT avec un JSON valide.\n"
        "TEXTE À ANALYSER:\n---\n{text}\n---\n"
        "SOURCE: {database_source}\n"
        f"{json_block}\n"
    )

def get_synthesis_prompt_template() -> str:
    # JSON échappé pour la synthèse
    return (
        "Contexte: {project_description}\n"
        "Résumés:\n---\n{data_for_prompt}\n---\n"
        "Réponds en JSON: "
        "{{\"relevance_evaluation\":[],\"main_themes\":[],\"key_findings\":[],"
        "\"methodologies_used\":[],\"synthesis_summary\":\"\",\"research_gaps\":[]}}\n"
    )

def get_rag_chat_prompt_template() -> str:
    # Utilitaire possible: pas de formatage JSON ici
    return (
        "En te basant sur ces extraits de documents, réponds à la question de façon concise et précise.\n"
        "Question: {question}\n"
        "Contexte:\n{context}\n"
    )

def get_effective_prompt_template(name: str, base_template: str) -> str:
    # Hook éventuel pour substitutions supplémentaires côté base
    # Par défaut on renvoie tel quel. Les accolades JSON sont déjà échappées.
    return base_template
