/**
 * @jest-environment jsdom
 */
import { fetchAPI } from './api.js';
import { appState } from './app-improved.js';

jest.mock('./api.js', () => ({
  fetchAPI: jest.fn(),
}));

describe('Module Selection', () => {
  beforeEach(() => {
    // Réinitialiser les mocks et le DOM avant chaque test
    jest.clearAllMocks();
    document.body.innerHTML = `<div id="results-list"></div>`;
    // Simuler l'état global nécessaire pour les appels API
    global.appState = {
      currentProject: { id: 'proj-test' }
    };
  });

  // Helper pour charger le module et attendre la fin des opérations asynchrones
  async function loadModule() {
    jest.isolateModules(() => {
      require('./selection.js');
    });
    // Attendre que les promesses (comme l'appel à load()) se résolvent
    await new Promise(process.nextTick);
  }

  test('devrait charger les données et les afficher au démarrage', async () => {
    const mockData = [{ id: 1, title: 'Article 1', journal: 'Journal A', year: 2023, included: false }];
    fetchAPI.mockResolvedValue(mockData);

    await loadModule();

    expect(fetchAPI).toHaveBeenCalledWith('/projects/proj-test/articles');
    const container = document.querySelector('#results-list');
    expect(container.innerHTML).toContain('Article 1');
    expect(container.querySelector('.btn-include')).not.toBeNull();
    expect(container.querySelector('.btn-exclude').disabled).toBe(true);
  });

  test('devrait appeler toggle avec "include" lors du clic sur le bouton Inclure', async () => {
    const mockData = [{ id: 1, title: 'Article 1', included: false }];
    fetchAPI.mockResolvedValue(mockData);

    await loadModule();

    const includeButton = document.querySelector('.btn-include');
    includeButton.click();

    await new Promise(process.nextTick);

    expect(fetchAPI).toHaveBeenCalledWith(
      '/projects/proj-test/extractions/1/decision',
      expect.objectContaining({ method: 'PUT', body: { decision: true } })
    );
    // Vérifie que `load` est appelé à nouveau après le toggle
    expect(fetchAPI).toHaveBeenCalledTimes(2);
  });

  test('devrait appeler toggle avec "exclude" lors du clic sur le bouton Exclure', async () => {
    const mockData = [{ id: 1, title: 'Article 1', included: true }];
    fetchAPI.mockResolvedValue(mockData);

    await loadModule();

    const excludeButton = document.querySelector('.btn-exclude');
    excludeButton.click();

    await new Promise(process.nextTick);

    expect(fetchAPI).toHaveBeenCalledWith(
      '/projects/proj-test/extractions/1/decision',
      expect.objectContaining({ method: 'PUT', body: { decision: false } })
    );
    expect(fetchAPI).toHaveBeenCalledTimes(2);
  });

  test('devrait afficher un conteneur vide si aucune donnée n\'est retournée', async () => {
    fetchAPI.mockResolvedValue([]); // Simule une réponse vide

    await loadModule();

    const container = document.querySelector('#results-list');
    expect(container.innerHTML).toBe('');
  });
});