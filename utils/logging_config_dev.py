# utils/logging_config_dev.py - Configuration logging pour le développement

import logging
import os
from pathlib import Path

def setup_logging():
    """Configuration de logging pour le développement (sans fichiers)."""
    
    # Configuration pour la console uniquement en mode développement
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler()  # Sortie console uniquement
        ]
    )
def setup_test_logging():
    """Configuration silencieuse pour les tests"""
    if os.getenv('TESTING') == 'true':
        # En mode test, on réduit le niveau de logging
        logging.getLogger('root').setLevel(logging.WARNING)
        logging.getLogger('utils.logging_config_dev').setLevel(logging.WARNING)
        
        # Supprime les handlers répétitifs
        for handler in logging.getLogger().handlers[:]:
            logging.getLogger().removeHandler(handler)

    
    # Désactiver les logs verbeux des librairies externes
    logging.getLogger('werkzeug').setLevel(logging.WARNING)
    logging.getLogger('urllib3').setLevel(logging.WARNING)
    
    logger = logging.getLogger(__name__)
    logger.info("Configuration de logging développement initialisée")
    
    return logging.getLogger()
