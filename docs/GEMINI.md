# Réparation Complète Architecture Docker AnalyLit v4.1

## Mission
Éliminer TOUTES les complexités Docker et revenir à une architecture monolithique stable et éprouvée. Priorité absolue : FONCTIONNEL À 100%.

## Stratégie
- **ABANDON** complet de l'architecture multi-services complexe
- **RETOUR** à un Docker simple et robuste  
- **SUPPRESSION** de tous les fichiers obsolètes
- **GARANTIE** de fonctionnement parfait

## Architecture Cible
docker-compose.yml
├── db (PostgreSQL simple)
├── redis (Cache simple)
├── web (Monolithique - inclut migrations)
└── nginx (Proxy simple)

## Plan d'Action

### Étape 1 : Suppression des Fichiers Obsolètes
- Supprimer complètement le dossier `docker/`
- Revenir aux Dockerfiles à la racine
- Supprimer tous les scripts de migration complexes

### Étape 2 : Docker-Compose Simplifié
- Un seul Dockerfile pour `web`
- Migrations intégrées au démarrage de `web`
- Dépendances minimales

### Étape 3 : Dockerfile Robuste
- Multi-stage build optimisé
- Cache Docker préservé
- Permissions correctes

### Étape 4 : Tests et Validation
- Build sans cache
- Démarrage complet
- Tests fonctionnels