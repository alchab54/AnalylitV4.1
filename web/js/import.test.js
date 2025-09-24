/**
 * @jest-environment jsdom
 */

import { handleIndexPdfs } from './import.js';
import { appState } from './app-improved.js';
import * as api from './api.js';
import * as uiImproved from './ui-improved.js';
import * as state from './state.js';

// Mocker les modules dépendants
jest.mock('./app-improved.js', () => ({
  appState: {
    currentProject: null,
  },
}));
jest.mock('./api.js', () => ({
  fetchAPI: jest.fn(),
}));
jest.mock('./ui-improved.js', () => ({
  showLoadingOverlay: jest.fn(),
  updateLoadingProgress: jest.fn(),
  showToast: jest.fn(), // Mock showToast from ui-improved.js
}));
jest.mock('./state.js', () => ({
  // Mock all functions from state.js that might be used
  setSearchResults: jest.fn(),
  setCurrentProjectExtractions: jest.fn(),
  setLoadingState: jest.fn(),
  setCurrentSection: jest.fn(),
  // Add other state functions as needed by the modules being tested
}));

describe('Fonctions d\'importation', () => {

  beforeEach(() => {
    // Réinitialiser les mocks et l\'état avant chaque test
    jest.clearAllMocks();
    appState.currentProject = { id: 'project-123', name: 'Test Project' };
    // Add the loading overlay to the DOM
    document.body.innerHTML = '<div id="loadingOverlay"></div>'; 
  });

  describe('handleIndexPdfs', () => {

    test('devrait appeler showLoadingOverlay et updateLoadingProgress au démarrage', async () => {
      // ARRANGE
      // Simuler une réponse réussie de l\'API avec un ID de tâche
      api.fetchAPI.mockResolvedValue({ job_id: 'task-abc' }); // Changed task_id to job_id

      // ACT
      await handleIndexPdfs();

      // ASSERT
      // 1. Vérifie que l\'overlay est affiché au tout début
      expect(uiImproved.showLoadingOverlay).toHaveBeenCalledWith(true, "Lancement de l\'indexation...");

      // 2. Vérifie que la barre de progression est initialisée à 0%
      expect(uiImproved.updateLoadingProgress).toHaveBeenCalledWith(0, 1, "Lancement de l\'indexation...");

      // 3. Vérifie que l\'API a été appelée correctement
      expect(api.fetchAPI).toHaveBeenCalledWith('/projects/project-123/index-pdfs', { method: 'POST' });

      // 4. Vérifie que l\'overlay est mis à jour avec le message "en cours" et l\'ID de la tâche
      //    Ceci se produit après que l\'appel API a réussi.
      expect(uiImproved.showLoadingOverlay).toHaveBeenCalledWith(true, 'Indexation en cours...', 'task-abc');

      // 5. Vérifie qu\'une notification de succès est affichée
      expect(uiImproved.showToast).toHaveBeenCalledWith('Indexation lancée en arrière-plan.', 'info');
    });

  });
});
