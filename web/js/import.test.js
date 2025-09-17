/**
 * @jest-environment jsdom
 */

import { handleIndexPdfs } from './import.js';
import { appState } from '../app.js';
import * as api from './api.js';
import * as ui from './ui.js';

// Mocker les modules dépendants
jest.mock('../app.js', () => ({
  appState: {
    currentProject: null,
  },
}));

jest.mock('./api.js', () => ({
  fetchAPI: jest.fn(),
}));

jest.mock('./ui.js', () => ({
  showLoadingOverlay: jest.fn(),
  updateLoadingProgress: jest.fn(),
  showToast: jest.fn(),
}));

describe('Fonctions d\'importation', () => {

  beforeEach(() => {
    // Réinitialiser les mocks et l'état avant chaque test
    jest.clearAllMocks();
    appState.currentProject = { id: 'project-123', name: 'Test Project' };
  });

  describe('handleIndexPdfs', () => {

    test('devrait appeler showLoadingOverlay et updateLoadingProgress au démarrage', async () => {
      // ARRANGE
      // Simuler une réponse réussie de l'API avec un ID de tâche
      api.fetchAPI.mockResolvedValue({ task_id: 'task-abc' });

      // ACT
      await handleIndexPdfs();

      // ASSERT
      // 1. Vérifie que l'overlay est affiché au tout début
      expect(ui.showLoadingOverlay).toHaveBeenCalledWith(true, "Lancement de l'indexation...");

      // 2. Vérifie que la barre de progression est initialisée à 0%
      expect(ui.updateLoadingProgress).toHaveBeenCalledWith(0, 1, "Lancement de l'indexation...");

      // 3. Vérifie que l'API a été appelée correctement
      expect(api.fetchAPI).toHaveBeenCalledWith('/projects/project-123/index-pdfs', { method: 'POST' });

      // 4. Vérifie que l'overlay est mis à jour avec le message "en cours" et l'ID de la tâche
      //    Ceci se produit après que l'appel API a réussi.
      expect(ui.showLoadingOverlay).toHaveBeenCalledWith(true, 'Indexation en cours...', 'task-abc');

      // 5. Vérifie qu'une notification de succès est affichée
      expect(ui.showToast).toHaveBeenCalledWith('Indexation lancée en arrière-plan.', 'info');
    });

  });
});