# tests/test_logging.py

import pytest
import logging
from logging.handlers import TimedRotatingFileHandler
from unittest.mock import patch

# Importe la fonction à tester
from utils.logging_config import setup_logging

def test_setup_logging_configures_handlers():
    """
    Vérifie que la fonction setup_logging configure correctement
    les handlers pour la console et pour les fichiers.
    """
    # ARRANGE: On s'assure que le logger racine est propre avant le test
    root_logger = logging.getLogger()
    root_logger.handlers = []

    # ACT: On appelle la fonction de configuration
    setup_logging()

    # ASSERT: On vérifie les résultats
    assert len(root_logger.handlers) >= 1, "Le logger racine doit avoir au least one handler."

    # Vérifie la présence d'un StreamHandler (console)
    assert any(isinstance(h, logging.StreamHandler) for h in root_logger.handlers), "A StreamHandler for the console should be present."

    # Vérifie la présence d'un TimedRotatingFileHandler (fichier)
    assert any(isinstance(h, TimedRotatingFileHandler) for h in root_logger.handlers), "Un TimedRotatingFileHandler pour les fichiers doit être présent."