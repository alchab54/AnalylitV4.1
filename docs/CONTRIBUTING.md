# 🤝 Guide de Contribution - AnalyLit v4.1

Merci de votre intérêt pour contribuer à AnalyLit v4.1 ! Ce guide vous explique comment participer efficacement au développement de ce projet innovant.

## 🎯 Types de Contributions Bienvenues

### 🐛 **Rapports de Bugs**
- Interface utilisateur défaillante
- Erreurs d'analyse IA
- Problèmes d'import/export
- Dysfonctionnements Docker

### ✨ **Nouvelles Fonctionnalités**
- Intégrations bases de données supplémentaires
- Nouveaux formats d'export
- Améliorations IA/ML
- Optimisations performance

### 📚 **Documentation**
- Guides utilisateur
- Tutoriels techniques
- Traductions
- Exemples d'usage

### 🧪 **Tests & Qualité**
- Tests automatisés supplémentaires
- Tests de performance
- Validation méthodologique
- Sécurité & robustesse

## 🚀 Démarrage Rapide pour Contributeurs

### 1. **Setup Environnement**

```bash
# Fork + Clone
git clone https://github.com/VOTRE_USERNAME/AnalylitV4.1.git
cd AnalylitV4.1

# Configuration développement
cp .env.example .env
# Éditer .env avec vos clés de test

# Installation dépendances
pip install -r requirements.txt
pip install -r requirements-dev.txt  # Outils développement

# Lancement environnement
docker compose up -d
```

### 2. **Tests Locaux**

Avant de soumettre votre code, assurez-vous que tous les tests passent.

```bash
# Lancer tous les tests backend (Python/Pytest)
docker-compose exec web pytest

# Lancer un fichier de test backend spécifique
docker-compose exec web pytest tests/test_server_endpoints.py -v

# Lancer les tests unitaires frontend (JavaScript/Jest)
docker-compose exec web npm run test:unit

# Lancer les tests End-to-End (Cypress) en mode headless
docker-compose exec web npm run test:e2e
```

### 3. **Standards Code**

```bash
# Formatage automatique
black .
isort .

# Linting
flake8 analylit/
pylint analylit/

# Type checking
mypy analylit/
```

## 📋 Processus de Contribution

### 1. **Avant de Commencer**
- [ ] Cherchez dans les [issues existantes](https://github.com/alchab54/AnalylitV4.1/issues)
- [ ] Créez une nouvelle issue pour discuter des changements majeurs
- [ ] Assignez-vous l'issue ou commentez votre intention

### 2. **Développement**
```bash
# Branche feature
git checkout -b feature/nom-fonctionnalite

# Développement avec commits atomiques
git commit -m "feat: ajout intégration Scopus"
git commit -m "test: tests unitaires Scopus API"
git commit -m "docs: documentation API Scopus"
```

### 3. **Tests & Validation**
```bash
# Tests complets avant PR
make test-all
make lint
make security-check

# Validation manuelle
docker compose up --build
# Tester la fonctionnalité dans l'interface
```

### 4. **Pull Request**
- [ ] Titre clair et descriptif
- [ ] Description détaillée des changements
- [ ] Screenshots/vidéos si interface
- [ ] Liens vers les issues résolues
- [ ] Tests ajoutés/mis à jour

### ✅ **Règle d'Or pour les Tests**
N'utilisez **JAMAIS** `db_session.commit()` dans un test. Utilisez `db_session.flush()` si vous avez besoin de persister des données pour les lire dans le même test. La fixture `db_session` gère automatiquement le `rollback` pour garantir l'isolation.


## 📝 Standards de Code

### **Convention Commits**
```
feat: nouvelle fonctionnalité
fix: correction bug
docs: documentation
style: formatage, style
refactor: refactoring code
test: ajout/modification tests
chore: tâches maintenance
```

### **Architecture Python**
```python
# Structure module
analylit/
├── api/           # Endpoints REST
├── core/          # Logique métier
├── models/        # Models données
├── services/      # Services externes
├── utils/         # Utilitaires
└── tests/         # Tests unitaires
```

### **Tests Requis**
- [ ] **Tests unitaires** pour nouvelle logique
- [ ] **Tests d'intégration** pour APIs externes
- [ ] **Tests end-to-end** pour workflows complets
- [ ] **Tests sécurité** pour endpoints sensibles

## 🔬 Domaines de Contribution Prioritaires

### 🎯 **Intelligence Artificielle**
- Intégration nouveaux modèles (Claude, GPT-4)
- Optimisation prompts méthodologiques
- Amélioration scoring empathie/ATN
- Validation résultats IA

### 🌐 **Intégrations Externes**
- Nouvelles bases de données scientifiques
- APIs gestion bibliographique (Mendeley, EndNote)
- Services cloud (AWS, GCP, Azure)
- Outils statistiques (R, SPSS)

### 🏥 **Méthodologie Médicale**
- Grilles d'extraction spécialisées
- Conformité guidelines internationales
- Validation statistique automatisée
- Export formats académiques

### ⚡ **Performance & Scalabilité**
- Optimisation requêtes base de données
- Cache intelligent résultats IA
- Parallélisation traitements
- Monitoring & alerting

## 🤝 Code de Conduite

Ce projet suit le [Contributor Covenant](https://www.contributor-covenant.org/). En participant, vous vous engagez à respecter ce code.

### Comportements Encouragés
- ✅ Langage bienveillant et inclusif
- ✅ Respect des différences d'opinion
- ✅ Feedback constructif et professionnel
- ✅ Focus sur l'amélioration collective

### Comportements Inacceptables
- ❌ Langage offensant ou discriminatoire
- ❌ Attaques personnelles ou trolling
- ❌ Harcèlement public ou privé
- ❌ Partage d'informations privées sans autorisation

## 🆘 Besoin d'Aide ?

### 💬 **Discussion & Questions**
- [GitHub Issues](https://github.com/alchab54/AnalylitV4.1/issues) - Questions techniques
- [GitHub Discussions](https://github.com/alchab54/AnalylitV4.1/discussions) - Idées & échanges

### 📚 **Ressources**
- [Guide Technique Complet](./docs/TECHNICAL_GUIDE.md)
- [Documentation API](./docs/API_REFERENCE.md)
- [Architecture Docker](./docker-compose.yml)

### 🐛 **Rapporter un Problème**
Utilisez le [template d'issue](https://github.com/alchab54/AnalylitV4.1/issues/new/choose) avec :
- Description claire du problème
- Étapes de reproduction
- Environnement (OS, version Docker, etc.)
- Logs et captures d'écran

---

## 🎉 Reconnaissance

Tous les contributeurs sont reconnus dans :
- [Liste des contributeurs GitHub](https://github.com/alchab54/AnalylitV4.1/graphs/contributors)  
- Section remerciements du README principal
- Changelog des versions

**Merci de contribuer à l'avenir de la recherche scientifique ouverte !** 🚀