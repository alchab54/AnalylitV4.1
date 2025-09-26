/**
 * @jest-environment jsdom
 */
import * as grids from './grids.js';
import { appState } from './app-improved.js';
import * as api from './api.js';
import * as ui from './ui-improved.js';
import * as state from './state.js';

// Mocker les dépendances
jest.mock('./api.js');
jest.mock('./ui-improved.js', () => ({
  showToast: jest.fn(),
  escapeHtml: (str) => str,
}));
jest.mock('./state.js', () => ({
  setCurrentProjectGrids: jest.fn(),
}));
jest.mock('./app-improved.js', () => ({
  appState: {
    currentProject: null,
    currentProjectGrids: [],
  },
}));

describe('Module Grids', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = `<div id="gridsContainer"></div>`;
    appState.currentProject = { id: 'proj-1' };
    appState.currentProjectGrids = [];

    // Configure the mock to update the appState when called
    state.setCurrentProjectGrids.mockImplementation((grids) => {
      appState.currentProjectGrids = grids;
    });
  });

  describe('loadProjectGrids', () => {
    it('devrait charger les grilles et appeler le rendu', async () => {
      const mockGrids = [{ id: 'g1', name: 'Grille PICOS' }];
      api.fetchAPI.mockResolvedValue(mockGrids);

      await grids.loadProjectGrids('proj-1');

      expect(api.fetchAPI).toHaveBeenCalledWith('/projects/proj-1/grids');
      expect(state.setCurrentProjectGrids).toHaveBeenCalledWith(mockGrids);
      // Le rendu est appelé à l'intérieur, on vérifie son effet
      expect(document.querySelector('.card[data-grid-id="g1"]')).not.toBeNull();
    });

    it("devrait afficher une erreur si le chargement échoue", async () => {
      api.fetchAPI.mockRejectedValue(new Error('API Error'));
      await grids.loadProjectGrids('proj-1');
      expect(ui.showToast).toHaveBeenCalledWith('Erreur lors du chargement des grilles.', 'error');
    });
  });

  describe('renderGridsSection', () => {
    it("devrait afficher un message si aucun projet n'est sélectionné", () => {
      grids.renderGridsSection(null, {});
      expect(document.getElementById('gridsContainer').innerHTML).toContain('Sélectionnez un projet pour voir ses grilles.');
    });

    it("devrait afficher un message si aucune grille n'existe", () => {
      appState.currentProjectGrids = [];
      grids.renderGridsSection(appState.currentProject, {});
      expect(document.getElementById('gridsContainer').innerHTML).toContain('Aucune grille personnalisée.');
    });
  });

  describe('handleDeleteGrid', () => {
    beforeEach(() => {
      appState.currentProjectGrids = [{ id: 'g1', name: 'Grille à supprimer' }];
    });

    it("devrait supprimer une grille après confirmation", async () => {
      window.confirm = jest.fn(() => true);
      api.fetchAPI.mockResolvedValue({});

      await grids.handleDeleteGrid('g1');

      expect(window.confirm).toHaveBeenCalled();
      expect(api.fetchAPI).toHaveBeenCalledWith('/projects/proj-1/grids/g1', { method: 'DELETE' });
      expect(ui.showToast).toHaveBeenCalledWith('Grille supprimée.', 'success');
      expect(state.setCurrentProjectGrids).toHaveBeenCalledWith([]);
    });

    it("ne devrait rien faire si l'utilisateur annule", async () => {
      window.confirm = jest.fn(() => false);
      await grids.handleDeleteGrid('g1');
      expect(api.fetchAPI).not.toHaveBeenCalled();
    });
  });

  describe('handleSaveGrid', () => {
    it("devrait afficher une erreur si le nom ou les champs sont manquants", async () => {
      document.body.innerHTML += `
        <form id="gridForm">
          <input name="id" value="">
          <input name="name" value="">
          <input name="description" value="">
          <div id="gridFields"></div>
        </form>
      `;
      const mockEvent = { preventDefault: jest.fn() };

      await grids.handleSaveGrid(mockEvent);

      expect(api.fetchAPI).not.toHaveBeenCalled();
      expect(ui.showToast).toHaveBeenCalledWith('Le nom de la grille et au moins un champ sont requis.', 'warning');
    });
  });
});