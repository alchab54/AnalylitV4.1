/**
 * @jest-environment jsdom
 */

// Importer la fonction à tester
import { fetchAPI } from './api.js';

// Mocker les dépendances (showToast et global.fetch)
// Note : 'ui.js' est mocké car il n'est pas pertinent pour ce test unitaire.
jest.mock('./ui.js', () => ({
  showToast: jest.fn(),
}));

// Mocker le fetch global que fetchAPI utilise
global.fetch = jest.fn();

describe('fetchAPI Utility', () => {

  beforeEach(() => {
    // Réinitialiser les mocks avant chaque test
    jest.clearAllMocks();
    global.fetch.mockClear();
  });

  test('devrait gérer une réponse 200 OK avec JSON valide', async () => {
    const mockData = { success: true, data: 'test' };
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockData)),
    });

    const result = await fetchAPI('/test-endpoint');
    
    expect(result).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledWith('/api/test-endpoint', {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
  });

  test('devrait retourner un tableau vide pour une réponse vide sur un endpoint de collection', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(''), // Réponse vide
    });

    // /results est un endpoint de collection
    const result = await fetchAPI('/projects/123/results');
    
    expect(result).toEqual([]);
  });

  test('devrait gérer une erreur API (ex: 500) avec un message JSON', async () => {
    const errorResponse = { message: 'Erreur interne du serveur' };
    global.fetch.mockResolvedValue({
      ok: false, // Echec
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve(errorResponse), // Le serveur renvoie un JSON d'erreur
      text: () => Promise.resolve(JSON.stringify(errorResponse)),
    });

    // Nous nous attendons à ce que fetchAPI lève une exception
    await expect(fetchAPI('/error-endpoint'))
      .rejects
      .toThrow('Erreur interne du serveur');
  });

  test('devrait gérer un échec réseau (fetch lui-même échoue)', async () => {
    global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(fetchAPI('/network-fail'))
      .rejects
      .toThrow('Failed to fetch');
  });

});