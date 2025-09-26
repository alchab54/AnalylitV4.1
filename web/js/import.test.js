/**
 * @jest-environment jsdom
 */

import { handleIndexPdfs, handleZoteroImport, handleUploadPdfs, processPmidImport } from './import.js';
import { appState } from './app-improved.js';
import * as api from './api.js';
import * as uiImproved from './ui-improved.js';
import * as articles from './articles.js';

// Mocker les modules dépendants
jest.mock('./app-improved.js', () => ({
  appState: {
    currentProject: null,
  },
}));
jest.mock('./api.js', () => ({
  fetchAPI: jest.fn(),
}));
jest.mock('./ui-improved.js', () => ({
  showLoadingOverlay: jest.fn(),
  updateLoadingProgress: jest.fn(),
  showToast: jest.fn(),
  closeModal: jest.fn(),
}));
jest.mock('./articles.js', () => ({
  loadSearchResults: jest.fn(),
}));

describe('Fonctions d\'importation', () => {

  beforeEach(() => {
    // Réinitialiser les mocks et l\'état avant chaque test
    jest.clearAllMocks();
    appState.currentProject = { id: 'project-123', name: 'Test Project' };
    // Add the loading overlay to the DOM
    document.body.innerHTML = '<div id="loadingOverlay"></div><textarea id="pmid-list"></textarea>';
  });

  describe('handleIndexPdfs', () => {

    test('devrait appeler showLoadingOverlay et updateLoadingProgress au démarrage', async () => {
      // ARRANGE
      // Simuler une réponse réussie de l\'API avec un ID de tâche
      api.fetchAPI.mockResolvedValue({ job_id: 'task-abc' });

      // ACT
      await handleIndexPdfs();

      // ASSERT
      // 1. Vérifie que l\'overlay est affiché au tout début
      expect(uiImproved.showLoadingOverlay).toHaveBeenCalledWith(true, "Lancement de l\'indexation...");

      // 2. Vérifie que la barre de progression est initialisée à 0%
      expect(uiImproved.updateLoadingProgress).toHaveBeenCalledWith(0, 1, "Lancement de l\'indexation...");

      // 3. Vérifie que l\'API a été appelée correctement
      expect(api.fetchAPI).toHaveBeenCalledWith('/projects/project-123/index-pdfs', { method: 'POST' });

      // 4. Vérifie que l\'overlay est mis à jour avec le message "en cours" et l\'ID de la tâche
      //    Ceci se produit après que l\'appel API a réussi.
      expect(uiImproved.showLoadingOverlay).toHaveBeenCalledWith(true, 'Indexation en cours...', 'task-abc');

      // 5. Vérifie qu\'une notification de succès est affichée
      expect(uiImproved.showToast).toHaveBeenCalledWith('Indexation lancée en arrière-plan.', 'info');
    });

  });
});

describe('handleZoteroImport', () => {
    it('devrait traiter un fichier Zotero', async () => {
        const mockFile = new File(['{}'], 'zotero.json', { type: 'application/json' });
        const mockInput = { files: [mockFile] };
        api.fetchAPI.mockResolvedValue({ imported: 5 });

        await handleZoteroImport(mockInput);

        expect(uiImproved.showLoadingOverlay).toHaveBeenCalledWith(true, "Import du fichier Zotero...");
        expect(api.fetchAPI).toHaveBeenCalledWith('/projects/project-123/import/zotero', expect.any(Object));
        expect(uiImproved.showToast).toHaveBeenCalledWith("5 références importées.", 'success');
        expect(articles.loadSearchResults).toHaveBeenCalled();
    });
});

describe('handleUploadPdfs', () => {
    it('devrait traiter un upload de PDF', async () => {
        const mockFile = new File(['pdf content'], 'test.pdf', { type: 'application/pdf' });
        const mockInput = { files: [mockFile] };
        api.fetchAPI.mockResolvedValue({ successful_uploads: ['test.pdf'] });

        await handleUploadPdfs(mockInput);

        expect(uiImproved.showLoadingOverlay).toHaveBeenCalledWith(true, "Upload de 1 PDF(s)...");
        expect(api.fetchAPI).toHaveBeenCalledWith('/projects/project-123/upload-pdfs', expect.any(Object));
        expect(uiImproved.showToast).toHaveBeenCalledWith("1 PDFs uploadés", 'success');
    });

    it('devrait rejeter plus de 20 PDFs', async () => {
        const mockFiles = Array(21).fill(new File([''], 'test.pdf'));
        const mockInput = { files: mockFiles };

        await handleUploadPdfs(mockInput);

        expect(uiImproved.showToast).toHaveBeenCalledWith("Maximum 20 PDFs autorisés par upload.", 'warning');
        expect(api.fetchAPI).not.toHaveBeenCalled();
    });
});

describe('processPmidImport', () => {
    it('devrait importer une liste de PMIDs', async () => {
        document.getElementById('pmid-list').value = '12345\n67890';
        const mockEvent = { preventDefault: jest.fn() };
        api.fetchAPI.mockResolvedValue({});

        await processPmidImport(mockEvent);

        expect(uiImproved.closeModal).toHaveBeenCalled();
        expect(api.fetchAPI).toHaveBeenCalledWith('/projects/project-123/add-articles', expect.any(Object));
        expect(uiImproved.showToast).toHaveBeenCalledWith("Import lancé pour 2 identifiant(s).", 'success');
    });
});
