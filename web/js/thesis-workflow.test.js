/**
 * @jest-environment jsdom
 */
import ThesisWorkflow from './thesis-workflow.js';
import { fetchAPI } from './api.js';
import { appState } from './app-improved.js';
import { showToast } from './ui-improved.js';

// Mocker les dépendances
jest.mock('./api.js', () => ({
  fetchAPI: jest.fn(),
}));
jest.mock('./app-improved.js', () => ({
  appState: {
    currentProject: null,
    searchResults: [],
  },
}));
jest.mock('./ui-improved.js', () => ({
  showToast: jest.fn(),
}));

describe('Module ThesisWorkflow', () => {
  let workflow;

  beforeEach(() => {
    // Réinitialiser les mocks et le DOM
    jest.clearAllMocks();
    document.body.innerHTML = `
      <div id="search-form"></div>
      <div id="search-results"></div>
      <div id="validationContainer"></div>
      <div id="analysisContainer"></div>
      <div id="prismaModal"><div id="prisma-checklist-content"></div></div>
    `;
    appState.currentProject = { id: 'proj-thesis', name: 'Projet Thèse' };

    // Instancier la classe pour chaque test
    // On attache l'instance à window pour que les `onclick` dans les templates fonctionnent
    workflow = new ThesisWorkflow();
    window.thesisWorkflow = workflow;
  });

  describe('Initialization', () => {
    it('devrait initialiser les interfaces au démarrage', () => {
      expect(document.querySelector('#thesis-search-query')).not.toBeNull();
      expect(document.querySelector('.thesis-validation-header')).not.toBeNull();
      expect(document.querySelector('.export-section')).not.toBeNull();
    });

    it('devrait charger les données du projet si un projet est sélectionné', async () => {
      const refreshSpy = jest.spyOn(workflow, 'refreshProjectData').mockResolvedValue();
      await workflow.loadCurrentProject();
      expect(refreshSpy).toHaveBeenCalled();
    });
  });

  describe('handleThesisSearch', () => {
    it("ne devrait rien faire si aucun projet n'est sélectionné", async () => {
      // Directly modify the instance's property for this test case
      workflow.currentProject = null;
      const form = document.getElementById('search-form');
      form.innerHTML = `<input id="thesis-search-query" value="test"><input type="checkbox" name="databases" value="pubmed" checked><input name="max_results" value="100">`;
      const mockEvent = { preventDefault: jest.fn(), target: form };

      await workflow.handleThesisSearch(mockEvent);

      expect(showToast).toHaveBeenCalledWith("Veuillez sélectionner un projet d'abord.", 'warning');
      expect(fetchAPI).not.toHaveBeenCalled();
    });

    it('devrait lancer une recherche et appeler le polling', async () => {
      fetchAPI.mockResolvedValue({ task_id: 'task-123' });
      const pollSpy = jest.spyOn(workflow, 'pollSearchResults').mockImplementation(() => {});
      const form = document.getElementById('search-form');
      form.innerHTML = `<input id="thesis-search-query" value="test"><input type="checkbox" name="databases" value="pubmed" checked><input name="max_results" value="100">`;
      const mockEvent = { preventDefault: jest.fn(), target: form };

      await workflow.handleThesisSearch(mockEvent);

      expect(fetchAPI).toHaveBeenCalledWith('/api/search', expect.any(Object));
      expect(pollSpy).toHaveBeenCalledWith('task-123');
    });
  });

  describe('validateArticle', () => {
    it("devrait appeler l'API avec la bonne décision", async () => {
      fetchAPI.mockResolvedValue({});
      const loadSpy = jest.spyOn(workflow, 'loadValidationArticles').mockResolvedValue();

      await workflow.validateArticle('ext-1', 'include');

      expect(fetchAPI).toHaveBeenCalledWith(
        '/projects/proj-thesis/extractions/ext-1/decision',
        expect.objectContaining({
          method: 'PUT',
          body: { decision: 'include', evaluator: 'evaluator1' },
        })
      );
      expect(loadSpy).toHaveBeenCalled();
    });
  });

  describe('renderValidationStats', () => {
    it('devrait afficher les bonnes statistiques', () => {
      workflow.validationStats = { total: 10, included: 3, excluded: 5, pending: 2 };
      workflow.renderValidationStats();

      const statsContainer = document.getElementById('validation-stats');
      expect(statsContainer.textContent.replace(/\s+/g, ' ')).toContain('10 Total Articles');
      expect(statsContainer.textContent.replace(/\s+/g, ' ')).toContain('3 Inclus');
      expect(statsContainer.textContent.replace(/\s+/g, ' ')).toContain('80% Progression');
    });
  });

  describe('exportDataTable', () => {
    it("devrait générer un CSV et le télécharger", async () => {
      const mockExtractions = [{ id: '1', title: 'Test', user_validation_status: 'include' }];
      fetchAPI.mockResolvedValue(mockExtractions);
      const downloadSpy = jest.spyOn(workflow, 'downloadFile').mockImplementation(() => {});

      await workflow.exportDataTable();

      expect(fetchAPI).toHaveBeenCalledWith('/projects/proj-thesis/extractions');
      expect(downloadSpy).toHaveBeenCalledWith(
        expect.stringContaining('Titre,Auteurs,Année'),
        'tableau_donnees_Projet Thèse.csv',
        'text/csv'
      );
    });

    it("devrait afficher une alerte si aucun article n'est inclus", async () => {
      fetchAPI.mockResolvedValue([]);
      window.alert = jest.fn();
      await workflow.exportDataTable();
      expect(window.alert).toHaveBeenCalledWith('Aucun article inclus à exporter');
    });
  });
});