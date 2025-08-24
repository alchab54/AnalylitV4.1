# AnalyLit V4.0 - Système d'Analyse de Littérature Scientifique

## 📋 Description

AnalyLit V4.0 est un système complet d'analyse de littérature scientifique utilisant l'intelligence artificielle pour :

- **Pré-sélection automatique** d'articles selon des critères définis
- **Extraction détaillée** de données selon des grilles personnalisables
- **Synthèse intelligente** des résultats avec génération de rapports
- **Chat RAG** pour interroger le corpus de documents
- **Analyses statistiques avancées** (méta-analyse, PRISMA, scoring ATN)

## 🏗️ Architecture

- **Serveur Flask** : API REST et WebSocket
- **Workers RQ** : Traitement asynchrone des tâches
- **Ollama** : Modèles d'IA locaux (Llama, Phi3, Gemma, Mixtral)
- **Redis** : Files de tâches et cache
- **SQLite** : Base de données des projets
- **ChromaDB** : Base vectorielle pour le chat RAG
- **Nginx** : Reverse proxy et serveur de fichiers statiques

## 🚀 Installation et Déploiement

### Prérequis

- Docker et Docker Compose
- Au moins 16GB de RAM (recommandé 32GB pour les gros modèles)
- GPU NVIDIA optionnel pour l'accélération

### 1. Cloner le projet

```bash
git clone <url-du-projet>
cd analylit-v4
```

### 2. Préparer les fichiers

Assurez-vous d'avoir tous les fichiers suivants :

```
analylit-v4/
├── server_v4_complete.py          # Serveur Flask principal
├── tasks_v4_complete.py           # Tâches de traitement
├── config_v4_complete.py          # Configuration
├── requirements_complete.txt      # Dépendances Python
├── Dockerfile.web-complete        # Image serveur web
├── Dockerfile.worker-complete     # Image worker
├── docker-compose-complete.yml    # Orchestration
├── nginx_complete.conf           # Configuration Nginx
├── web/                          # Interface utilisateur
│   ├── index.html
│   ├── app.js
│   └── style.css
└── projects/                     # Dossier des données (créé automatiquement)
```

### 3. Démarrer les services

```bash
# Démarrage complet
docker-compose -f docker-compose-complete.yml up -d

# Voir les logs en temps réel
docker-compose -f docker-compose-complete.yml logs -f

# Vérifier l'état des services
docker-compose -f docker-compose-complete.yml ps
```

### 4. Télécharger les modèles IA

Une fois les services démarrés, accédez à l'interface web : http://localhost:8080

Dans la section "Paramètres > Modèles Ollama", téléchargez les modèles suivants :

```bash
# Modèles recommandés pour commencer
llama3.1:8b     # Modèle principal polyvalent
phi3:mini       # Modèle léger pour le preprocessing
gemma:2b        # Modèle très léger pour les tests

# Modèles avancés (nécessitent plus de RAM)
mixtral:8x7b    # Modèle expert pour extraction
llama3.1:70b    # Modèle très performant pour synthèse
```

## 📊 Utilisation

### 1. Créer un projet

1. Accédez à http://localhost:8080
2. Cliquez sur "Nouveau Projet"
3. Choisissez le mode d'analyse :
   - **Screening** : Pré-sélection d'articles
   - **Extraction détaillée** : Extraction avec grilles personnalisées
   - **Validation** : Comparaison avec des décisions humaines

### 2. Configurer un profil d'analyse

Les profils déterminent quels modèles IA utiliser :

- **Rapide** : gemma:2b + phi3:mini + llama3.1:8b
- **Standard** : phi3:mini + llama3.1:8b + llama3.1:8b  
- **Approfondi** : llama3.1:8b + mixtral:8x7b + llama3.1:70b

### 3. Lancer une analyse

1. Saisissez la liste des PMIDs à analyser
2. Sélectionnez un profil d'analyse
3. Lancez le traitement
4. Suivez l'avancement en temps réel

### 4. Consulter les résultats

- **Extractions** : Tableau des articles analysés
- **Synthèse** : Rapport automatique des résultats
- **Analyses avancées** : Graphiques, PRISMA, statistiques
- **Chat** : Questions/réponses sur le corpus

## 🔧 Configuration Avancée

### Variables d'environnement

```bash
# Dans un fichier .env
SECRET_KEY=VotreCleSecrete
REDIS_URL=redis://redis:6379/0
OLLAMA_BASE_URL=http://ollama:11434
DATABASE_URL=sqlite:///app/projects/database.db
```

### Configuration GPU (optionnel)

Pour activer l'accélération GPU NVIDIA :

1. Installez nvidia-docker2
2. Décommentez la section GPU dans docker-compose-complete.yml
3. Redémarrez les services

### Personnalisation des prompts

1. Accédez à "Paramètres > Prompts"
2. Modifiez les templates selon vos besoins
3. Les changements sont appliqués immédiatement

## 📈 Monitoring et Maintenance

### Vérification des services

```bash
# État des conteneurs
docker-compose -f docker-compose-complete.yml ps

# Logs détaillés
docker-compose -f docker-compose-complete.yml logs web
docker-compose -f docker-compose-complete.yml logs worker
docker-compose -f docker-compose-complete.yml logs ollama

# Ressources utilisées
docker stats
```

### Sauvegarde des données

```bash
# Sauvegarde du dossier projects
tar -czf backup-$(date +%Y%m%d).tar.gz projects/

# Sauvegarde des volumes Docker
docker run --rm -v analylit_ollama_v4:/data -v $(pwd):/backup alpine tar -czf /backup/ollama-backup.tar.gz -C /data .
```

### Nettoyage

```bash
# Arrêt complet
docker-compose -f docker-compose-complete.yml down

# Nettoyage avec suppression des volumes (⚠️ perte de données)
docker-compose -f docker-compose-complete.yml down -v

# Nettoyage des images Docker
docker image prune -f
```

## 🐛 Dépannage

### Problèmes courants

1. **Erreur de mémoire Ollama** : Réduisez OLLAMA_MAX_LOADED_MODELS ou utilisez des modèles plus petits
2. **Timeout de traitement** : Augmentez les timeouts dans config_v4_complete.py
3. **Erreur de connexion Redis** : Vérifiez que Redis est démarré avec `docker-compose ps`
4. **PDF non indexé** : Lancez manuellement l'indexation depuis l'interface

### Logs utiles

```bash
# Logs d'application
docker-compose logs web | grep ERROR
docker-compose logs worker | grep ERROR

# Logs système
docker-compose logs nginx
docker-compose logs redis
```

## 🔒 Sécurité

### En production

1. Changez le SECRET_KEY
2. Configurez un firewall
3. Utilisez HTTPS avec certificats SSL
4. Limitez l'accès aux ports (fermez 6379, 11434, 5001)
5. Sauvegardez régulièrement

### Réseau isolé

```yaml
# Exemple de configuration sécurisée
networks:
  analylit-internal:
    internal: true
  analylit-external:
    # Seul nginx a accès externe
```

## 🤝 Support

Pour obtenir de l'aide :

1. Consultez les logs avec les commandes ci-dessus
2. Vérifiez la section dépannage
3. Documentez votre environnement (OS, Docker version, RAM disponible)

## 🔄 Mise à jour

```bash
# Arrêt des services
docker-compose -f docker-compose-complete.yml down

# Mise à jour du code
git pull

# Reconstruction des images
docker-compose -f docker-compose-complete.yml build --no-cache

# Redémarrage
docker-compose -f docker-compose-complete.yml up -d
```

---

**Version**: 4.0.0  
**Licence**: MIT  
**Auteur**: AnalyLit Team