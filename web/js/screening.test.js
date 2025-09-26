/**
 * @jest-environment jsdom
 */
import * as screening from './screening.js';
import { appState, elements } from './app-improved.js';
import * as api from './api.js';
import * as ui from './ui-improved.js';
import * as state from './state.js';

// Mocker les dépendances
jest.mock('./api.js');
jest.mock('./ui-improved.js', () => ({
  showToast: jest.fn(),
  showLoadingOverlay: jest.fn(),
  escapeHtml: (str) => str,
}));
jest.mock('./state.js', () => ({
  setScreeningDecisions: jest.fn(),
}));
jest.mock('./app-improved.js', () => ({
  appState: {
    currentProject: null,
    screeningDecisions: [],
  },
  elements: {
    screeningContainer: jest.fn(),
  },
}));

describe('Module Screening', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = `<div id="screeningContainer"></div>`;
    elements.screeningContainer.mockReturnValue(document.getElementById('screeningContainer'));
    appState.currentProject = null;
    appState.screeningDecisions = [];
  });

  describe('initializeScreeningSection', () => {
    it('devrait appeler renderScreeningView si aucun projet n\'est sélectionné', () => {
      screening.initializeScreeningSection();
      expect(elements.screeningContainer().innerHTML).toContain('Sélectionnez un projet pour commencer le screening.');
      expect(api.fetchAPI).not.toHaveBeenCalled();
    });

    it('devrait charger les décisions si un projet est sélectionné', async () => {
      appState.currentProject = { id: 'proj-1' };
      api.fetchAPI.mockResolvedValue([]);

      await screening.initializeScreeningSection();

      expect(ui.showLoadingOverlay).toHaveBeenCalledWith(true, expect.any(String));
      expect(api.fetchAPI).toHaveBeenCalledWith('/projects/proj-1/screening-decisions');
      expect(ui.showLoadingOverlay).toHaveBeenCalledWith(false);
    });
  });

  describe('renderScreeningView', () => {
    it("devrait afficher un message si aucun article n'est à screener", () => {
      appState.currentProject = { id: 'proj-1' };
      screening.renderScreeningView([]);
      expect(elements.screeningContainer().innerHTML).toContain('Aucun article à screener pour le moment.');
    });

    it('devrait afficher la liste des articles à screener', () => {
      appState.currentProject = { id: 'proj-1' };
      const mockDecisions = [{ title: 'Article 1', abstract: 'Résumé 1' }];
      screening.renderScreeningView(mockDecisions);

      expect(document.querySelector('.screening-item')).not.toBeNull();
      expect(document.body.innerHTML).toContain('Article 1');
      expect(document.body.innerHTML).toContain('Résumé 1');
    });
  });

  describe('loadScreeningDecisions (via initialize)', () => {
    it("devrait gérer une erreur de l'API", async () => {
      appState.currentProject = { id: 'proj-1' };
      api.fetchAPI.mockRejectedValue(new Error('API Error'));

      await screening.initializeScreeningSection();

      expect(ui.showToast).toHaveBeenCalledWith('Erreur lors du chargement des décisions de screening: API Error', 'error');
    });
  });
});