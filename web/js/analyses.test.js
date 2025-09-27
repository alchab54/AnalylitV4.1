/**
 * @jest-environment jsdom
 */
import * as analyses from './analyses.js';
import { appState, elements } from './app-improved.js';
import * as api from './api.js';
import * as ui from './ui-improved.js';
import * as state from './state.js';

// Mocker les dépendances
jest.mock('./api.js');
jest.mock('./ui-improved.js', () => ({
  showToast: jest.fn(),
  showLoadingOverlay: jest.fn(),
  closeModal: jest.fn(),
  openModal: jest.fn(),
}));
jest.mock('./state.js', () => ({
  setAnalysisResults: jest.fn(),
}));
jest.mock('./app-improved.js', () => ({
  appState: {
    currentProject: null,
    prismaChecklist: {},
  },
  elements: {
    analysisContainer: jest.fn(),
  },
}));

describe('Module Analyses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = `
      <div id="analysisContainer"></div>
      <div id="prismaModal">
        <div id="prisma-checklist-content">
          <div class="prisma-item">
            <input type="checkbox" data-item-id="title" checked>
            <textarea>Notes pour le titre</textarea>
          </div>
        </div>
      </div>
    `;
    appState.currentProject = { id: 'proj-1', name: 'Projet Analyse' };
    elements.analysisContainer.mockReturnValue(document.querySelector('#analysisContainer'));
  });

  describe('loadProjectAnalyses', () => {
    it('devrait charger les analyses et rendre la section', async () => {
      // ✅ CORRECTION: The function now fetches an array of analyses, not the whole project.
      const mockAnalysesArray = [
        { type: 'discussion', content: 'This is a discussion.' },
        { type: 'knowledge_graph', content: { nodes: [], edges: [] } }
      ];
      api.fetchAPI.mockResolvedValue(mockAnalysesArray);

      await analyses.loadProjectAnalyses();

      // The function transforms the array into an object.
      const expectedResultsObject = {
        'discussion_result': mockAnalysesArray[0],
        'knowledge_graph_result': mockAnalysesArray[1]
      };
      expect(state.setAnalysisResults).toHaveBeenCalledWith(expectedResultsObject);
      expect(document.querySelector('.analysis-grid')).not.toBeNull();
      expect(document.body.innerHTML).toContain('Analyse ATN Multipartite');
    });

    it("devrait afficher un message si aucun projet n'est sélectionné", async () => {
      appState.currentProject = null;
      await analyses.loadProjectAnalyses();
      // ✅ CORRECTION: Utiliser `textContent` au lieu de `innerHTML` pour ignorer les balises HTML
      // et les espaces, ce qui rend le test plus robuste.
      expect(elements.analysisContainer().textContent).toContain('Veuillez sélectionner un projet pour visualiser les analyses.');
    });

    it("devrait gérer une erreur de l'API", async () => {
      // Simuler un échec de l'API en utilisant un mock qui rejette la promesse
      api.fetchAPI.mockRejectedValue(new Error('API Error'));
      jest.spyOn(console, 'error').mockImplementation(() => {}); // Masquer le console.error pour ce test      
      await analyses.loadProjectAnalyses();
      expect(ui.showToast).toHaveBeenCalledWith('Erreur lors du chargement des analyses', 'error');
    });
  });

  describe('runProjectAnalysis', () => {
    it("devrait appeler l'API pour lancer une analyse", async () => {
      api.fetchAPI.mockResolvedValue({ job_id: 'job-123' });

      await analyses.runProjectAnalysis('discussion');

      expect(api.fetchAPI).toHaveBeenCalledWith(
        '/projects/proj-1/run-analysis',
        expect.objectContaining({
          method: 'POST',
          body: { type: 'discussion' },
        })
      );
      expect(ui.showToast).toHaveBeenCalledWith('Tâche de génération du brouillon de discussion lancée', 'success');
    });

    it("ne devrait rien faire si aucun projet n'est sélectionné", async () => {
      appState.currentProject = null;
      await analyses.runProjectAnalysis('discussion');

      expect(api.fetchAPI).not.toHaveBeenCalled();
      expect(ui.showToast).toHaveBeenCalledWith('Veuillez sélectionner un projet en premier.', 'warning');
    });

    it("devrait gérer une erreur de l'API lors du lancement", async () => {
      api.fetchAPI.mockRejectedValue(new Error('API Failure'));
      await analyses.runProjectAnalysis('discussion');
      expect(api.fetchAPI).toHaveBeenCalled();
      expect(ui.showToast).toHaveBeenCalledWith('Erreur lors du lancement de l\'analyse: API Failure', 'error');
    });
  });

  describe('handleDeleteAnalysis', () => {
    it("devrait appeler l'API de suppression après confirmation", async () => {
      window.confirm = jest.fn(() => true); // Simuler le clic sur "OK"
      api.fetchAPI.mockResolvedValue({});

      await analyses.handleDeleteAnalysis('atn_scores');

      expect(window.confirm).toHaveBeenCalled();
      expect(api.fetchAPI).toHaveBeenCalledWith('/projects/proj-1/analyses/atn_scores', { method: 'DELETE' });
      expect(ui.showToast).toHaveBeenCalledWith('Résultats de l\'analyse atn_scores supprimés avec succès.', 'success');
    });

    it("ne devrait rien faire si l'utilisateur annule", async () => {
      window.confirm = jest.fn(() => false); // Simuler le clic sur "Annuler"

      await analyses.handleDeleteAnalysis('atn_scores');

      expect(window.confirm).toHaveBeenCalled();
      expect(api.fetchAPI).not.toHaveBeenCalled();
    });
  });

  describe('savePRISMAProgress', () => {
    it('devrait collecter les données de la checklist et les envoyer à l\'API', async () => {
      api.fetchAPI.mockResolvedValue({});

      await analyses.savePRISMAProgress();

      expect(api.fetchAPI).toHaveBeenCalledWith(
        '/projects/proj-1/prisma-checklist',
        expect.objectContaining({
          method: 'POST',
          body: {
            checklist: { items: [{ id: 'title', checked: true, notes: 'Notes pour le titre' }] },
          },
        })
      );
      expect(ui.showToast).toHaveBeenCalledWith('Progression PRISMA sauvegardée.', 'success');
    });

    it("devrait gérer une erreur de l'API lors de la sauvegarde", async () => {
      api.fetchAPI.mockRejectedValue(new Error('Save Failed'));

      await analyses.savePRISMAProgress();

      expect(api.fetchAPI).toHaveBeenCalled();
      expect(ui.showToast).toHaveBeenCalledWith('Erreur: Save Failed', 'error');
    });
  });

  describe('exportPRISMAReport', () => {
    it("devrait créer et cliquer sur un lien de téléchargement", () => {
      // Simuler la création du lien et le clic
      const link = { setAttribute: jest.fn(), click: jest.fn() };
      jest.spyOn(document, 'createElement').mockReturnValue(link);
      jest.spyOn(document.body, 'appendChild').mockImplementation(() => {});
      jest.spyOn(document.body, 'removeChild').mockImplementation(() => {});

      analyses.exportPRISMAReport();

      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(link.setAttribute).toHaveBeenCalledWith('download', expect.stringContaining('export_prisma_Projet_Analyse.csv'));
      expect(link.click).toHaveBeenCalled();
    });
  });
});
