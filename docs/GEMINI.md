GEMINI.MD - Architecture Docker Optimisée avec Image de Base
text
# Architecture Docker Optimisée AnalyLit v4.1 - Image de Base Partagée

## Objectif
Créer une architecture Docker professionnelle qui :
- Utilise une image `base` commune pour éviter les réinstallations
- Organise les Dockerfiles dans le dossier `docker/`
- Maintient `docker-compose.yml` à la racine pour facilité d'usage
- Garantit un cache Docker optimal et un GitHub propre

## Architecture Cible
/
├── docker-compose.yml ← Racine (facilité d'usage)
├── docker/
│ ├── Dockerfile.base ← Image commune avec dépendances
│ ├── Dockerfile.web ← Service web (hérite de base)

│ ├── Dockerfile.nginx ← Proxy (optionnel)
│ └── entrypoint.sh ← Script démarrage avec migrations
text

## Avantages
- ✅ **Performance** : Dépendances installées 1 seule fois
- ✅ **Cache** : Docker réutilise l'image `base` 
- ✅ **Maintenance** : Modifications code ne triggent pas pip install
- ✅ **GitHub** : Structure propre et professionnelle
- ✅ **Évolutivité** : Facile d'ajouter de nouveaux services

## Plan d'Implémentation
1. Créer `docker/Dockerfile.base` optimisé cache
2. Créer `docker/Dockerfile.web` lightweight  
3. Créer `docker/Dockerfile.worker` lightweight
4. Créer `docker/entrypoint.sh` avec migrations
5. Configurer `docker-compose.yml` avec dépendances correctes