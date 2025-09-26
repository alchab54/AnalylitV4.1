/**
 * @jest-environment jsdom
 */
import * as articles from './articles.js';
import { appState, elements } from './app-improved.js';
import * as api from './api.js';
import * as uiImproved from './ui-improved.js';
import * as state from './state.js';

// Mocker les dépendances
jest.mock('./app-improved.js', () => ({
  appState: {
    currentProject: null,
    searchResults: [],
    currentProjectExtractions: [],
    currentProjectFiles: new Set(),
    selectedSearchResults: new Set(),
  },
  elements: {
    resultsContainer: jest.fn(),
  },
}));
jest.mock('./api.js');
jest.mock('./ui-improved.js', () => ({
  showLoadingOverlay: jest.fn(),
  showModal: jest.fn(),
  closeModal: jest.fn(),
  escapeHtml: (str) => str,
  showToast: jest.fn(),
}));
// ✅ CORRECTION: Déclarer les mocks sans accéder à des variables hors de portée.
jest.mock('./state.js', () => ({
  setSearchResults: jest.fn(),
  setCurrentProjectExtractions: jest.fn(),
  isArticleSelected: jest.fn(),
  addSelectedArticle: jest.fn(),
  removeSelectedArticle: jest.fn(),
  getSelectedArticles: jest.fn(),
  setCurrentSection: jest.fn(),
}));
jest.mock('./projects.js');
jest.mock('./grids.js');

describe('Module Articles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = `
      <div id="resultsContainer">
        <div id="results-list"></div>
      </div>
      <div id="articleDetailModal">
        <div id="articleDetailContent"></div>
      </div>
      <div id="batchProcessModal">
        <div class="modal-body"></div>
      </div>
    `;
    appState.currentProject = { id: 'proj-1' };
    appState.searchResults = [];
    appState.selectedSearchResults.clear();
    elements.resultsContainer.mockReturnValue(document.querySelector('#resultsContainer'));

    // ✅ CORRECTION: Configurer le comportement des mocks ici, où appState est accessible.
    state.setSearchResults.mockImplementation((results) => appState.searchResults = results);
    state.setCurrentProjectExtractions.mockImplementation((extractions) => appState.currentProjectExtractions = extractions);
    state.isArticleSelected.mockImplementation((id) => appState.selectedSearchResults.has(id));
    state.getSelectedArticles.mockReturnValue(Array.from(appState.selectedSearchResults));

  });

  describe('loadSearchResults', () => {
    it('devrait charger et afficher les résultats de recherche', async () => {
      const mockArticles = { articles: [{ article_id: '1', title: 'Test Article' }], meta: {} };
      api.fetchAPI.mockResolvedValue(mockArticles);
      
      // ✅ CORRECTION: Assurer que l'appel pour les extractions retourne un tableau vide.
      api.fetchAPI.mockResolvedValueOnce(mockArticles) // For search results
                   .mockResolvedValueOnce([]);      // For extractions

      await articles.loadSearchResults();

      expect(api.fetchAPI).toHaveBeenCalledWith('/projects/proj-1/search-results?page=1');
      expect(state.setSearchResults).toHaveBeenCalledWith(mockArticles.articles, mockArticles.meta);
      expect(document.querySelector('.result-row')).not.toBeNull();
      expect(document.body.innerHTML).toContain('Test Article');
    });

    it("devrait afficher un message si aucun projet n'est sélectionné", async () => {
      appState.currentProject = null;
      await articles.loadSearchResults();
      expect(document.querySelector('#resultsContainer').innerHTML).toContain('Aucun projet sélectionné');
    });
  });

  describe('renderSearchResultsTable', () => {
    it("devrait afficher un message si aucun résultat n'est trouvé", () => {
      appState.searchResults = [];
      articles.renderSearchResultsTable();
      expect(document.querySelector('#results-list').innerHTML).toContain('Aucun résultat trouvé');
    });
  });

  describe('viewArticleDetails', () => {
    it("devrait ouvrir une modale avec les détails de l'article", async () => {
      appState.searchResults = [{ article_id: '1', title: 'Article Détaillé' }];
      
      // ✅ CORRECTION: Assurer que currentProjectExtractions est un tableau.
      appState.currentProjectExtractions = [];

      await articles.viewArticleDetails('1');
      expect(uiImproved.showModal).toHaveBeenCalledWith('articleDetailModal');
      expect(document.querySelector('#articleDetailContent').innerHTML).toContain('Article Détaillé');
    });
  });

  describe('startBatchProcessing', () => {
    it('devrait lancer le traitement par lot pour les articles sélectionnés', async () => {
      state.getSelectedArticles.mockReturnValue(['1', '2']);
      api.fetchAPI.mockResolvedValue({});

      await articles.startBatchProcessing();

      expect(uiImproved.closeModal).toHaveBeenCalledWith('batchProcessModal');
      expect(uiImproved.showLoadingOverlay).toHaveBeenCalledWith(true, 'Lancement du screening pour 2 article(s)...');
      expect(api.fetchAPI).toHaveBeenCalledWith('/projects/proj-1/run', expect.any(Object));
      expect(uiImproved.showToast).toHaveBeenCalledWith('Tâche de screening lancée avec succès', 'success');
      expect(state.setCurrentSection).toHaveBeenCalledWith('validation');
    });
  });

  describe('handleDeleteSelectedArticles', () => {
    it('ne devrait rien faire si aucun article n\'est sélectionné', async () => {
      state.getSelectedArticles.mockReturnValue([]);
      await articles.handleDeleteSelectedArticles();
      expect(uiImproved.showToast).toHaveBeenCalledWith('Aucun article sélectionné', 'warning');
      expect(api.fetchAPI).not.toHaveBeenCalled();
    });
  });
});