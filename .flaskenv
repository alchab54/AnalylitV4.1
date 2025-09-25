# AnalyLit V4.1 - Fichier d'environnement d'exemple
# Copiez ce fichier en .env et remplissez les valeurs.
# NE COMMITEZ JAMAIS votre fichier .env dans Git.

# --- Configuration Flask ---
SECRET_KEY=a_secure_secret_key_for_development_only
FLASK_ENV=development
LOG_LEVEL=INFO

# --- Connexions aux services Docker ---
# Ces valeurs correspondent à celles dans docker-compose-complete.yml
DATABASE_URL=postgresql://postgres:password@localhost:5432/analylit
REDIS_URL=redis://localhost:6379

# Configuration Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODELS_PATH=/tmp/ollama_models
OLLAMA_MAX_LOADED_MODELS=1
CUDA_VISIBLE_DEVICES=0

# --- Clés API et Identifiants (à remplir) ---
UNPAYWALL_EMAIL=

# Identifiants Zotero
ZOTERO_USER_ID=
ZOTERO_API_KEY=
ZOTERO_GROUP_ID=

# Clés optionnelles pour étendre la recherche
IEEE_API_KEY=
PUBMED_API_KEY=

# --- Performance & Optimisations ---
# Backend Performance (Ryzen 8-cores)
WORKERS=8
MAX_WORKERS=12
WORKER_CONNECTIONS=1000
WORKER_CLASS=sync
# Python/ML Optimisations
PYTHONPATH=/app
NUMBA_NUM_THREADS=8
OMP_NUM_THREADS=8
OPENBLAS_NUM_THREADS=4
# Node.js/NPM (16GB RAM)
NODE_OPTIONS="--max-old-space-size=4096"
UV_THREADPOOL_SIZE=8

# ====================================================================
# ANALYLIT v4.1 - CONFIGURATION AWS GPU g4dn.2xlarge
# ====================================================================

# --- Configuration des modèles IA HAUTE PERFORMANCE ---
# Le modèle d'embedding reste le même, il tourne sur CPU
EMBEDDING_MODEL=all-MiniLM-L6-v2

# --- Configuration Ollama sur GPU AWS ---
# Indique à l'application d'utiliser le GPU
OLLAMA_GPU_ENABLED=true
# (Optionnel) Si vous avez plusieurs GPU
CUDA_VISIBLE_DEVICES=0
# (Optionnel) Limite le nombre de modèles chargés en RAM GPU
OLLAMA_MAX_LOADED_MODELS=2

# --- SÉLECTION STRATÉGIQUE DES MODÈLES ---
# Modèles standards pour les tâches courantes (rapides et efficaces)
DEFAULT_LLM_MODEL=mistral:7b-instruct-v0.2-q4_0
FAST_LLM_MODEL=llama3.2:3b-instruct-q4_0
ANALYSIS_LLM_MODEL=llama3.1:8b-instruct-q4_0

# GROS MODÈLES pour les analyses critiques et démos (à utiliser ponctuellement)
HEAVY_LLM_MODEL=llama3.1:70b-instruct-q4_0
RESEARCH_LLM_MODEL=mixtral:8x7b-instruct-v0.1-q4_0

# --- Optimisations performance GPU (recommandé) ---
PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512
OMP_NUM_THREADS=8
OLLAMA_FLASH_ATTENTION=true

# --- Connexion à la base de données (fournie par AWS RDS) ---
DATABASE_URL=postgresql://user:password@<URL_RDS_POSTGRES>:5432/dbname

# --- Connexion au cache (fourni par AWS ElastiCache) ---
REDIS_URL=redis://<URL_ELASTICACHE_REDIS>:6379

# --- Configuration du modèle d'embedding (NE CHANGE PAS) ---
# Ce modèle reste avec l'application, il est rapide et ne nécessite pas de GPU.
EMBEDDING_MODEL=all-MiniLM-L6-v2

# --- CONFIGURATION CRITIQUE : LE GROS MODÈLE SUR AWS ---
# L'application contactera Ollama sur l'instance GPU via cette URL.
# C'est la seule ligne qui change pour pointer vers le cloud.
OLLAMA_HOST=http://<IP_DE_VOTRE_INSTANCE_GPU>:11434

# Modèle LLM à utiliser par défaut pour les tâches d'analyse.
# Vous pourrez le changer dans l'interface, mais c'est une bonne base.
LLM_MODEL=llama3:8b
# Ou pour les grosses analyses :
# LLM_MODEL=mistral:latest