# utils/queues.py
_import_queue  = None

def set_import_queue (q):
    global _import_queue 
    _import_queue  = q

def get_import_queue ():
    return _import_queue 
