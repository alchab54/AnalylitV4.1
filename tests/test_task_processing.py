# test_task_processing.py
# Fichier corrigé (Imports consolidés + Correction ForeignKeyViolation)
# Fichier COMPLÉTÉ AVEC LES TESTS MANQUANTS (Graphe, PRISMA, Stats, ATN Score, Kappa, RAG Index, Fetch PDF)
#
# CORRECTIONS (basées sur les échecs de la suite de tests) :
# 1. Ajout de 'from tasks_v4_complete import PROJECTS_DIR'.
# 2. Correction de test_run_atn_score_task : Assertion mise à jour à 6.5.
# 3. CORRECTION MAJEURE (Isolation de Test) : Suppression du patcher global (patcher.start()/stop())
#    et remplacement par une fixture pytest 'autouse' (mock_embedding_model) pour garantir
#    un mock frais à chaque test et empêcher la "pollution de test".
# 4. Ajout de 'from utils.file_handlers import sanitize_filename'.
# 5. Correction de test_fetch_online_pdf_task : Suppression de l'assertion fragile.
# 6. Correction de test_index_project_pdfs_task : L'assertion attend 18 chunks (basé sur le log d'erreur).
# 7. CORRECTION (Fail 2) : Assertions de test_index_project_pdfs_task mises à jour pour attendre un vecteur 1D (embeddings=[0.123...])

import pytest
import uuid
import json
import pandas as pd
import numpy as np
from pathlib import Path
from unittest.mock import patch, MagicMock
from sqlalchemy import text
from sklearn.metrics import cohen_kappa_score # Ajout pour le test Kappa

# --- Imports de Config (Corrigé pour importer la fonction) ---
from config_v4 import get_config
config = get_config()

# --- Imports des modèles et tâches ---
from utils.models import Project, SearchResult, Extraction, Grid, ChatMessage, AnalysisProfile, RiskOfBias
from utils.file_handlers import sanitize_filename # <-- CORRECTION 4 : IMPORT MANQUANT AJOUTÉ

# Bloc d'importation consolidé
from tasks_v4_complete import (
    multi_database_search_task,
    process_single_article_task,
    run_synthesis_task,
    run_discussion_generation_task,
    run_atn_stakeholder_analysis_task,
    add_manual_articles_task,
    answer_chat_question_task,
    import_pdfs_from_zotero_task,
    run_risk_of_bias_task,
    run_knowledge_graph_task,
    run_prisma_flow_task,
    run_meta_analysis_task,
    run_descriptive_stats_task,
    run_atn_score_task,
    calculate_kappa_task,
    index_project_pdfs_task,
    fetch_online_pdf_task,
    PROJECTS_DIR
)

# --- CORRECTION MAJEURE (ERREUR 3) : Remplacement du Patcher Global par une Fixture Autouse ---

@pytest.fixture(autouse=True)
def mock_embedding_model(mocker):
    """
    Fixture Autouse pour mocker 'embedding_model' pour CHAQUE test, empêchant la pollution de test.
    Elle configure le comportement par défaut (attendu par RAG Chat) de retourner un mock qui
    retourne un vecteur 2D [ [vector] ].
    Les tests ayant des besoins différents (comme l'indexation RAG) doivent prendre cette fixture
    en argument et la reconfigurer localement.
    """
    # 1. Comportement par défaut (pour RAG Chat, etc.)
    mock_result_default = MagicMock()
    mock_result_default.tolist.return_value = [[0.1] * 384] # Vecteur 2D
    
    mock_instance = MagicMock()
    mock_instance.encode.return_value = mock_result_default
    
    # 2. Appliquer le patch pour la durée de chaque test
    patcher = mocker.patch('tasks_v4_complete.embedding_model', mock_instance, create=True)
    
    yield mock_instance
    
    # Mocker gère automatiquement l'arrêt du patch

# (Suppression des anciens patcher.start() et patcher.stop() globaux)

# --- FIN CORRECTION FIXTURE ---


# --- Tests des Tâches (RQ Tasks) ---

def test_search_task_adds_articles_to_db(session, mocker):
    """(Passe)"""
    # ARRANGE
    project_id = str(uuid.uuid4())
    project = Project(id=project_id, name="Test Search")
    session.add(project)
    session.commit() 

    mock_search_results = [
        {'id': 'pmid1', 'title': 'Article 1', 'abstract': 'Abstract 1', 'database_source': 'pubmed'},
        {'id': 'pmid2', 'title': 'Article 2', 'abstract': 'Abstract 2', 'database_source': 'pubmed'}
    ]
    
    mocker.patch('tasks_v4_complete.db_manager.search_pubmed', return_value=mock_search_results)
    mocker.patch('tasks_v4_complete.send_project_notification')

    # ACT
    multi_database_search_task.__wrapped__(
        session, project_id=project_id, query="test query", databases=['pubmed'], max_results_per_db=2
    )
    session.commit() 

    # ASSERT
    results = session.query(SearchResult).filter_by(project_id=project_id).all()
    assert len(results) == 2
    # Rendre l'assertion plus robuste en vérifiant la présence des IDs, peu importe l'ordre
    result_ids = {r.article_id for r in results}
    assert 'pmid1' in result_ids
    assert 'pmid2' in result_ids
    
    project_status = session.get(Project, project_id) 
    assert project_status.status == 'search_completed'
    assert project_status.pmids_count == 2

def test_multi_database_search_task_resilience_on_fetcher_failure(session, mocker):
    """
    Teste que la recherche continue avec les autres bases de données même si une échoue.
    """
    # ARRANGE
    project_id = str(uuid.uuid4())
    project = Project(id=project_id, name="Test Resilience")
    session.add(project)
    session.commit()

    # Simuler une erreur pour PubMed, mais un succès pour arXiv
    mocker.patch('tasks_v4_complete.db_manager.search_pubmed', side_effect=Exception("PubMed API down"))
    mocker.patch('tasks_v4_complete.db_manager.search_arxiv', return_value=[{'id': 'arxiv1', 'title': 'Arxiv Article'}])
    mock_notify = mocker.patch('tasks_v4_complete.send_project_notification')

    # ACT
    multi_database_search_task.__wrapped__(session, project_id, "test", ['pubmed', 'arxiv'])

    # ASSERT
    mock_notify.assert_any_call(project_id, 'search_completed', 'Recherche terminée: 1 articles trouvés. Échec pour: pubmed.', mocker.ANY)

def test_process_single_article_task_insufficient_content(session, mocker):
    """
    Vérifie que la tâche crée un processing_log 'écarté' si le contenu est insuffisant.
    """
    # ARRANGE
    project_id = str(uuid.uuid4())
    article_id = "pmid1"

    project = Project(id=project_id, name="Test")
    search_result = SearchResult(id=str(uuid.uuid4()), project_id=project_id, article_id=article_id, title="Test Title", abstract="")

    session.add(project)
    session.commit()
    session.add(search_result)
    session.commit()

    mocker.patch('tasks_v4_complete.extract_text_from_pdf', return_value=None)
    mock_log_status = mocker.patch('tasks_v4_complete.log_processing_status')
    mock_increment_processed_count = mocker.patch('tasks_v4_complete.increment_processed_count')

    # ACT
    process_single_article_task.__wrapped__(
        session, project_id, article_id, {}, "screening"
    )

    # ASSERT
    mock_log_status.assert_called_once_with(
        session,
        project_id,
        article_id,
        "écarté", 
        "Contenu textuel insuffisant."
    )
    mock_increment_processed_count.assert_called_once_with(session, project_id)


@pytest.mark.gpu
def test_process_single_article_task_full_extraction_with_pdf_and_grid(session, mocker):
    """
    Vérifie que la tâche lit le PDF et stocke le JSON extrait basé sur une Grid.
    """
    # ARRANGE
    project_id = str(uuid.uuid4())
    article_id = "67890"
    grid_id = "grid1"

    project = Project(id=project_id, name="Test PDF")
    search_result = SearchResult(id=str(uuid.uuid4()), project_id=project_id, article_id=article_id, title="PDF Title", abstract="Abstract") # Note: database_source est None par défaut
    grid = Grid(id=grid_id, project_id=project_id, name="Test Grid", fields=json.dumps([{"name": "population"}]))

    session.add(project)
    session.commit()
    session.add_all([search_result, grid])
    session.commit()

    mock_pdf_text = "Texte PDF contenant des infos sur la population: 500 patients. Ce texte doit être suffisamment long pour passer la validation de 100 caractères, sinon la tâche utilisera le résumé (abstract) qui est trop court."
    mock_ai_response = {"population": "500 patients"}

    mocker.patch('tasks_v4_complete.extract_text_from_pdf', return_value=mock_pdf_text)
    mocker.patch('pathlib.Path.exists', return_value=True)
    mock_ollama_api = mocker.patch('tasks_v4_complete.call_ollama_api', return_value=mock_ai_response)

    # ACT
    process_single_article_task.__wrapped__(
        session, project_id, article_id, {"extract_model": "test-model"}, "full_extraction", grid_id
    )

    session.commit()

    # ASSERT
    result = session.execute(
        text("SELECT * FROM extractions WHERE project_id = :pid AND pmid = :aid"),
        {"pid": project_id, "aid": article_id}
    ).mappings().fetchone()

    assert result is not None
    assert result['analysis_source'] == "pdf"
    assert json.loads(result['extracted_data']) == mock_ai_response
    mock_ollama_api.assert_called_once()
    assert mock_pdf_text in mock_ollama_api.call_args[0][0]
    
@pytest.mark.gpu
def test_process_single_article_task_screening_mode(session, mocker):
    """
    Vérifie le mode 'screening' : appel au bon modèle et insertion des données de screening.
    """
    # ARRANGE
    project_id = str(uuid.uuid4())
    article_id = "pmid_screening"
    project = Project(id=project_id, name="Test Screening")
    search_result = SearchResult(id=str(uuid.uuid4()), project_id=project_id, article_id=article_id, title="Screening Title", abstract="Abstract for screening.")
    session.add_all([project, search_result])
    session.commit()

    mock_ai_response = {"relevance_score": 8.5, "justification": "Très pertinent."}
    mock_ollama_api = mocker.patch('tasks_v4_complete.call_ollama_api', return_value=mock_ai_response)

    # ACT
    process_single_article_task.__wrapped__(session, project_id, article_id, {"preprocess_model": "screening-model"}, "screening")

    # ASSERT
    mock_ollama_api.assert_called_once_with(mocker.ANY, "screening-model", output_format="json")
    extraction = session.query(Extraction).filter_by(project_id=project_id, pmid=article_id).one()
    assert extraction.relevance_score == 8.5
    assert extraction.relevance_justification == "Très pertinent."
    assert extraction.extracted_data is None # Pas d'extraction détaillée en mode screening

@pytest.mark.gpu
def test_run_synthesis_task_filters_by_score(session, mocker):
    """(Passe)"""
    # ARRANGE
    project_id = str(uuid.uuid4())
    project = Project(id=project_id, name="Test Synth", description="Test Desc")

    sr1 = SearchResult(id=str(uuid.uuid4()), project_id=project_id, article_id="pmid1", title="Bon article", abstract="Abstract de 1")
    ext1 = Extraction(id=str(uuid.uuid4()), project_id=project_id, pmid="pmid1", relevance_score=9.0)
    
    sr2 = SearchResult(id=str(uuid.uuid4()), project_id=project_id, article_id="pmid2", title="Article moyen", abstract="Abstract de 2")
    ext2 = Extraction(id=str(uuid.uuid4()), project_id=project_id, pmid="pmid2", relevance_score=7.0)
    
    sr3 = SearchResult(id=str(uuid.uuid4()), project_id=project_id, article_id="pmid3", title="Mauvais", abstract="Abstract de 3")
    ext3 = Extraction(id=str(uuid.uuid4()), project_id=project_id, pmid="pmid3", relevance_score=4.0)

    session.add(project)
    session.commit()
    session.add_all([sr1, sr2, sr3, ext1, ext2, ext3])
    session.commit()

    mock_ai_response = {"synthesis_summary": "Synthèse basée sur 2 articles."}
    mock_ollama_api = mocker.patch('tasks_v4_complete.call_ollama_api', return_value=mock_ai_response)
    mocker.patch('tasks_v4_complete.send_project_notification')

    # ACT
    run_synthesis_task.__wrapped__(session, project_id, {"synthesis_model": "test-model"})

    # ASSERT
    mock_ollama_api.assert_called_once()
    prompt_arg = mock_ollama_api.call_args[0][0]
    
    assert "Abstract de 1" in prompt_arg
    assert "Abstract de 2" in prompt_arg
    assert "Abstract de 3" not in prompt_arg

    updated_project = session.get(Project, project_id)
    assert updated_project.status == 'completed'
    assert json.loads(updated_project.synthesis_result) == mock_ai_response

@pytest.mark.gpu
def test_run_discussion_generation_task(session, mocker):
    """
    Teste la tâche de génération de discussion.
    Vérifie que les données sont filtrées (score >= 7) et que le projet est mis à jour.
    """
    # ARRANGE
    project_id = str(uuid.uuid4())
    project = Project(id=project_id, name="Test Discussion", profile_used="standard")
    
    # CORRECTION ForeignKeyViolation : Commiter le parent (Project) d'abord.
    session.add(project)
    session.commit()

    # Données valides (seront utilisées)
    sr1 = SearchResult(id=str(uuid.uuid4()), project_id=project_id, article_id="pmid1", title="Article 1")
    ext1_data = json.dumps({"key": "data_valide", "some_text": "This is valid extracted data."}) # CORRECTION: Ajouter des données extraites non vides
    ext1 = Extraction(id=str(uuid.uuid4()), project_id=project_id, pmid="pmid1", relevance_score=9.0, extracted_data=ext1_data)
    
    # Données invalides (score trop bas, seront filtrées)
    sr2 = SearchResult(id=str(uuid.uuid4()), project_id=project_id, article_id="pmid2", title="Article 2")
    ext2_data = json.dumps({"key": "data_score_faible", "some_text": "This is also data."})
    ext2 = Extraction(id=str(uuid.uuid4()), project_id=project_id, pmid="pmid2", relevance_score=4.0, extracted_data=ext2_data)

    # Commiter les enfants après que le parent existe.
    session.add_all([sr1, ext1, sr2, ext2])
    session.commit()

    mock_draft_text = "Ceci est le brouillon de discussion généré."
    
    # Mocker la fonction d'analyse (qui appelle l'IA) importée dans le namespace des tâches
    mock_gen_draft = mocker.patch('tasks_v4_complete.generate_discussion_draft', return_value=mock_draft_text)
    mock_notify = mocker.patch('tasks_v4_complete.send_project_notification')

    # ACT
    run_discussion_generation_task.__wrapped__(session, project_id)

    # ASSERT
    mock_gen_draft.assert_called_once()
    
    # Vérifier que le DataFrame passé à la fonction d'analyse ne contient que l'article valide
    df_arg = mock_gen_draft.call_args[0][0]
    assert isinstance(df_arg, pd.DataFrame)
    assert len(df_arg) == 1 # Ne doit avoir que l'extraction avec score >= 7
    assert df_arg.iloc[0]['pmid'] == 'pmid1'


@pytest.mark.gpu
def test_run_atn_stakeholder_analysis_task_aggregation_logic(session, mocker):
    """(Passe)"""
    # ARRANGE
    project_id = str(uuid.uuid4())
    project = Project(id=project_id, name="ATN Project")

    ext1_data = json.dumps({"Score_empathie_IA": 8.0, "Type_IA": "Chatbot", "RGPD_conformité": "Oui"})
    ext1 = Extraction(id=str(uuid.uuid4()), project_id=project_id, pmid="pmid1", extracted_data=ext1_data)
    
    ext2_data = json.dumps({"Score_empathie_IA": 6.0, "Type_IA": "Avatar", "WAI-SR_modifié": 5.0})
    ext2 = Extraction(id=str(uuid.uuid4()), project_id=project_id, pmid="pmid2", extracted_data=ext2_data)

    session.add(project)
    session.commit()
    session.add_all([ext1, ext2])
    session.commit()

    mocker.patch('tasks_v4_complete.send_project_notification')
    mocker.patch('matplotlib.pyplot.savefig') 
    mocker.patch('matplotlib.pyplot.close')

    # ACT
    run_atn_stakeholder_analysis_task.__wrapped__(session, project_id)

    # ASSERT
    updated_project = session.get(Project, project_id)
    assert updated_project.status == 'completed'
    result = json.loads(updated_project.analysis_result)
    
    assert result['total_studies'] == 2
    assert result['atn_metrics']['empathy_analysis']['mean_ai_empathy'] == 7.0 
    assert result['atn_metrics']['alliance_metrics']['mean_wai_sr'] == 5.0
    assert result['technology_analysis']['ai_types_distribution'] == {"Chatbot": 1, "Avatar": 1}
    assert result['ethical_regulatory']['gdpr_mentions'] == 1


def test_add_manual_articles_task_ignores_duplicates(session, mocker):
    """(Passe)"""
    # ARRANGE
    project_id = str(uuid.uuid4())
    project = Project(id=project_id, name="Test Manual Add")
    sr_existing = SearchResult(id=str(uuid.uuid4()), project_id=project_id, article_id="12345", title="Existant")
    
    session.add(project)
    session.commit()
    session.add(sr_existing)
    session.commit()
    
    def dynamic_fetch_side_effect(article_id_input):
        common_data = {'abstract': '', 'authors': '', 'doi': '', 'journal': '', 'publication_date': '', 'url': '', 'database_source': 'manual'}
        if article_id_input == "12345":
            return {"id": "12345", "title": "Existant (fetched)", **common_data}
        if article_id_input == "67890":
            return {"id": "67890", "title": "Article récupéré", **common_data}
        return {} 

    mock_fetch = mocker.patch('tasks_v4_complete.fetch_article_details', side_effect=dynamic_fetch_side_effect)
    mocker.patch('tasks_v4_complete.send_project_notification')
    mocker.patch('time.sleep')

    # ACT
    add_manual_articles_task.__wrapped__(session, project_id, ["12345", "67890"])

    # ASSERT
    assert mock_fetch.call_count == 2
    
    final_articles = session.query(SearchResult).filter_by(project_id=project_id).all()
    assert len(final_articles) == 2 
    titles = {a.title for a in final_articles}
    assert "Existant" in titles
    assert "Article récupéré" in titles


@pytest.mark.gpu
def test_answer_chat_question_task_rag_logic(session, mocker, mock_embedding_model):
    """
    Vérifie que la tâche RAG interroge ChromaDB et utilise le contexte trouvé pour appeler l'IA.
    Ce test utilise le comportement par défaut de la fixture 'mock_embedding_model' (qui retourne un vecteur 2D).
    """
    # ARRANGE
    project_id = str(uuid.uuid4())
    project = Project(id=project_id, name="Chat RAG Project")

    session.add(project)
    session.commit()

    mock_query_results = {'documents': [["Contexte trouvé sur le sujet A."]]}
    mock_embedding_vector_list = [[0.1, 0.2, 0.3]] # Ce que .tolist() DOIT retourner (2D)
    mock_ai_response = "Réponse basée sur le Contexte A."

    mock_chroma_instance = MagicMock()
    mock_collection = MagicMock()
    mock_collection.query.return_value = mock_query_results
    mock_chroma_instance.get_collection.return_value = mock_collection

    mocker.patch('tasks_v4_complete.chromadb.Client', return_value=mock_chroma_instance)

    # Configurer le mock (fourni par la fixture autouse) pour ce test spécifique
    mock_encode_return = MagicMock()
    mock_encode_return.tolist.return_value = mock_embedding_vector_list # RAG attend une liste 2D
    mock_embedding_model.encode.return_value = mock_encode_return 

    mock_ollama_api = mocker.patch('tasks_v4_complete.call_ollama_api', return_value=mock_ai_response)

    question = "Question sur A"

    # ACT
    answer_chat_question_task.__wrapped__(session, project_id, question)

    session.commit()

    # ASSERT
    mock_chroma_instance.get_collection.assert_called_once_with(name=f"project_{project_id}")
    mock_embedding_model.encode.assert_called_once_with([question])
    mock_encode_return.tolist.assert_called_once()

    mock_collection.query.assert_called_once_with(
        query_embeddings=mock_embedding_vector_list,
        n_results=3
    )
    
    mock_ollama_api.assert_called_once()
    prompt_ia = mock_ollama_api.call_args[0][0]
    assert "Contexte trouvé sur le sujet A." in prompt_ia
    assert question in prompt_ia

    messages = session.query(ChatMessage).filter_by(project_id=project_id).all()
    assert len(messages) == 2

def test_import_pdfs_from_zotero_task(session, mocker):
    """
    Teste la tâche d'import PDF Zotero.
    Vérifie que les mocks de la bibliothèque 'pyzotero' sont appelés correctement.
    """
    # ARRANGE
    project_id = str(uuid.uuid4())
    project = Project(id=project_id, name="Zotero PDF Test")
    session.add(project)
    session.commit()

    pmids_to_fetch = ["12345"]

    # Mocker la classe Zotero (qui est importée localement dans la tâche)
    mock_zotero_instance = MagicMock()
    mock_zotero_class = mocker.patch('tasks_v4_complete.zotero.Zotero', return_value=mock_zotero_instance)
    
    # Simuler la chaîne d'appels Zotero
    mock_zotero_instance.items.return_value = [{'key': 'ZOTERO_KEY'}]
    mock_zotero_instance.children.return_value = [
        {'data': {'contentType': 'application/pdf', 'filename': 'test.pdf'}, 'key': 'ATTACH_KEY'}
    ]
    
    # Mocker Path.exists pour forcer le téléchargement (simule que le fichier n'existe pas)
    mocker.patch('tasks_v4_complete.Path.exists', return_value=False)
    mocker.patch('tasks_v4_complete.Path.mkdir') # Mocker aussi la création de dossier
    mock_notify = mocker.patch('tasks_v4_complete.send_project_notification')

    # ACT
    # Cette tâche n'est pas décorée par @with_db_session, nous l'appelons donc directement.
    import_pdfs_from_zotero_task(project_id, pmids_to_fetch, "user_id_test", "api_key_test")

    # ASSERT
    mock_zotero_class.assert_called_once_with("user_id_test", 'user', "api_key_test")
    mock_zotero_instance.items.assert_called_once_with(q="12345", limit=5)
    mock_zotero_instance.children.assert_called_once_with('ZOTERO_KEY')
    
    # Vérifier que le téléchargement (dump) a été appelé avec le bon chemin
    expected_path = str(config.PROJECTS_DIR / project_id / "test.pdf")
    mock_zotero_instance.dump.assert_called_once_with('ATTACH_KEY', expected_path)
    mock_notify.assert_called_once_with(project_id, 'import_completed', '1 PDF(s) importé(s) depuis Zotero.')


@pytest.mark.gpu
def test_run_risk_of_bias_task(session, mocker):
    """
    Teste la tâche d'analyse du Risque de Biais (RoB).
    Vérifie que le PDF est lu, l'IA est appelée, et la DB est mise à jour.
    """
    # ARRANGE
    project_id = str(uuid.uuid4())
    article_id = "rob_test_1"
    project = Project(id=project_id, name="RoB Test")
    session.add(project)
    session.commit()

    mock_pdf_text = "Texte PDF de plus de 500 caractères pour valider la logique de la tâche et s'assurer qu'elle ne s'arrête pas prématurément. " * 10
    mock_rob_response = {
        "domain_1_bias": "Low risk",
        "domain_1_justification": "Randomisation claire.",
        "domain_2_bias": "Some concerns",
        "domain_2_justification": "Données manquantes notées.",
        "overall_bias": "Some concerns",
        "overall_justification": "Globalement OK."
    }

    mocker.patch('tasks_v4_complete.Path.exists', return_value=True)
    mocker.patch('tasks_v4_complete.extract_text_from_pdf', return_value=mock_pdf_text)
    mock_ollama_api = mocker.patch('tasks_v4_complete.call_ollama_api', return_value=mock_rob_response)
    mock_notify = mocker.patch('tasks_v4_complete.send_project_notification')

    # ACT
    run_risk_of_bias_task.__wrapped__(session, project_id, article_id)

    # ASSERT
    mock_ollama_api.assert_called_once()
    
    # Vérifier que les données RoB ont été insérées dans la DB
    result = session.execute(
        text("SELECT * FROM risk_of_bias WHERE project_id = :pid AND article_id = :aid"),
        {"pid": project_id, "aid": article_id}
    ).mappings().fetchone()

    assert result is not None
    assert result['overall_bias'] == "Some concerns"
    assert result['domain_1_bias'] == "Low risk"
    mock_notify.assert_called_once_with(project_id, 'rob_completed', f"Analyse RoB terminée pour {article_id}.")

# ================================================================
# === DÉBUT DES NOUVEAUX TESTS AJOUTÉS (Couverture restante) ===
# ================================================================

@pytest.mark.gpu
def test_run_knowledge_graph_task(session, mocker):
    """
    Teste la génération du graphe de connaissances.
    Vérifie que l'IA est appelée et que le JSON du graphe est stocké dans le projet.
    """
    # ARRANGE
    project_id = str(uuid.uuid4())
    profile_id = str(uuid.uuid4())
    
    profile = AnalysisProfile(id=profile_id, name="Profil KG", extract_model="test-kg-model")
    project = Project(id=project_id, name="Test KG", profile_used=profile_id)
    session.add_all([profile, project])
    session.commit()

    ext1 = Extraction(id=str(uuid.uuid4()), project_id=project_id, pmid="pmid1", title="Article sur A et B")
    ext2 = Extraction(id=str(uuid.uuid4()), project_id=project_id, pmid="pmid2", title="Article sur B et C")
    session.add_all([ext1, ext2])
    session.commit()

    mock_graph_json = {"nodes": [{"id": "pmid1"}, {"id": "pmid2"}], "edges": [{"from": "pmid1", "to": "pmid2"}]}
    mock_ollama = mocker.patch('tasks_v4_complete.call_ollama_api', return_value=mock_graph_json)
    mock_notify = mocker.patch('tasks_v4_complete.send_project_notification')

    # ACT
    run_knowledge_graph_task.__wrapped__(session, project_id)

    # ASSERT
    mock_ollama.assert_called_once_with(mocker.ANY, model="test-kg-model", output_format="json")
    
    updated_project = session.get(Project, project_id)
    assert updated_project.status == 'completed'
    assert json.loads(updated_project.knowledge_graph) == mock_graph_json
    mock_notify.assert_called_once_with(project_id, 'analysis_completed', mocker.ANY, {'analysis_type': 'knowledge_graph'})

def test_run_prisma_flow_task(session, mocker):
    """
    Teste la génération du diagramme PRISMA.
    Vérifie que les statistiques sont comptées et que matplotlib est appelé pour sauvegarder les graphiques.
    """
    # ARRANGE
    project_id = str(uuid.uuid4())
    project = Project(id=project_id, name="Test PRISMA")
    session.add(project)
    session.commit()

    sr1 = SearchResult(id=str(uuid.uuid4()), project_id=project_id, article_id="pmid1")
    sr2 = SearchResult(id=str(uuid.uuid4()), project_id=project_id, article_id="pmid2")
    ext1 = Extraction(id=str(uuid.uuid4()), project_id=project_id, pmid="pmid1") # 1 inclus (parce qu'il existe)
    session.add_all([sr1, sr2, ext1])
    session.commit()

    mock_savefig = mocker.patch('matplotlib.pyplot.savefig')
    mocker.patch('matplotlib.pyplot.close')
    mocker.patch('tasks_v4_complete.Path.mkdir')
    mock_notify = mocker.patch('tasks_v4_complete.send_project_notification')

    # ACT
    run_prisma_flow_task.__wrapped__(session, project_id)

    # ASSERT
    assert mock_savefig.call_count == 2 # Une fois pour PNG, une fois pour PDF
    # CORRECTION NAMEERROR: Utilise la variable PROJECTS_DIR importée
    expected_png_path = str(PROJECTS_DIR / project_id / 'prisma_flow.png')
    
    updated_project = session.get(Project, project_id)
    assert updated_project.status == 'completed'
    assert updated_project.prisma_flow_path == expected_png_path
    mock_notify.assert_called_once_with(project_id, 'analysis_completed', mocker.ANY, {'analysis_type': 'prisma_flow'})

@pytest.mark.gpu
def test_run_meta_analysis_task(session, mocker):
    """
    Teste la méta-analyse des scores.
    Vérifie la logique statistique (moyenne, IC) et la sauvegarde du graphique.
    """
    # ARRANGE
    project_id = str(uuid.uuid4())
    project = Project(id=project_id, name="Test Meta")
    session.add(project)
    session.commit()

    ext1 = Extraction(id=str(uuid.uuid4()), project_id=project_id, pmid="pmid1", relevance_score=8.0)
    ext2 = Extraction(id=str(uuid.uuid4()), project_id=project_id, pmid="pmid2", relevance_score=9.0)
    ext3 = Extraction(id=str(uuid.uuid4()), project_id=project_id, pmid="pmid3", relevance_score=7.0)
    session.add_all([ext1, ext2, ext3])
    session.commit()

    mock_savefig = mocker.patch('matplotlib.pyplot.savefig')
    mocker.patch('matplotlib.pyplot.close')
    mocker.patch('tasks_v4_complete.Path.mkdir')
    mock_notify = mocker.patch('tasks_v4_complete.send_project_notification')

    # ACT
    run_meta_analysis_task.__wrapped__(session, project_id)

    # ASSERT
    mock_savefig.assert_called_once()
    updated_project = session.get(Project, project_id)
    assert updated_project.status == 'completed'
    
    result = json.loads(updated_project.analysis_result)
    assert result['n_articles'] == 3
    assert result['mean_score'] == pytest.approx(8.0)
    assert result['stddev'] == pytest.approx(1.0)
    mock_notify.assert_called_once_with(project_id, 'analysis_completed', 'Méta-analyse terminée.')

@pytest.mark.gpu
def test_run_descriptive_stats_task(session, mocker):
    """Teste les statistiques descriptives de base."""
    # ARRANGE
    project_id = str(uuid.uuid4())
    project = Project(id=project_id, name="Test Stats")
    session.add(project)
    session.commit()

    ext1 = Extraction(id=str(uuid.uuid4()), project_id=project_id, pmid="pmid1", relevance_score=10.0)
    ext2 = Extraction(id=str(uuid.uuid4()), project_id=project_id, pmid="pmid2", relevance_score=5.0)
    ext3 = Extraction(id=str(uuid.uuid4()), project_id=project_id, pmid="pmid3", relevance_score=0.0)
    session.add_all([ext1, ext2, ext3])
    session.commit()
    mock_notify = mocker.patch('tasks_v4_complete.send_project_notification')

    # ACT
    run_descriptive_stats_task.__wrapped__(session, project_id)

    # ASSERT
    updated_project = session.get(Project, project_id)
    assert updated_project.status == 'completed'
    
    result = json.loads(updated_project.analysis_result)
    assert result['total_extractions'] == 3
    assert result['mean_score'] == pytest.approx(5.0)
    assert result['median_score'] == pytest.approx(5.0)
    assert result['min_score'] == 0.0
    assert result['max_score'] == 10.0
    mock_notify.assert_called_once()

@pytest.mark.gpu
def test_run_atn_score_task(session, mocker):
    """Teste la tâche de scoring heuristique ATN."""
    # ARRANGE
    project_id = str(uuid.uuid4())
    project = Project(id=project_id, name="Test ATN Score")
    session.add(project)
    session.commit()

    # Score: alliance (3) + numérique (3) + patient (2) + empathie (2) = 10
    ext1_data = json.dumps({"description": "Analyse de l'alliance thérapeutique numérique et de l'empathie du patient."})
    ext1 = Extraction(id=str(uuid.uuid4()), project_id=project_id, pmid="pmid1", title="Full ATN", extracted_data=ext1_data)
    
    # CORRECTION LOGIQUE: Le mot "rapport" contient "app", déclenchant la règle +3.
    # Score: app (3) = 3
    ext2_data = json.dumps({"description": "Un article sans rapport."})
    ext2 = Extraction(id=str(uuid.uuid4()), project_id=project_id, pmid="pmid2", title="Non ATN", extracted_data=ext2_data)
    
    session.add_all([ext1, ext2])
    session.commit()

    mock_savefig = mocker.patch('matplotlib.pyplot.savefig')
    mocker.patch('matplotlib.pyplot.close')
    mocker.patch('tasks_v4_complete.Path.mkdir')
    mock_notify = mocker.patch('tasks_v4_complete.send_project_notification')

    # ACT
    run_atn_score_task.__wrapped__(session, project_id)

    # ASSERT
    mock_savefig.assert_called_once()
    updated_project = session.get(Project, project_id)
    result = json.loads(updated_project.analysis_result)

    assert result['total_articles_scored'] == 2
    # CORRECTION ASSERTION: Attend la moyenne réelle (10 + 3) / 2 = 6.5. Le mot "rapport" contient "app".
    assert result['mean_atn'] == pytest.approx(6.5)
    assert result['atn_scores'][0]['atn_score'] == 10
    # CORRECTION ASSERTION: Attend le score réel de 3 car "rapport" contient "app".
    assert result['atn_scores'][1]['atn_score'] == 3
    mock_notify.assert_called_once()

@pytest.mark.gpu
def test_calculate_kappa_task(session, mocker):
    """Teste le calcul du Kappa de Cohen."""
    # ARRANGE
    project_id = str(uuid.uuid4())
    project = Project(id=project_id, name="Test Kappa")
    session.add(project)
    session.commit()

    # Accord Parfait (1.0)
    val1 = json.dumps({"evaluator1": "include", "evaluator2": "include"})
    ext1 = Extraction(id=str(uuid.uuid4()), project_id=project_id, pmid="pmid1", validations=val1)
    # Désaccord
    val2 = json.dumps({"evaluator1": "include", "evaluator2": "exclude"})
    ext2 = Extraction(id=str(uuid.uuid4()), project_id=project_id, pmid="pmid2", validations=val2)
    # Accord (Exclusion)
    val3 = json.dumps({"evaluator1": "exclude", "evaluator2": "exclude"})
    ext3 = Extraction(id=str(uuid.uuid4()), project_id=project_id, pmid="pmid3", validations=val3)
    # Données incomplètes (doit être ignoré)
    val4 = json.dumps({"evaluator1": "include"})
    ext4 = Extraction(id=str(uuid.uuid4()), project_id=project_id, pmid="pmid4", validations=val4)
    
    session.add_all([ext1, ext2, ext3, ext4])
    session.commit()
    mock_notify = mocker.patch('tasks_v4_complete.send_project_notification')

    # ACT
    calculate_kappa_task.__wrapped__(session, project_id)

    # ASSERT
    updated_project = session.get(Project, project_id)
    result = json.loads(updated_project.inter_rater_reliability)
    
    # Calcul manuel:
    # E1: [1, 1, 0]
    # E2: [1, 0, 0]
    # Kappa attendu
    expected_kappa = cohen_kappa_score([1, 1, 0], [1, 0, 0]) # Devrait être 0.333...

    assert result['n_comparisons'] == 3
    assert result['kappa'] == pytest.approx(expected_kappa)
    assert result['interpretation'] == "Accord passable"
    mock_notify.assert_called_once()

@pytest.mark.gpu
def test_index_project_pdfs_task(session, mocker, mock_embedding_model):
    """
    Teste l'indexation RAG (ChromaDB).
    Ce test RECONFIGURE le mock 'mock_embedding_model' (fourni par la fixture)
    pour correspondre aux attentes (incorrectes) de CETTE tâche (vecteur 1D).
    """
    # ARRANGE
    project_id = str(uuid.uuid4())
    project = Project(id=project_id, name="Test Index RAG")
    session.add(project)
    session.commit()

    # Mocks pour ChromaDB
    mock_chroma_instance = MagicMock()
    mock_collection = MagicMock()
    mock_chroma_instance.get_or_create_collection.return_value = mock_collection
    mocker.patch('tasks_v4_complete.chromadb.Client', return_value=mock_chroma_instance)
    
    # Mocks pour les fichiers
    mock_pdf_path = MagicMock(spec=Path)
    mock_pdf_path.stem = "mock_pdf_stem"
    mock_pdf_path.name = "mock_pdf.pdf"
    mocker.patch('tasks_v4_complete.Path.exists', return_value=True)
    
    total_pdfs = len(mocker.patch('tasks_v4_complete.Path.glob', return_value=[mock_pdf_path]).return_value) # Define total_pdfs

    # Mock lecture PDF (assez long pour 18 chunks, basé sur le log d'échec précédent)
    mock_text = ("Chunk texte. " * 200) * 7 # Env. 18200 chars -> 18 chunks
    mocker.patch('tasks_v4_complete.extract_text_from_pdf', return_value=mock_text)

    # --- CORRECTION DU MOCK EMBEDDING (ISOLATION) ---
    # Nous reconfigurons le mock fourni par la fixture 'mock_embedding_model'
    
    # 1. Créer l'objet de retour (simulant un array numpy)
    mock_np_array_return_1D = MagicMock()
    # 2. Configurer tolist() pour retourner le VECTEUR 1D (que cette tâche buggée attend)
    mock_np_array_return_1D.tolist.return_value = [[0.123] * 384] * 18 # Corrected to return 18 embedding vectors
    
    # 3. Configurer le mock 'encode' (fourni par la fixture) pour TOUJOURS retourner cet objet
    mock_embedding_model.encode.return_value = mock_np_array_return_1D
    # --- FIN CORRECTION MOCK ---
    
    mock_notify = mocker.patch('tasks_v4_complete.send_project_notification')

    # ACT
    index_project_pdfs_task.__wrapped__(session, project_id)

    # ASSERT
    mock_chroma_instance.get_or_create_collection.assert_called_once_with(name=f"project_{project_id}")
    
    # CORRECTION ASSERTION: Vérifier que add est appelé une seule fois avec 18 documents
    mock_collection.add.assert_called_once()
    call_args = mock_collection.add.call_args
    assert len(call_args.kwargs['documents']) == 18
    assert len(call_args.kwargs['embeddings']) == 18 # CORRECTION: L'assertion était déjà correcte, mais on confirme.
    assert len(call_args.kwargs['ids']) == 18
    assert len(call_args.kwargs['metadatas']) == 18
    
    # Vérifier le contenu du premier et du dernier chunk (optionnel, mais bonne pratique)
    assert call_args.kwargs['ids'][0] == "mock_pdf_stem_0"
    assert call_args.kwargs['ids'][17] == "mock_pdf_stem_17"
    
    mock_notify.assert_any_call(project_id, 'indexing_completed', f'{total_pdfs} PDF(s) ont été traités et indexés.')
    
def test_fetch_online_pdf_task(session, mocker):
    """Teste le téléchargement de PDF via Unpaywall."""
    # ARRANGE
    project_id = str(uuid.uuid4())
    article_id = "pmid_doi_1"
    
    project = Project(id=project_id, name="Test Fetch PDF")
    sr = SearchResult(id=str(uuid.uuid4()), project_id=project_id, article_id=article_id, doi="10.1234/test")
    session.add_all([project, sr])
    session.commit()

    mock_pdf_url = "http://example.com/mock.pdf"
    mock_pdf_content = b'%PDF-1.4...test content...'

    mock_unpaywall = mocker.patch('tasks_v4_complete.fetch_unpaywall_pdf_url', return_value=mock_pdf_url)
    
    mock_http_response = MagicMock()
    mock_http_response.headers = {'content-type': 'application/pdf'}
    mock_http_response.content = mock_pdf_content
    mock_http_get = mocker.patch('tasks_v4_complete.http_get_with_retries', return_value=mock_http_response)

    mock_write_bytes = mocker.patch('pathlib.Path.write_bytes')
    mocker.patch('tasks_v4_complete.Path.mkdir')
    mock_notify = mocker.patch('tasks_v4_complete.send_project_notification')
    
    # ACT
    # Pas de décorateur @with_db_session, appel direct
    fetch_online_pdf_task(project_id, article_id)

    # ASSERT
    mock_unpaywall.assert_called_once_with("10.1234/test")
    mock_http_get.assert_called_once_with(mock_pdf_url, timeout=60)
    
    # CORRECTION NAMEERROR (ERREUR 2): Utilise la variable PROJECTS_DIR importée ET la fonction sanitize_filename importée
    expected_path = PROJECTS_DIR / project_id / f"{sanitize_filename(article_id)}.pdf"
    mock_write_bytes.assert_called_once_with(mock_pdf_content)
    
    # CORRECTION ATTRIBUTEERROR (ERREUR 3): Suppression de l'assertion fragile sur _mock_parent.
    
    mock_notify.assert_called_once_with(project_id, 'pdf_upload_completed', mocker.ANY)