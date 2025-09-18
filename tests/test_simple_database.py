# tests/test_simple_database.py

"""
Tests simplifiés pour la base de données.
Ce fichier est complètement autonome et ne dépend d'aucune fixture complexe.
"""

import os
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Force le mode test
os.environ['TESTING'] = 'true'

# Import des modèles et de la Base
from utils.database import Base, seed_default_data
from utils.models import AnalysisProfile, Project

def test_database_models_work():
    """Test simple : créer une DB en mémoire et tester nos modèles."""
    
    # Créer un moteur SQLite en mémoire
    engine = create_engine("sqlite:///:memory:")
    
    # Créer toutes les tables
    Base.metadata.create_all(engine)
    
    # Créer une session
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Test 1 : Insérer des données
        profile = AnalysisProfile(name="Test Profile", is_custom=True)
        project = Project(name="Test Project", description="Test description")
        
        session.add(profile)
        session.add(project)
        session.commit()
        
        # Test 2 : Lire les données
        retrieved_profile = session.query(AnalysisProfile).filter_by(name="Test Profile").first()
        retrieved_project = session.query(Project).filter_by(name="Test Project").first()
        
        assert retrieved_profile is not None
        assert retrieved_profile.name == "Test Profile"
        assert retrieved_project is not None
        assert retrieved_project.name == "Test Project"
        
        print("✅ Test de base réussi : Modèles SQLAlchemy fonctionnels")
        
    finally:
        session.close()

def test_seed_default_data_function():
    """Test de la fonction seed_default_data."""
    
    # Créer un moteur SQLite en mémoire
    engine = create_engine("sqlite:///:memory:")
    
    # Créer toutes les tables
    Base.metadata.create_all(engine)
    
    # Créer une session
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Appeler la fonction de seeding
        seed_default_data(session)
        
        # Vérifier que les données par défaut ont été créées
        profile = session.query(AnalysisProfile).filter_by(name='Standard').first()
        project = session.query(Project).filter_by(name='Projet par défaut').first()
        
        assert profile is not None, "Le profil 'Standard' devrait être créé"
        assert project is not None, "Le projet 'Projet par défaut' devrait être créé"
        
        print("✅ Test de seeding réussi")
        
    finally:
        session.close()

if __name__ == "__main__":
    # Permet de lancer le test directement
    test_database_models_work()
    test_seed_default_data_function()
    print("🎉 Tous les tests sont passés !")