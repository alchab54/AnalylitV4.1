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
    
    # Désactiver les logs verbeux des librairies externes
    logging.getLogger('werkzeug').setLevel(logging.WARNING)
    logging.getLogger('urllib3').setLevel(logging.WARNING)
    
    logger = logging.getLogger(__name__)
    logger.info("Configuration de logging développement initialisée")
    
    return logging.getLogger()
