# Architecture Technique

## Vue d'Ensemble

AnalyLit utilise une architecture microservices basée sur Docker, conçue pour être modulaire et facilement déployable.

## Services Principaux

### Application Web (Flask)
- **Port** : 5000
- **Technologie** : Flask avec architecture factory pattern
- **Responsabilités** :
  - API REST pour l'interface utilisateur
  - Orchestration des tâches asynchrones
  - Gestion des sessions utilisateur

### Base de Données (PostgreSQL)
- **Port** : 5432
- **Schéma** : `analylit_schema`
- **Fonctionnalités** :
  - Stockage des projets et articles
  - Gestion des extractions et validations
  - Historique des analyses

### Cache et Files d'Attente (Redis)
- **Port** : 6379
- **Usage** :
  - Cache des sessions
  - Files d'attente RQ pour tâches asynchrones
  - Communication inter-services

### Intelligence Artificielle (Ollama)
- **Port** : 11434
- **Configuration** :
  - Support GPU NVIDIA (optionnel)
  - Modèles de langage configurables
  - API REST pour interactions

## Flux de Données

1. **Recherche** : Interface → API → Workers → Bases externes → Base locale
2. **Analyse** : Interface → API → Worker IA → Ollama → Résultats
3. **Export** : Interface → API → Générateur → Fichiers

## Configuration Réseau

Les services communiquent via un réseau Docker interne. Seul le port 5000 est exposé publiquement.

## Sécurité

- Isolation des services via Docker
- Validation des entrées utilisateur
- Échappement des données pour prévenir XSS
- Requêtes paramétrées contre l'injection SQL