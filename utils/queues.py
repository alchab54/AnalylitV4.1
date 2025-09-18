# utils/queues.py
_background_queue = None

def set_background_queue(q):
    global _background_queue
    _background_queue = q

def get_background_queue():
    return _background_queue
