# Guide de Développement

## Configuration de l'Environnement

### Prérequis
- Python 3.11+
- Node.js 16+
- Docker et Docker Compose
- Git

### Installation Locale
```
# Cloner le projet
git clone https://github.com/alchab54/AnalylitV4.1.git
cd AnalylitV4.1

# Configuration Python
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

pip install -r requirements.txt

# Configuration Frontend
cd web
npm install
```

## Structure du Code

### Backend (Python)
```
api/                    # Points d'entrée REST
├── projects.py         # Gestion des projets
├── search.py          # Recherche multi-bases
└── analysis.py        # Analyses et exports

backend/               # Logique métier
├── database.py        # Modèles SQLAlchemy
├── tasks.py          # Tâches asynchrones
└── utils.py          # Fonctions utilitaires

migrations/           # Évolutions de schéma
tests/               # Tests automatisés
```

### Frontend (JavaScript)
```
web/js/              # Code JavaScript modulaire
├── api.js           # Communication avec le backend
├── ui.js            # Interface utilisateur
├── projects.js      # Gestion des projets
└── analysis.js      # Fonctionnalités d'analyse

web/css/             # Styles CSS
web/templates/       # Templates HTML
```

## Tests

### Backend
```
# Tous les tests
pytest

# Tests spécifiques
pytest tests/test_api.py
pytest tests/test_tasks.py

# Avec couverture
pytest --cov=backend
```

### Frontend
```
# Tests unitaires
npm test

# Tests end-to-end
npm run test:e2e

# Mode développement (watch)
npm run test:watch
```

## Conventions de Code

### Python
- Style PEP 8
- Type hints recommandés
- Docstrings pour les fonctions publiques
- Tests pour toute nouvelle fonctionnalité

### JavaScript
- Style ES6+
- Modules séparés par fonctionnalité
- JSDoc pour les fonctions complexes
- Tests unitaires pour la logique métier

### Git
- Commits descriptifs en français
- Branches feature pour les nouvelles fonctionnalités
- Pull requests pour les changements majeurs

## Ajout de Nouvelles Fonctionnalités

### Backend
1. Créer les modèles de données (si nécessaire)
2. Implémenter la logique métier
3. Créer les endpoints API
4. Ajouter les tests correspondants
5. Mettre à jour la documentation

### Frontend
1. Créer les éléments d'interface
2. Implémenter la logique d'interaction
3. Connecter aux APIs backend
4. Ajouter les tests d'interface
5. Valider l'accessibilité

## Débogage

### Logs
```
# Application
docker-compose logs web

# Base de données
docker-compose logs db

# IA
docker-compose logs ollama

# Tous les services
docker-compose logs -f
```

### Outils
- Debugger Python intégré
- Console développeur du navigateur
- Logs Docker pour les services
- Monitoring PostgreSQL via adminer (si activé)

## Déploiement

### Environnement de Test
```
docker-compose -f docker-compose.test.yml up
```

### Production (Recommandations)
- Utiliser des volumes Docker persistants
- Configurer les sauvegardes de base de données
- Monitorer les performances et l'usage mémoire
- Implémenter la rotation des logs

## Contributions

Les contributions suivent l'esprit open source du projet :
- Fork du repository
- Branches feature descriptives
- Tests pour toute modification
- Documentation mise à jour
- Pull request avec description détaillée