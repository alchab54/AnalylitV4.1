/**
 * @jest-environment jsdom
 */
import { apiGet, apiPost } from './api-client.js';

// Mocker la fonction fetch globale pour contrôler les appels réseau dans les tests
global.fetch = jest.fn();

describe('Module API Client', () => {
  beforeEach(() => {
    // Réinitialiser le mock de fetch avant chaque test pour éviter les interférences
    fetch.mockClear();
  });

  describe('apiGet', () => {
    it('devrait effectuer un appel GET simple et retourner les données JSON', async () => {
      // Arrange: préparer une fausse réponse réussie
      const mockData = { message: 'success' };
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      // Act: appeler la fonction à tester
      const data = await apiGet('/test-url');

      // Assert: vérifier que fetch a été appelé avec la bonne URL et que les données sont correctes
      expect(fetch).toHaveBeenCalledWith('/test-url');
      expect(data).toEqual(mockData);
    });

    it('devrait inclure les paramètres de requête dans l\'URL pour un appel GET', async () => {
      // Arrange
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });
      const params = { a: 1, b: 'test' };

      // Act
      await apiGet('/test-url', params);

      // Assert: vérifier que l'URL construite est correcte
      expect(fetch).toHaveBeenCalledWith('/test-url?a=1&b=test');
    });

    it('devrait lever une erreur si la réponse GET n\'est pas "ok"', async () => {
      // Arrange: simuler une réponse d'erreur (ex: 404 Not Found)
      fetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      // Act & Assert: s'assurer que la promesse est rejetée avec le bon message d'erreur
      await expect(apiGet('/not-found')).rejects.toThrow('GET /not-found 404');
    });
  });

  describe('apiPost', () => {
    it('devrait effectuer un appel POST avec les données et retourner la réponse JSON', async () => {
      // Arrange
      const postData = { name: 'test' };
      const responseData = { id: 1, ...postData };
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(responseData),
      });

      // Act
      const data = await apiPost('/create', postData);

      // Assert: vérifier que fetch a été appelé avec les bonnes options (méthode, headers, body)
      expect(fetch).toHaveBeenCalledWith('/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData),
      });
      expect(data).toEqual(responseData);
    });

    it('devrait lever une erreur si la réponse POST n\'est pas "ok"', async () => {
      // Arrange: simuler une réponse d'erreur (ex: 500 Internal Server Error)
      fetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      // Act & Assert
      await expect(apiPost('/error', { data: 'bad' })).rejects.toThrow('POST /error 500');
    });
  });
});