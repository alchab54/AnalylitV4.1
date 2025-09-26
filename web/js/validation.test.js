/**
 * @jest-environment jsdom
 */
import * as validation from './validation.js';
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
  setCurrentValidations: jest.fn(),
  setActiveEvaluator: jest.fn(),
}));
jest.mock('./app-improved.js', () => ({
  appState: {
    currentProject: null,
    currentValidations: [],
    searchResults: [],
    activeEvaluator: 'evaluator1',
  },
  elements: {
    validationContainer: jest.fn(),
  },
}));

describe('Module Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = `<div id="validationContainer"></div>`;
    appState.currentProject = { id: 'proj-1' };
    appState.currentValidations = [];
    appState.searchResults = [];
    elements.validationContainer.mockReturnValue(document.getElementById('validationContainer'));

    // ✅ CORRECTION: Simuler la mise à jour de l'état pour que les fonctions de rendu aient des données.
    state.setCurrentValidations.mockImplementation((validations) => {
      appState.currentValidations = validations;
    });
  });

  describe('loadValidationSection', () => {
    it('devrait charger les extractions et rendre la section', async () => {
      const mockExtractions = [{ id: 'ext-1', title: 'Article 1', user_validation_status: 'include' }];
      api.fetchAPI.mockResolvedValue(mockExtractions);

      await validation.loadValidationSection();

      expect(api.fetchAPI).toHaveBeenCalledWith('/projects/proj-1/extractions');
      expect(state.setCurrentValidations).toHaveBeenCalledWith(mockExtractions);
      // renderValidationSection est appelée par loadValidationSection
      expect(document.querySelector('.validation-item')).not.toBeNull();
    });

    it("devrait afficher un message si aucun projet n'est sélectionné", async () => {
      appState.currentProject = null;
      await validation.loadValidationSection();
      expect(document.getElementById('validationContainer').innerHTML).toContain('Aucun projet sélectionné');
    });
  });

  describe('handleValidateExtraction', () => {
    it("devrait appeler l'API avec la bonne décision et le bon évaluateur", async () => {
      api.fetchAPI.mockResolvedValue({}); // Mock l'appel de validation
      api.fetchAPI.mockResolvedValueOnce({}).mockResolvedValueOnce([]); // Mock pour le rechargement

      await validation.handleValidateExtraction('ext-1', 'include');

      expect(api.fetchAPI).toHaveBeenCalledWith(
        '/projects/proj-1/extractions/ext-1/decision',
        expect.objectContaining({
          method: 'PUT',
          body: { decision: 'include', evaluator: 'evaluator1' },
        })
      );
      expect(ui.showToast).toHaveBeenCalledWith('Décision mise à jour', 'success');
    });
  });

  describe('calculateKappa', () => {
    it("devrait appeler l'API pour calculer le Kappa", async () => {
      api.fetchAPI.mockResolvedValue({ success: true, task_id: 'kappa-123' });

      await validation.calculateKappa();

      expect(api.fetchAPI).toHaveBeenCalledWith('/projects/proj-1/calculate-kappa', { method: 'POST' });
      expect(ui.showToast).toHaveBeenCalledWith('Calcul Kappa lancé (Task: kappa-123)', 'success');
    });

    it("devrait afficher une erreur si aucun projet n'est sélectionné", async () => {
      appState.currentProject = null;
      await validation.calculateKappa();
      expect(ui.showToast).toHaveBeenCalledWith('Sélectionnez un projet pour calculer le Kappa.', 'error');
      expect(api.fetchAPI).not.toHaveBeenCalled();
    });
  });
});