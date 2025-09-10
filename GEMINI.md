# Instructions pour le projet AnalyLit v4.1

## Contexte du projet
Ceci est une application web pour ma thèse de médecine générale sur l'impact de l'alliance thérapeutique numérique (ATN). L'objectif est de réaliser une revue de littérature systématique (scoping review) de A à Z avec cet outil.

## Stack Technique
- **Backend**: Python 3.11 avec Flask et SQLAlchemy. Les tâches asynchrones sont gérées par RQ (Redis Queue).
- **Base de données**: PostgreSQL.
- **Frontend**: JavaScript vanilla (ES6+), HTML5, CSS3. Pas de framework comme React ou Vue.js.
- **IA**: Modèles de langage locaux servis via Ollama.

## Conventions de code
- Le fichier principal du frontend est `web/app.js`. Il gère l'état global dans l'objet `appState`.
- Les fonctionnalités frontend sont progressivement externalisées dans le dossier `web/js/` pour plus de modularité.
- La logique backend asynchrone est dans `tasks_v4_complete.py`.
- Le schéma de la base de données et les routes API sont définis dans `server_v4_complete.py`.
- Toutes les interactions avec la base de données doivent utiliser SQLAlchemy Core (requêtes textuelles) pour la simplicité.

## Objectifs actuels
L'objectif est d'ajouter une section "Rapports & Exports" dédiée à la finalisation de la thèse. Cette section doit inclure :
1.  **Un générateur de bibliographie** (format APA/Vancouver).
2.  **Un générateur de tableaux de synthèse** des études incluses (exportable en Excel).
3.  **Une checklist PRISMA-ScR interactive** pour assurer la conformité de la rédaction.

**Priorité** : La robustesse et la fiabilité des fonctionnalités sont primordiales pour le travail de thèse. Le code doit être clair et maintenable.
