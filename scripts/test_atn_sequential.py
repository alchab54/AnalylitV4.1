#!/usr/bin/env python3
"""
Test ATN avec Workflow Séquentiel Optimisé
==========================================
Ordre d'exécution garanti + Utilisation maximale de la puissance GPU
"""
import requests
import time
import json
from datetime import datetime

# Configuration
API_BASE = "http://localhost:8080"
TEST_ARTICLES = [
    {
        "pmid": "38001001",
        "title": "Digital Therapeutic Alliance in Mental Health: A Systematic Review",
        "abstract": "Investigation of AI-human therapeutic relationships in digital mental health platforms...",
        "authors": "Smith J, Brown A, Wilson C",
        "year": "2024",
        "journal": "Journal of Medical Internet Research",
        "doi": "10.2196/38001001"
    },
    # ... 4 autres articles ...
]

def test_sequential_atn_workflow():
    """Test du workflow ATN séquentiel complet"""
    
    print("🚀 LANCEMENT WORKFLOW ATN SÉQUENTIEL")
    print("="*60)
    
    # 1. Créer le projet
    project_data = {
        "name": "Test ATN - Workflow Séquentiel",
        "description": "Test du pipeline ATN avec ordre d'exécution optimal",
        "profile_used": "fast-local"
    }
    
    response = requests.post(f"{API_BASE}/api/projects", json=project_data)
    project = response.json()
    project_id = project['id']
    
    print(f"✅ Projet créé: {project_id}")
    
    # 2. Lancer le workflow orchestré
    workflow_data = {
        "articles_data": TEST_ARTICLES,
        "profile": {"extract": "llama3:8b", "synthesis": "llama3:8b"},
        "fetch_pdfs": True,  # Récupération PDFs activée
        "use_atn_grid": True  # Grille ATN standardisée
    }
    
    response = requests.post(f"{API_BASE}/api/projects/{project_id}/launch-atn-workflow", json=workflow_data)
    workflow_info = response.json()
    
    print(f"✅ Workflow ATN lancé - Jobs: {workflow_info}")
    
    # 3. Suivi en temps réel du pipeline
    stages = [
        ("Import Articles", "import"),
        ("Récupération PDFs", "pdfs"),  
        ("Screening ATN", "screening"),
        ("Extraction Grille", "extraction"),
        ("Calcul Scores", "analysis"),
        ("Synthèse Finale", "synthesis")
    ]
    
    print("\n⏳ SUIVI DU PIPELINE ATN:")
    print("-" * 40)
    
    max_wait = 900  # 15 minutes max
    start_time = time.time()
    
    while (time.time() - start_time) < max_wait:
        # Vérifier le statut du projet
        response = requests.get(f"{API_BASE}/api/projects/{project_id}")
        project_status = response.json()
        
        current_stage = project_status.get('current_stage', 'import')
        progress = project_status.get('progress_percentage', 0)
        
        print(f"📊 [{datetime.now().strftime('%H:%M:%S')}] Stage: {current_stage} | Progrès: {progress}%")
        
        # Vérifier si terminé
        if project_status.get('status') == 'completed':
            print("🎉 WORKFLOW ATN TERMINÉ AVEC SUCCÈS !")
            break
        elif project_status.get('status') == 'failed':
            print("❌ Workflow échoué - Vérifiez les logs")
            break
            
        time.sleep(30)  # Vérification toutes les 30 secondes
    
    # 4. Rapport final détaillé
    print("\n" + "="*60)
    print("📋 RAPPORT FINAL ATN")
    print("="*60)
    
    # Articles récupérés
    response = requests.get(f"{API_BASE}/api/projects/{project_id}/search-results")
    articles = response.json().get('results', [])
    print(f"📚 Articles importés: {len(articles)}")
    
    # PDFs disponibles
    pdfs_count = len([a for a in articles if a.get('pdf_available')])
    print(f"📄 PDFs récupérés: {pdfs_count}/{len(articles)} ({round(pdfs_count/len(articles)*100, 1)}%)")
    
    # Extractions ATN
    response = requests.get(f"{API_BASE}/api/projects/{project_id}/extractions")
    extractions = response.json().get('results', [])
    relevant_articles = [e for e in extractions if e.get('relevance_score', 0) >= 6]
    print(f"🔍 Articles screened: {len(extractions)}")
    print(f"✅ Articles pertinents ATN: {len(relevant_articles)}")
    
    # Données ATN extraites
    atn_extractions = [e for e in extractions if e.get('extracted_data')]
    print(f"🔬 Extractions ATN complètes: {len(atn_extractions)}")
    
    if atn_extractions:
        # Analyse des champs ATN extraits
        all_fields = set()
        for ext in atn_extractions:
            if ext.get('extracted_data'):
                try:
                    data = json.loads(ext['extracted_data'])
                    all_fields.update(data.keys())
                except:
                    pass
        
        print(f"📋 Champs ATN extraits: {len(all_fields)}/30 champs standardisés")
        print(f"🎯 Grille ATN: {round(len(all_fields)/30*100, 1)}% complétude")
    
    # Analyses finales
    response = requests.get(f"{API_BASE}/api/projects/{project_id}/analyses")
    analyses = response.json().get('results', [])
    print(f"📊 Analyses générées: {len(analyses)}")
    
    for analysis in analyses:
        analysis_type = analysis.get('analysis_type', 'unknown')
        status = analysis.get('status', 'pending')
        print(f"  - {analysis_type}: {status}")
    
    print(f"\n🎉 Test ATN séquentiel terminé - Projet: {project_id}")
    return project_id

if __name__ == "__main__":
    test_sequential_atn_workflow()
