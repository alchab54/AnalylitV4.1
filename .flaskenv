# ===================================================================
# == ANALYLIT V4.1 - VARIABLES FLASK (Non-Sensibles) ==
# ===================================================================

# Configuration Flask de base
FLASK_APP=backend.server_v4_complete:app
FLASK_ENV=development
FLASK_DEBUG=1
FLASK_RUN_HOST=0.0.0.0
FLASK_RUN_PORT=5000

# ===============================================
# == Configuration Développement Local ==
# ===============================================
# Performance et debugging
WERKZEUG_DEBUG_PIN=off
WERKZEUG_RUN_MAIN=true

# Logging optimisé
LOG_LEVEL=INFO
PYTHONUNBUFFERED=1
PYTHONDONTWRITEBYTECODE=1

# ===============================================
# == Connexions Services (Non-Docker) ==
# ===============================================
# Pour tests locaux sans Docker
LOCAL_DATABASE_URL=postgresql://postgres:password@localhost:5432/analylit
LOCAL_REDIS_URL=redis://localhost:6379
LOCAL_OLLAMA_BASE_URL=http://localhost:11434

# ===============================================
# == Configuration Tests et CI/CD ==
# ===============================================
# Variables pour les tests automatisés
TESTING=false
PYTEST_CURRENT_TEST=""
CYPRESS_baseUrl=http://localhost:8080

# ===============================================
# == Performance Ryzen 3700X Optimisée ==
# ===============================================
# Gunicorn optimisé 16GB RAM
WORKERS=4
MAX_WORKERS=6
WORKER_CONNECTIONS=200
WORKER_CLASS=gevent
TIMEOUT=120

# Python optimisations mémoire
PYTHONPATH=/app
PYTHON_MALLOC_STATS=1
PYTHONMALLOC=malloc

# Threading optimisé
OMP_NUM_THREADS=4
NUMBA_NUM_THREADS=4
OPENBLAS_NUM_THREADS=2
MKL_NUM_THREADS=2

# ===============================================
# == Node.js et Frontend ==
# ===============================================
NODE_OPTIONS="--max-old-space-size=2048"
UV_THREADPOOL_SIZE=4
NPM_CONFIG_CACHE=/tmp/.npm

# ===============================================
# == Modèles IA RTX 2060 SUPER ==
# ===============================================
# Modèles par défaut (référence pour l'équipe)
DEFAULT_EMBEDDING_MODEL=all-MiniLM-L6-v2
DEFAULT_LLM_MODEL=llama3:8b
DEFAULT_FAST_MODEL=llama3.2:3b
DEFAULT_ANALYSIS_MODEL=mistral:7b-instruct

# ===============================================
# == Monitoring et Debugging ==
# ===============================================
# Interface de debugging
DEBUG_MODE=1
PROFILE_REQUESTS=false
MEMORY_PROFILING=false

# Métriques système
TRACK_RESOURCE_USAGE=true
LOG_SQL_QUERIES=false
