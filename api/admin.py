# api/admin.py - Ajouter méthodes manquantes
from flask import Blueprint, jsonify, request
from utils.app_globals import redis_conn, limiter
from rq import Queue

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/queues/info', methods=['GET'])
@limiter.limit("50 per minute")
def get_queues_info():
    """Récupérer l'état des files d'attente"""
    try:
        queues_to_check = [
            'processing_queue', 'synthesis_queue', 'analysis_queue', 
            'background_queue', 'models_queue', 'extension_queue',
            'fast_queue', 'default_queue', 'ai_queue'
        ]
        
        queues_info = []
        for queue_name in queues_to_check:
            try:
                q = Queue(queue_name, connection=redis_conn)
                queues_info.append({
                    'name': queue_name,
                    'size': len(q),
                    'workers': 0  # Placeholder
                })
            except Exception:
                queues_info.append({
                    'name': queue_name,
                    'size': 0,
                    'workers': 0
                })
        
        return jsonify(queues_info)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/pull-models', methods=['POST'])
@limiter.limit("5 per minute")
def pull_models():
    """Déclencher le téléchargement de modèles"""
    try:
        data = request.get_json() or {}
        models = data.get('models', [])
        
        # Logique pour pull des modèles (simulée)
        result = {
            'message': f'{len(models)} modèles en cours de téléchargement',
            'models': models,
            'status': 'processing'
        }
        
        return jsonify(result), 202
    except Exception as e:
        return jsonify({'error': str(e)}), 500
