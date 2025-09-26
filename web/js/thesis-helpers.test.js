/**
 * @jest-environment jsdom
 */
import * as thesisHelpers from './thesis-helpers.js';
import { appState } from './app-improved.js';
import * as api from './api.js';

// Mocker les dépendances
jest.mock('./api.js');
jest.mock('./app-improved.js', () => ({
  appState: {
    currentProject: null,
  },
}));

describe('Module Thesis Helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    appState.currentProject = { id: 'proj-thesis', name: 'Projet Thèse' };

    // Mocker les fonctions du DOM pour le téléchargement
    global.URL.createObjectURL = jest.fn(() => 'blob:http://localhost/mock-url');
    global.URL.revokeObjectURL = jest.fn();
    const mockLink = {
      href: '',
      download: '',
      click: jest.fn(),
    };
    jest.spyOn(document, 'createElement').mockReturnValue(mockLink);
    jest.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    jest.spyOn(document.body, 'removeChild').mockImplementation(() => {});
  });

  describe('exportPRISMAForThesis', () => {
    it("ne devrait rien faire si aucun projet n'est sélectionné", async () => {
      appState.currentProject = null;
      global.fetch = jest.fn();
      await thesisHelpers.exportPRISMAForThesis();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('devrait télécharger un fichier docx en cas de succès', async () => {
      const mockBlob = new Blob(['test'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      global.fetch = jest.fn().mockResolvedValue({
        blob: () => Promise.resolve(mockBlob),
      });

      const result = await thesisHelpers.exportPRISMAForThesis();

      expect(global.fetch).toHaveBeenCalledWith('/projects/proj-thesis/export/thesis');
      expect(document.createElement).toHaveBeenCalledWith('a');
      const link = document.createElement.mock.results[0].value;
      expect(link.download).toBe('prisma_Projet Thèse.docx');
      expect(link.click).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("devrait gérer une erreur de fetch", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network Error'));
      jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await thesisHelpers.exportPRISMAForThesis();

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith('Erreur export PRISMA:', expect.any(Error));
      console.error.mockRestore();
    });
  });

  describe('calculateThesisStats', () => {
    it("devrait retourner null si aucun projet n'est sélectionné", async () => {
      appState.currentProject = null;
      const stats = await thesisHelpers.calculateThesisStats();
      expect(stats).toBeNull();
      expect(api.fetchAPI).not.toHaveBeenCalled();
    });

    it('devrait calculer les statistiques correctement', async () => {
      const mockArticles = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const mockExtractions = [
        { user_validation_status: 'include', relevance_score: 8 },
        { user_validation_status: 'exclude', relevance_score: 2 },
        { user_validation_status: null, relevance_score: 5 },
      ];
      api.fetchAPI
        .mockResolvedValueOnce(mockArticles)
        .mockResolvedValueOnce(mockExtractions);

      const stats = await thesisHelpers.calculateThesisStats();

      expect(stats.totalArticles).toBe(3);
      expect(stats.includedArticles).toBe(1);
      expect(stats.excludedArticles).toBe(1);
      expect(stats.pendingArticles).toBe(1);
      expect(stats.averageRelevanceScore).toBeCloseTo(5);
    });
  });

  describe('exportCompleteThesisData', () => {
    it('devrait télécharger un fichier JSON avec toutes les données', async () => {
      const mockAnalyses = [{ type: 'discussion', result: '...' }];
      const mockArticles = [{ id: 1 }];
      const mockExtractions = [{ user_validation_status: 'include' }];

      // Mock all API calls that will be made internally
      api.fetchAPI
        .mockResolvedValueOnce(mockArticles) // for calculateThesisStats's first call
        .mockResolvedValueOnce(mockExtractions) // for calculateThesisStats's second call
        .mockResolvedValueOnce(mockAnalyses); // for the analyses call

      const result = await thesisHelpers.exportCompleteThesisData();

      // Verify the API calls were made as expected
      expect(api.fetchAPI).toHaveBeenCalledWith('/projects/proj-thesis/articles');
      expect(api.fetchAPI).toHaveBeenCalledWith('/projects/proj-thesis/extractions');
      expect(api.fetchAPI).toHaveBeenCalledWith('/projects/proj-thesis/analyses');
      expect(document.createElement).toHaveBeenCalledWith('a');
      const link = document.createElement.mock.results[0].value;
      expect(link.download).toBe('thesis_data_Projet Thèse.json');
      expect(link.click).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });
});