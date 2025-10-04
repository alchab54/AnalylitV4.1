# backend/config/gunicorn.conf.py

# Configuration optimisée pour 16GB RAM
bind = "0.0.0.0:80"
workers = 4
worker_class = "geventwebsocket.gunicorn.workers.GeventWebSocketWorker"
worker_connections = 100
timeout = 600
keepalive = 5
max_requests = 2000
max_requests_jitter = 200
preload_app = False
reload = False

# ✅✅✅ **LA CORRECTION FINALE EST ICI** ✅✅✅
# On dit à Gunicorn de charger la variable 'app' depuis le fichier 'backend.server_v4_complete'
wsgi_app = "backend.server_v4_complete:app"
