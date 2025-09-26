/**
 * @jest-environment jsdom
 */

// On importe les fonctions à tester depuis le module.
// Note : On ne peut pas mocker les fonctions internes au module (comme loadAnalysisProfiles) facilement,
// donc on teste leurs effets en mockant leurs dépendances.
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
    // Configurer les mocks pour qu'ils retournent des promesses résolues par défaut
    projects.loadProjects.mockResolvedValue([]);
    api.fetchAPI.mockResolvedValue([]);

    // Mock the implementation of state functions to update the mocked appState
    state.setAnalysisProfiles.mockImplementation(profiles => { appState.analysisProfiles = profiles; });
    state.setAvailableDatabases.mockImplementation(databases => { appState.availableDatabases = databases; });
    state.initializeState.mockImplementation(() => { /* do nothing */ });

  });

  describe('initializeApplication', () => {
    // Increase timeout for this test to handle async operations
    it("devrait appeler toutes les fonctions d'initialisation dans le bon ordre", async () => {
      initializeApplication();
      // Wait for all promises in the event loop to resolve
      await new Promise(resolve => setTimeout(resolve, 0));

      // Vérifier que les fonctions d'initialisation de base sont appelées
      expect(state.initializeState).toHaveBeenCalledTimes(1);
      expect(core.setupDelegatedEventListeners).toHaveBeenCalledTimes(1);
      expect(core.initializeWebSocket).toHaveBeenCalledTimes(1);

      // Vérifier que le chargement des données initiales est déclenché
      expect(projects.loadProjects).toHaveBeenCalledTimes(1);
      expect(api.fetchAPI).toHaveBeenCalledWith('/api/analysis-profiles');
      expect(api.fetchAPI).toHaveBeenCalledWith('/api/databases');

      // Vérifier que la section par défaut est affichée
      expect(core.showSection).toHaveBeenCalledWith('projects');
    });

    it("devrait gérer une erreur lors du chargement des données initiales", async () => {
      // Simuler un échec lors du chargement des projets
      projects.loadProjects.mockRejectedValue(new Error('Failed to load projects'));

      initializeApplication();
      // ✅ CORRECTION: Utiliser setTimeout pour attendre que la boucle d'événements traite la promesse rejetée
      await new Promise(resolve => setTimeout(resolve, 0));
      // Vérifier qu'une erreur est loggée et affichée à l'utilisateur
      expect(ui.showError).toHaveBeenCalledWith("Erreur lors de l'initialisation de l'application");
      // S'assurer que l'application n'essaie pas d'afficher une section si les données ont échoué
      expect(core.showSection).not.toHaveBeenCalled();
    });
  });

  describe('loadInitialData (via initializeApplication)', () => {
    it('devrait appeler les fonctions de chargement de données et mettre à jour l\'état', async () => {
      // Configurer les mocks pour retourner des données spécifiques
      projects.loadProjects.mockResolvedValue([{ id: 'p1' }]);
      // Use mockImplementation to handle different API calls
      api.fetchAPI.mockImplementation((url) => {
        if (url.includes('analysis-profiles')) return Promise.resolve([{ id: 'ap1' }]);
        if (url.includes('databases')) return Promise.resolve([{ id: 'db1' }]);
        return Promise.resolve([]);
      });

      initializeApplication();
      // ✅ CORRECTION: Attendre la résolution des promesses
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(projects.loadProjects).toHaveBeenCalled();
      expect(state.setAnalysisProfiles).toHaveBeenCalledWith([{ id: 'ap1' }]);
      expect(state.setAvailableDatabases).toHaveBeenCalledWith([{ id: 'db1' }]);
    });
  });
});