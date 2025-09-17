# utils/logging_config.py
import logging
from logging.handlers import TimedRotatingFileHandler
from config_v4 import get_config

config = get_config()

def setup_logging():
    """
    Configure la journalisation (logging) de manière centralisée 
    pour la console et les fichiers rotatifs.
    """
    # Évite les configurations multiples si la fonction est appelée plusieurs fois
    if logging.getLogger().hasHandlers():
        logging.getLogger().handlers.clear()

    # Formatter
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')

    # Handler pour la console
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)

    # Handler pour les fichiers (rotation temporelle)
    log_file_path = config.LOG_DIR / config.LOG_FILE
    file_handler = TimedRotatingFileHandler(log_file_path, when='D', interval=2, backupCount=3)
    file_handler.setFormatter(formatter)

    # Configurer le logger racine
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, config.LOG_LEVEL))
    root_logger.addHandler(console_handler)
    root_logger.addHandler(file_handler)