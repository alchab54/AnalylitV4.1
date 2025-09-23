# Améliorations apportées à AnalyLit V4.1

## Fonctionnalité de téléchargement de modèles Ollama

- **Interface utilisateur** : Ajout d'une section dans les paramètres pour gérer les modèles IA. Elle permet de sélectionner un modèle depuis une liste et de lancer le téléchargement.
- **Backend** : 
    - Ajout d'un endpoint API `/api/ollama/pull` pour lancer le téléchargement d'un modèle en tâche de fond via RQ.
    - Ajout d'un endpoint API `/api/ollama/models` pour lister les modèles Ollama installés localement.
- **Tâches asynchrones** : Création d'une nouvelle file d'attente (`models`) pour gérer les téléchargements de modèles.
