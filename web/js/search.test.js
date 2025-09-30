/**
 * @jest-environment jsdom
 */
import * as search from './search.js';
import { appState } from './app-improved.js';
import * as api from './api.js';
import * as ui from './ui-improved.js';

// Mocker les dépendances
jest.mock('./api.js');
jest.mock('./ui-improved.js', () => ({
  showToast: jest.fn(),
  escapeHtml: (str) => str,
}));
jest.mock('./app-improved.js', () => ({
  appState: {
    currentProject: null,
    availableDatabases: [],
  },
}));

describe('Module Search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = `
      <div id="searchContainer">
        <div id="search-results-status"></div>
      </div>
    `;
    appState.currentProject = { id: 'proj-1' };
    appState.availableDatabases = [{ id: 'pubmed', name: 'PubMed' }, { id: 'crossref', name: 'CrossRef' }];
  });

  describe('renderSearchSection', () => {
    it("devrait afficher un message si aucun projet n'est sélectionné", () => {
      appState.currentProject = null;
      search.renderSearchSection(null);
      expect(document.getElementById('searchContainer').innerHTML).toContain('Veuillez sélectionner un un projet pour commencer une recherche.');
    });

    it('devrait afficher les formulaires de recherche simple et experte si un projet est sélectionné', () => {
      search.renderSearchSection(appState.currentProject);
      expect(document.querySelector('form[data-action="run-multi-search"]')).not.toBeNull();
      expect(document.querySelector('form[data-action="run-expert-search"]')).not.toBeNull();
      expect(document.body.innerHTML).toContain('PubMed');
    });
  });

  describe('handleMultiDatabaseSearch', () => {
    beforeEach(() => {
      search.renderSearchSection(appState.currentProject);
    });

    it('devrait exécuter une recherche avec les bonnes données', async () => {
      api.fetchAPI.mockResolvedValue({ task_id: 'task-123' });
      const form = document.querySelector('form[data-action="run-multi-search"]');
      form.querySelector('input[name="query"]').value = 'test query';

      await search.handleMultiDatabaseSearch({ preventDefault: jest.fn(), target: form });

      expect(api.fetchAPI).toHaveBeenCalledWith('/search', expect.objectContaining({
        method: 'POST',
        body: {
          project_id: 'proj-1',
          query: 'test query',
          databases: ['pubmed', 'crossref'],
          max_results_per_db: 100,
        },
      }));
      expect(ui.showToast).toHaveBeenCalledWith('Recherche lancée en arrière-plan. Les résultats apparaîtront progressivement.', 'success');
    });

    it('devrait afficher une erreur si la requête est vide', async () => {
      const form = document.querySelector('form[data-action="run-multi-search"]');
      form.querySelector('input[name="query"]').value = '';

      await search.handleMultiDatabaseSearch({ preventDefault: jest.fn(), target: form });

      expect(api.fetchAPI).not.toHaveBeenCalled();
      expect(ui.showToast).toHaveBeenCalledWith('Veuillez saisir une requête de recherche.', 'warning');
    });
  });

  describe('handleExpertSearch', () => {
    beforeEach(() => {
      search.renderSearchSection(appState.currentProject);
    });

    it('devrait exécuter une recherche experte avec les bonnes données', async () => {
      api.fetchAPI.mockResolvedValue({ task_id: 'task-456' });
      const form = document.querySelector('form[data-action="run-expert-search"]');
      form.querySelector('input[name="pubmed"]').value = 'pubmed query';

      await search.handleExpertSearch({ preventDefault: jest.fn(), target: form });

      expect(api.fetchAPI).toHaveBeenCalledWith('/search', expect.objectContaining({
        body: {
          project_id: 'proj-1',
          expert_queries: { pubmed: 'pubmed query' },
          max_results_per_db: 100,
        },
      }));
    });

    it('devrait afficher une erreur si aucune requête experte n\'est fournie', async () => {
      const form = document.querySelector('form[data-action="run-expert-search"]');

      await search.handleExpertSearch({ preventDefault: jest.fn(), target: form });

      expect(api.fetchAPI).not.toHaveBeenCalled();
      expect(ui.showToast).toHaveBeenCalledWith('Veuillez saisir au moins une requête en mode expert.', 'warning');
    });
  });
});