# Restructuration Docker Optimale AnalyLit v4.1

## Objectifs
1. Image de base partagée pour éviter réinstallations multiples
2. Architecture propre avec dossier docker/
3. Cache Docker préservé à 100%
4. GitHub organisé professionnellement

## Plan d'Action

### Étape 1 : Créer la Structure Docker Propre
- Créer dossier `docker/` à la racine
- Déplacer tous les Dockerfiles dans `docker/`
- docker-compose.yml reste à la racine

### Étape 2 : Image de Base Optimisée
- `docker/Dockerfile.base` avec toutes les dépendances
- Multi-stage build pour optimiser le cache
- Installation dépendances Python uniquement

### Étape 3 : Images Dérivées Légères  
- `docker/Dockerfile.web` hérite de l'image base
- `docker/Dockerfile.worker` hérite de l'image base
- Copie uniquement le code applicatif

### Étape 4 : Docker-Compose Intelligent
- Construit d'abord l'image base
- web et worker dépendent de cette base
- Cache préservé entre les builds

### Étape 5 : Nettoyage Fichiers Obsolètes
