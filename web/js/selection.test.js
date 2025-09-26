/**
 * @jest-environment jsdom
 */

// Mocker le module api-client pour contrôler les appels réseau
import { apiGet, apiPost } from './api-client.js';
jest.mock('./api-client.js', () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
}));

describe('Module Selection', () => {
  beforeEach(() => {
    // Réinitialiser les mocks et le DOM avant chaque test
    jest.clearAllMocks();
    document.body.innerHTML = `<div id="results-list"></div>`;
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
    apiGet.mockResolvedValue(mockData);

    await loadModule();

    expect(apiGet).toHaveBeenCalledWith('/api/selection');
    const container = document.querySelector('#results-list');
    expect(container.innerHTML).toContain('Article 1');
    expect(container.querySelector('.btn-include')).not.toBeNull();
    expect(container.querySelector('.btn-exclude').disabled).toBe(true);
  });

  test('devrait appeler toggle avec "include" lors du clic sur le bouton Inclure', async () => {
    const mockData = [{ id: 1, title: 'Article 1', included: false }];
    apiGet.mockResolvedValue(mockData);
    apiPost.mockResolvedValue({}); // Mock pour l'appel toggle

    await loadModule();

    const includeButton = document.querySelector('.btn-include');
    includeButton.click();

    // Attendre que les promesses de toggle() et load() se résolvent
    await new Promise(process.nextTick);

    expect(apiPost).toHaveBeenCalledWith('/api/selection/toggle', { id: '1', included: true });
    // Vérifie que `load` est appelé à nouveau après le toggle
    expect(apiGet).toHaveBeenCalledTimes(2);
  });

  test('devrait appeler toggle avec "exclude" lors du clic sur le bouton Exclure', async () => {
    const mockData = [{ id: 1, title: 'Article 1', included: true }];
    apiGet.mockResolvedValue(mockData);
    apiPost.mockResolvedValue({});

    await loadModule();

    const excludeButton = document.querySelector('.btn-exclude');
    excludeButton.click();

    await new Promise(process.nextTick);

    expect(apiPost).toHaveBeenCalledWith('/api/selection/toggle', { id: '1', included: false });
    expect(apiGet).toHaveBeenCalledTimes(2);
  });

  test('devrait afficher un conteneur vide si aucune donnée n\'est retournée', async () => {
    apiGet.mockResolvedValue([]); // Simule une réponse vide

    await loadModule();

    const container = document.querySelector('#results-list');
    expect(container.innerHTML).toBe('');
  });
});