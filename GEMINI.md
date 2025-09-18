# Problème : Conflit d'initialisation de Gunicorn et Flask

Mon application Docker Compose pour AnalylitV4.1 est presque fonctionnelle.

**État Actuel (Succès) :**
1.  Le conteneur `analylit-db-v4` démarre et reste "healthy".
2.  Le script `entrypoint.sh` du conteneur `analylit-web-v4` réussit à se connecter à la base de données (`Base de données prête !`).
3.  L'initialisation Python (`_init_db_command()`) s'exécute une fois avec succès via le script shell.
4.  Le serveur Gunicorn démarre et écoute sur le port 5001.

**Le Problème Final (Échec) :**
1.  Dès que Gunicorn démarre ses workers (nous en avons 3), chaque worker ré-importe `server_v4_complete.py`.
2.  Le fichier `server_v4_complete.py` contient un appel global (au niveau du module) à `app_globals.initialize_app()`.
3.  Par conséquent, l'application tente de se ré-initialiser 3 fois de plus (une fois par worker), ce qui entre en conflit avec l'initialisation déjà effectuée par `entrypoint.sh`.
4.  Ce conflit corrompt l'état de l'application Flask, ce qui fait que toutes les routes API (comme `/api/settings/profiles`) renvoient `404 Not Found`.
5.  Le `healthcheck` de Docker Compose (qui vise `/api/settings/profiles`) reçoit un `404`, échoue et marque le conteneur `web` comme "unhealthy", arrêtant ainsi le déploiement.

**Objectif :**
Modifier `server_v4_complete.py` pour empêcher l'initialisation globale `app_globals.initialize_app()` de s'exécuter lors de l'importation par les workers de Gunicorn. L'initialisation doit être *uniquement* gérée par notre appel explicite dans `entrypoint.sh`.

---

## Résumé de la résolution

**Problème : Conflit d'initialisation de Gunicorn et Flask**

L'application subissait un conflit d'initialisation lors du démarrage avec Gunicorn. Le script `entrypoint.sh` réalisait une première initialisation de la base de données, mais la fonction `create_app()` dans `server_v4_complete.py` effectuait également une initialisation.

Lorsque Gunicorn démarrait ses workers, chaque worker importait le module `server_v4_complete` et appelait `create_app()`, ce qui provoquait des ré-initialisations multiples. Ce conflit corrompait l'état de l'application Flask, entraînant des erreurs `404 Not Found` sur les routes de l'API et l'échec du healthcheck de Docker Compose.

**Solution : Suppression de l'initialisation redondante**

La solution a été de supprimer le bloc d'initialisation redondant dans la fonction `create_app()` du fichier `server_v4_complete.py`. L'initialisation est maintenant uniquement gérée par le script `entrypoint.sh` avant le lancement de Gunicorn, ce qui garantit qu'elle n'est effectuée qu'une seule fois.
