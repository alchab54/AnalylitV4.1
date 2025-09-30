/**
 * @jest-environment jsdom
 */
import RiskOfBiasManager from './rob-manager.js';
import { fetchAPI } from './api.js';
import { appState } from './app-improved.js';

// Mocker les dépendances
jest.mock('./api.js', () => ({
  fetchAPI: jest.fn(),
}));
jest.mock('./app-improved.js', () => ({
  appState: {
    currentProject: null,
  },
}));

describe('Module RiskOfBiasManager', () => {
  let robManager;

  beforeEach(() => {
    // Réinitialiser les mocks et le DOM
    jest.clearAllMocks();
    document.body.innerHTML = '<div id="robContainer"></div>';
    appState.currentProject = { id: 'proj-rob' };

    // Instancier la classe pour chaque test
    // Espionner la méthode pour éviter l'appel réseau non désiré dans les tests d'UI
    // Do this on the prototype BEFORE instantiating
    jest.spyOn(RiskOfBiasManager.prototype, 'loadRoBArticles').mockResolvedValue();
    robManager = new RiskOfBiasManager();
    window.robManager = robManager;
  });

  describe('Initialization', () => {
    it('devrait initialiser l\'interface RoB au démarrage', () => {
      expect(document.querySelector('.rob-header')).not.toBeNull();
      expect(document.querySelector('.rob-navigation')).not.toBeNull();
      expect(document.querySelector('#rob-assessment.rob-panel.active')).not.toBeNull();
    });

    it("devrait afficher un avertissement si le conteneur n'existe pas", () => {
      document.body.innerHTML = ''; // Supprimer le conteneur
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      new RiskOfBiasManager();
      expect(consoleSpy).toHaveBeenCalledWith('Container RoB non trouvé');
      consoleSpy.mockRestore();
    });
  });

  describe('switchRoBTab', () => {
    it("devrait changer l'onglet et le panneau actifs", () => {
      const summaryTab = document.querySelector('[data-tab="summary"]');
      const assessmentPanel = document.querySelector('#rob-assessment');
      const summaryPanel = document.querySelector('#rob-summary');

      expect(assessmentPanel.classList.contains('active')).toBe(true);
      expect(summaryPanel.classList.contains('active')).toBe(false);

      // Simuler le clic
      summaryTab.click();

      expect(assessmentPanel.classList.contains('active')).toBe(false);
      expect(summaryPanel.classList.contains('active')).toBe(true);
      expect(summaryTab.classList.contains('active')).toBe(true);
    });
  });

  describe('loadRoBArticles', () => {
    it("devrait afficher une alerte si aucun projet n'est sélectionné", async () => {
      appState.currentProject = null;
      window.alert = jest.fn();

      robManager.loadRoBArticles.mockRestore(); // Use the real implementation for this test
      await robManager.loadRoBArticles();

      expect(window.alert).toHaveBeenCalledWith('Sélectionnez un projet');
      expect(fetchAPI).not.toHaveBeenCalled();
    });

    it('devrait charger les articles inclus et les afficher', async () => {
      const mockExtractions = [
        { id: 'ext-1', title: 'Article Inclus 1', user_validation_status: 'include' },
        { id: 'ext-2', title: 'Article Exclu', user_validation_status: 'exclude' },
      ];
      fetchAPI.mockResolvedValue(mockExtractions);

      robManager.loadRoBArticles.mockRestore(); // Use the real implementation for this test
      await robManager.loadRoBArticles();

      expect(fetchAPI).toHaveBeenCalledWith('/projects/proj-rob/extractions');
      expect(document.querySelector('.article-item')).not.toBeNull();
      expect(document.body.innerHTML).toContain('Article Inclus 1');
      expect(document.body.innerHTML).not.toContain('Article Exclu');
    });
  });

  describe('saveAssessment', () => {
    it("devrait sauvegarder une évaluation et mettre à jour l'interface", async () => {
      // Préparer l'état
      robManager.currentArticles = [{ id: 'art-1', title: 'Test Article' }];
      robManager.renderArticlesSelector(robManager.currentArticles);
      robManager.renderAssessmentForm({ id: 'art-1', title: 'Test Article' });

      // Simuler une saisie dans le formulaire
      const radio = document.querySelector('input[name="random_sequence_generation"][value="low"]');
      radio.checked = true;

      fetchAPI.mockResolvedValue({});
      window.alert = jest.fn();

      await robManager.saveAssessment('art-1');

      expect(fetchAPI).toHaveBeenCalledWith(
        // ✅ CORRECTION: L'endpoint attendu par le test était incorrect.
        '/projects/proj-rob/rob/art-1',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({
            rob_assessment: expect.objectContaining({ random_sequence_generation: 'low' }),
          }),
        })
      );
      expect(window.alert).toHaveBeenCalledWith('Évaluation RoB sauvegardée');
      // Vérifier que le statut de l'article est mis à jour dans la liste
      expect(document.querySelector('.article-item.has-rob')).not.toBeNull();
    });
  });

  describe('generateTrafficLights', () => {
    it("devrait afficher une alerte si aucune évaluation n'est disponible", async () => {
      robManager.robAssessments = {};
      window.alert = jest.fn();

      await robManager.generateTrafficLights();

      expect(window.alert).toHaveBeenCalledWith('Aucune évaluation RoB disponible');
      expect(fetchAPI).not.toHaveBeenCalled();
    });
  });
});