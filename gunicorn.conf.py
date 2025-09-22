# gunicorn.conf.py

bind = "0.0.0.0:5000"
workers = 2
threads = 2
worker_class = "geventwebsocket.gunicorn.workers.GeventWebSocketWorker"

# Import the post_fork hook from your application
from server_v4_complete import post_fork

# The server hook to be executed after a worker has been forked.