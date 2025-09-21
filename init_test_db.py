# init_test_db.py
import logging
from utils.database import init_database

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

if __name__ == "__main__":
    log.info("Initialisation de la base de données de TEST...")
    # L'argument is_test=True garantit que nous nous connectons à la BDD de test
    # définie par DATABASE_URL dans l'environnement du conteneur 'tester'.
    init_database(is_test=True)
    log.info("Base de données de TEST initialisée avec succès.")