# AnalyLit v4.1

Application web de revue de littérature systématique avec assistance IA pour la recherche académique.

## À propos

Cette application a été développée dans le cadre d'une thèse doctorale pour faciliter l'analyse de la littérature scientifique sur l'Alliance Thérapeutique Numérique. Elle s'appuie sur les ressources librement accessibles d'Internet et les avancées en intelligence artificielle pour automatiser certaines tâches de recherche documentaire tout en maintenant la rigueur académique nécessaire.

## Remerciements

Ce projet n'existerait pas sans :
- Les contributeurs des projets open source utilisés (Flask, SQLAlchemy, Ollama, etc.)
- Les bases de données scientifiques ouvertes (PubMed, arXiv, Crossref)
- La communauté de développement qui partage librement ses connaissances
- Les chercheurs qui rendent leurs travaux accessibles
- Tous ceux qui contribuent à rendre l'information scientifique disponible

## Fonctionnalités

### Recherche et Import
- Recherche simultanée dans plusieurs bases de données (PubMed, arXiv, Crossref)
- Import depuis Zotero (JSON/RIS)
- Déduplication automatique des articles

### Analyse Assistée
- Extraction de données avec assistance IA (Ollama)
- Screening semi-automatique des articles
- Évaluation du risque de biais (échelle Cochrane)
- Analyses statistiques de base

### Export et Documentation
- Export vers Excel avec tableaux de synthèse
- Génération de diagrammes PRISMA
- Sauvegarde des décisions de validation

## Statut du Projet

**⚠️ Important :** Cette application est en phase de développement et de test. L'exactitude et la pertinence des résultats d'analyse n'ont pas encore été validées de manière exhaustive. Les utilisateurs doivent vérifier manuellement tous les résultats critiques.

## Installation

### Prérequis
- Docker et Docker Compose
- **Sur Windows :** [Git for Windows](https://git-scm.com/download/win) pour avoir le terminal **Git Bash**.
- 8 GB RAM minimum
- GPU NVIDIA recommandé pour Ollama (optionnel)

### Démarrage Rapide

Toutes les commandes doivent être exécutées depuis un terminal **Git Bash** sur Windows, ou un terminal standard sur macOS/Linux.

```
git clone https://github.com/alchab54/AnalylitV4.1.git
cd AnalylitV4.1
docker-compose up -d --build
```

L'application sera accessible à http://localhost:5000

### Vérification
```
# Test de santé de l'API
curl http://localhost:5000/api/health

# Status des services
docker-compose ps
```

## Architecture Technique

### Services
- **Web** : Application Flask (Python)
- **Database** : PostgreSQL avec schéma dédié
- **Cache** : Redis pour les sessions et files d'attente
- **Workers** : Traitement asynchrone des tâches
- **IA** : Ollama pour l'assistance à l'analyse
- **Tests** : Base PostgreSQL dédiée

### Structure du Code
```
├── api/                 # Endpoints REST
├── backend/             # Logique métier et tâches
├── web/                 # Interface utilisateur
├── migrations/          # Schéma base de données
├── tests/              # Suite de tests
└── docker-compose.yml   # Configuration services
```

## Test de Validation Suggéré

Pour valider les capacités de recherche, vous pouvez tester avec cette équation PubMed :

```
("Therapeutic Alliance"[Mesh] OR "therapeutic alliance"[tiab] OR "working alliance"[tiab] OR "treatment alliance"[tiab]) AND ("Digital Technology"[Mesh] OR "Virtual Reality"[Mesh] OR "Virtual Reality Exposure Therapy"[Mesh] OR "Artificial Intelligence"[Mesh] OR "Empathy"[Mesh] OR "Digital Health"[Mesh] OR mHealth[tiab] OR eHealth[tiab] OR digital*[tiab] OR virtual*[tiab] OR "artificial intelligence"[tiab] OR chatbot*[tiab] OR "empathy"[tiab]) AND ("2020/01/01"[Date - Publication] : "2025/06/25"[Date - Publication])
```

## Tests

```
# Tests unitaires backend
docker-compose exec web pytest

# Tests frontend
npm test

# Tests end-to-end
npm run test:e2e
```

## Développement

### Variables d'Environnement
Copiez `.env.example` vers `.env` et ajustez selon votre configuration.

### Logs
```
# Logs en temps réel
docker-compose logs -f

# Logs spécifiques
docker-compose logs web
docker-compose logs ollama
```

## Limitations Connues

- Les résultats d'analyse IA nécessitent une validation manuelle
- La qualité des extractions dépend du modèle Ollama utilisé
- Certaines fonctionnalités nécessitent une connexion Internet
- L'interface n'a pas encore été testée sur tous les navigateurs

## Contribution

Les contributions sont bienvenues. Ce projet bénéficie de l'esprit de partage de la communauté open source.

## Licence

[Préciser la licence choisie]

## Support

Pour les questions techniques, consultez la documentation dans le dossier `docs/` ou ouvrez une issue sur GitHub.