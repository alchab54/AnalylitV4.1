#!/bin/bash
set -e

# Configuration
PROJECT_NAME="ATN Thèse - $(date +%Y%m%d)"
PUBMED_QUERY="("Therapeutic Alliance"[Mesh] OR "therapeutic alliance"[tiab] OR "working alliance"[tiab] OR "treatment alliance"[tiab]) AND ("Digital Technology"[Mesh] OR "Virtual Reality"[Mesh] OR "Virtual Reality Exposure Therapy"[Mesh] OR "Artificial Intelligence"[Mesh] OR "Empathy"[Mesh] OR "Digital Health"[Mesh] OR mHealth[tiab] OR eHealth[tiab] OR digital*[tiab] OR virtual*[tiab] OR "artificial intelligence"[tiab] OR chatbot*[tiab] OR "empathy"[tiab]) AND ("2020/01/01"[Date - Publication] : "2025/06/25"[Date - Publication])"  # Remplacez par votre équation
EMAIL="alicechabaux@gmail.com"           # Pour Unpaywall

echo "🚀 AnalyLit Express Workflow - Démarrage $(date)"
echo "=========================================="

# 1. Vérification système
echo "📋 Vérification système..."
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose requis"
    exit 1
fi

if ! command -v curl &> /dev/null; then
    echo "❌ curl requis" 
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo "📦 Installation jq..."
    sudo apt-get update && sudo apt-get install -y jq
fi

# 2. Démarrage services
echo "🐳 Démarrage services Docker..."
docker-compose -f docker-compose-complete.yml up --build -d

echo "⏳ Attente démarrage services (90s)..."
sleep 90

# 3. Vérification santé
echo "🔍 Vérification santé services..."
for i in {1..10}; do
    if curl -s http://localhost:8080/api/health | grep -q "ok"; then
        echo "✅ Services opérationnels"
        break
    fi
    echo "⏳ Tentative $i/10..."
    sleep 10
done

# 4. Création projet
echo "📁 Création projet..."
PROJECT_RESPONSE=$(curl -s -X POST http://localhost:8080/api/projects \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$PROJECT_NAME\",
    \"description\": \"Scoping review ATN - workflow express\",
    \"mode\": \"screening\"
  }")

PROJECT_ID=$(echo $PROJECT_RESPONSE | jq -r '.id')
echo "✅ Projet créé: $PROJECT_ID"

# 5. Configuration profil IA
echo "🤖 Configuration profil IA express..."
PROFILE_RESPONSE=$(curl -s -X POST http://localhost:8080/api/profiles \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Express ATN",
    "description": "Profil optimisé vitesse",
    "preprocess_model": "phi3:mini",
    "extract_model": "llama3.1:8b",
    "synthesis_model": "llama3.1:8b",
    "temperature": 0.3
  }')

echo "✅ Profil IA configuré"

# 6. Téléchargement modèles (en arrière-plan)
echo "📥 Téléchargement modèles IA..."
curl -s -X POST http://localhost:8080/api/ollama/pull -d '{"model": "phi3:mini"}' &
curl -s -X POST http://localhost:8080/api/ollama/pull -d '{"model": "llama3.1:8b"}' &

# 7. Recherche PubMed
echo "🔍 Lancement recherche PubMed..."
SEARCH_RESPONSE=$(curl -s -X POST http://localhost:8080/api/search \
  -H "Content-Type: application/json" \
  -d "{
    \"project_id\": \"$PROJECT_ID\",
    \"query\": \"$PUBMED_QUERY\",
    \"databases\": [\"pubmed\"],
    \"max_results_per_db\": 500
  }")

SEARCH_TASK_ID=$(echo $SEARCH_RESPONSE | jq -r '.task_id')
echo "✅ Recherche lancée: $SEARCH_TASK_ID"

# 8. Attente résultats recherche
echo "⏳ Attente résultats recherche..."
for i in {1..30}; do
    STATS=$(curl -s http://localhost:8080/api/projects/$PROJECT_ID/search-stats)
    TOTAL=$(echo $STATS | jq -r '.total_results // 0')
    
    if [ "$TOTAL" -gt 0 ]; then
        echo "✅ Recherche terminée: $TOTAL articles trouvés"
        break
    fi
    
    echo "⏳ Recherche en cours... ($i/30)"
    sleep 30
done

# 9. Création grille ATN
echo "📊 Création grille extraction ATN..."
GRID_RESPONSE=$(curl -s -X POST http://localhost:8080/api/projects/$PROJECT_ID/grids \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ATN Express",
    "fields": [
      {"name": "Type_IA", "description": "Type système IA"},
      {"name": "Population", "description": "Population étudiée"},
      {"name": "Score_empathie_IA", "description": "Score empathie IA"},
      {"name": "Score_empathie_humain", "description": "Score empathie humain"},
      {"name": "WAI_SR_score", "description": "Working Alliance Inventory"},
      {"name": "Taux_adherence", "description": "Taux adhésion patients"},
      {"name": "Acceptabilite", "description": "Acceptabilité patients"},
      {"name": "Barrieres", "description": "Barrières identifiées"},
      {"name": "Facilitateurs", "description": "Facilitateurs"},
      {"name": "Outcomes", "description": "Résultats principaux"}
    ]
  }')

GRID_ID=$(echo $GRID_RESPONSE | jq -r '.id')
echo "✅ Grille ATN créée: $GRID_ID"

# 10. Screening automatique (batches)
echo "🤖 Lancement screening automatique..."

# Récupérer tous PMIDs
curl -s "http://localhost:8080/api/projects/$PROJECT_ID/search-results?per_page=1000" > all_results.json
TOTAL_ARTICLES=$(cat all_results.json | jq '.total')

echo "📋 Screening de $TOTAL_ARTICLES articles..."

# Traitement par batches de 50
python3 << EOF
import json
import requests
import time

with open('all_results.json') as f:
    data = json.load(f)

pmids = [r['article_id'] for r in data['results']]
batches = [pmids[i:i+50] for i in range(0, len(pmids), 50)]

for i, batch in enumerate(batches):
    print(f"📦 Batch {i+1}/{len(batches)} ({len(batch)} articles)")
    
    response = requests.post(
        f"http://localhost:8080/api/projects/$PROJECT_ID/run",
        json={
            "articles": batch,
            "profile": "Express ATN",
            "analysis_mode": "screening"
        }
    )
    
    if response.status_code == 202:
        print(f"✅ Batch {i+1} lancé")
        time.sleep(5)  # Éviter surcharge
    else:
        print(f"❌ Erreur batch {i+1}: {response.status_code}")
EOF

echo "🎯 Screening lancé pour tous les articles"

# 11. Monitoring screening
echo "📊 Monitoring screening..."
while true; do
    PROJECT_STATUS=$(curl -s http://localhost:8080/api/projects/$PROJECT_ID)
    PROCESSED=$(echo $PROJECT_STATUS | jq -r '.processed_count // 0')
    TOTAL=$(echo $PROJECT_STATUS | jq -r '.pmids_count // 0')
    
    if [ "$PROCESSED" -ge "$TOTAL" ] && [ "$TOTAL" -gt 0 ]; then
        echo "✅ Screening terminé: $PROCESSED/$TOTAL"
        break
    fi
    
    PERCENT=$((PROCESSED * 100 / TOTAL))
    echo "⏳ Screening: $PROCESSED/$TOTAL ($PERCENT%)"
    sleep 60
done

# 12. Identification articles pertinents
echo "🎯 Identification articles pertinents..."
curl -s http://localhost:8080/api/projects/$PROJECT_ID/extractions > extractions.json

RELEVANT_COUNT=$(cat extractions.json | jq '[.[] | select(.relevance_score >= 7)] | length')
echo "✅ Articles pertinents (score ≥7): $RELEVANT_COUNT"

# 13. Extraction détaillée top articles
if [ "$RELEVANT_COUNT" -gt 0 ]; then
    echo "📊 Extraction détaillée articles pertinents..."
    
    # Top 20 articles les plus pertinents
    cat extractions.json | jq -r '.[] | select(.relevance_score >= 7) | .pmid' | head -20 > top_pmids.txt
    
    TOP_PMIDS=$(cat top_pmids.txt | tr '\n' ',' | sed 's/,$//')
    
    curl -X POST http://localhost:8080/api/projects/$PROJECT_ID/run \
      -H "Content-Type: application/json" \
      -d "{
        \"articles\": [$TOP_PMIDS],
        \"profile\": \"Express ATN\",
        \"analysis_mode\": \"full_extraction\",
        \"custom_grid_id\": \"$GRID_ID\"
      }"
    
    echo "✅ Extraction détaillée lancée"
fi

# 14. Génération analyses automatiques
echo "📈 Génération analyses automatiques..."

# PRISMA flow
curl -s -X POST http://localhost:8080/api/projects/$PROJECT_ID/run-analysis \
  -d '{"type": "prisma_flow"}' &

# Méta-analyse
curl -s -X POST http://localhost:8080/api/projects/$PROJECT_ID/run-analysis \
  -d '{"type": "meta_analysis"}' &

# Scores ATN
curl -s -X POST http://localhost:8080/api/projects/$PROJECT_ID/run-analysis \
  -d '{"type": "atn_scores"}' &

# Discussion
curl -s -X POST http://localhost:8080/api/projects/$PROJECT_ID/run-discussion-draft &

wait  # Attendre toutes les analyses
echo "✅ Analyses terminées"

# 15. Export final
echo "📦 Export résultats..."
mkdir -p resultats_express_$(date +%Y%m%d)

# Export thèse
curl -o "resultats_express_$(date +%Y%m%d)/export_these.zip" \
  http://localhost:8080/api/projects/$PROJECT_ID/export/thesis

# Export complet  
curl -o "resultats_express_$(date +%Y%m%d)/export_complet.zip" \
  http://localhost:8080/api/projects/$PROJECT_ID/export

echo "✅ Exports sauvegardés dans resultats_express_$(date +%Y%m%d)/"

# 16. Génération rapport final
cat > "resultats_express_$(date +%Y%m%d)/RAPPORT_EXPRESS.txt" << EOL
===========================================
ANALYLIT EXPRESS - RAPPORT FINAL
===========================================
Date: $(date)
Projet: $PROJECT_ID

RÉSULTATS:
- Articles trouvés: $TOTAL
- Articles traités: $PROCESSED  
- Articles pertinents (≥7): $RELEVANT_COUNT
- Taux pertinence: $((RELEVANT_COUNT * 100 / TOTAL))%

FICHIERS GÉNÉRÉS:
- export_these.zip : Données pour thèse ATN
- export_complet.zip : Toutes les données  
- Graphiques PRISMA et analyses dans les exports

PROCHAINES ÉTAPES:
1. Décompresser les exports
2. Consulter données Excel ATN
3. Utiliser diagramme PRISMA pour méthodologie
4. Intégrer métriques dans rédaction thèse

URL Application: http://localhost:8080
Identifiant projet: $PROJECT_ID
===========================================
EOL

echo ""
echo "🎉 WORKFLOW EXPRESS TERMINÉ!"
echo "==============================="
echo "📊 Résultats:"
echo "   - Articles analysés: $PROCESSED"
echo "   - Articles pertinents: $RELEVANT_COUNT"
echo "   - Taux pertinence: $((RELEVANT_COUNT * 100 / TOTAL))%"
echo ""
echo "📁 Résultats dans: resultats_express_$(date +%Y%m%d)/"
echo "🌐 Interface web: http://localhost:8080"
echo "🆔 ID projet: $PROJECT_ID"
echo ""
echo "✅ Prêt pour rédaction thèse!"
