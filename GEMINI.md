\# Instructions pour le projet AnalyLit v4.1



\## Contexte du projet

Ceci est une application web pour ma thèse de médecine générale sur l'alliance thérapeutique numérique (ATN). L'objectif est de réaliser une revue de littérature systématique (scoping review).



\## Stack Technique

\- \*\*Backend\*\*: Python 3.11, Flask, SQLAlchemy, RQ (Redis Queue).

\- \*\*Base de données\*\*: PostgreSQL.

\- \*\*Frontend\*\*: JavaScript vanilla (pas de React/Vue), HTML5, CSS3.

\- \*\*IA\*\*: Modèles locaux via Ollama.



\## Conventions de code

\- Le fichier principal du frontend est `web/app.js` et gère l'état global dans l'objet `appState`.

\- La logique backend asynchrone est dans `tasks\_v4\_complete.py`.

\- Le schéma de la base de données est défini dans `server\_v4\_complete.py`.



\## Objectifs actuels

\- \*\*Refactoring progressif de `app.js`\*\* : Externaliser les fonctionnalités non-stables (validation, settings, chat) dans des fichiers séparés dans `web/js/` avant de toucher au noyau fonctionnel.

\- \*\*Priorité\*\* : Stabiliser l'application pour la collecte de données de la thèse. Ne pas introduire de changements risqués qui pourraient retarder la production.

