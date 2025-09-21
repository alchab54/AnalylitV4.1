# 🚀 Démarrage Express - AnalyLit v4.1

Guide pratique pour utiliser AnalyLit v4.1 et obtenir des résultats exploitables en **moins de 30 minutes**.

## ⚡ Installation Express (5 minutes)

### Prérequis Système
- **Docker Desktop** installé et démarré
- **8GB RAM** minimum (16GB recommandé)
- **10GB espace disque** libre
- **Connexion internet** stable

### 1. Téléchargement
```bash
# Clone du projet
git clone https://github.com/alchab54/AnalylitV4.1.git
cd AnalylitV4.1
```

### 2. Configuration Rapide
```bash
# Copie configuration
cp .env.example .env

# IMPORTANT: Éditez .env pour ajouter vos clés
nano .env  # ou votre éditeur préféré
```

**🔑 Clés requises (gratuites):**
- `UNPAYWALL_EMAIL`: Votre email
- `ZOTERO_API_KEY`: Optionnel pour import Zotero

### 3. Lancement
```bash
# Démarrage complet
docker compose up -d

# Vérification
docker compose ps
```

**✅ Prêt !** Application accessible : http://localhost:8080

---

## 📋 Premier Projet (10 minutes)

### Étape 1: Créer un Projet
1. Ouvrez http://localhost:8080
2. Cliquez **"Nouveau Projet"**
3. Remplissez :
   - **Nom**: "Mon premier projet ATN"
   - **Description**: "Test AnalyLit v4.1"
   - **Type**: "Alliance Thérapeutique Numérique"

### Étape 2: Configuration Recherche
```json
{
  "query": "artificial intelligence therapeutic alliance",
  "databases": ["pubmed"],
  "date_range": "2020-2024",
  "max_results": 50
}
```

### Étape 3: Lancement
1. Cliquez **"Lancer la Recherche"**
2. Attendez la progression (2-3 minutes)
3. Résultats disponibles dans **"Articles trouvés"**

### Étape 4: Screening IA
1. Activez **"Screening Automatique"**
2. Critères d'inclusion suggérés appliqués
3. Articles pertinents sélectionnés automatiquement

---

## 🤖 Analyse IA Avancée (10 minutes)

### Configuration Modèle IA
```bash
# Modèles disponibles par défaut
- llama3:8b (rapide, recommandé)
- mistral:7b (équilibré)
```

### 1. Extraction Automatique
- **Données démographiques** extraites
- **Méthodologie** analysée  
- **Résultats** synthétisés
- **Grille ATN** complétée automatiquement

### 2. Analyse de Biais
- **Risk of Bias 2.0** appliqué
- **Scoring automatique** généré
- **Recommandations** d'amélioration

### 3. Synthèse Narrative
- **Résumé exécutif** généré par IA
- **Points clés** extraits
- **Recommandations cliniques** formulées

---

## 📊 Export Résultats (5 minutes)

### Formats Disponibles
```bash
# Export Word complet
Clic "Export" → "Rapport Word"

# Export Excel données
Clic "Export" → "Données Excel" 

# Export PDF présentation
Clic "Export" → "Présentation PDF"
```

### Contenu Export
- ✅ **Méthodologie** complète
- ✅ **Diagramme PRISMA** généré
- ✅ **Tableau extraction** formaté
- ✅ **Analyse statistique** descriptive
- ✅ **Références bibliographiques**

---

## 🎯 Cas d'Usage Avancés

### Recherche Multi-Bases
```javascript
// Configuration avancée
{
  "databases": ["pubmed", "psycinfo", "medline"],
  "query_strategy": "comprehensive",
  "deduplication": "automatic",
  "language_filter": ["en", "fr"]
}
```

### Import Zotero
```bash
# Depuis interface
1. Menu "Import" → "Zotero"
2. Group ID: [votre_group_id]
3. API Key: [votre_api_key]
4. Import automatique
```

### Analyses Spécialisées ATN
- **Empathy Scoring Algorithm** activé
- **Therapeutic Alliance Metrics** calculées
- **Clinical Outcomes** analysés
- **Patient-Reported Measures** extraites

---

## 🔧 Dépannage Express

### Problèmes Courants

**🚨 Port 8080 occupé**
```bash
# Changer le port
sed -i 's/8080:8080/8081:8080/' docker-compose.yml
docker compose up -d
# → http://localhost:8081
```

**🚨 Erreur mémoire**
```bash
# Augmenter limite Docker
# Docker Desktop → Settings → Resources → Memory: 8GB+
```

**🚨 Modèle IA indisponible**
```bash
# Télécharger modèle manuellement
docker compose exec ollama ollama pull llama3:8b
```

### Vérifications Santé
```bash
# Status services
docker compose ps

# Logs erreurs
docker compose logs web
docker compose logs worker

# Tests rapides
docker compose exec web python -m pytest tests/test_health.py
```

### Reset Complet
```bash
# En cas de problème majeur
docker compose down -v  # ⚠️ Supprime données
docker system prune -a
git pull origin main
docker compose up -d --build
```

---

## 📚 Étapes Suivantes

### Approfondissement
- 📖 [Guide Technique Complet](./TECHNICAL_GUIDE.md)
- 🧪 [Guide Tests & Validation](./TESTING.md)  
- 📊 [API Reference](./API_REFERENCE.md)

### Personnalisation
- ⚙️ Configuration modèles IA avancés
- 🔗 Intégration outils externes
- 📈 Métriques et monitoring
- ☁️ Déploiement cloud (AWS)

### Communauté
- 🤝 [Contribuer au projet](../CONTRIBUTING.md)
- 🐛 [Signaler un bug](https://github.com/alchab54/AnalylitV4.1/issues)
- 💡 [Proposer des améliorations](https://github.com/alchab54/AnalylitV4.1/discussions)

---

## 🎉 Félicitations !

Vous maîtrisez maintenant les bases d'AnalyLit v4.1. En **30 minutes**, vous avez :

- ✅ **Installé** une plateforme d'IA médicale
- ✅ **Créé** votre premier projet de recherche
- ✅ **Analysé** des articles scientifiques par IA
- ✅ **Exporté** des résultats professionnels
- ✅ **Découvert** les fonctionnalités avancées

**🚀 Prêt pour des analyses de niveau recherche !**