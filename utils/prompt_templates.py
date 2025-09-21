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

def get_scoping_stakeholder_template(fields: list) -> str:
    """Template spécialisé pour scoping review multipartie prenante."""
    
    # Champs de base + champs spécialisés
    base_fields = [f.get("name", "").strip() for f in fields if isinstance(f, dict) and f.get("name")]
    
    # Ajout automatique des champs stakeholder si pas présents
    stakeholder_fields = [
        "partie_prenante_principale",
        "perspective_adoptee", 
        "barrières_identifiees",
        "facilitateurs_identifies", 
        "outcomes_par_stakeholder",
        "implications_pratiques",
        "gaps_recherche_identifiés"
    ]
    
    all_fields = base_fields + [f for f in stakeholder_fields if f not in base_fields]
    
    json_lines = []
    for i, k in enumerate(all_fields):
        comma = "," if i < len(all_fields) - 1 else ""
        json_lines.append(f'"{k}": "...""{comma}')
    
    json_block = "{{\n{body}\n}}".format(body=",\n".join(json_lines))
    
    return (
        "ROLE: Assistant expert en scoping review et analyse multipartie prenante. "
        "Analysez ce texte selon les critères PRISMA-ScR et JBI.\n\n"
        "CONSIGNES SPÉCIALES :\n"
        "- Identifiez clairement la/les partie(s) prenante(s) étudiée(s)\n"
        "- Distinguez les perspectives : patients, soignants, développeurs, régulateurs\n"
        "- Relevez les barrières ET facilitateurs spécifiques à chaque groupe\n"
        "- Notez les outcomes différenciés par stakeholder\n\n"
        "TEXTE À ANALYSER:\n---\n{text}\n---\n"
        "SOURCE: {database_source}\n\n"
        f"Répondez UNIQUEMENT avec ce JSON :\n{json_block}\n"
    )

def get_scoping_atn_template(fields: list) -> str:
    """Template spécialisé pour la scoping review ATN (Alliance Thérapeutique Numérique)."""
    
    # Votre grille ATN complète
    atn_fields = [
        "ID_étude", "Auteurs", "Année", "Titre", "DOI/PMID", "Type_étude",
        "Niveau_preuve_HAS", "Pays_contexte", "Durée_suivi", "Taille_échantillon",
        "Population_cible", "Type_IA", "Plateforme", "Fréquence_usage",
        "Instrument_empathie", "Score_empathie_IA", "Score_empathie_humain",
        "WAI-SR_modifié", "Taux_adhésion", "Confiance_algorithmique",
        "Interactions_biomodales", "Considération_éthique", "Acceptabilité_patients",
        "Risque_biais", "Limites_principales", "Conflits_intérêts", "Financement",
        "RGPD_conformité", "AI_Act_risque", "Transparence_algo"
    ]
    
    # Utiliser les champs fournis ou la grille ATN par défaut
    fields_to_use = [f.get("name", "") for f in fields if isinstance(f, dict)] or atn_fields
    
    json_lines = []
    for i, field in enumerate(fields_to_use):
        comma = "," if i < len(fields_to_use) - 1 else ""
        json_lines.append(f'    "{field}": "..."{comma}') # The user request is to fix the test, but the test is correct. The prompt template is wrong.
    
    json_block = "{{\n{body}\n}}".format(body=",\n".join(json_lines))
    
    return (
        "ROLE: Assistant expert en scoping review sur l'alliance thérapeutique numérique. "
        "Analysez ce texte selon les critères PRISMA-ScR et JBI pour extraire les données ATN.\n\n"
        
        "CONSIGNES SPÉCIALES ALLIANCE THÉRAPEUTIQUE NUMÉRIQUE :\n"
        "- Identifiez le type d'IA utilisé (chatbot, avatar, assistant virtuel, etc.)\n"
        "- Relevez tous les scores d'empathie (IA vs humain) si mentionnés\n"
        "- Notez les instruments de mesure utilisés (WAI-SR modifié, etc.)\n"
        "- Analysez l'acceptabilité et l'adhésion des patients\n"
        "- Évaluez la confiance algorithmique et les aspects éthiques\n"
        "- Vérifiez la conformité RGPD et AI Act si applicable\n"
        "- Identifiez les parties prenantes (patients, soignants, développeurs, régulateurs)\n\n"
        
        "CONTEXTE MULTIPARTIE PRENANTE :\n"
        "- Patients/Soignés : acceptabilité, satisfaction, adhésion\n"
        "- Professionnels de santé : utilisation, perception, workflow\n"
        "- Développeurs/Tech : performance technique, algorithmes\n"
        "- Régulateurs/Décideurs : conformité, éthique, sécurité\n\n"
        
        "TEXTE À ANALYSER:\n---\n{text}\n---\n"
        "SOURCE: {database_source}\n\n"
        f"Répondez UNIQUEMENT avec ce JSON :\n{json_block}\n"
    )

def get_screening_atn_template() -> str:
    """Template de screening spécialisé pour l'ATN."""
    return (
        "En tant qu'assistant expert en scoping review sur l'alliance thérapeutique numérique, "
        "analysez cet article selon les critères PRISMA-ScR et JBI.\n\n"
        
        "CRITÈRES DE PERTINENCE ATN :\n"
        "✅ INCLURE si l'article traite de :\n"
        "- Relations thérapeutiques avec des systèmes d'IA (chatbots, avatars, assistants virtuels)\n"
        "- Empathie algorithmique ou empathie artificielle\n"
        "- Alliance thérapeutique dans le contexte numérique/digital\n"
        "- Acceptabilité des outils d'IA par les patients\n"
        "- Confiance dans les algorithmes de santé\n"
        "- Interaction patient-IA dans un contexte thérapeutique\n"
        "- WAI (Working Alliance Inventory) appliqué aux systèmes numériques\n\n"
        
        "❌ EXCLURE si l'article traite uniquement de :\n"
        "- IA diagnostique sans dimension relationnelle\n"
        "- Télémédecine classique sans composante IA\n"
        "- Algorithmes de prédiction sans interaction patient\n"
        "- Technologies médicales sans aspect alliance thérapeutique\n\n"
        
        "Titre: {title}\n\n"
        "Résumé: {abstract}\n\n"
        "Source: {database_source}\n\n"
        
        "Répondez UNIQUEMENT en JSON:\n"
        "{{\"relevance_score\": 0-10, \"decision\": \"À inclure\"|\"À exclure\", \"justification\": \"...\", \"stakeholder_identified\": \"...\", \"atn_relevance\": \"...\"}}\n"
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
