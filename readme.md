# **AnalyLit v4.1**

**Un outil de recherche IA avancé pour les revues de littérature systématiques et exploratoires.**

\[Image d'un tableau de bord d'application d'analyse de données\]

AnalyLit v4.1 est une application web complète conçue pour automatiser et rationaliser le processus complexe des revues de littérature. Développée pour répondre aux exigences de la recherche académique, elle intègre une suite d'outils basés sur l'IA (via Ollama) pour accompagner le chercheur de la collecte des articles à la synthèse finale.

## **✨ Fonctionnalités Principales**

* **Gestion de Projets :** Isolez chaque revue de littérature dans un projet dédié avec son propre corpus et ses analyses.  
* **Recherche Multi-Bases :** Lancez des recherches fédérées sur des bases de données académiques majeures comme PubMed, arXiv, CrossRef, et IEEE Xplore.  
* **Pipeline d'Analyse IA :**  
  * **Screening Automatisé :** L'IA évalue la pertinence des articles sur la base des titres et résumés.  
  * **Extraction Détaillée :** L'IA remplit des grilles d'extraction personnalisables à partir du texte intégral des PDF.  
* **Module de Double Codage :** Implémentez un processus de validation par un pair avec un cycle Export CSV \-\> Import CSV et calculez automatiquement le **coefficient Kappa de Cohen** pour mesurer la fiabilité de l'accord.  
* **Analyses Avancées :**  
  * Générez un diagramme de flux **PRISMA** en un clic.  
  * Effectuez des **méta-analyses** et des **statistiques descriptives** sur vos données.  
  * Créez un **graphe de connaissances** pour visualiser les relations entre les concepts.  
* **Chat RAG avec vos Documents :** Après avoir indexé vos PDF, dialoguez avec votre corpus pour poser des questions précises et obtenir des réponses synthétiques basées sur vos documents.  
* **Gestion des Prompts et Profils IA :** Personnalisez les prompts et les modèles de langage (LLM) utilisés pour chaque étape via l'interface, ou revenez aux versions par défaut robustes codées en dur.  
* **Intégration Zotero & Récupération de PDF :** Importez des références depuis Zotero et lancez une recherche automatisée des PDF en libre accès via Unpaywall.

## **🏛️ Architecture**

AnalyLit v4.1 est construit sur une architecture micro-services robuste et scalable, orchestrée par Docker Compose.

\[Image d'une architecture web micro-services\]

* **nginx** : Reverse proxy qui sert le frontend statique et route les requêtes /api et /socket.io vers le backend.  
* **web** : Le serveur principal en **Flask** et **Gunicorn**, qui expose l'API RESTful et gère les connexions **Socket.IO** pour la communication en temps réel.  
* **worker** : Un ou plusieurs workers **RQ (Redis Queue)** qui exécutent toutes les tâches longues en arrière-plan (recherches, analyses IA, imports) pour garantir une interface utilisateur toujours réactive.  
* **db** : Une base de données **PostgreSQL** pour un stockage des données fiable et performant.  
* **redis** : Agit comme message broker pour les files d'attente RQ et pour la communication Socket.IO.  
* **ollama** : Le service qui fait tourner les modèles de langage locaux (LLMs), avec support GPU.

## **🛠️ Stack Technique**

* **Backend :** Python 3.11, Flask, SQLAlchemy  
* **Frontend :** JavaScript (Vanilla), HTML5, CSS3  
* **Tâches Asynchrones :** Redis, RQ (Redis Queue)  
* **Base de Données :** PostgreSQL  
* **Communication Temps Réel :** Flask-SocketIO  
* **IA :** Ollama  
* **Déploiement :** Docker, Docker Compose, Nginx, Gunicorn

## **🚀 Installation et Lancement**

### **Prérequis**

* [Docker](https://www.docker.com/products/docker-desktop/)  
* [Docker Compose](https://docs.docker.com/compose/install/)  
* (Optionnel mais recommandé) Un GPU NVIDIA avec les drivers à jour et le [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html) pour l'accélération matérielle des modèles IA.

### **Étapes d'Installation**

1. **Clonez le dépôt :**  
   git clone \[URL\_DU\_DEPOT\]  
   cd \[NOM\_DU\_DOSSIER\]

2. **Configurez votre environnement :**  
   * Copiez le fichier d'exemple .env.example vers un nouveau fichier nommé .env.  
     cp env.example .env

   * Ouvrez le fichier .env et remplissez les variables, notamment :  
     * SECRET\_KEY : Générez une clé secrète aléatoire.  
     * POSTGRES\_USER, POSTGRES\_PASSWORD, POSTGRES\_DB : Vos identifiants pour la base de données.  
     * ZOTERO\_USER\_ID, ZOTERO\_API\_KEY : Vos informations Zotero si vous souhaitez utiliser cette fonctionnalité.  
3. **Construisez et lancez les conteneurs :**  
   * Cette commande va construire les images Docker et démarrer tous les services en arrière-plan.

   docker-compose \-f docker-compose-local.yml up \-d \--build

   * Pour scaler les workers (par exemple, pour en avoir 3\) :

docker-compose \-f docker-compose-local.yml up \-d \--build \--scale worker=3

4. **Accédez à l'application :**  
   * Ouvrez votre navigateur et allez à l'adresse : **http://localhost:8080**  
5. **Surveillez les logs :**  
   * Pour voir les logs de tous les services en temps réel :

   docker-compose \-f docker-compose-local.yml logs \-f

   * Pour voir les logs d'un service spécifique (ex: le serveur web) :

docker-compose \-f docker-compose-local.yml logs \-f web

## **📖 Utilisation**

Le guide d'utilisation complet pour mener une revue de littérature avec l'application se trouve dans le document AnalyLit\_v4.1\_Revue\_Finale\_et\_Guide.md.

## **📁 Structure du Projet**

.  
├── Dockerfile-nginx  
├── Dockerfile-web-complete  
├── Dockerfile-worker-complete  
├── README\_complete.md  
├── config\_v4.py                 \# Configuration centrale de l'application  
├── docker-compose-local.yml     \# Orchestration des services Docker  
├── env.example                  \# Modèle pour les variables d'environnement  
├── requirements.txt             \# Dépendances Python  
├── server\_v4\_complete.py        \# Serveur principal Flask (API & Socket.IO)  
├── tasks\_v4\_complete.py         \# Logique des tâches asynchrones RQ  
├── utils/                       \# Modules utilitaires partagés  
│   ├── \_\_init\_\_.py  
│   ├── ai\_processors.py  
│   ├── fetchers.py  
│   ├── file\_handlers.py  
│   ├── helpers.py  
│   ├── notifications.py  
│   └── prompt\_templates.py  
└── web/                         \# Frontend de l'application (SPA)  
    ├── app.js  
    ├── index.html  
    └── style.css

## **📜 Licence**

Ce projet est sous licence MIT.