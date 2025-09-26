/**
 * @jest-environment jsdom
 */
import * as analyses from './analyses.js';
import { appState, elements } from './app-improved.js';
import * as api from './api.js';
import * as ui from './ui-improved.js';
import * as state from './state.js';

// Mocker les dépendances
jest.mock('./api.js');
jest.mock('./ui-improved.js', () => ({
  showToast: jest.fn(),
  showLoadingOverlay: jest.fn(),
  closeModal: jest.fn(),
  openModal: jest.fn(),
}));
jest.mock('./state.js', () => ({
  setAnalysisResults: jest.fn(),
}));
jest.mock('./app-improved.js', () => ({
  appState: {
    currentProject: null,
    prismaChecklist: {},
  },
  elements: {
    analysisContainer: jest.fn(),
  },
}));

describe('Module Analyses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = `
      <div id="analysisContainer"></div>
      <div id="prismaModal">
        <div id="prisma-checklist-content">
          <div class="prisma-item">
            <input type="checkbox" data-item-id="title" checked>
            <textarea>Notes pour le titre</textarea>
          </div>
        </div>
      </div>
    `;
    appState.currentProject = { id: 'proj-1', name: 'Projet Analyse' };
    elements.analysisContainer.mockReturnValue(document.querySelector('#analysisContainer'));
  });

  describe('loadProjectAnalyses', () => {
    it('devrait charger les analyses et rendre la section', async () => {
      await analyses.loadProjectAnalyses();

      expect(state.setAnalysisResults).toHaveBeenCalledWith(appState.currentProject);
      expect(document.querySelector('.analysis-grid')).not.toBeNull();
      expect(document.body.innerHTML).toContain('Analyse ATN Multipartite');
    });

    it("devrait afficher un message si aucun projet n'est sélectionné", async () => {
      appState.currentProject = null;
      await analyses.loadProjectAnalyses();
      expect(elements.analysisContainer().innerHTML).toContain('Sélectionnez un projet pour voir les analyses.');
    });
  });

  describe('runProjectAnalysis', () => {
    it("devrait appeler l'API pour lancer une analyse", async () => {
      api.fetchAPI.mockResolvedValue({ job_id: 'job-123' });

      await analyses.runProjectAnalysis('discussion');

      expect(api.fetchAPI).toHaveBeenCalledWith(
        '/projects/proj-1/run-analysis',
        expect.objectContaining({
          method: 'POST',
          body: { type: 'discussion' },
        })
      );
      expect(ui.showToast).toHaveBeenCalledWith('Tâche de génération du brouillon de discussion lancée', 'success');
    });

    it("ne devrait rien faire si aucun projet n'est sélectionné", async () => {
      appState.currentProject = null;
      await analyses.runProjectAnalysis('discussion');

      expect(api.fetchAPI).not.toHaveBeenCalled();
      expect(ui.showToast).toHaveBeenCalledWith('Veuillez sélectionner un projet en premier.', 'warning');
    });
  });

  describe('handleDeleteAnalysis', () => {
    it("devrait appeler l'API de suppression après confirmation", async () => {
      window.confirm = jest.fn(() => true); // Simuler le clic sur "OK"
      api.fetchAPI.mockResolvedValue({});

      await analyses.handleDeleteAnalysis('atn_scores');

      expect(window.confirm).toHaveBeenCalled();
      expect(api.fetchAPI).toHaveBeenCalledWith('/projects/proj-1/analyses/atn_scores', { method: 'DELETE' });
      expect(ui.showToast).toHaveBeenCalledWith('Résultats de l\'analyse atn_scores supprimés avec succès.', 'success');
    });
  });

  describe('savePRISMAProgress', () => {
    it('devrait collecter les données de la checklist et les envoyer à l\'API', async () => {
      api.fetchAPI.mockResolvedValue({});

      await analyses.savePRISMAProgress();

      expect(api.fetchAPI).toHaveBeenCalledWith(
        '/projects/proj-1/prisma-checklist',
        expect.objectContaining({
          method: 'POST',
          body: {
            checklist: { items: [{ id: 'title', checked: true, notes: 'Notes pour le titre' }] },
          },
        })
      );
      expect(ui.showToast).toHaveBeenCalledWith('Progression PRISMA sauvegardée.', 'success');
    });
  });
});
