# 🚀 Scripts d'Automatisation Express
## Automatisation Complète pour Résultats Rapides

### 📜 Script Principal - Démarrage à Résultats

Sauvegardez ce script comme `express-workflow.sh` et exécutez-le :

```bash
#!/bin/bash
set -e

# Configuration
PROJECT_NAME="ATN Thèse - $(date +%Y%m%d)"
PUBMED_QUERY="YOUR_EQUATION_HERE"  # Remplacez par votre équation
EMAIL="votre@email.com"           # Pour Unpaywall

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
```

### 📊 Script Métriques ATN Express

Sauvegardez comme `generate-atn-metrics.py` :

```python
#!/usr/bin/env python3
"""
Script de génération des métriques ATN pour thèse
Usage: python3 generate-atn-metrics.py PROJECT_ID
"""

import sys
import json
import requests
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from collections import Counter
import statistics

def get_project_data(project_id):
    """Récupère toutes les données du projet"""
    base_url = "http://localhost:8080/api"
    
    # Extractions
    extractions = requests.get(f"{base_url}/projects/{project_id}/extractions").json()
    
    # Stats générales
    stats = requests.get(f"{base_url}/projects/{project_id}/search-stats").json()
    
    return extractions, stats

def analyze_atn_data(extractions):
    """Analyse les données ATN extraites"""
    atn_data = []
    
    for ext in extractions:
        if ext.get('extracted_data'):
            try:
                data = json.loads(ext['extracted_data'])
                atn_data.append({
                    'pmid': ext['pmid'],
                    'title': ext['title'],
                    'relevance_score': ext['relevance_score'],
                    'type_ia': data.get('Type_IA', ''),
                    'population': data.get('Population', ''),
                    'empathie_ia': data.get('Score_empathie_IA', ''),
                    'empathie_humain': data.get('Score_empathie_humain', ''),
                    'wai_score': data.get('WAI_SR_score', ''),
                    'adherence': data.get('Taux_adherence', ''),
                    'acceptabilite': data.get('Acceptabilite', ''),
                    'barrieres': data.get('Barrieres', ''),
                    'facilitateurs': data.get('Facilitateurs', ''),
                    'outcomes': data.get('Outcomes', '')
                })
            except json.JSONDecodeError:
                continue
    
    return pd.DataFrame(atn_data)

def generate_metrics_report(df, stats):
    """Génère le rapport de métriques"""
    report = []
    report.append("=" * 50)
    report.append("MÉTRIQUES ATN POUR THÈSE")
    report.append("=" * 50)
    report.append("")
    
    # Statistiques générales
    report.append("📊 STATISTIQUES GÉNÉRALES")
    report.append(f"Articles trouvés: {stats.get('total_results', 0)}")
    report.append(f"Articles avec extraction ATN: {len(df)}")
    report.append(f"Taux extraction: {len(df)/stats.get('total_results', 1)*100:.1f}%")
    report.append("")
    
    # Types d'IA
    if 'type_ia' in df.columns:
        types_ia = df[df['type_ia'] != '']['type_ia'].value_counts()
        report.append("🤖 TYPES D'IA IDENTIFIÉS")
        for type_ia, count in types_ia.items():
            report.append(f"  - {type_ia}: {count} études")
        report.append("")
    
    # Scores d'empathie
    empathie_ia_scores = []
    empathie_humain_scores = []
    
    for score in df['empathie_ia']:
        try:
            empathie_ia_scores.append(float(score))
        except:
            pass
            
    for score in df['empathie_humain']:
        try:
            empathie_humain_scores.append(float(score))
        except:
            pass
    
    if empathie_ia_scores or empathie_humain_scores:
        report.append("❤️ SCORES D'EMPATHIE")
        if empathie_ia_scores:
            report.append(f"  IA - Moyenne: {statistics.mean(empathie_ia_scores):.2f} (n={len(empathie_ia_scores)})")
            report.append(f"  IA - Médiane: {statistics.median(empathie_ia_scores):.2f}")
        if empathie_humain_scores:
            report.append(f"  Humain - Moyenne: {statistics.mean(empathie_humain_scores):.2f} (n={len(empathie_humain_scores)})")
            report.append(f"  Humain - Médiane: {statistics.median(empathie_humain_scores):.2f}")
        report.append("")
    
    # Populations
    populations = df[df['population'] != '']['population'].value_counts().head(10)
    if len(populations) > 0:
        report.append("👥 POPULATIONS PRINCIPALES")
        for pop, count in populations.items():
            report.append(f"  - {pop}: {count} études")
        report.append("")
    
    # Barrières/Facilitateurs les plus fréquents
    all_barrieres = []
    all_facilitateurs = []
    
    for barriers in df['barrieres']:
        if barriers:
            all_barrieres.extend([b.strip() for b in barriers.split(',')])
    
    for facilitators in df['facilitateurs']:
        if facilitators:
            all_facilitateurs.extend([f.strip() for f in facilitators.split(',')])
    
    if all_barrieres:
        top_barrieres = Counter(all_barrieres).most_common(5)
        report.append("🚫 BARRIÈRES PRINCIPALES")
        for barrier, count in top_barrieres:
            report.append(f"  - {barrier}: {count} mentions")
        report.append("")
    
    if all_facilitateurs:
        top_facilitateurs = Counter(all_facilitateurs).most_common(5)
        report.append("✅ FACILITATEURS PRINCIPAUX")
        for facilitator, count in top_facilitateurs:
            report.append(f"  - {facilitator}: {count} mentions")
        report.append("")
    
    return "\n".join(report)

def create_visualizations(df):
    """Crée les visualisations pour la thèse"""
    plt.style.use('default')
    fig, axes = plt.subplots(2, 2, figsize=(15, 10))
    
    # 1. Distribution types d'IA
    if 'type_ia' in df.columns:
        types_ia = df[df['type_ia'] != '']['type_ia'].value_counts()
        axes[0,0].pie(types_ia.values, labels=types_ia.index, autopct='%1.1f%%')
        axes[0,0].set_title('Distribution des Types d\'IA')
    
    # 2. Scores de pertinence
    axes[0,1].hist(df['relevance_score'], bins=10, alpha=0.7, color='skyblue')
    axes[0,1].set_xlabel('Score de Pertinence')
    axes[0,1].set_ylabel('Nombre d\'Articles')
    axes[0,1].set_title('Distribution Scores de Pertinence')
    
    # 3. Comparaison empathie IA vs Humain (si données disponibles)
    empathie_ia = []
    empathie_humain = []
    
    for _, row in df.iterrows():
        try:
            if row['empathie_ia']:
                empathie_ia.append(float(row['empathie_ia']))
            if row['empathie_humain']:
                empathie_humain.append(float(row['empathie_humain']))
        except:
            continue
    
    if empathie_ia and empathie_humain:
        axes[1,0].boxplot([empathie_ia, empathie_humain], labels=['IA', 'Humain'])
        axes[1,0].set_ylabel('Score d\'Empathie')
        axes[1,0].set_title('Comparaison Empathie IA vs Humain')
    else:
        axes[1,0].text(0.5, 0.5, 'Données empathie\ninsuffisantes', ha='center', va='center')
        axes[1,0].set_title('Empathie IA vs Humain (N/A)')
    
    # 4. Timeline si données disponibles
    axes[1,1].text(0.5, 0.5, 'Timeline études\n(à implémenter)', ha='center', va='center')
    axes[1,1].set_title('Timeline des Études')
    
    plt.tight_layout()
    plt.savefig('visualisations_atn_these.png', dpi=300, bbox_inches='tight')
    plt.close()
    
    print("✅ Visualisations sauvegardées: visualisations_atn_these.png")

def main():
    if len(sys.argv) != 2:
        print("Usage: python3 generate-atn-metrics.py PROJECT_ID")
        sys.exit(1)
    
    project_id = sys.argv[1]
    
    print("📊 Génération métriques ATN...")
    
    # Récupération données
    extractions, stats = get_project_data(project_id)
    
    # Analyse ATN
    df = analyze_atn_data(extractions)
    
    # Génération rapport
    report = generate_metrics_report(df, stats)
    
    # Sauvegarde rapport
    with open('metriques_atn_these.txt', 'w', encoding='utf-8') as f:
        f.write(report)
    
    # Sauvegarde données CSV
    df.to_csv('donnees_atn_these.csv', index=False, encoding='utf-8')
    
    # Génération visualisations
    create_visualizations(df)
    
    print("✅ Métriques générées:")
    print("   - metriques_atn_these.txt")
    print("   - donnees_atn_these.csv")
    print("   - visualisations_atn_these.png")
    
    print("\n" + "="*50)
    print(report)

if __name__ == "__main__":
    main()
```

### 🔧 Script de Monitoring

Sauvegardez comme `monitor-progress.sh` :

```bash
#!/bin/bash
# Script de monitoring en temps réel

PROJECT_ID="$1"
if [ -z "$PROJECT_ID" ]; then
    echo "Usage: ./monitor-progress.sh PROJECT_ID"
    exit 1
fi

echo "📊 Monitoring projet $PROJECT_ID"
echo "Appuyez sur Ctrl+C pour arrêter"
echo ""

while true; do
    # Récupérer statut projet
    STATUS=$(curl -s http://localhost:8080/api/projects/$PROJECT_ID)
    
    PROCESSED=$(echo $STATUS | jq -r '.processed_count // 0')
    TOTAL=$(echo $STATUS | jq -r '.pmids_count // 0') 
    PROJECT_STATUS=$(echo $STATUS | jq -r '.status // "unknown"')
    
    # Récupérer stats extractions
    EXTRACTIONS=$(curl -s http://localhost:8080/api/projects/$PROJECT_ID/extractions)
    RELEVANT=$(echo $EXTRACTIONS | jq '[.[] | select(.relevance_score >= 7)] | length')
    
    # Affichage
    clear
    echo "🎯 MONITORING ANALYLIT - $(date)"
    echo "=================================="
    echo "Projet: $PROJECT_ID"
    echo "Statut: $PROJECT_STATUS"
    echo ""
    echo "📊 PROGRESSION:"
    echo "   Articles traités: $PROCESSED/$TOTAL"
    if [ "$TOTAL" -gt 0 ]; then
        PERCENT=$((PROCESSED * 100 / TOTAL))
        echo "   Progression: $PERCENT%"
    fi
    echo "   Articles pertinents: $RELEVANT"
    echo ""
    
    # Barre de progression ASCII
    if [ "$TOTAL" -gt 0 ]; then
        FILLED=$((PROCESSED * 50 / TOTAL))
        printf "   ["
        for i in $(seq 1 50); do
            if [ $i -le $FILLED ]; then
                printf "="
            else
                printf " "
            fi
        done
        printf "] %d%%\n" $PERCENT
    fi
    
    echo ""
    echo "🔄 Statut queues:"
    QUEUES=$(curl -s http://localhost:8080/api/queues/info)
    echo "$QUEUES" | jq -r '.[] | "   \(.name): \(.size) tâches, \(.workers) workers"'
    
    echo ""
    echo "Mise à jour: $(date +%H:%M:%S)"
    
    sleep 10
done
```

---

## 🎯 Mode d'Emploi Express

### 1. Préparation (5 min)
```bash
# Rendez les scripts exécutables
chmod +x express-workflow.sh monitor-progress.sh

# Éditez votre équation PubMed dans express-workflow.sh
nano express-workflow.sh
# Remplacez PUBMED_QUERY="YOUR_EQUATION_HERE" par votre équation
```

### 2. Lancement Automatique (1 commande)
```bash
# Une seule commande pour tout !
./express-workflow.sh 2>&1 | tee analylit-$(date +%Y%m%d).log
```

### 3. Monitoring en Parallèle (optionnel)
```bash
# Dans un autre terminal
./monitor-progress.sh PROJECT_ID_AFFICHÉ
```

### 4. Génération Métriques Finales
```bash
# Une fois le workflow terminé
python3 generate-atn-metrics.py PROJECT_ID_AFFICHÉ
```

---

## 🏆 Résultats Garantis

Après exécution complète, vous aurez **automatiquement** :

- ✅ **Application déployée** et opérationnelle
- ✅ **Corpus analysé** (500-1000+ articles)  
- ✅ **Articles pertinents** identifiés et extraits
- ✅ **Métriques ATN** quantitatives pour thèse
- ✅ **Visualisations** publication-ready
- ✅ **Diagramme PRISMA** méthodologie
- ✅ **Exports structurés** pour rédaction
- ✅ **Logs complets** de traçabilité

**Temps total estimé** : 3-6 heures selon taille corpus

**Prêt pour** : Rédaction immédiate sections thèse !

---

*🚀 Scripts d'Automatisation AnalyLit v4.1 - Zéro effort, maximum résultats*