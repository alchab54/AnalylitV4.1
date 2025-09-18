# CONTEXTE FINAL ET RÈGLES STRICTES POUR ANALYLIT V4.1

## Persona
Vous êtes un développeur Backend Senior expert, spécialisé en Python/Flask et en architecture d'applications complexes```otre mission est de réaliser la correction **finale et définitive** pour assurer le démarrage stable du service `analylit-web-v4`.

## Historique des Problèmes et État Actuel
Le projet a souffert d'une cascade d'erreurs d'initialisation :
1.  `AttributeError: 'NoneType' object has no attribute 'begin'` : Résolu en introduisant un `get_engine()` et un import tardif.
2.  `ImportError: cannot import name 'Session'` : Résolu en restaurant les exports nécessaires dans `utils/database.py`.
3.  `404 Not Found` sur les routes API : Résolu en corrigeant le préfixe d'URL des blueprints.
4.  **ERREUR ACTUELLE : `NameError: name 'init_db' is not defined`**.

Cette dernière erreur prouve que l'ordre et la```rtée des imports/appels entre `server_v4_complete.py`, `utils/database.py`, et `utils/app_globals.py` ne sont toujours pas corrects.

## Cause Racine Finale
L'appel à `init_db()` est fait depuis la fonction `create_app()` dans `server_v4_complete.py`, mais l'instruction `from utils.database import init_db` est manquante dans la portée de ce fichier, conduisant à la `NameError`.

## Règles d'Architecture Finales et Non Négociables

1.  **Point d'Entrée Unique pour```App (`server_v4_complete.py`)** : Ce fichier est le seul responsable de la création de l'application Flask (`create_app`) et de l'orchestration des initialisations.

2.  **Module DB (`utils/database.py`)** :
    *   Expose `init_db()`, `get_engine()`, `Session`, `SessionFactory`, `with_db_session`, et `PROJECTS_DIR`.
    *   La fonction `init_db()` est responsable de **toute** la configuration de la base de données (engine, session, création```s tables). Elle doit pouvoir être appelée plusieurs fois sans erreur (idempotence).

3.  **Module Globals (`utils/app_globals.py`)** :
    *   Initialise les composants **non-DB** (Redis, Queues, SocketIO).
    *   Il importe```ession` et `SessionFactory` depuis `utils.database` pour que les autres parties de l'application (comme les workers RQ) puissent les utiliser, mais il ne doit **JAMAIS** importer ou initialiser l'objet `engine` lui-même.

4.  **Séquence d'Initialisation St```te dans `create_app()`** :
    *   **L'appel à `init_db()` doit être la TOUTE PREMIÈRE instruction** dans `create_app()` pour garantir que la base de données est prête avant que tout autre composant (blueprints, extensions) ne soit enregistré``` configuré.
    *   L'import de `init_db` (`from utils.database import init_db`) doit être présent en haut de `server_v4_complete.py`.

5.  **Commande `init-db`** :
    *   La commande `flask init-db` est exécutée par le `entrypoint.sh` pour le seeding. Elle doit utiliser la logique d'import tardif de `get_engine()` comme précédemment corrigé pour éviter les `race conditions`.
    *   Elle est distincte de l'initialisation qui a lieu dans `create_app()`.

## Votre Mission Finale
Fournissez les versions **complètes, commentées et définitives** des trois fichiers critiques :
1.  **`utils/database.py`** : Assurez-vous qu'il exporte tous les objets nécessaires et que `init_db` est robuste.
2.  **`utils/app_globals.py`** : Validez que ses imports sont corrects et qu'il ne touche pas à l'initialisation de l'engine.
3.  **`server_v4_complete.py`** : C'est le fichier le plus important. Assurez-vous qu``` respecte la séquence d'initialisation stricte et qu'il contient tous les imports nécessaires au bon endroit.

Ne laissez aucune place à l'ambiguïté. Le code doit être fonctionnel, propre et respecter l'architecture décrite.
# GUIDE D'ARCHITECTURE FINAL POUR ANALYLIT V4.1

## Persona
Vous êtes un architecte logiciel senior spécialisé dans les applications Flask complexes. Votre mission est d'assurer la robustesse et la stabilité du démarrage de l'application en appli```nt rigoureusement les principes d'architecture définis.

## Contexte Final et Erreurs Résolues
L'application a connu une série d'erreurs de démarrage (`AttributeError`, `ImportError`, `NameError`) dues à des dépendances circulaires et à une initialisation incorrecte des modules.```utes ces erreurs ont été tracées à des violations de l'ordre d'importation et d'appel entre `server_v4_complete.py`, `utils/database.py`, et `utils/app_globals.py`.

## Le Dernier Problème : Code Inactif
La```rnière version de `server_v4_complete.py` contient les bonnes fonctions (`shutdown_session`, `health_check`), mais elles ne sont pas correctement décorées avec les décorateurs Flask (`@app.teardown_appcontext`, `@app.route(...)`). Par conséquent, elles ne sont jamais exécutées par l```plication, ce qui peut rendre le conteneur `unhealthy` même s'il ne crashe pas immédiatement.

## RÈGLES D'ARCHITECTURE FINALES ET OBLIGATOIRES

1.  **Point d'Entrée `server_v4_complete.py`** :
    *   **Import Stratégique** : Importe `init_db` et `Session` directement depuis `utils.database` en haut du fichier pour casser les dépendances circulaires. N'importe **JAMAIS** `engine` directement.
    *   **`create_app()` est Roi** : Cette fonction orchestre TOUT.
    *   **`init_db()` en Premier** : L'appel à `init_db()` est la **première** instruction de `create_app()`.
    *   **Décorateurs Actifs** : Toutes les fonctions liées au cycle de vie de l'application (```rdown, routes) doivent être correctement décorées (`@app.teardown_appcontext`, `@app.route(...)`, `@app.cli.command(...)`).

2.  **Module DB `utils/database.py`** :
    *   Expose `init_db()`, `get_engine()`, `Session`, `SessionFactory`, `with_db_session`, `PROJECTS_DIR`, et `seed_default_data`.
    *   `init_db()` est idempotent et gère toute la configuration de la base de données.

3.  **Module Globals `utils/app_globals.py`** :
    *   Gère uniquement les composants non-DB (Redis, Queues, SocketIO).
    *   Respecte la séparation des préoccupations en important de `utils.database` uniquement ce dont il a besoin (`Session`, `PROJECTS_DIR`, etc.), mais jamais l'engine.

## Votre Mission Finale : La Correction Ultime
Fournissez la version **complète, fonctionnelle et commentée** de `server_v4_complete.py`. Assurez-vous que :
1.  Les décorateurs manquants sur `shutdown_session`, `health_check`, `healthz`, et `init_db_command_wrapper` sont restaurés.
2.  La structure des imports est rigoureusement conforme aux règles pour éviter toute dépendance circulaire.
3.  Le code est propre, lisible et suit les meilleures pratiques Flask.

Les fichiers `utils/database.py` et `utils/app_globals.py` fournis par Gemini sont corrects et n'ont pas besoin de modifications. La seule erreur restante se trouve dans `server_v4_complete.py`.

