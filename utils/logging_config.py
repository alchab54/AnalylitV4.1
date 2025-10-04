# utils/logging_config.py - Version FINALE compatible développement

import logging
import os
from logging.handlers import TimedRotatingFileHandler
from backend.config.config_v4 import get_config
from pathlib import Path

def setup_logging():
    """
    Configure la journalisation de manière adaptative selon l'environnement.
    En développement : logs console uniquement.
    En production : logs fichier + console.
    """
    # Évite les configurations multiples si la fonction est appelée plusieurs fois
    if logging.getLogger().hasHandlers():
        logging.getLogger().handlers.clear()

    config = get_config()
    
    # Formatter
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')

    # Handler pour la console (toujours présent)
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)

    # Configurer le logger racine
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, config.LOG_LEVEL))
    root_logger.addHandler(console_handler)

    # ✅✅✅ **LA CORRECTION FINALE** ✅✅✅
    # Handler pour les fichiers SEULEMENT si on peut écrire
    if os.getenv('FLASK_ENV') != 'development':
        try:
            log_file_path = config.LOG_DIR / config.LOG_FILE
            # S'assurer que le répertoire existe et est accessible en écriture
            config.LOG_DIR.mkdir(parents=True, exist_ok=True)
            
            # Tester l'accès en écriture avant de créer le handler
            test_file = config.LOG_DIR / "test_write.tmp"
            test_file.write_text("test")
            test_file.unlink()  # Supprimer le fichier test
            
            # Si on arrive ici, l'écriture est possible
            file_handler = TimedRotatingFileHandler(log_file_path, when='D', interval=2, backupCount=3)
            file_handler.setFormatter(formatter)
            root_logger.addHandler(file_handler)
            
        except (OSError, PermissionError):
            # En cas d'erreur de permissions, continuer avec la console seulement
            root_logger.warning("Impossible d'écrire les logs dans un fichier. Mode console uniquement.")
    else:
        # En développement, on log seulement dans la console
        root_logger.info("Mode développement : logs console uniquement")

    return root_logger
