# gunicorn.conf.py

bind = "0.0.0.0:5000"
workers = 2
threads = 2
worker_class = "geventwebsocket.gunicorn.workers.GeventWebSocketWorker"

# Import the post_fork hook from your application
def post_fork(server, worker):
    # Plus besoin d'initialiser SQLAlchemy ici
    # L'initialisation se fait déjà dans create_app()
    pass