# tests/test_data_integrity.py

import pytest
import json
import uuid
import shutil
from pathlib import Path
from unittest.mock import patch
import sqlite3
import os

# Imports des modèles et tâches
from utils.models import Project, SearchResult
from backend.tasks_v4_complete import multi_database_search_task, import_from_zotero_json_task

# Ce fichier teste la capacité de l'application à maintenir l'intégrité des données.

@pytest.fixture
def temp_db_path(tmp_path):
    """Crée un chemin de fichier temporaire et une base de données SQLite vide pour le test."""
    db_path = tmp_path / "test_db.sqlite"
    # Crée une base de données vide pour que le test de copie puisse la trouver
    conn = sqlite3.connect(db_path)
    conn.close()
    # Retourne le chemin en tant que chaîne de caractères
    return str(db_path)

@pytest.fixture
def project_for_dedup(db_session):
    """Crée un projet et un article existant pour les tests de déduplication."""
    project = Project(name="Projet Déduplication")
    db_session.add(project)
    db_session.flush()

    # Article déjà présent dans la base
    existing_article = SearchResult(
        project_id=project.id,
        article_id="1234567",  # Use a valid 7-digit PMID
        title="Titre Original",
        abstract="Résumé original."
    )
    db_session.add(existing_article)
    db_session.flush()
    
    return project.id

def test_deduplication_on_conflict_during_search(db_session, project_for_dedup, mocker):
    """
    Test d'intégrité (Doublons) : Vérifie que la contrainte `ON CONFLICT` de la base
    de données empêche l'insertion d'un article en double lors d'une recherche.
    """
    project_id = project_for_dedup
    
    # Simuler une recherche qui retourne l'article existant (1234567) et un nouveau (PMID456)
    # 1. Simuler l'appel à Entrez pour retourner les IDs
    mock_entrez_ids = ['1234567', 'PMID456']
    # Utiliser MagicMock pour simuler le gestionnaire de contexte si nécessaire
    mocker.patch('Bio.Entrez.esearch', return_value=io.StringIO(json.dumps({"IdList": mock_entrez_ids})))
    mocker.patch('Bio.Entrez.read', return_value={"IdList": mock_entrez_ids})

    # 2. Simuler l'appel à fetch_details_for_ids qui est réellement utilisé
    mock_details_results = [
        {'id': '1234567', 'title': 'Titre Dupliqué', 'abstract': 'Résumé dupliqué.', 'database_source': 'pubmed'},
        {'id': 'PMID456', 'title': 'Nouveau Titre', 'abstract': 'Nouveau résumé.', 'database_source': 'pubmed'}
    ]
    mocker.patch('utils.fetchers.db_manager.fetch_details_for_ids', return_value=mock_details_results)
    mocker.patch('backend.tasks_v4_complete.send_project_notification')

    # Exécuter la tâche de recherche
    multi_database_search_task(
        db_session, project_id=project_id, query="test", databases=['pubmed']
    )

    # Vérifier l'état de la base de données
    articles_in_db = db_session.query(SearchResult).filter_by(project_id=project_id).all()
    assert len(articles_in_db) == 2, "Il ne doit y avoir que 2 articles au total (l'existant + le nouveau)."

    original_article = db_session.query(SearchResult).filter_by(project_id=project_id, article_id="1234567").one()
    assert original_article.title == "Titre Original", "L'article existant ne doit pas avoir été écrasé."
    
    print("\n[OK] Intégrité Données : La déduplication `ON CONFLICT` a bien fonctionné.")

def test_deduplication_in_zotero_import_logic(db_session, project_for_dedup, mocker):
    """
    Test d'intégrité (Doublons) : Vérifie la logique de déduplication au sein de la tâche
    d'import Zotero, qui ignore les articles déjà présents.
    """
    project_id = project_for_dedup

    # Simuler un import Zotero avec l'article existant (PMID123) et un nouveau
    zotero_items = [
        {"data": {"PMID": "1234567", "title": "Titre Zotero Dupliqué"}}, # Use the same valid PMID
        {"data": {"DOI": "10.123/new", "PMID": "PMID789", "title": "Nouveau Titre Zotero"}}
    ]
    mocker.patch('backend.tasks_v4_complete.send_project_notification')

    # Exécuter la tâche d'import
    import_from_zotero_json_task.__wrapped__(db_session, project_id, zotero_items)

    # Vérifier l'état de la base de données
    articles_in_db = db_session.query(SearchResult).filter_by(project_id=project_id).all()
    assert len(articles_in_db) == 2, "Il ne doit y avoir que 2 articles au total (l'existant + le nouveau)."

    original_article = db_session.query(SearchResult).filter_by(project_id=project_id, article_id="1234567").one()
    assert original_article.title == "Titre Original"

    print("\n[OK] Intégrité Données : La logique de déduplication de l'import Zotero a bien fonctionné.")

@pytest.mark.skip(reason="Ce test est spécifique à SQLite et incompatible avec le setup de test parallèle PostgreSQL.")
def test_database_backup_and_restore_cycle(temp_db_path, tmp_path):
    """
    Test d'intégrité (Sauvegarde/Restauration) : Simule un cycle complet de
    sauvegarde, suppression et restauration de la base de données.
    """
    # --- 0. Setup: Create a dedicated session for a real file DB ---
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from utils.models import Base, Project, SearchResult

    engine = create_engine(f"sqlite:///{temp_db_path}")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    db_session = Session()

    # Add initial data to the real file DB
    project = Project(name="Projet Déduplication")
    db_session.add(project)
    db_session.flush()
    project_id = project.id
    db_session.add(SearchResult(project_id=project_id, article_id="PMID123", title="Titre Original"))
    db_session.flush()

    # --- 1. Sauvegarde (simulée par une copie de fichier) ---
    db_path = Path(temp_db_path) # temp_db_path is already a string
    backup_path = tmp_path / "analylit_backup.db"
    shutil.copy(db_path, backup_path)
    assert backup_path.exists()
    print(f"\n[OK] Sauvegarde : Fichier de base de données copié vers {backup_path}")

    # --- 2. "Catastrophe" : Suppression de la base de données ---
    # La fixture `clean_db_before_test` simule déjà la suppression avant chaque test.
    db_session.query(SearchResult).delete()
    db_session.query(Project).delete()
    db_session.flush()
    assert db_session.query(Project).count() == 0
    print("[OK] Catastrophe : Base de données vidée.")

    # --- 3. Restauration & Vérification ---
    # On doit recréer une session pour lire le fichier restauré. Pour cela,
    # on doit d'abord fermer la session de test actuelle qui est liée à une DB en mémoire
    # ou à une version précédente du fichier.
    db_session.close()
    
    # Restauration (simulée par une copie inverse)
    shutil.copy(backup_path, db_path) # db_path is a string here
    print("[OK] Restauration : Fichier de sauvegarde restauré.")
    
    # Vérification de l'intégrité avec une nouvelle connexion
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    engine = create_engine(f"sqlite:///{db_path}")
    
    # Initialize the schema on the new database engine.
    from utils.models import Base
    Base.metadata.create_all(engine)
    
    Session = sessionmaker(bind=engine)
    new_session = Session()
    
    try:
        restored_project = new_session.query(Project).filter_by(id=project_id).one_or_none()
        assert restored_project is not None
        assert restored_project.name == "Projet Déduplication"
        
        restored_articles_count = new_session.query(SearchResult).filter_by(project_id=project_id).count()
        assert restored_articles_count == 1
    finally:
        new_session.close()
    
    print("[OK] Intégrité Données : Le cycle de sauvegarde/restauration a préservé les données.")