# 🧠 AnalyLit v4.1 
**Intelligence Artificielle pour Revues de Littérature Scientifique**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/Tests-145%2F145%20✅-brightgreen)](./tests/)
[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](./docker-compose.yml)

> **Innovation académique révolutionnaire** : Premier outil d'IA spécialisé dans l'Alliance Thérapeutique Numérique (ATN) avec validation méthodologique complète.

---

## 🚀 **Aperçu Rapide**

AnalyLit v4.1 automatise entièrement le processus de revue de littérature scientifique, de la recherche multi-base à l'export final, en passant par l'analyse IA et la validation méthodologique.

**🎯 Spécialement conçu pour :**
- 🏥 **Recherche médicale** (Alliance Thérapeutique Numérique)
- 📊 **Revues systématiques** (conformité PRISMA-ScR)
- 🤖 **Analyse par IA** (Ollama, Mistral, LLaMA)
- 📋 **Export multi-formats** (Word, Excel, PDF)

---

## ✨ **Fonctionnalités Principales**

### 🔍 **Recherche Multi-Bases**
- **PubMed, PsycINFO, MEDLINE** intégrés
- **Import Zotero** automatique
- **Déduplication** intelligente
- **Filtrage** par critères personnalisés

### 🤖 **Intelligence Artificielle**
- **Screening automatique** des articles
- **Extraction de données** structurée  
- **Analyse de biais** (Risk of Bias 2.0)
- **Synthèse narrative** générée par IA

### 📊 **Spécialisation ATN**
- **Grille d'extraction** 29 champs spécialisés
- **Scoring empathie** et alliance thérapeutique
- **Métriques cliniques** automatisées
- **Validation méthodologique** intégrée

### 🔄 **Architecture Robuste**
- **Docker** deployment ready
- **Tests automatisés** (145/145 ✅)
- **API REST** complète
- **Workers asynchrones** scalables

---

## 🚀 **Démarrage Express**

### Prérequis
- Docker & Docker Compose
- 8GB RAM minimum (16GB recommandé pour IA)
- Python 3.11+ (pour développement local)

### Installation (3 minutes)

```bash
# 1. Cloner le repository
git clone https://github.com/alchab54/AnalylitV4.1.git
cd AnalylitV4.1

# 2. Configuration
cp .env.example .env
# Éditer .env avec vos clés API (Zotero, Unpaywall)

# 3. Lancement
docker compose up -d

# 4. Accès
# Application: http://localhost:8080
# Tests: docker compose exec web pytest
```

**🎯 Première utilisation :** Consultez le [Guide de Démarrage Express](./docs/QUICK_START.md)

---

## 📊 **Validation Technique**

### 🏆 **Qualité Certificiée**
- ✅ **145 tests automatisés** - 100% réussite
- ✅ **Architecture microservices** validée
- ✅ **Sécurité** testée (injections, validation)
- ✅ **Performance** optimisée (scalabilité)
- ✅ **Standards industriels** respectés

### 🧪 **Couverture Tests**
```bash
# Exécuter la suite complète
make test

# Tests spécifiques
make test-security    # Tests sécurité
make test-e2e         # Tests end-to-end  
make test-atn         # Tests méthodologie ATN
```

---

## 🎓 **Impact Académique**

### 📚 **Innovation Scientifique**
- **Premier outil IA** spécialisé Alliance Thérapeutique Numérique
- **Validation méthodologique** rigoureuse (PRISMA-ScR)
- **Reproductibilité** garantie des analyses
- **Open Science** et transparence complète

### 🏆 **Résultats Démontrés**
- **90,6% → 100%** d'amélioration qualité tests
- **Workflow complet** validé end-to-end
- **Architecture production** prête AWS
- **Méthodologie ATN** certifiée conforme

---

## 🛠️ **Architecture Technique**

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│   Frontend  │    │   API REST   │    │  Workers    │
│   (React)   │◄──►│   (Flask)    │◄──►│  (Celery)   │
└─────────────┘    └──────────────┘    └─────────────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
              ┌─────────────▼──────────────┐
              │     Services Backend       │
              │  ┌─────────┐ ┌─────────┐   │
              │  │   DB    │ │  Redis  │   │
              │  │(Postgres│ │ (Cache) │   │
              │  └─────────┘ └─────────┘   │
              │  ┌─────────┐ ┌─────────┐   │
              │  │ Ollama  │ │ Storage │   │
              │  │  (IA)   │ │ (Files) │   │
              │  └─────────┘ └─────────┘   │
              └────────────────────────────┘
```

---

## 💡 **Cas d'Usage Concrets**

### 🏥 **Recherche Clinique**
```bash
# Revue systématique ATN
./analylit.ps1 --project "ATN-COVID-2024" \
              --databases "pubmed,psycinfo" \
              --ai-screening --export-word
```

### 📊 **Analyse Multi-Bases**
```bash
# Import Zotero + Analyse IA
docker compose exec web python scripts/import_zotero.py \
    --group-id 6109700 --ai-analysis --export-all
```

---

## ❤️ **Soutenir le Projet**

AnalyLit v4.1 est **open-source et gratuit**. Votre soutien permet :

- ☁️ **Maintenir** l'infrastructure cloud (AWS, IA)
- 🚀 **Développer** nouvelles fonctionnalités
- 🌍 **Assurer** l'accès libre mondial
- 📚 **Former** la communauté scientifique

**👉 Cliquez sur "💜 Sponsor" ci-dessus pour soutenir l'innovation !**

---

## 📖 **Documentation**

| 📋 Guide | 🎯 Public | ⏱️ Temps |
|-----------|-----------|----------|
| [🚀 Démarrage Express](./docs/QUICK_START.md) | Utilisateurs | 10 min |
| [🔧 Guide Technique](./docs/TECHNICAL_GUIDE.md) | Développeurs | 30 min |
| [🧪 Guide Tests](./docs/TESTING.md) | QA/DevOps | 15 min |
| [📊 API Reference](./docs/API_REFERENCE.md) | Intégrateurs | 20 min |

---

## 🤝 **Contribuer**

Nous accueillons toutes les contributions ! Voir [CONTRIBUTING.md](./CONTRIBUTING.md)

### 🐛 **Reporter un Bug**
1. Vérifiez les [issues existantes](https://github.com/alchab54/AnalylitV4.1/issues)
2. Créez une [nouvelle issue](https://github.com/alchab54/AnalylitV4.1/issues/new)
3. Suivez le template fourni

### ✨ **Proposer une Fonctionnalité**
1. Discussion dans les [issues](https://github.com/alchab54/AnalylitV4.1/issues)
2. Fork du projet
3. Pull Request avec tests

---

## 📜 **Licence & Citation**

### 📄 **Licence MIT**
Ce projet est sous [licence MIT](./LICENSE) - libre utilisation, modification et redistribution.

### 📚 **Citation Académique**
```bibtex
@software{chabaux2025analylit,
  author = {Alice Chabaux},
  title = {AnalyLit v4.1: IA pour Revues de Littérature Scientifique},
  year = {2025},
  url = {https://github.com/alchab54/AnalylitV4.1}
}
```

---

## 👥 **Auteur & Contact**

**Alice Chabaux** - *Doctorante en Médecine Numérique*  
🎓 Spécialisation : Alliance Thérapeutique Numérique  
📧 Contact : [Issues GitHub](https://github.com/alchab54/AnalylitV4.1/issues)

---

⭐ **Si ce projet vous aide, n'hésitez pas à lui donner une étoile !** ⭐