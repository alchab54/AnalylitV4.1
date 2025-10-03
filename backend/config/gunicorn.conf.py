# gunicorn.conf.py

# Configuration optimisée pour 16GB RAM
# ✅ CORRECTION: On bind sur le port 5000, qui est le port que Nginx attend.
bind = "0.0.0.0:80"
workers = 4  # ✅ AUGMENTÉ: Plus de workers pour gérer les requêtes simultanées.
# ✅ CORRECTION: Le nom du worker était incorrect. 'gevent_websocket' n'est pas un alias valide.
# Il faut utiliser le chemin complet vers la classe du worker fournie par la bibliothèque gevent-websocket.
worker_class = "geventwebsocket.gunicorn.workers.GeventWebSocketWorker"
worker_connections = 100 # RÉDUIT de 1000 à 100
timeout = 600           # ✅ AUGMENTÉ: Tolérance de 10 minutes pour les tâches longues.
keepalive = 5
max_requests = 2000     # ✅ AUGMENTÉ: Recycle les workers moins souvent, stabilise les WebSockets.
max_requests_jitter = 200
# ✅ CORRECTION: `preload_app` est incompatible avec gevent et le monkey-patching.
# Le monkey-patching doit se produire dans chaque worker APRÈS le fork, mais AVANT que l'app soit importée.
# Désactiver `preload_app` garantit que chaque worker charge sa propre instance de l'app après le patch.
preload_app = False

# ✅ CORRECTION: Le rechargement automatique de Gunicorn est incompatible avec gevent
# et cause des erreurs de type KeyError. Il doit être désactivé.
reload = False
