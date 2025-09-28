# gunicorn.conf.py

# Configuration optimisée pour 16GB RAM
bind = "0.0.0.0:5000"
workers = 2  # RÉDUIT pour éviter l'OOM
# ✅ CORRECTION: Le nom du worker était incorrect. 'gevent_websocket' n'est pas un alias valide.
# Il faut utiliser le chemin complet vers la classe du worker fournie par la bibliothèque gevent-websocket.
worker_class = "geventwebsocket.gunicorn.workers.GeventWebSocketWorker"
worker_connections = 100 # RÉDUIT de 1000 à 100
timeout = 120           # Timeout réduit
keepalive = 2
max_requests = 500      # Recycler les workers plus souvent
max_requests_jitter = 50
# ✅ CORRECTION: `preload_app` est incompatible avec gevent et le monkey-patching.
# Le monkey-patching doit se produire dans chaque worker APRÈS le fork, mais AVANT que l'app soit importée.
# Désactiver `preload_app` garantit que chaque worker charge sa propre instance de l'app après le patch.
preload_app = False

# ✅ CORRECTION: Le rechargement automatique de Gunicorn est incompatible avec gevent
# et cause des erreurs de type KeyError. Il doit être désactivé.
reload = False
