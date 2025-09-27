# backend/gunicorn_entry.py

import gevent.monkey

# CRITICAL: Perform monkey-patching before any other modules are imported.
# This is the earliest possible point and resolves the MonkeyPatchWarning.
gevent.monkey.patch_all()

# Now that patching is done, import the Flask app factory and create the app.
from server_v4_complete import create_app

app = create_app()