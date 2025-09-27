# gunicorn.conf.py

# Configuration optimisée pour 16GB RAM
bind = "0.0.0.0:5000"
workers = 2              # RÉDUIT pour éviter l'OOM
worker_class = "gevent"  # Plus efficace en mémoire
worker_connections = 100 # RÉDUIT de 1000 à 100
timeout = 120           # Timeout réduit
keepalive = 2
max_requests = 500      # Recycler workers plus souvent
max_requests_jitter = 50
preload_app = True      # Partage mémoire entre workers
reload = True


