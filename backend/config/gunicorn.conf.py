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

# ✅✅✅ **CORRECTION FINALE** ✅✅✅
# Cette variable dit EXPLICITEMENT à Gunicorn quelle application charger
module = "backend.server_v4_complete:app"

# Alternative équivalente (gardons les deux pour être sûr)
wsgi_app = "backend.server_v4_complete:app"
