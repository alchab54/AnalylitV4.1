# Fichier : utils/analysis.py

import json
import numpy as np
import pandas as pd
from typing import List, Dict, Any, Callable
# import matplotlib.pyplot as plt # <-- SUPPRESSION DE L'IMPORT GLOBAL

def process_atn_data(data_list: List[Dict[str, Any]], project_id: str) -> Dict[str, Any]:
    """
    Traite les données ATN agrégées et génère des métriques et des graphiques.
    """
    # Importez matplotlib ici (lazy loading) pour éviter de casser l'importation 
    # au niveau du serveur dans un environnement headless.
    import matplotlib.pyplot as plt

    # ... (le reste de la logique de la fonction doit être ici)
    # Cette fonction semble manquante ou incomplète dans le fichier fourni.
    # Je vais ajouter une implémentation de base pour que le code soit fonctionnel.
    
    atn_metrics = {'empathy_scores_ai': [], 'empathy_scores_human': [], 'wai_sr_scores': [], 'adherence_rates': [], 'algorithmic_trust': [], 'acceptability_scores': []}
    for data_json in data_list:
        if score := data_json.get("Score_empathie_IA"): atn_metrics['empathy_scores_ai'].append(float(score))
        if score := data_json.get("WAI-SR_modifié"): atn_metrics['wai_sr_scores'].append(float(score)) # Correction : utiliser data_json

    return {"atn_metrics": atn_metrics} # Retourne une structure de base

def generate_discussion_draft(df: pd.DataFrame, call_ollama_func: Callable, model: str, max_prompt_length: int = 8000) -> str:
    """
    Génère un brouillon de la section 'Discussion' pour une revue systématique.
    """
    required_cols = ['extracted_data', 'pmid', 'title']
    if not all(col in df.columns for col in required_cols):
        return "Erreur: Colonnes 'extracted_data', 'pmid', 'title' requises."

    if 'relevance_score' in df.columns:
        df_sorted = df.sort_values(by='relevance_score', ascending=False)
    else:
        df_sorted = df

    excerpts = []
    for _, row in df_sorted.head(15).iterrows():
        try:
            data = json.loads(row.get('extracted_data', '{}'))
            if not isinstance(data, dict): # 'data' est maintenant le dictionnaire parsé
                continue

            # CORRECTION : Extraction robuste de toutes les données textuelles
            content_parts = []
            for key, value in data.items(): # On itère sur le dictionnaire 'data'
                # Gère les valeurs simples (str) et les dictionnaires imbriqués d'un niveau
                if isinstance(value, str) and value.strip() and value.lower() not in ['n/a', 'non spécifié', 'none']:
                    content_parts.append(f"- {key.replace('_', ' ').capitalize()}: {value}")
                elif isinstance(value, dict):
                    for sub_key, sub_value in value.items():
                        if isinstance(sub_value, str) and sub_value.strip() and sub_value.lower() not in ['n/a', 'non spécifié', 'none']:
                            content_parts.append(f"- {sub_key.replace('_', ' ').capitalize()}: {sub_value}")
            
            if content_parts:
                excerpts.append(f"Étude (PMID: {row.get('pmid', 'N/A')} - Titre: {row.get('title', 'N/A')}):\n" + "\n".join(content_parts))

        except (json.JSONDecodeError, AttributeError):
            continue

    if not excerpts:
        return "Aucune donnée textuelle exploitable n'a été trouvée dans les extractions des articles pertinents."

    # Limit the size of the excerpts
    full_excerpts_text = "".join(excerpts)
    if len(full_excerpts_text) > max_prompt_length:
        full_excerpts_text = full_excerpts_text[:max_prompt_length]
        # Find the last newline to avoid cutting in the middle of a line
        last_newline = full_excerpts_text.rfind('\n')
        if last_newline != -1:
            full_excerpts_text = full_excerpts_text[:last_newline]

    if not full_excerpts_text:
        return "Aucune donnée textuelle exploitable n'a été trouvée dans les extractions des articles pertinents."

    prompt = f"""
En tant qu'assistant de recherche expert, rédigez une synthèse narrative concise (environ 150-200 mots) destinée à la section "Discussion" d'une revue systématique. Votre analyse doit se baser sur les extraits d'études suivants.

Votre synthèse doit impérativement :
1. Identifier les points de convergence majeurs (les résultats qui se répètent ou se complètent).
2. Souligner les divergences ou les contradictions notables entre les études.
3. Suggérer brièvement une ou deux directions pertinentes pour la recherche future, en se basant sur les limitations identifiées.

Extraits des études à analyser :
---
{full_excerpts_text}
---

Brouillon de la section Discussion :
"""
    return call_ollama_func(prompt, model)


def generate_knowledge_graph_data(df: pd.DataFrame, call_ollama_func: Callable, model: str) -> Dict[str, List[Dict[str, Any]]]:
    """
    Génère les données (nœuds et arêtes) pour un graphe de connaissances.
    """
    nodes = [{"id": str(row.get('pmid')), "title": row.get('title')} for i, row in df.iterrows()]
    
    study_summaries = "\n".join([f"ID: {node['id']}, Titre: {node['title']}" for node in nodes])

    prompt = f"""
    Analysez la liste d'articles suivante et identifiez jusqu'à 5 relations significatives entre eux. Les types de relations peuvent être, par exemple, "Méthodologie Similaire", "Population Similaire", "Thème Commun", "Auteur Commun", "Résultats Contradictoires".
    Retournez UNIQUEMENT un objet JSON valide contenant une seule clé "relations". La valeur de cette clé doit être une liste d'objets. Chaque objet doit avoir trois clés : "source" (ID de l'article source), "target" (ID de l'article cible), et "type" (une courte description de la relation).
    Articles à analyser :
    ---
    {study_summaries}
    ---
    JSON des relations :
    """
    
    response_json = call_ollama_func(prompt, model, output_format="json")
    
    try:
        # response_json est déjà un dict grâce à `output_format="json"`
        edges = response_json.get("relations", [])
        node_ids = {node['id'] for node in nodes}
        edges = [edge for edge in edges if edge.get('source') in node_ids and edge.get('target') in node_ids]
    except (AttributeError, TypeError): # Si response_json n'est pas un dict
        print("Avertissement: La réponse du LLM pour le graphe n'était pas un JSON valide.")
        edges = []

    return {"nodes": nodes, "edges": edges}

def analyze_themes(abstracts: List[str], call_ollama_func: Callable, model: str) -> List[str]:
    """
    Identifie les thèmes récurrents à partir d'une liste d'abstracts.
    """
    if not abstracts:
        return []
    
    combined_abstracts = "\n\n".join(abstracts)
    prompt = f"""
    Analysez le corpus de résumés scientifiques suivant et identifiez les 5 à 7 thèmes de recherche les plus récurrents et significatifs. Ne fournissez aucune explication, juste une liste numérotée des thèmes.
    Corpus :
    {combined_abstracts}
    Thèmes récurrents :
    """
    
    response = call_ollama_func(prompt, model)
    themes = [line.split('.', 1)[1].strip() for line in response.split('\n') if '.' in line]
    return themes

    
