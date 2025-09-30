# Guide de Démarrage Rapide - AnalyLit v4.1

Ce guide vous aide à installer et à lancer votre premier projet avec AnalyLit en quelques minutes.

## Installation (5 minutes)

### 1. Pré-requis Validés
```
# Vérifier Docker
docker --version          # >= 20.10
docker-compose --version  # >= 2.0

# Ressources recommandées  
# RAM: 8GB minimum (16GB pour IA)
# Disque: 10GB libres
# CPU: 4 cores recommandés
```

### 2. Clone & Configuration
```
# Clone repository
git clone https://github.com/alchab54/AnalylitV4.1.git
cd AnalylitV4.1

# Configuration express
cp .env.example .env

# Éditer variables essentielles
echo "SECRET_KEY=$(openssl rand -hex 32)" >> .env
echo "UNPAYWALL_EMAIL=votre.email@domaine.com" >> .env
```

### 3. Lancement Production
```
# Démarrage complet (tous services)
docker-compose -f docker-compose-complete.yml up -d --build

# Vérification santé (attendre 2 minutes)
curl http://localhost:8080/api/health
# ✅ Réponse: {"status": "healthy", "services": "all_ready"}
```

## 🎯 Validation Installation (2 minutes)

### Tests Automatiques
```
# Tests critiques (30 secondes)
docker-compose exec web pytest tests/test_server_endpoints.py -v

# Tests ATN spécialisés (1 minute)  
docker-compose exec web pytest tests/test_atn_*.py -v

# Résultat attendu: All tests PASSED ✅
```

### Interface Web
1. **Ouvrir** : http://localhost:8080
2. **Vérifier** : Navigation visible et responsive
3. **Créer** : Nouveau projet de test
4. **Confirmer** : WebSocket connecté (indicateur vert)

## 🧠 Premier Projet ATN (8 minutes)

### 1. Création Projet (1 minute)
```
// Via interface web ou API
{
  "name": "Test ATN - Premier Projet",
  "description": "Alliance Thérapeutique Numérique - Validation",
  "mode": "screening"
}
```

### 2. Recherche Multi-Bases (3 minutes)
```
# Interface web: Section Recherche
Requête: "therapeutic alliance artificial intelligence"
Bases: ✅ PubMed ✅ CrossRef ✅ arXiv  
Résultats: 100 par base
```

### 3. Screening IA ATN (3 minutes)
```
# Traitement automatique avec profil ATN
- Modèle: llama3.1:8b (recommandé)
- Template: ATN spécialisé (29 champs)
- Scoring: Empathie IA vs Humain
```

### 4. Validation Résultats (1 minute)
```
# Vérifications
✅ Articles trouvés: 50-300 (selon bases)
✅ Score pertinence: 0-10 (ATN spécialisé)  
✅ Champs extraits: TypeIA, ScoreEmpathie, WAI-SR
✅ Export disponible: Excel + PDF
```

## 📊 Résultats Attendus

### Métriques Typiques
```
📈 Recherche Réussie
├── 📚 150-500 articles trouvés
├── 🎯 20-50 articles pertinents (score >7)
├── 🧠 Extraction ATN: 29 champs spécialisés
├── ✅ Validation: Kappa Cohen disponible
└── 📤 Export: Formats multiples ready
```

### Fichiers Générés
```
results/
├── 📄 articles_pertinents.xlsx    # Données structurées
├── 📊 diagramme_prisma.png       # Workflow visuel  
├── 📈 analyses_atn.json          # Métriques spécialisées
├── 📚 bibliographie.txt          # Citations formatées
└── 📋 rapport_validation.html    # Dashboard complet
```

## 🏥 Cas d'Usage Thèse

### Pipeline Thèse Complet
```
# Workflow automatisé 3-5 jours
./scripts/thesis-pipeline.sh \
    --project "These-ATN-2025" \
    --search "alliance thérapeutique intelligence artificielle" \
    --databases "pubmed,crossref,arxiv,ieee" \
    --ai-profile "deep" \
    --validation-kappa \
    --export-thesis
```

### Livrables Thèse
- ✅ **Diagramme PRISMA** publication-ready
- ✅ **Tableau synthèse** articles inclus  
- ✅ **Métriques ATN** (empathie, alliance, acceptabilité)
- ✅ **Validation inter-évaluateurs** Kappa Cohen
- ✅ **Bibliographie** styles standards (APA, Vancouver)

## 🛠️ Résolution Problèmes Express

### Problème: Services ne démarrent pas
```
# Diagnostic
docker-compose ps
docker-compose logs web db

# Solution
docker-compose down -v
docker-compose up --build --force-recreate
```

### Problème: IA non accessible  
```
# Vérifier Ollama
curl http://localhost:11434/api/tags

# Télécharger modèles
docker-compose exec ollama ollama pull llama3.1:8b
docker-compose exec ollama ollama pull phi3:mini
```

### Problème: Tests échouent
```
# Re-run tests avec détails
docker-compose exec web pytest tests/ -v --tb=long

# Tests par domaine si problème spécifique
docker-compose exec web pytest tests/test_atn_scoring.py -v
```

## 📈 Monitoring Production

### Santé Services
```
# Vérification complète
curl http://localhost:8080/api/health | jq . 

# Métriques performance
curl http://localhost:8080/api/metrics | jq . 

# Files de tâches
curl http://localhost:8080/api/queues/info | jq . 
```

### Logs Temps Réel
```
# Logs applicatifs
docker-compose logs -f web

# Logs IA/Ollama  
docker-compose logs -f ollama

# Logs base données
docker-compose logs -f db
```

## 🎓 Support & Formation

### Documentation Avancée
- 📚 [Manuel Technique Complet](./TECHNICAL_GUIDE.md)
- 🧪 [Guide Tests 149 Validés](./TESTING.md)  
- 📊 [Référence API](./API_REFERENCE.md)
- 🎓 [Guide Thèse ATN](./THESIS_MANUAL.md)

### Communauté & Support
- **GitHub Issues** : Support technique expert
- **Discussions** : Questions méthodologiques  
- **Wiki** : Cas d'usage documentés
- **Webinaires** : Formation utilisation

---

**🏆 AnalyLit v4.1 - Excellence Validée - Production Ready**

*De zéro à résultats ATN professionnels en 15 minutes*