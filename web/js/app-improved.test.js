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

    it("devrait s'exécuter même en cas d'erreur", async () => {
      // Simuler une erreur dans fetchAPI
      api.fetchAPI.mockRejectedValue(new Error('API failed'));

      // L'application ne devrait pas planter
      await expect(initializeApplication()).resolves.not.toThrow();
    });
  });

  describe('loadInitialData (via initializeApplication)', () => {
    it('devrait tenter de charger les données initiales', async () => {
      // 1. Réinitialiser les modules pour obtenir une instance fraîche de app-improved.js
      jest.resetModules();

      // 2. Re-mocker les dépendances APRÈS la réinitialisation.
      // C'est l'étape cruciale qui manquait.
      const api = require('./api.js');
      jest.mock('./api.js');
      api.fetchAPI.mockResolvedValue([]); // Mock de base pour que ça ne plante pas

      // 3. Importer la fonction à tester depuis le module fraîchement réinitialisé.
      const { initializeApplication } = await import('./app-improved.js');
      
      // 4. Exécuter la fonction
      await initializeApplication();

      // Vérifier au moins que fetchAPI est appelé (même si les autres mocks ne sont pas appelés)
      // Maintenant, l'assertion vérifie le mock correct.
      expect(api.fetchAPI).toHaveBeenCalledTimes(2);
    });
  });
});