import os

print("Starting Gunicorn...")
# Command to start Gunicorn
gunicorn_cmd = [
    "gunicorn",
    "server_v4_complete:create_app()",
    "-k", "geventwebsocket.gunicorn.workers.GeventWebSocketWorker",
    "-w", "1",
    "--timeout", "300",
    "-b", "0.0.0.0:5000",
    "--access-logfile", "-",
    "--error-logfile", "-"
]

# Replace the current process with the Gunicorn process
os.execvp("gunicorn", gunicorn_cmd)
