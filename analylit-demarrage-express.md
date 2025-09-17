**🚀 AnalyLit v4.1 \- Guide de Démarrage Express**

**De Zéro à Premiers Résultats en 3 Jours**

**⚡ Objectif : Résultats Concrets Rapides**

Vous avez déjà une équation PubMed et des tests d'extraction. Ce guide vous mène directement aux résultats exploitables pour vos travaux.

**📅 Planning Express 3 Jours**

**JOUR 1 : Installation & Import (2-3h)**

* \[ \] Démarrage application

* \[ \] Import équation PubMed existante

* \[ \] Configuration profil IA optimal

* \[ \] Test screening automatique

**JOUR 2 : Traitement & Extraction (4-6h)**

* \[ \] Screening complet corpus

* \[ \] Extraction articles pertinents

* \[ \] Upload PDFs disponibles

* \[ \] Chat RAG pour insights rapides

**JOUR 3 : Synthèse & Export (2-4h)**

* \[ \] Génération analyses automatiques

* \[ \] Export données pour rédaction

* \[ \] Diagramme PRISMA

* \[ \] Premier draft discussion

**🏁 JOUR 1 : Démarrage Express**

**1️⃣ Installation Ultra-Rapide (15 min)**

`# Cloner et démarrer`  
`git clone [votre-repo] analylit-express`  
`cd analylit-express`

`# Configuration express`  
`cp env.example .env`  
`# Éditer rapidement les essentiels :`  
`echo "SECRET_KEY=votre_clé_secrète_ici" >> .env`  
`echo "UNPAYWALL_EMAIL=votre@email.com" >> .env`

`# Démarrage complet`  
`docker-compose -f docker-compose-complete.yml up --build -d`

`# Vérification (attendre ~2 min)`  
`curl http://localhost:8080/api/health`

**✅ Succès si** : `{"status": "ok"}` dans la réponse

**2️⃣ Création Projet Express (5 min)**

`# Créer projet directement via API`  
`curl -X POST http://localhost:8080/api/projects \`  
  `-H "Content-Type: application/json" \`  
  `-d '{`  
    `"name": "ATN Thèse - Sprint 1",`  
    `"description": "Alliance thérapeutique numérique - premiers résultats",`  
    `"mode": "screening"`  
  `}' | jq .`

`# Sauvegarder l'ID retourné`  
`PROJECT_ID="[ID_RETOURNÉ]"`

**3️⃣ Import Équation PubMed Existante (30 min)**

**Option A \- Import Direct (Recommandé)**

`# Lancer recherche avec votre équation existante`  
`curl -X POST http://localhost:8080/api/search \`  
  `-H "Content-Type: application/json" \`  
  `-d '{`  
    `"project_id": "'$PROJECT_ID'",`  
    `"query": "VOTRE_ÉQUATION_PUBMED_ICI",`   
    `"databases": ["pubmed"],`  
    `"max_results_per_db": 500`  
  `}'`

`# Vérifier progression (répéter toutes les 30s)`  
`curl http://localhost:8080/api/projects/$PROJECT_ID/search-stats`

**Option B \- Import CSV Manuel (si vous avez déjà les résultats)**

`# Préparer CSV avec colonnes : title, abstract, authors, pmid, doi`  
`# Upload via interface web à http://localhost:8080`

**4️⃣ Configuration Profil IA Optimal (10 min)**

`# Créer profil "express" pour vitesse`  
`curl -X POST http://localhost:8080/api/profiles \`  
  `-H "Content-Type: application/json" \`  
  `-d '{`  
    `"name": "Express ATN",`  
    `"description": "Profil optimisé pour résultats rapides ATN",`  
    `"preprocess_model": "phi3:mini",`  
    `"extract_model": "llama3.1:8b",`   
    `"synthesis_model": "llama3.1:8b",`  
    `"temperature": 0.3`  
  `}'`

`# Télécharger modèles (en parallèle pendant autres tâches)`  
`curl -X POST http://localhost:8080/api/ollama/pull \`  
  `-d '{"model": "phi3:mini"}'`

`curl -X POST http://localhost:8080/api/ollama/pull \`  
  `-d '{"model": "llama3.1:8b"}'`

**5️⃣ Test Screening Échantillon (30 min)**

`# Récupérer premiers articles`  
`curl http://localhost:8080/api/projects/$PROJECT_ID/search-results?per_page=10`

`# Tester screening sur 10 articles`  
`curl -X POST http://localhost:8080/api/projects/$PROJECT_ID/run \`  
  `-H "Content-Type: application/json" \`  
  `-d '{`  
    `"articles": ["pmid1", "pmid2", "pmid3", "pmid4", "pmid5"],`  
    `"profile": "Express ATN",`  
    `"analysis_mode": "screening"`  
  `}'`

`# Vérifier résultats test`  
`curl http://localhost:8080/api/projects/$PROJECT_ID/extractions | jq '.[] | {pmid: .pmid, score: .relevance_score, decision: .relevance_justification}'`

**✅ Objectif Jour 1** : Système opérationnel, équation importée, test screening validé

**🎯 JOUR 2 : Production de Données**

**1️⃣ Screening Complet Express (1-2h)**

`# Récupérer tous les PMIDs trouvés`  
`curl http://localhost:8080/api/projects/$PROJECT_ID/search-results?per_page=1000 > all_results.json`

`# Extraire liste PMIDs (script Python rapide)`  
`python3 -c "`  
`import json`  
`with open('all_results.json') as f:`  
    `data = json.load(f)`  
`pmids = [r['article_id'] for r in data['results']]`  
`print(' '.join(f'\"{pmid}\"' for pmid in pmids[:100]))  # Batch de 100`  
`" > pmids_batch1.txt`

`# Lancer screening batch 1`  
`curl -X POST http://localhost:8080/api/projects/$PROJECT_ID/run \`  
  `-H "Content-Type: application/json" \`  
  `-d "{`  
    `\"articles\": [$(cat pmids_batch1.txt | tr ' ' ',')],`  
    `\"profile\": \"Express ATN\",`  
    `\"analysis_mode\": \"screening\"`  
  `}"`

**Monitoring Progress**

`# Script de monitoring (exécuter en boucle)`  
`watch -n 30 "curl -s http://localhost:8080/api/projects/$PROJECT_ID | jq '.processed_count, .pmids_count'"`

**2️⃣ Identification Articles Pertinents (30 min)**

`# Articles avec score ≥ 7 (seuil pertinence)`  
`curl "http://localhost:8080/api/projects/$PROJECT_ID/extractions" | \`  
  `jq '.[] | select(.relevance_score >= 7) | {pmid: .pmid, title: .title, score: .relevance_score}' > articles_pertinents.json`

`# Compter articles pertinents`  
`wc -l articles_pertinents.json`

**3️⃣ Création Grille ATN Express (20 min)**

`# Créer grille d'extraction ATN spécialisée`  
`curl -X POST http://localhost:8080/api/projects/$PROJECT_ID/grids \`  
  `-H "Content-Type: application/json" \`  
  `-d '{`  
    `"name": "ATN Express",`  
    `"fields": [`  
      `{"name": "Type_IA", "description": "Type système IA (chatbot, avatar, assistant)"},`  
      `{"name": "Population", "description": "Population étudiée"},`  
      `{"name": "Score_empathie_IA", "description": "Score empathie IA si mentionné"},`  
      `{"name": "Score_empathie_humain", "description": "Score empathie humain comparatif"},`  
      `{"name": "WAI_SR_score", "description": "Score Working Alliance Inventory"},`  
      `{"name": "Taux_adhésion", "description": "Taux adhésion/engagement patients"},`  
      `{"name": "Acceptabilité", "description": "Acceptabilité patients"},`  
      `{"name": "Barrières", "description": "Barrières identifiées"},`  
      `{"name": "Facilitateurs", "description": "Facilitateurs identifiés"},`  
      `{"name": "Outcomes", "description": "Résultats principaux"}`  
    `]`  
  `}' | jq .id`

**4️⃣ Extraction Détaillée Articles Clés (2-3h)**

`# Extraire PMIDs des 20 articles les plus pertinents`  
`python3 -c "`  
`import json`  
`with open('articles_pertinents.json') as f:`  
    `articles = [json.loads(line) for line in f]`  
`top_articles = sorted(articles, key=lambda x: x['score'], reverse=True)[:20]`  
`pmids = [a['pmid'] for a in top_articles]`  
`print(' '.join(f'\"{pmid}\"' for pmid in pmids))`  
`" > top_pmids.txt`

`# Extraction complète avec grille ATN`  
`curl -X POST http://localhost:8080/api/projects/$PROJECT_ID/run \`  
  `-H "Content-Type: application/json" \`  
  `-d "{`  
    `\"articles\": [$(cat top_pmids.txt | tr ' ' ',')],`  
    `\"profile\": \"Express ATN\",`   
    `\"analysis_mode\": \"full_extraction\",`  
    `\"custom_grid_id\": \"$GRID_ID\"`  
  `}"`

**5️⃣ Upload PDFs Disponibles (1h)**

`# Si vous avez des PDFs de vos tests précédents`  
`find /path/to/your/pdfs -name "*.pdf" -exec \`  
  `curl -X POST http://localhost:8080/api/projects/$PROJECT_ID/upload-pdfs-bulk \`  
  `-F "files=@{}" \;`

`# Indexer pour RAG`  
`curl -X POST http://localhost:8080/api/projects/$PROJECT_ID/index-pdfs`

**✅ Objectif Jour 2** : Screening complet, articles pertinents identifiés, extractions détaillées lancées

**📊 JOUR 3 : Synthèse et Livrables**

**1️⃣ Analyses Automatiques Express (1h)**

`# Diagramme PRISMA automatique`  
`curl -X POST http://localhost:8080/api/projects/$PROJECT_ID/run-analysis \`  
  `-d '{"type": "prisma_flow"}'`

`# Méta-analyse scores`  
`curl -X POST http://localhost:8080/api/projects/$PROJECT_ID/run-analysis \`  
  `-d '{"type": "meta_analysis"}'`

`# Scores ATN spécialisés`  
`curl -X POST http://localhost:8080/api/projects/$PROJECT_ID/run-analysis \`  
  `-d '{"type": "atn_scores"}'`

`# Génération discussion automatique`  
`curl -X POST http://localhost:8080/api/projects/$PROJECT_ID/run-discussion-draft`

**2️⃣ Export Données Thèse (30 min)**

`# Export spécialisé thèse ATN (avec graphiques HD)`  
`curl -o export_these_atn.zip \`  
  `http://localhost:8080/api/projects/$PROJECT_ID/export/thesis`

`# Export complet pour analyse`  
`curl -o export_complet.zip \`  
  `http://localhost:8080/api/projects/$PROJECT_ID/export`

`# Décompresser et organiser`  
`unzip export_these_atn.zip -d resultats_these/`  
`unzip export_complet.zip -d donnees_brutes/`

**3️⃣ Chat RAG pour Insights Rapides (1h)**

`# Questions clés pour votre thèse`  
`questions=(`  
  `"Quels sont les principaux types d'intelligence artificielle utilisés dans l'alliance thérapeutique?"`  
  `"Quels instruments de mesure sont utilisés pour évaluer l'alliance thérapeutique numérique?"`  
  `"Quelles sont les principales barrières à l'adoption de l'IA dans la relation thérapeutique?"`  
  `"Quels sont les scores d'empathie rapportés entre IA et humains?"`  
  `"Quelles populations ont été étudiées dans ces recherches?"`  
`)`

`# Poser questions automatiquement`  
`for question in "${questions[@]}"; do`  
  `echo "=== $question ==="`  
  `curl -X POST http://localhost:8080/api/projects/$PROJECT_ID/chat \`  
    `-H "Content-Type: application/json" \`  
    `-d "{\"question\": \"$question\"}"`  
  `sleep 10  # Attendre réponse`  
`done`

`# Récupérer historique complet`  
`curl http://localhost:8080/api/projects/$PROJECT_ID/chat-messages > insights_rag.json`

**4️⃣ Génération Outputs Rédaction (1-2h)**

**Tableau de Synthèse Articles Clés**

`# Générer CSV pour tableau articles`  
`curl http://localhost:8080/api/projects/$PROJECT_ID/extractions | \`  
  `jq -r '.[] | select(.relevance_score >= 7 and .extracted_data != null) |`   
    `[.pmid, .title, .relevance_score, (.extracted_data | fromjson | .Type_IA // "N/A"), (.extracted_data | fromjson | .Population // "N/A")] |`   
    `@csv' > tableau_articles_cles.csv`

`# Ajouter header`  
`echo "PMID,Titre,Score_Pertinence,Type_IA,Population" | cat - tableau_articles_cles.csv > temp && mv temp tableau_articles_cles.csv`

**Métriques ATN Agrégées**

`# Extraire métriques pour votre thèse`  
`python3 -c "`  
`import json, statistics`  
`with open('donnees_brutes/extractions.json') as f:`  
    `extractions = json.load(f)`

`scores_empathie_ia = []`  
`scores_empathie_humain = []`  
`types_ia = []`

`for ext in extractions:`  
    `if ext.get('extracted_data'):`  
        `data = json.loads(ext['extracted_data'])`  
        `if data.get('Score_empathie_IA'):`  
            `try:`  
                `scores_empathie_ia.append(float(data['Score_empathie_IA']))`  
            `except: pass`  
        `if data.get('Score_empathie_humain'):`  
            `try:`  
                `scores_empathie_humain.append(float(data['Score_empathie_humain']))`  
            `except: pass`  
        `if data.get('Type_IA'):`  
            `types_ia.append(data['Type_IA'])`

`print('=== MÉTRIQUES ATN POUR THÈSE ===')`  
`print(f'Articles avec données ATN: {len([e for e in extractions if e.get(\"extracted_data\")])}')`  
`print(f'Scores empathie IA (n={len(scores_empathie_ia)}): moyenne={statistics.mean(scores_empathie_ia) if scores_empathie_ia else \"N/A\"}')`  
`print(f'Scores empathie humain (n={len(scores_empathie_humain)}): moyenne={statistics.mean(scores_empathie_humain) if scores_empathie_humain else \"N/A\"}')`  
`print(f'Types IA les plus fréquents: {max(set(types_ia), key=types_ia.count) if types_ia else \"N/A\"}')`  
`" > metriques_atn_these.txt`

**✅ Objectif Jour 3** : Analyses complètes, exports prêts, métriques pour rédaction

**📋 Checklist Livrables Express**

**✅ Fichiers Produits (Fin Jour 3\)**

**Données Brutes**

* \[ \] `donnees_brutes/extractions.json` \- Toutes extractions

* \[ \] `donnees_brutes/search_results.json` \- Articles trouvés

* \[ \] `donnees_brutes/processing_log.json` \- Log complet

**Analyses**

* \[ \] `resultats_these/prisma_flow.png` \- Diagramme PRISMA HD

* \[ \] `resultats_these/meta_analysis_plot.png` \- Graphiques méta-analyse

* \[ \] `resultats_these/donnees_atn_these.xlsx` \- Données ATN structurées

**Synthèses**

* \[ \] `tableau_articles_cles.csv` \- Top articles avec métadonnées

* \[ \] `metriques_atn_these.txt` \- Métriques agrégées

* \[ \] `insights_rag.json` \- Réponses chat pour insights

**Rédaction**

* \[ \] Brouillon discussion automatique (dans export)

* \[ \] Checklist PRISMA-ScR complétée

* \[ \] Statistiques descriptives

**🎯 Utilisation Immédiate**

**Pour Rédaction Thèse**

1. **Diagramme PRISMA** → Section Méthodes

2. **Tableau articles clés** → Appendice/Résultats

3. **Métriques ATN** → Section Résultats quantitatifs

4. **Discussion automatique** → Base section Discussion

5. **Insights RAG** → Citations et arguments

**Pour Présentation**

1. **Graphiques méta-analyse** → Slides résultats

2. **Checklist PRISMA** → Validité méthodologique

3. **Stats descriptives** → Vue d'ensemble corpus

**🚨 Résolution Problèmes Express**

**Problème : Tâches RQ Bloquées**

`# Diagnostic rapide`  
`curl http://localhost:8080/api/tasks/status`  
`curl http://localhost:8080/api/queues/info`

`# Solution rapide`  
`docker-compose restart worker`  
`curl -X POST http://localhost:8080/api/queues/processing/clear`

**Problème : Ollama Modèles Manquants**

`# Vérifier modèles`  
`curl http://localhost:11434/api/tags`

`# Force download`  
`docker exec analylit-ollama-v4 ollama pull phi3:mini`  
`docker exec analylit-ollama-v4 ollama pull llama3.1:8b`

**Problème : Mémoire Insuffisante**

`# Monitoring ressources`  
`docker stats`

`# Solutions temporaires`  
`docker-compose restart ollama  # Libère mémoire GPU`  
`sudo sysctl vm.drop_caches=3   # Libère RAM système`

**📞 Support Express**

**Logs Debugging Critiques**

`# Erreurs critique uniquement`  
`docker-compose logs --tail=50 web worker | grep -i error`

`# Statut services essentiels`  
`docker-compose ps | grep -v "Up"`

**Commandes de Récupération**

`# Reset complet si nécessaire (ATTENTION: perte données)`  
`docker-compose down -v`  
`docker-compose up --build -d`  
`# Puis relancer import équation PubMed`

**🏆 Objectif Final (72h)**

**Vous devriez avoir** :

* ✅ **500-1000 articles** screenés automatiquement

* ✅ **20-50 articles pertinents** avec extraction ATN complète

* ✅ **Diagramme PRISMA** publication-ready

* ✅ **Métriques quantitatives** pour résultats thèse

* ✅ **Tableau synthèse** articles clés avec métadonnées

* ✅ **Draft discussion** basé sur corpus analysé

* ✅ **Insights RAG** pour argumentation thèse

**Prêt pour** :

* Rédaction sections Méthodes/Résultats

* Création tableaux/figures thèse

* Argumentation discussion basée données

* Validation méthodologique PRISMA-ScR

*🚀 Guide Express AnalyLit v4.1 \- De zéro à résultats exploitables en 72h*