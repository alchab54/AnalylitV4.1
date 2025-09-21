# teststest_utils_logic.py

import pytest
import json
import pandas as pd
import uuid
from unittest.mock import patch, MagicMock

# Fonctions à tester
from utils.analysis import generate_discussion_draft
from utils.file_handlers import extract_text_from_pdf
from utils.fetchers import db_manager
from tasks_v4_complete import import_from_zotero_json_task

# Modèles nécessaires
from utils.models import Project, SearchResult

# --- Fixture pour un projet de test (utilisée par plusieurs tests) ---

@pytest.fixture
def setup_project(db_session):
    """Crée un projet simple et le stocke en BDD."""
    project = Project(
        id=str(uuid.uuid4()),
        name="Projet de Test pour Logique"
    )
    db_session.add(project)
    db_session.commit()
    return project

# =================================================================
# 1. Tests pour utils.analysis.py
# =================================================================

def test_generate_discussion_draft_logic():
    """
    Teste la logique de la fonction generate_discussion_draft
    - Filtre par score de pertinence.
    - Construit correctement le prompt pour l'IA.
    """
    # --- Setup ---
    # Création d'un DataFrame pandas de test
    data = {
        'extracted_data': [
            json.dumps({"conclusion": "Résultat A", "limites": "Limite A"}),
            json.dumps({"conclusion": "Résultat B", "limites": "Limite B"}),
            json.dumps({"conclusion": "Résultat C (faible score)"})
        ],
        'pmid': ['pmid1', 'pmid2', 'pmid3'],
        'title': ['Titre 1', 'Titre 2', 'Titre 3'],
        'relevance_score': [9.0, 7.0, 4.0] # pmid3 doit être filtré
    }
    df = pd.DataFrame(data)
    
    mock_ollama_func = MagicMock(return_value="Discussion générée.")

    # --- Act ---
    result = generate_discussion_draft(df, mock_ollama_func, 'test-model')

    # --- Assert ---
    assert result == "Discussion générée."
    mock_ollama_func.assert_called_once()
    
    # Récupère le prompt envoyé à l'IA
    prompt_arg = mock_ollama_func.call_args[0][0]
    
    # Vérifie que les données pertinentes sont dans le prompt
    assert "Résultat A" in prompt_arg
    assert "Limite A" in prompt_arg
    assert "pmid1" in prompt_arg
    assert "Résultat B" in prompt_arg
    assert "Limite B" in prompt_arg
    assert "pmid2" in prompt_arg
    
    # Vérifie que les données non pertinentes (score < 7) sont exclues
    
    
    # Vérifie que les instructions clés sont dans le prompt
    assert "Identifier les points de convergence majeurs" in prompt_arg

# =================================================================
# 2. Tests pour utils.file_handlers.py
# =================================================================

@patch('os.path.exists', return_value=True)
@patch('utils.file_handlers._extract_text_with_pymupdf', return_value="Texte de PyMuPDF.")
def test_extract_text_from_pdf_logic_pymupdf_succeeds(mock_pymupdf, mock_exists):
    """
    Cas 1: Teste que si PyMuPDF réussit, son texte est retourné.
    """
    result = extract_text_from_pdf('fake.pdf')
    assert result == "Texte de PyMuPDF."
    mock_pymupdf.assert_called_once()

@patch('os.path.exists', return_value=True)
@patch('utils.file_handlers._extract_text_with_pymupdf', return_value="") # PyMuPDF échoue
@patch('utils.file_handlers._extract_text_with_pdfplumber', return_value="Texte de PDFPlumber.") # PDFPlumber réussit
def test_extract_text_from_pdf_logic_fallback_to_pdfplumber(mock_pdfplumber, mock_pymupdf, mock_exists):
    """
    Cas 2: Teste que si PyMuPDF échoue, la fonction se rabat sur PDFPlumber.
    """
    result = extract_text_from_pdf('fake.pdf')
    assert result == "Texte de PDFPlumber."
    mock_pymupdf.assert_called_once()
    mock_pdfplumber.assert_called_once()

@patch('os.path.exists', return_value=True)
@patch('utils.file_handlers._extract_text_with_pymupdf', return_value="") # PyMuPDF échoue
@patch('utils.file_handlers._extract_text_with_pdfplumber', return_value="") # PDFPlumber échoue
@patch('utils.file_handlers._extract_text_with_ocr', return_value="") # OCR échoue
def test_extract_text_from_pdf_logic_all_fail(mock_ocr, mock_pdfplumber, mock_pymupdf, mock_exists):
    """
    Cas 3: Teste que si toutes les méthodes échouent, une chaîne vide est retournée.
    """
    result = extract_text_from_pdf('fake.pdf')
    assert result == "" # La fonction retourne une chaîne vide en cas d'échec total
    mock_pymupdf.assert_called_once()
    mock_pdfplumber.assert_called_once()
    mock_ocr.assert_called_once()

# =================================================================
# 3. Tests pour utils.fetchers.py (ArXiv & CrossRef)
# =================================================================

@patch('requests.get')
def test_fetchers_arxiv_and_crossref(mock_get):
    """
    Teste la logique de parsing pour ArXiv et CrossRef dans db_manager.
    """
    # --- Cas 1 ArXiv ---
    # Simuler une réponse XML ArXiv
    arxiv_xml = """
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <id>http://arxiv.org/abs/1234.5678v1</id>
        <title>Un Titre ArXiv Simple</title>
        <summary>Ceci est le résumé.</summary>
        <author><name>A. Auteur</name></author>
        <published>2023-01-01T00:00:00Z</published>
      </entry>
    </feed>"""
    
    mock_response_arxiv = MagicMock()
    mock_response_arxiv.status_code = 200
    mock_response_arxiv.text = arxiv_xml
    mock_get.return_value = mock_response_arxiv

    mock_get.return_value = mock_response_arxiv
    results_arxiv = db_manager.search_arxiv("IA en médecine", 1)
    
    assert len(results_arxiv) == 1
    assert results_arxiv[0]['id'] == '1234.5678v1'
    assert results_arxiv[0]['title'] == "Un Titre ArXiv Simple"
    assert results_arxiv[0]['abstract'] == "Ceci est le résumé."
    assert results_arxiv[0]['authors'] == "A. Auteur"
    assert results_arxiv[0]['database_source'] == "arxiv"

    # --- Cas 2 CrossRef ---
    # Simuler une réponse JSON CrossRef
    crossref_json = {
        "status": "ok",
        "message": {
            "items": [
                {
                    "title": ["Un Titre CrossRef"],
                    "author": [{"given": "B.", "family": "Auteur"}],
                    "abstract": "<p>Résumé CrossRef.</p>",
                    "DOI": "10.1234/cr.1",
                    "URL": "http://doi.org/10.1234/cr.1",
                    "issued": {"date-parts": [[2022, 5]]}
                }
            ]
        }
    }
    mock_response_crossref = MagicMock()
    mock_response_crossref.status_code = 200
    mock_response_crossref.json.return_value = crossref_json
    mock_get.return_value = mock_response_crossref # Réassigner la valeur de retour

    results_crossref = db_manager.search_crossref("IA en éducation", 1)
    
    assert len(results_crossref) == 1
    assert results_crossref[0]['id'] == "10.1234/cr.1"
    assert results_crossref[0]['title'] == "Un Titre CrossRef"
    assert results_crossref[0]['abstract'] == "Résumé CrossRef." # Le parsing HTML est basique
    assert results_crossref[0]['authors'] == "B. Auteur"
    assert results_crossref[0]['publication_date'] == "2022"
    assert results_crossref[0]['database_source'] == "crossref"

# =================================================================
# 4. Tests pour la Tâche d'Import (Extension Zotero)
# =================================================================

# Patch pour la session BDD interne de la tâche et la notification
@patch('tasks_v4_complete.Session') 
@patch('tasks_v4_complete.send_project_notification')
def test_import_from_zotero_json_task_logic(mock_notify, mock_session, db_session, setup_project):
    """
    Teste la logique de la tâche 'import_from_zotero_json_task'
    - Ajoute de nouveaux articles.
    - Ignore les articles déjà existants (basé sur l'article_id).
    """
    # --- Setup ---
    project_id = setup_project.id
    
    # Fait en sorte que la tâche utilise notre session de test
    mock_session.return_value = db_session 

    # 1. Créer un article déjà existant en BDD
    existing_article = SearchResult(
        id=str(uuid.uuid4()),
        project_id=project_id,
        article_id="10.1000/existing" # L'ID unique
    )
    db_session.add(existing_article)
    db_session.commit()

    # 2. Définir la liste d'items JSON envoyée par l'extension
    items_list = [
        # Item 1 Déjà existant (doit être ignoré)
        {
            "data": {
                "DOI": "10.1000/existing",
                "title": "Titre existant",
                "abstractNote": "Résumé existant."
            }
        },
        # Item 2 Nouvel item (doit être ajouté)
        {
            "data": {
                "key": "ZKEY123",
                "PMID": "9876543", # Utilisé comme article_id
                "title": "Nouveau Titre Zotero",
                "abstractNote": "Nouveau résumé.",
                "creators": [
                    {"creatorType": "author", "firstName": "Jane", "lastName": "Doe"}
                ],
                "date": "2023"
            }
        }
    ]

    # --- Act ---
    # Appel de la fonction de la tâche (décorateur non inclus)
    import_from_zotero_json_task(project_id, items_list)

    # --- Assert ---
    # Vérifier la BDD
    all_articles = db_session.query(SearchResult).filter_by(project_id=project_id).all()
    
    # On doit avoir 2 articles au total (l'existant + le nouveau)
    assert len(all_articles) == 2
    
    titles = {a.title for a in all_articles}
    assert "Titre existant" in titles
    assert "Nouveau Titre Zotero" in titles

    # Vérifier la notification (doit dire que 1 article a été ajouté, pas 2)
    mock_notify.assert_called_once_with(
        project_id, 
        'import_completed',
        "Importation Zotero (Extension) terminée : 1 articles ajoutés, 0 échecs."
    )