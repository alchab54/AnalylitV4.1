# tests/test_data_integrity.py

import pytest
import json
import uuid
import shutil
from pathlib import Path
from unittest.mock import patch

# Imports des modèles et tâches
from utils.models import Project, SearchResult
from tasks_v4_complete import multi_database_search_task, import_from_zotero_json_task

# Ce fichier teste la capacité de l'application à maintenir l'intégrité des données.

@pytest.fixture
def project_for_dedup(db_session):
    """Crée un projet et un article existant pour les tests de déduplication."""
    project = Project(name="Projet Déduplication")
    db_session.add(project)
    db_session.commit()

    # Article déjà présent dans la base
    existing_article = SearchResult(
        project_id=project.id,
        article_id="PMID123",
        title="Titre Original",
        abstract="Résumé original."
    )
    db_session.add(existing_article)
    db_session.commit()
    
    return project.id

def test_deduplication_on_conflict_during_search(db_session, project_for_dedup, mocker):
    """
    Test d'intégrité (Doublons) : Vérifie que la contrainte `ON CONFLICT` de la base
    de données empêche l'insertion d'un article en double lors d'une recherche.
    """
    project_id = project_for_dedup
    
    # Simuler une recherche qui retourne l'article existant (PMID123) et un nouveau (PMID456)
    mock_search_results = [
        {'id': 'PMID123', 'title': 'Titre Dupliqué', 'abstract': 'Résumé dupliqué.', 'database_source': 'pubmed'},
        {'id': 'PMID456', 'title': 'Nouveau Titre', 'abstract': 'Nouveau résumé.', 'database_source': 'pubmed'}
    ]
    mocker.patch('tasks_v4_complete.db_manager.search_pubmed', return_value=mock_search_results)
    mocker.patch('tasks_v4_complete.send_project_notification')

    # Exécuter la tâche de recherche
    multi_database_search_task.__wrapped__(
        db_session, project_id=project_id, query="test", databases=['pubmed']
    )

    # Vérifier l'état de la base de données
    articles_in_db = db_session.query(SearchResult).filter_by(project_id=project_id).all()
    assert len(articles_in_db) == 2, "Il ne doit y avoir que 2 articles au total (l'existant + le nouveau)."

    original_article = db_session.query(SearchResult).filter_by(project_id=project_id, article_id="PMID123").one()
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
        {"data": {"DOI": "10.123/existing", "PMID": "PMID123", "title": "Titre Zotero Dupliqué"}},
        {"data": {"DOI": "10.123/new", "PMID": "PMID789", "title": "Nouveau Titre Zotero"}}
    ]
    mocker.patch('tasks_v4_complete.send_project_notification')

    # Exécuter la tâche d'import
    import_from_zotero_json_task.__wrapped__(db_session, project_id, zotero_items)

    # Vérifier l'état de la base de données
    articles_in_db = db_session.query(SearchResult).filter_by(project_id=project_id).all()
    assert len(articles_in_db) == 1

    original_article = db_session.query(SearchResult).filter_by(project_id=project_id, article_id="PMID123").one()
    assert original_article.title == "Titre Original"

    print("\n[OK] Intégrité Données : La logique de déduplication de l'import Zotero a bien fonctionné.")

def test_database_backup_and_restore_cycle(app, db_session, project_for_dedup, tmp_path):
    """
    Test d'intégrité (Sauvegarde/Restauration) : Simule un cycle complet de
    sauvegarde, suppression et restauration de la base de données.
    """
    # --- 1. Sauvegarde (simulée par une copie de fichier) ---
    # CORRECTION: Utiliser la configuration de l'application fournie par la fixture 'app'.
    # La base de données de test est en mémoire, donc on utilise le chemin du fichier de la config.
    # Pour un test réel, le chemin serait celui de la base de données de test.
    # Ici, on simule en utilisant le chemin de la config, qui est valide dans le contexte du test.
    db_path = Path(app.config['DATABASE_URL'].replace('sqlite:///', ''))
    backup_path = tmp_path / "analylit_backup.db"
    shutil.copy(db_path, backup_path)
    assert backup_path.exists()
    print(f"\n[OK] Sauvegarde : Fichier de base de données copié vers {backup_path}")

    # --- 2. "Catastrophe" : Suppression de la base de données ---
    # La fixture `clean_db_before_test` simule déjà la suppression avant chaque test.
    # On vérifie que la base est vide après le nettoyage de la fixture du *prochain* test (simulé ici).
    db_session.query(Project).delete()
    db_session.commit()
    assert db_session.query(Project).count() == 0
    print("[OK] Catastrophe : Base de données vidée.")

    # --- 3. Restauration (simulée par une copie inverse) ---
    shutil.copy(backup_path, db_path)
    print("[OK] Restauration : Fichier de sauvegarde restauré.")

    # --- 4. Vérification de l'intégrité ---
    # On doit recréer une session pour lire le fichier restauré.
    from utils.database import get_session
    new_session = get_session()
    restored_project = new_session.query(Project).filter_by(id=project_for_dedup).one_or_none()
    assert restored_project is not None
    assert restored_project.name == "Projet Déduplication"
    
    restored_articles_count = new_session.query(SearchResult).filter_by(project_id=project_for_dedup).count()
    assert restored_articles_count == 1
    new_session.close()
    
    print("[OK] Intégrité Données : Le cycle de sauvegarde/restauration a préservé les données.")