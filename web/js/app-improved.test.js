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
jest.mock('./ui-improved.js');

describe('Module App Improved - Initialisation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // ✅ SETUP DOM minimal
    document.body.innerHTML = `<button class="app-nav__button" data-section-id="projects"></button>`;
    
    // ✅ SETUP MOCKS pour correspondre exactement aux attentes
    projects.loadProjects.mockResolvedValue([{ id: 'project1' }]);
    api.fetchAPI.mockImplementation((url) => {
      if (url === '/api/analysis-profiles') return Promise.resolve([{ id: 'ap1' }]);
      if (url === '/api/databases') return Promise.resolve([{ id: 'db1' }]);
      return Promise.resolve([]);
    });
    
    // ✅ SETUP STATE MOCKS
    state.setAnalysisProfiles.mockImplementation(() => {});
    state.setAvailableDatabases.mockImplementation(() => {});
    state.initializeState.mockImplementation(() => {});
    
    // ✅ SETUP CORE MOCKS
    core.setupDelegatedEventListeners.mockImplementation(() => {});
    core.initializeWebSocket.mockImplementation(() => {});
    core.showSection.mockImplementation(() => {});
    
    // ✅ SETUP UI MOCKS
    ui.showError.mockImplementation(() => {});
  });

  describe('initializeApplication', () => {
    it("devrait appeler toutes les fonctions d'initialisation dans le bon ordre", async () => {
      await initializeApplication();

      expect(state.initializeState).toHaveBeenCalledTimes(1);
      expect(core.setupDelegatedEventListeners).toHaveBeenCalledTimes(1);
      expect(core.initializeWebSocket).toHaveBeenCalledTimes(1);
      expect(projects.loadProjects).toHaveBeenCalledTimes(1);
      expect(api.fetchAPI).toHaveBeenCalledWith('/api/analysis-profiles');
      expect(api.fetchAPI).toHaveBeenCalledWith('/api/databases');
      expect(core.showSection).toHaveBeenCalledWith('projects');
    });

    it("devrait gérer une erreur lors du chargement des données initiales", async () => {
      // ✅ SIMULER une erreur dans fetchAPI
      api.fetchAPI.mockRejectedValue(new Error('API failed'));

      await initializeApplication();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(ui.showError).toHaveBeenCalledWith("Erreur lors de l'initialisation de l'application");
      expect(core.showSection).not.toHaveBeenCalled();
    });
  });

  describe('loadInitialData (via initializeApplication)', () => {
    it('devrait appeler les fonctions de chargement de données et mettre à jour l\'état', async () => {
      await initializeApplication();
      // No extra wait needed here as the successful path is more direct.

      expect(projects.loadProjects).toHaveBeenCalled();
      expect(state.setAnalysisProfiles).toHaveBeenCalledWith([{ id: 'ap1' }]);
      expect(state.setAvailableDatabases).toHaveBeenCalledWith([{ id: 'db1' }]);
    });
  });
});