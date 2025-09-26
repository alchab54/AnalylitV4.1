/**
 * @jest-environment jsdom
 */
 
import { initializeApplication, loadInitialData } from './app-improved.js';
 
// On mocke toutes les dépendances externes.
import * as state from './state.js';
import * as core from './core.js';
import * as projects from './projects.js';
import * as api from './api.js';
import * as ui from './ui-improved.js';
 
jest.mock('./state.js');
jest.mock('./core.js');
jest.mock('./projects.js');
jest.mock('./api.js');
jest.mock('./ui-improved.js', () => ({
  showError: jest.fn(),
}));
 
describe('Module App Improved - Initialisation', () => {
  beforeEach(() => {
    // Réinitialiser tous les mocks avant chaque test
    jest.clearAllMocks();
    // Simuler le DOM minimal requis par la fonction d'initialisation
    document.body.innerHTML = `
      <button class="app-nav__button" data-section-id="projects"></button>
    `;
    // ✅ CORRECTION: Configuration des mocks plus robuste
    projects.loadProjects.mockResolvedValue([{ id: 'project1' }]);
    api.fetchAPI.mockImplementation((url) => {
      if (url === '/api/analysis-profiles') return Promise.resolve([{ id: 'ap1' }]);
      if (url === '/api/databases') return Promise.resolve([{ id: 'db1' }]);
      return Promise.resolve([]);
    });
  });
 
  describe('initializeApplication', () => {
    it("devrait appeler toutes les fonctions d'initialisation dans le bon ordre", async () => {
      await initializeApplication();
 
      // Vérifier que les fonctions d'initialisation de base sont appelées
      expect(state.initializeState).toHaveBeenCalledTimes(1);
      expect(core.setupDelegatedEventListeners).toHaveBeenCalledTimes(1);
      expect(core.initializeWebSocket).toHaveBeenCalledTimes(1);
 
      // ✅ CORRECTION: Vérifier les appels exacts attendus
      expect(api.fetchAPI).toHaveBeenCalledWith('/api/analysis-profiles');
      expect(api.fetchAPI).toHaveBeenCalledWith('/api/databases');
      expect(projects.loadProjects).toHaveBeenCalledTimes(1);
 
      // Vérifier que la section par défaut est affichée
      expect(core.showSection).toHaveBeenCalledWith('projects');
    });
 
    it("devrait gérer une erreur lors du chargement des données initiales", async () => {
      // ✅ CORRECTION: Simuler un échec dans fetchAPI au lieu de loadProjects
      api.fetchAPI.mockRejectedValue(new Error('API Error'));
 
      await initializeApplication();
      await new Promise(resolve => setTimeout(resolve, 0)); // Wait for the catch block to execute
 
      expect(ui.showError).toHaveBeenCalledWith("Erreur lors de l'initialisation de l'application");
      expect(core.showSection).not.toHaveBeenCalled();
    });
  });
 
  describe('loadInitialData (via initializeApplication)', () => {
    it('devrait appeler les fonctions de chargement de données et mettre à jour l\'état', async () => {
      await initializeApplication();
      await new Promise(resolve => setTimeout(resolve, 0)); // Wait for all promises to resolve
 
      expect(projects.loadProjects).toHaveBeenCalled();
      expect(state.setAnalysisProfiles).toHaveBeenCalledWith([{ id: 'ap1' }]);
      expect(state.setAvailableDatabases).toHaveBeenCalledWith([{ id: 'db1' }]);
    });
  });
});