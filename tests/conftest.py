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
import server_v4_complete 

# Configurer le logging pour les tests
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@pytest.fixture(scope='session')
def app():
    """Crée une instance de l'application Flask pour la session de test."""
    
    # IMPORTANT : Initialise la base de données AVANT la création de l'app
    database_utils.init_db() 

    # CORRECTION MAJEURE:
    # 1. On n'utilise PAS importlib.reload()
    # 2. On passe la configuration de test DIRECTEMENT dans la factory
    app_instance = server_v4_complete.create_app({
        "TESTING": True,
    })
    
    # Créer toutes les tables (en utilisant l'engine via le module)
    with app_instance.app_context():
        Base.metadata.create_all(bind=database_utils.engine)
    
    yield app_instance
    
    # Nettoyage après la session
    with app_instance.app_context():
        Base.metadata.drop_all(bind=database_utils.engine)

@pytest.fixture()
def client(app):
    """Un client de test Flask pour l'application."""
    return app.test_client()

@pytest.fixture(scope='function')
def session(app):
    """
    Fixture de session DB par fonction.
    """
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
    """
    Nettoie la base de données *entre chaque test* pour l'isolation.
    """
    logger.info("--- SETUP TEST DB: CLEANING TABLES ---")
    for table in reversed(Base.metadata.sorted_tables):
        session.execute(table.delete())
    session.commit()
    
    yield session
    
@pytest.fixture(scope="session")
def remote_driver():
    """
    Fixture de session pour initialiser un remote driver Selenium.
    """
    print("\n--- [E2E Setup] Initialisation du Remote Driver Selenium ---")
    
    time.sleep(15) 
    
    chrome_options = Options()
    chrome_options.set_capability("browserName", "chrome")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    
    driver = None
    try:
        driver = webdriver.Remote(
            command_executor='http://selenium:4444/wd/hub',
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