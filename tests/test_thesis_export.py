# -*- coding: utf-8 -*-
"""
Tests pour l'export spécialisé thèse et génération de rapports
Tests critiques pour le livrable final Excel + graphiques + métadonnées
"""

import pytest
import json
import uuid
from sqlalchemy import text
from unittest.mock import patch, MagicMock
import openpyxl

class TestThesisExport:
    """Tests complets export spécialisé thèse"""

    @patch('server_v4_complete.format_bibliography')
    @patch('pandas.DataFrame.to_excel')
    def test_thesis_excel_export_comprehensive(self, mock_to_excel, mock_format_bib, session):
        """
        Test export Excel complet format thèse via API.
        Vérifie que to_excel et format_bibliography sont appelés.
        """
        
        project = Project(name="Test Thesis Export", description="Desc", analysis_mode="screening")
        session.add(project)
        session.flush() # Pour obtenir l'ID auto-généré
        project_id = project.id

        search_result = SearchResult(project_id=project_id, article_id="PMID1", title="Article 1", authors="Doe J", publication_date="2023", journal="Journal A")
        extraction = Extraction(project_id=project_id, pmid="PMID1", user_validation_status="include")
        session.add_all([search_result, extraction])
        session.commit()

        # Configurer les mocks
        mock_to_excel.return_value = None
        mock_format_bib.return_value = ["Doe, J. (2023). Article 1. Journal A."]

        from server_v4_complete import create_app
        app = create_app()
        with app.test_client() as client:
            response = client.get(f'/api/projects/{project_id}/export/thesis')

        assert response.status_code == 200
        assert response.content_type == 'application/zip'
        assert 'attachment;filename=export_these_' in response.headers['Content-Disposition']
        
        # Vérifier que les fonctions de génération de contenu ont été appelées
        mock_to_excel.assert_called()
        mock_format_bib.assert_called_once()

    def test_prisma_scr_checklist_generation(self, session):
        """Test génération et sauvegarde checklist PRISMA-ScR complète via API"""
        
        project = Project(name="Test PRISMA Checklist", description="Desc", analysis_mode="screening")
        session.add(project)
        session.flush()
        project_id = project.id
        session.commit()

        from server_v4_complete import create_app
        app = create_app()
        with app.test_client() as client:
            response_get = client.get(f'/api/projects/{project_id}/prisma-checklist')
            assert response_get.status_code == 200
            
            prisma_checklist = json.loads(response_get.data)
            # CORRECTION: La clé pour un item complété est 'checked', pas 'completed'.
            prisma_checklist['sections'][0]['items'][0]['checked'] = True
            prisma_checklist['sections'][0]['items'][0]['notes'] = "Titre vérifié par le test"

            response_post = client.post(
                f'/api/projects/{project_id}/prisma-checklist',
                data=json.dumps({"checklist": prisma_checklist}),
                content_type='application/json'
            )
            assert response_post.status_code == 200
            
            response_get_again = client.get(f'/api/projects/{project_id}/prisma-checklist')
            assert response_get_again.status_code == 200
            result = json.loads(response_get_again.data)
            assert result['sections'][0]['items'][0]['checked'] is True
            assert result['sections'][0]['items'][0]['notes'] == "Titre vérifié par le test"

    def test_prisma_flow_diagram_generation(self, session):
        """Test génération diagramme de flux PRISMA via API (task enqueue)"""
        
        project = Project(name="Test PRISMA Flow", description="Desc", analysis_mode="screening")
        session.add(project)
        session.flush()
        project_id = project.id
        session.add(SearchResult(project_id=project_id, article_id="PMID1", title="Article 1"))
        session.commit()

        from server_v4_complete import create_app
        app = create_app()
        with app.test_client() as client:
            with patch('server_v4_complete.analysis_queue.enqueue') as mock_enqueue:
                # Utiliser MagicMock pour un mock plus robuste
                mock_job = MagicMock()
                mock_job.id = "fake_prisma_task_id"
                mock_enqueue.return_value = mock_job
                
                # CORRECTION: Utiliser le bon endpoint /run-analysis avec le payload correct
                response = client.post(
                    f'/api/projects/{project_id}/run-analysis',
                    data=json.dumps({"type": "prisma_flow"}),
                    content_type='application/json'
                )
                assert response.status_code == 202
                assert 'task_id' in json.loads(response.data)
                mock_enqueue.assert_called_once()
