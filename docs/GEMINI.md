 Plan de Réparation et Stabilisation Docker
Voici le plan à fournir à VSCode Code Assist.

Contexte et Diagnostic
Le but était de séparer la base de données de test de celle de développement. Cette tentative a introduit plusieurs problèmes :

Réinstallation des dépendances à chaque build : Le cache Docker est cassé car la copie du code se fait trop tôt dans Dockerfile.base.

Échec du migrator : Le service migrator a des dépendances incorrectes et une commande invalide dans docker-compose.yml.

Complexité inutile : L'ajout d'une base de données de test complique la CI/CD et le développement local sans bénéfice crucial pour la thèse.

Décision Stratégique
ABANDON de la séparation de la DB de test. RETOUR à une architecture unique, stable et éprouvée. L'objectif est la fiabilité absolue.

Plan de Réparation en 3 Étapes
Étape 1 : Réparer Dockerfile.base pour Cacher les Dépendances
Fichier : docker/Dockerfile.base

Problème : COPY . /app copie tout le code avant le pip install, ce qui casse le cache Docker à chaque modification de n'importe quel fichier.

Solution : Copier uniquement requirements.txt, installer les dépendances, puis copier le reste du code.

Étape 2 : Simplifier et Réparer docker-compose.yml
Fichier : docker-compose.yml

Problème 1 : Le service migrator est complexe, fragile et redondant.

Solution 1 : Supprimer complètement le service migrator. L'initialisation de la DB et les migrations seront gérées directement par le service web au démarrage.

Problème 2 : Les dépendances entre services (depends_on) sont incorrectes et trop complexes.

Solution 2 : Simplifier les dépendances. Le web et le worker ne dépendent que de db et redis.

Problème 3 : Les chemins vers les Dockerfiles sont incorrects (ils ne sont plus à la racine).

Étape 3 : Intégrer les Migrations dans le Point d'Entrée du web
Fichier : docker/entrypoint.sh (nouveau fichier à créer)

Problème : Les migrations ne sont plus lancées nulle part si on supprime le migrator.

Solution : Créer un script entrypoint.sh qui sera le nouveau point d'entrée du service web. Ce script attendra que la base de données soit prête, appliquera les migrations (flask db upgrade), puis lancera le serveur Gunicorn.

