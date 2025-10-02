# -*- coding: utf-8 -*-
"""
Tests pour l'export spécialisé thèse et génération de rapports
Tests critiques pour le livrable final Excel + graphiques + métadonnées
"""

import pytest
import json
from unittest.mock import patch, MagicMock

# --- Imports des modèles ---
from utils.models import Project, SearchResult, Extraction

class TestThesisExport:
    """Tests complets pour l'export spécialisé thèse"""

    # La fixture 'client' est maintenant injectée directement
    @patch('api.projects.format_bibliography')
    @patch('pandas.DataFrame.to_excel')
    def test_thesis_excel_export_comprehensive(self, mock_to_excel, mock_format_bib, client, db_session):
        """
        Test de l'export Excel complet format thèse via API.
        Vérifie que to_excel et format_bibliography sont appelés.
        """
        # --- ARRANGE (Préparation) ---
        # Configurer les mocks
        mock_to_excel.return_value = None
        mock_format_bib.return_value = ["Doe, J. (2023). Article 1. Journal A."]

        # Création des données de test via la fixture de session
        project = Project(name="Test Thesis Export", description="Desc", analysis_mode="screening")
        db_session.add(project)
        db_session.flush()  # Pour obtenir l'ID auto-généré
        project_id = project.id

        # CORRECTION : Assurer que SearchResult et Extraction sont liés par le même article_id/pmid
        # pour que la jointure dans la requête de l'API fonctionne.
        article_id_to_include = "PMID12345"
        search_result = SearchResult(project_id=project_id, article_id=article_id_to_include, title="Article 1", authors="Doe J", publication_date="2023", journal="Journal A", abstract="Abstract de test.")
        # L'extraction doit avoir le même pmid et le statut 'include'
        extraction = Extraction(project_id=project_id, pmid=article_id_to_include, user_validation_status="include")

        db_session.add_all([search_result, extraction])
        db_session.flush()

        # --- ACT (Action) ---
        # Utiliser le client de test fourni par la fixture
        response = client.get(f'/api/projects/{project_id}/export/thesis')

        # --- ASSERT (Vérification) ---
        assert response.status_code == 200, "La requête devrait réussir"
        assert response.content_type == 'application/zip', "Le contenu doit être un fichier zip"
        assert 'attachment; filename=export_these_' in response.headers['Content-Disposition'], "Le nom du fichier doit être correct"
        
        # Vérifier que les fonctions de génération de contenu ont été appelées
        mock_to_excel.assert_called_once()
        mock_format_bib.assert_called_once()

    def test_prisma_scr_checklist_generation(self, client, db_session):
        """Test de la génération et sauvegarde de la checklist PRISMA-ScR complète via API"""
        # --- ARRANGE ---
        project = Project(name="Test PRISMA Checklist", description="Desc", analysis_mode="screening")
        db_session.add(project)
        db_session.flush()
        project_id = project.id
        db_session.flush()

        # --- ACT & ASSERT ---
        # 1. Récupérer la checklist de base
        response_get = client.get(f'/api/projects/{project_id}/prisma-checklist')
        assert response_get.status_code == 200
        
        prisma_checklist = response_get.json
        
        # 2. Modifier la checklist
        prisma_checklist['sections'][0]['items'][0]['checked'] = True
        prisma_checklist['sections'][0]['items'][0]['notes'] = "Titre vérifié par le test"

        # 3. Sauvegarder la checklist modifiée
        response_post = client.post(
            f'/api/projects/{project_id}/prisma-checklist',
            json={"checklist": prisma_checklist} # Utiliser 'json=' pour envoyer du JSON
        )
        assert response_post.status_code == 200
        
        # 4. Revérifier que les données ont bien été sauvegardées
        response_get_again = client.get(f'/api/projects/{project_id}/prisma-checklist')
        assert response_get_again.status_code == 200
        result = response_get_again.json
        assert result['sections'][0]['items'][0]['checked'] is True
        assert result['sections'][0]['items'][0]['notes'] == "Titre vérifié par le test"

    def test_prisma_flow_diagram_generation(self, client, db_session):
        """Test de la génération du diagramme de flux PRISMA via API (mise en file d'attente de la tâche)"""
        # --- ARRANGE ---
        project = Project(name="Test PRISMA Flow", description="Desc", analysis_mode="screening")
        db_session.add(project)
        db_session.flush()
        project_id = project.id
        db_session.add(SearchResult(project_id=project_id, article_id="PMID1", title="Article 1"))
        db_session.flush()

        # --- ACT & ASSERT ---
        with patch('backend.server_v4_complete.analysis_queue.enqueue') as mock_enqueue:
            mock_job = MagicMock()
            mock_job.id = "fake_prisma_task_id"
            mock_enqueue.return_value = mock_job
            
            # Utiliser le bon endpoint /run-analysis avec le payload correct
            response = client.post(
                f'/api/projects/{project_id}/run-analysis',
                json={"type": "prisma_flow"}
            )
            
            assert response.status_code == 202
            assert 'job_id' in response.json
            mock_enqueue.assert_called_once()
