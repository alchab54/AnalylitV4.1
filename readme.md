# **AnalyLit v4.1**

**Un outil de recherche IA robuste et performant pour les revues de littérature systématiques et exploratoires (scoping reviews).**

<p align="center">
  <img src="https://raw.githubusercontent.com/alichabaux/AnalyLit/main/assets/dashboard.png" alt="Tableau de bord AnalyLit" width="700">
</p>

AnalyLit v4.1 est une application web complète conçue pour automatiser et rationaliser le processus complexe des revues de littérature. Développée pour répondre aux exigences de la recherche académique, elle intègre une suite d'outils basés sur l'IA (via Ollama) pour accompagner le chercheur de la collecte des articles à la synthèse finale. Le code a été entièrement refactorisé pour garantir une **robustesse**, une **sécurité** et une **performance** de niveau professionnel.

## **✨ Fonctionnalités Principales**

* **Gestion de Projets :** Isolez chaque revue de littérature dans un projet dédié avec son propre corpus et ses analyses.  
* **Recherche Multi-Bases :** Lancez des recherches fédérées sur des bases de données académiques majeures comme PubMed, arXiv, CrossRef et IEEE Xplore.  


### Mode de Recherche Hybride : Simple et Experte

AnalyLit combine deux modes de recherche pour s'adapter à vos besoins :

1.  **Recherche Simple (par défaut)**
    * Idéale pour des recherches rapides et exploratoires.
    * Entrez simplement vos mots-clés (ex: `cancer AND treatment`).
    * AnalyLit se charge de traduire cette requête simple pour chaque base de données sélectionnée (PubMed, Scopus, etc.) en utilisant leurs champs de recherche par défaut.

2.  **Recherche Experte (Avancée)**
    * Conçue pour les revues systématiques et les recherches de haute précision.
    * Activez le mode "Recherche Experte" pour révéler des champs de saisie distincts pour chaque base de données.
    * Vous pouvez alors coller votre équation de recherche complète et optimisée, en utilisant la syntaxe spécifique de chaque base (ex: `(cancer[MeSH Terms] OR cancer[Title/Abstract])` pour PubMed et `TITLE-ABS-KEY(cancer) AND ...` pour Scopus).
    * AnalyLit exécute votre équation exacte sans aucune traduction, garantissant une
  
* **Pipeline d'Analyse IA :**   

  * **Screening Automatisé :** L'IA évalue la pertinence des articles sur la base des titres et résumés.  
  * **Extraction Détaillée :** L'IA remplit des grilles d'extraction personnalisables à partir du texte intégral des PDF.  

* **Module de Double Codage :** Implémentez un processus de validation par un pair avec un cycle Export CSV \-\> Import CSV et calculez automatiquement le **coefficient Kappa de Cohen** pour mesurer la fiabilité de l'accord.  

* **Synthèse Intelligente :** Générez des brouillons de sections "Discussion" et des synthèses des conclusions clés.

* **Analyses Avancées :**  
  * Générez un diagramme de flux **PRISMA** en un clic.  
  * Effectuez des **méta-analyses** et des **statistiques descriptives** sur vos données.  
  * Créez un **graphe de connaissances** pour visualiser les relations entre les concepts et les articles.  
  * **Analyse ATN multipartite** : Une analyse spécialisée pour l'Alliance Thérapeutique Numérique.

* **Chat RAG avec vos Documents :** Après avoir indexé vos PDF, dialoguez avec votre corpus pour poser des questions précises et obtenir des réponses synthétiques basées sur vos documents.  

* **Gestion des Prompts et Profils IA :** Personnalisez les prompts et les modèles de langage (LLM) utilisés pour chaque étape via l'interface, ou revenez aux versions par défaut robustes codées en dur.  

* **Intégration Zotero & Récupération de PDF :** Importez des références depuis Zotero et lancez une recherche automatisée des PDF en libre accès via Unpaywall.

## **✅ Améliorations de Qualité et de Robustesse**

Le projet a bénéficié d'une refactorisation complète pour améliorer sa fiabilité et sa maintenabilité :

*   **Backend Robuste :**
    *   **Sécurité Renforcée :** Validation systématique des entrées (UUIDs) et protection contre les attaques de type *Path Traversal*.
    *   **Gestion d'Erreurs Fiable :** Gestion centralisée des sessions de base de données et logging détaillé avec stack traces pour un débogage rapide.
    *   **Performances Optimisées :** Utilisation de traitement par lots (*batch processing*) pour les insertions massives en base de données et optimisation des requêtes SQL.
    *   **Appels Réseau Résilients :** Stratégie de nouvel essai (*retry*) automatique pour les appels aux API externes (Ollama, etc.).
*   **Frontend Modulaire :**
    *   **Code Organisé :** Le code JavaScript a été entièrement modularisé pour une meilleure lisibilité et maintenabilité.
    *   **Gestion d'État Prévisible :** Un gestionnaire d'état centralisé garantit que l'interface utilisateur est toujours synchronisée avec les données.
    *   **Gestion d'Événements Moderne :** Suppression des `onclick` au profit d'un système de délégation d'événements performant et propre.

## **🏛️ Architecture**

AnalyLit v4.1 est construit sur une architecture microservices robuste et scalable, orchestrée par Docker Compose.

* **nginx** : Reverse proxy qui sert le frontend statique et route les requêtes /api et /socket.io vers le backend.  
* **web** : Le serveur principal en **Flask** et **Gunicorn**, qui expose l'API RESTful et gère les connexions **Socket.IO** pour la communication en temps réel.  
* **worker** : Un ou plusieurs workers **RQ (Redis Queue)** qui exécutent toutes les tâches longues en arrière-plan (recherches, analyses IA, imports) pour garantir une interface utilisateur toujours réactive.  
* **db** : Une base de données **PostgreSQL** pour un stockage des données fiable et performant.  
* **redis** : Agit comme *message broker* pour les files d'attente RQ et pour la communication Socket.IO.  
* **ollama** : Le service qui fait tourner les modèles de langage locaux (LLMs), avec support GPU.

```mermaid
graph TD
    subgraph "Utilisateur"
        U[🌐 Navigateur Client]
    end

    subgraph "Infrastructure Docker"
        N[/"nginx (Reverse Proxy)"/]
        W[🚀 web (Flask/Gunicorn)]
        WK[🛠️ worker (RQ)]
        R[📦 redis (Broker)]
        DB[(🐘 db (PostgreSQL))]
        O[🧠 ollama (LLM)]
    end

    U -- HTTPS --> N
    N -- /api, /socket.io --> W
    N -- / (fichiers statiques) --> W
    W -- Crée Tâches --> R
    W <--> DB
    WK -- Lit Tâches --> R
    WK -- Appelle IA --> O
    WK <--> DB
```

## **🛠️ Stack Technique**

* **Backend :** Python 3.11, Flask, SQLAlchemy, Gunicorn  
* **Frontend :** JavaScript (ES6+ Modules), HTML5, CSS3  
* **Tâches Asynchrones :** Redis, RQ (Redis Queue)  
* **Base de Données :** PostgreSQL  
* **Communication Temps Réel :** Flask-SocketIO  
* **IA :** Ollama  
* **Déploiement :** Docker, Docker Compose, Nginx, Gunicorn

## **🚀 Installation & Lancement**

### **Prérequis**

* [Docker](https://www.docker.com/products/docker-desktop/)  
* [Docker Compose](https://docs.docker.com/compose/install/)  
* (Optionnel mais recommandé) Un GPU NVIDIA avec les drivers à jour et le [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html) pour l'accélération matérielle des modèles IA.

### **Étapes d'Installation**

1.  **Clonez le dépôt :**
    ```bash
    git clone https://github.com/alichabaux/AnalyLit.git
    cd [NOM_DU_DOSSIER]
    ```

2.  **Configurez votre environnement :**
    *   Copiez le fichier d'exemple `env.example` vers un nouveau fichier nommé `.env`.
        ```bash
        cp env.example .env
        ```

    *   Ouvrez le fichier `.env` et remplissez les variables, notamment :
        *   `SECRET_KEY` : Générez une clé secrète aléatoire (ex: `openssl rand -hex 32`).
        *   `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` : Vos identifiants pour la base de données.

3.  **Construisez et lancez les conteneurs :**
    *   Cette commande va construire les images Docker et démarrer tous les services en arrière-plan.
        ```bash
        docker-compose -f docker-compose-local.yml up -d --build
        ```

    *   Pour scaler les workers (par exemple, pour en avoir 3) :
        ```bash
        docker-compose -f docker-compose-local.yml up -d --build --scale worker=3
        ```

4.  **Accédez à l'application :**
    *   Ouvrez votre navigateur et allez à l'adresse : **http://localhost:8080**

5.  **Surveillez les logs :**
    *   Pour voir les logs de tous les services en temps réel :
        ```bash
        docker-compose -f docker-compose-local.yml logs -f
        ```

    *   Pour voir les logs d'un service spécifique (ex: le serveur web) :
        ```bash
        docker-compose -f docker-compose-local.yml logs -f web
        ```

## **📖 Commandes Utiles**

Le projet inclut un `Makefile` pour simplifier la gestion des commandes Docker.

*   **Démarrer l'application :**
    ```bash
    make start
    ```
*   **Arrêter l'application :**
    ```bash
    make stop
    ```
*   **Voir les logs en temps réel :**
    ```bash
    make logs-follow
    ```
*   **Télécharger les modèles IA de base (Ollama) :**
    ```bash
    make models
    ```
*   **Lancer la suite de tests :**
    ```bash
    make test
    ```

Pour la liste complète des raccourcis, utilisez `make help`.

## **📁 Structure du Projet**

```
.  
├── Dockerfile-nginx  
├── Dockerfile.base              # Image de base pour web et worker
├── Dockerfile-web-complete  
├── Dockerfile-worker-complete  
├── Makefile.mk                  # Commandes de gestion du projet
├── README.md                    # Ce fichier
├── analylit.sh                  # Script de gestion pour les systèmes non-Make
├── config_v4.py                 # Configuration centrale de l'application
├── docker-compose-local.yml     # Orchestration des services Docker
├── env.example                  # Modèle pour les variables d'environnement
├── requirements.txt             # Dépendances Python
├── pytest.ini                   # Configuration pour Pytest
├── profiles.json                # Configuration externalisée des profils IA
├── server_v4_complete.py        # Serveur principal Flask (API & Socket.IO)
├── tasks_v4_complete.py         # Logique des tâches asynchrones RQ
├── utils/                       # Modules utilitaires partagés
│   ├── __init__.py
│   ├── ai_processors.py
│   ├── analysis.py
│   ├── fetchers.py
│   ├── file_handlers.py
│   ├── helpers.py
│   ├── importers.py
│   ├── notifications.py
│   ├── prisma_scr.py
│   ├── prompt_templates.py
│   └── reporting.py
└── web/                         # Frontend modulaire de l'application
    ├── app.js  
    ├── js/                      # Modules JavaScript
    ├── index.html  
    └── style.css
```

## **💾 Gestion des Données & Persistance**

La persistance des données est gérée par des **volumes Docker**, ce qui garantit que vos données ne sont pas perdues lorsque les conteneurs sont arrêtés ou recréés.

*   **`postgres_data_v4`** : Stocke toutes les données de la base de données PostgreSQL (projets, articles, extractions, etc.).
*   **`ollama_data_v4`** : Met en cache les modèles de langage téléchargés pour éviter de devoir les retélécharger à chaque redémarrage.
*   **`./projects` (dossier local)** : Ce dossier est monté directement dans les conteneurs `web` et `worker`. Il contient tous les fichiers spécifiques aux projets, comme les PDF importés, les images générées (PRISMA, graphes) et les bases de données vectorielles ChromaDB pour le RAG.

**Pour sauvegarder votre application**, il vous suffit de copier le contenu du volume `postgres_data_v4` et le dossier local `projects/`.

## **🐛 Dépannage**

*   **Erreur de mémoire Ollama (`out of memory`)** : Si vous rencontrez cette erreur dans les logs d'Ollama, cela signifie que votre GPU n'a pas assez de VRAM pour charger le modèle demandé. Essayez d'utiliser des modèles plus petits (ex: `phi3:mini` au lieu de `llama3.1:8b`).
*   **Le worker ne démarre pas ou boucle** : Vérifiez les logs du worker (`make logs-worker`). Une erreur fréquente est une mauvaise configuration dans `.env` (ex: `REDIS_URL` incorrect) ou une dépendance manquante.
*   **L'interface web ne se charge pas (`502 Bad Gateway`)** : Cela signifie généralement que le service `web` n'a pas démarré correctement. Vérifiez ses logs (`make logs-web`) pour identifier la cause (souvent une erreur de syntaxe en Python ou un problème de connexion à la base de données).

## **📜 Licence**

Ce projet est sous licence MIT.