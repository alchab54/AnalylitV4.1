# utils/prompt_templates.py
from typing import Optional, Dict, Any, List
from sqlalchemy import create_engine, text
from config_v4 import get_config

config = get_config()
engine = create_engine(config.DATABASE_URL, pool_pre_ping=True)

def get_screening_prompt_template() -> str:
    return """
ROLE: Vous êtes un assistant de recherche expert en revue systématique.
TÂCHE: Évaluer la pertinence d'un article basé sur son titre et son résumé.
CONTRAINTES:
1. Répondez UNIQUEMENT avec un objet JSON valide.
2. Le score de pertinence doit être un entier entre 0 et 10.
3. La décision doit être "À inclure" si le score >= 7, sinon "À exclure".
4. La justification doit être une phrase concise (maximum 30 mots).

EXEMPLE 1:
---
Titre: The impact of digital therapeutic alliance on patient engagement.
Résumé: This study explores how a strong digital therapeutic alliance improves engagement.
---
RÉPONSE ATTENDUE:
{
    "relevance_score": 9,
    "decision": "À inclure",
    "justification": "L'article traite directement de l'alliance thérapeutique numérique et de son impact sur l'engagement des patients."
}

ARTICLE À ANALYSER:
---
Titre: {title}
Résumé: {abstract}
Source: {database_source}
---
RÉPONSE ATTENDUE:
"""

def get_full_extraction_prompt_template(fields: List[Dict[str, str]]) -> str:
    example_json = {f['name']: f"Exemple de valeur pour {f.get('description', f['name'])}" for f in fields}
    example = json.dumps(example_json, indent=4, ensure_ascii=False)
    return f"""
ROLE: Vous êtes un expert en extraction de données structurées.
TÂCHE: Analyser le texte fourni et remplir la grille d'extraction JSON.
CONTRAINTES STRICTES:
1. Votre réponse doit être UNIQUEMENT un objet JSON valide.
2. Respectez scrupuleusement la structure de la grille fournie.
3. Si une information est absente, utilisez la valeur null ou "".

GRILLE D'EXTRACTION (EXEMPLE):
---
{example}
---

TEXTE COMPLET À ANALYSER:
---
{{text}}
---
VOTRE RÉPONSE (JSON UNIQUEMENT):
"""

def get_synthesis_prompt_template() -> str:
    return """
PERSONA: Vous êtes un chercheur médical rédigeant la section "Résultats" d'une revue systématique.
TÂCHE: Produire une synthèse structurée au format JSON.
CONTEXTE: {project_description}

RÉSUMÉS:
---
{data_for_prompt}
---

INSTRUCTIONS:
Répondez UNIQUEMENT avec un JSON contenant:
- "main_themes": [3 à 5 thèmes principaux],
- "key_findings": [conclusions récurrentes],
- "notable_contradictions": [divergences majeures],
- "synthesis_summary": "paragraphe de synthèse",
- "research_gaps": [lacunes identifiées]
"""

def get_rag_chat_prompt_template() -> str:
    return """
ROLE: Assistant de recherche répondant EXCLUSIVEMENT sur un contexte fourni.
CONTEXTE:
---
{context}
---
QUESTION: {question}
---
INSTRUCTIONS:
1. Basez la réponse UNIQUEMENT sur le contexte.
2. Citez les sources (ex: [Article: 1234567]).
3. Si le contexte est insuffisant, répondez EXACTEMENT: "Les documents fournis ne contiennent pas d'informations pour répondre à cette question."
4. Aucune supposition.
VOTRE RÉPONSE:
"""

def get_prompt_override_from_db(prompt_name: str) -> Optional[str]:
    try:
        with engine.connect() as conn:
            row = conn.execute(
                text("SELECT template FROM prompts WHERE name = :n"),
                {"n": prompt_name}
            ).scalar_one_or_none()
            if row and isinstance(row, str) and row.strip():
                return row
    except Exception:
        # journaliser côté appelant si nécessaire
        return None
    return None

def get_effective_prompt_template(prompt_name: str, default_template: str) -> str:
    """Retourne le template DB si présent, sinon le template robuste par défaut."""
    override = get_prompt_override_from_db(prompt_name)
    return override if override else default_template