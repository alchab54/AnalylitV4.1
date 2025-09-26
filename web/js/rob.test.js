/**
 * @jest-environment jsdom
 */
import * as rob from './rob.js';
import { appState, elements } from './app-improved.js';
import * as api from './api.js';
import * as ui from './ui-improved.js';

// Mocker les dépendances
jest.mock('./api.js');
jest.mock('./ui-improved.js', () => ({
  showToast: jest.fn(),
  showLoadingOverlay: jest.fn(),
  escapeHtml: (str) => str,
}));
jest.mock('./app-improved.js', () => ({
  appState: {
    currentProject: null,
    searchResults: [],
    currentProjectExtractions: [],
    selectedSearchResults: new Set(),
  },
  elements: {
    robContainer: jest.fn(), // Mock it as a simple function first
  },
}));

describe('Module RoB (Risk of Bias)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = `<div id="robContainer"></div>`;
    // Now, in beforeEach, where `document` is available, define the mock's implementation.
    elements.robContainer.mockReturnValue(document.getElementById('robContainer'));
    appState.currentProject = { id: 'proj-1' };
    appState.searchResults = [];
    appState.currentProjectExtractions = [];
    appState.selectedSearchResults.clear();
  });

  describe('loadRobSection', () => {
    it("devrait afficher un message si aucun projet n'est sélectionné", async () => {
      appState.currentProject = null;
      await rob.loadRobSection();
      expect(elements.robContainer.innerHTML).toContain('Sélectionnez un projet pour évaluer le risque de biais.');
    });

    it("devrait afficher un message si le projet n'a pas d'articles", async () => {
      appState.searchResults = [];
      await rob.loadRobSection();
      expect(elements.robContainer.innerHTML).toContain("Aucun article dans ce projet. Lancez une recherche d'abord.");
    });

    it('devrait afficher la liste des articles à évaluer', async () => {
      appState.searchResults = [{ article_id: 'art-1', title: 'Test Article' }];
      await rob.loadRobSection();
      expect(document.querySelector('.rob-article-card')).not.toBeNull();
      expect(document.body.innerHTML).toContain('Test Article');
      expect(document.querySelector('[data-action="run-rob-analysis"]')).not.toBeNull();
    });
  });

  describe('fetchAndDisplayRob', () => {
    it("devrait afficher les détails d'une évaluation RoB existante", async () => {
      const mockRobData = { domain_1_bias: 'Low risk', domain_1_justification: 'Good method' };
      api.fetchAPI.mockResolvedValue(mockRobData);
      document.body.innerHTML += `<div id="rob-summary-art-1"></div>`;
      
      // ✅ CORRECTION: The endpoint function was missing in the test setup.
      api.API_ENDPOINTS = { projectRob: (projId, artId) => `/api/projects/${projId}/articles/${artId}/rob` };
      
      await rob.fetchAndDisplayRob('art-1', false);

      expect(api.fetchAPI).toHaveBeenCalledWith('/api/projects/proj-1/articles/art-1/rob');
      expect(document.getElementById('rob-summary-art-1').innerHTML).toContain('Low risk');
      expect(document.getElementById('rob-summary-art-1').innerHTML).toContain('Good method');
    });

    it("devrait afficher le formulaire d'édition", async () => {
      const mockRobData = { domain_1_bias: 'High risk' };
      api.fetchAPI.mockResolvedValue(mockRobData);
      document.body.innerHTML += `<div id="rob-summary-art-1"></div>`;

      // ✅ CORRECTION: The endpoint function was missing in the test setup.
      api.API_ENDPOINTS = { projectRob: (projId, artId) => `/api/projects/${projId}/articles/${artId}/rob` };

      await rob.fetchAndDisplayRob('art-1', true);

      expect(document.querySelector('form[data-action="save-rob-assessment"]')).not.toBeNull();
      expect(document.querySelector('select[name="domain_1_bias"]').value).toBe('High risk');
    });
  });

  describe('handleSaveRobAssessment', () => {
    it("devrait afficher une erreur si l'API échoue", async () => {
      document.body.innerHTML += `
        <form data-action="save-rob-assessment" data-article-id="art-1">
          <button type="submit">Sauvegarder</button>
        </form>
      `;
      const form = document.querySelector('form');
      const mockEvent = { preventDefault: jest.fn(), target: form.querySelector('button') };
      api.fetchAPI.mockRejectedValue(new Error('Save Failed'));
      
      // ✅ CORRECTION: The endpoint function was missing in the test setup.
      api.API_ENDPOINTS = { projectRob: (projId, artId) => `/api/projects/${projId}/articles/${artId}/rob` };


      await rob.handleSaveRobAssessment(mockEvent);

      expect(api.fetchAPI).toHaveBeenCalled();
      expect(ui.showToast).toHaveBeenCalledWith('Erreur: Save Failed', 'error');
    });
  });

  describe('handleRunRobAnalysis', () => {
    it("devrait afficher une alerte si aucun article n'est sélectionné", async () => {
      appState.selectedSearchResults.clear();
      await rob.handleRunRobAnalysis();

      expect(ui.showToast).toHaveBeenCalledWith("Veuillez sélectionner au moins un article pour l'analyse RoB.", 'warning');
      expect(api.fetchAPI).not.toHaveBeenCalled();
    });
  });
});
