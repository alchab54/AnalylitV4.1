import pytest
import logging
import importlib
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from sqlalchemy.orm import sessionmaker

# Importe le module database et la fonction init
import utils.database as database_utils

# Importe la Base depuis les modèles
from utils.models import Base, SearchResult # Explicitly import SearchResult
# Importe le serveur APRÈS que la DB soit initialisée
# import server_v4_complete # Déplacé dans la fixture 'app' pour éviter le rechargement

# Configurer le logging pour les tests
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Crée une SessionFactory de test liée au MOTEUR MAINTENANT INITIALISÉ
# Nous accédons à l'engine via le module pour garantir que nous avons la version post-init()
# TestingSessionLocal est maintenant créé dans la fixture session pour s'assurer que l'engine est initialisé.

import pytest
import logging
import importlib
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from sqlalchemy.orm import sessionmaker

# Importe le module database et la fonction init
import utils.database as database_utils

# Importe la Base depuis les modèles
from utils.models import Base, SearchResult # Explicitly import SearchResult
# Importe le serveur APRÈS que la DB soit initialisée
# import server_v4_complete # Déplacé dans la fixture 'app' pour éviter le rechargement

# Configurer le logging pour les tests
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Crée une SessionFactory de test liée au MOTEUR MAINTENANT INITIALISÉ
# Nous accédons à l'engine via le module pour garantir que nous avons la version post-init()
# TestingSessionLocal est maintenant créé dans la fixture session pour s'assurer que l'engine est initialisé.

@pytest.fixture(scope='session')
def app():
    """Crée une instance de l'application Flask pour la session de test."""
    # Importer et recharger le module ici garantit un état frais pour les tests
    # sans causer de double enregistrement de blueprint.
    import server_v4_complete
    importlib.reload(server_v4_complete)
    
    # IMPORTANT : Initialise la base de données APRES l'importation des modèles
    database_utils.init_db() 

    app_instance = server_v4_complete.create_app()
    app_instance.config.update({
        "TESTING": True,
    })
    
    # Créer toutes les tables (en utilisant l'engine via le module)
    Base.metadata.create_all(bind=database_utils.engine)
    yield app_instance
    # Nettoyage après la session
    Base.metadata.drop_all(bind=database_utils.engine)

@pytest.fixture()
def client(app):
    """Un client de test Flask pour l'application."""
    return app.test_client()

@pytest.fixture(scope='function')
def session():
    """
    Fixture de session DB par fonction :
    1. Supprime TOUT le schéma (drop_all)
    2. Recrée TOUT le schéma (create_all)
    """
    logger.info("--- SETUP TEST DB: DROPPING AND CREATING TABLES ---")
    Base.metadata.drop_all(bind=database_utils.engine)
    Base.metadata.create_all(bind=database_utils.engine)
    
    # Crée une session locale de test liée à l'engine initialisé
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=database_utils.engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.rollback() 
        db.close()
        logger.info("--- TEARDOWN TEST DB: SESSION CLOSED ---")

@pytest.fixture(scope='function')
def clean_db(session):
    """Alias pour la fixture 'session'."""
    yield session
    
@pytest.fixture(scope="session")
def remote_driver():
    """
    Fixture de session pour initialiser un remote driver Selenium.
    Cette fixture s'exécute une seule fois par session de test E2E.
    """
    print("\n--- [E2E Setup] Initialisation du Remote Driver Selenium ---")
    
    # Attend que le conteneur Selenium soit prêt
    # (En production, on utiliserait une attente plus robuste)
    time.sleep(15) 
    
    chrome_options = Options()
    # CORRECTION: Pour éviter un "capability mismatch", nous devons explicitement
    # définir le nom du navigateur. Le conteneur selenium/standalone-chrome
    # s'attend à recevoir une demande pour "chrome".
    chrome_options.set_capability("browserName", "chrome")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    
    driver = None
    try:
        driver = webdriver.Remote(
            # Le hub Selenium est accessible via son nom de service Docker
            command_executor='http://selenium:4444/wd/hub',
            # CORRECTION: Le paramètre 'options' est maintenant obligatoire.
            options=chrome_options 
        )
        driver.set_window_size(1920, 1080)
        print("--- [E2E Setup] Driver initialisé ---")
        yield driver
    
    except Exception as e:
        print(f"--- [E2E ERREUR] Impossible de connecter au hub Selenium: {e} ---")
        pytest.fail(f"Impossible de se connecter au Selenium Hub (http://selenium:4444). Le conteneur est-il lancé ? Détails : {e}")
        
    finally:
        if driver:
            print("\n--- [E2E Teardown] Fermeture du Driver Selenium ---")
            driver.quit()
