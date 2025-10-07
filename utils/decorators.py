#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Decorateurs pour AnalyLit V4.2"""

from functools import wraps
from flask import request, jsonify
import os

def require_api_key(f):
    """Decorateur pour valider la clé API (mode développement permissif)"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Mode développement : accepter toutes les requêtes
        if os.environ.get('FLASK_ENV') == 'development':
            return f(*args, **kwargs)
        
        # Mode production : vérifier la clé API
        api_key = request.headers.get('X-API-Key') or request.args.get('api_key')
        expected_key = os.environ.get('API_KEY', 'dev-key-analylit')
        
        if not api_key or api_key != expected_key:
            return jsonify({'error': 'API key required', 'status': 'unauthorized'}), 401
        
        return f(*args, **kwargs)
    return decorated_function

def validate_json(required_fields=None):
    """Decorateur pour valider les données JSON"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not request.is_json:
                return jsonify({'error': 'Content-Type must be application/json'}), 400
            
            data = request.get_json()
            if not data:
                return jsonify({'error': 'Invalid JSON data'}), 400
            
            if required_fields:
                missing_fields = [field for field in required_fields if field not in data]
                if missing_fields:
                    return jsonify({
                        'error': f'Missing required fields: {", ".join(missing_fields)}'
                    }), 400
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def handle_errors(f):
    """Decorateur pour gérer les erreurs automatiquement"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except ValueError as e:
            return jsonify({'error': str(e), 'type': 'validation_error'}), 400
        except FileNotFoundError as e:
            return jsonify({'error': 'Resource not found', 'details': str(e)}), 404
        except Exception as e:
            return jsonify({
                'error': 'Internal server error',
                'details': str(e) if os.environ.get('FLASK_ENV') == 'development' else 'Contact support'
            }), 500
    return decorated_function
