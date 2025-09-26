/**
 * @jest-environment jsdom
 */

// Simuler l'environnement global d'un Service Worker avec toutes les fonctions nécessaires
const mockClients = {
  claim: jest.fn(),
};

const mockCache = {
  put: jest.fn(),
  match: jest.fn(),
  delete: jest.fn(),
};

const mockCaches = {
  open: jest.fn().mockResolvedValue(mockCache),
  keys: jest.fn().mockResolvedValue(['analylit-v0-cache', 'analylit-v1-cache']),
  delete: jest.fn().mockResolvedValue(true), // Mock the delete method on caches
};

global.self = {
  addEventListener: jest.fn(),
  skipWaiting: jest.fn(), // This was the missing mock
  clients: mockClients,
};

global.caches = mockCaches;
global.fetch = jest.fn();

// Importer le Service Worker après avoir mis en place les mocks
require('./sw.js');

describe('Service Worker', () => {
  let eventListeners;

  beforeEach(() => {
    // Capturer les listeners pour les simuler dans les tests
    eventListeners = {};
    // Re-mock the necessary properties on global.self before each test
    global.self.skipWaiting = jest.fn();
    global.self.clients = {
      claim: jest.fn(),
    };
    jest.spyOn(global.self, 'addEventListener').mockImplementation((event, listener) => {
      eventListeners[event] = listener;
    });
    // Réimporter pour ré-attacher les listeners
    jest.isolateModules(() => {
      require('./sw.js');
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("devrait s'installer et appeler skipWaiting", () => {
    const installEvent = { waitUntil: jest.fn() };
    eventListeners.install(installEvent);
    expect(global.self.skipWaiting).toHaveBeenCalled();
  });

  it("devrait s'activer et supprimer les anciens caches", async () => {
    const activateEvent = { waitUntil: jest.fn() };
    eventListeners.activate(activateEvent);
    await activateEvent.waitUntil.mock.calls[0][0]; // Wait for the promise inside waitUntil
    // Le mock de `keys` retourne ['analylit-v0-cache', 'analylit-v1-cache']
    // 'analylit-v1-cache' est le nom du cache actuel, donc seul 'analylit-v0-cache' doit être supprimé.    
    expect(mockCaches.delete).toHaveBeenCalledWith('analylit-v0-cache');
    expect(mockCaches.delete).not.toHaveBeenCalledWith('analylit-v1-cache');
    expect(global.self.clients.claim).toHaveBeenCalled();
  });

  it('devrait utiliser la stratégie "réseau d\'abord" pour les requêtes GET', async () => {
    const mockRequest = { url: '/css/style.css', method: 'GET' };
    const mockResponse = { clone: () => 'cloned response' };
    global.fetch.mockResolvedValue(mockResponse);

    const fetchEvent = { request: mockRequest, respondWith: jest.fn() };
    eventListeners.fetch(fetchEvent);

    // Attendre que la promesse dans respondWith se résolve
    await fetchEvent.respondWith.mock.calls[0][0];

    expect(global.fetch).toHaveBeenCalledWith(mockRequest);
    expect(mockCache.put).toHaveBeenCalledWith(mockRequest, 'cloned response');
  });
});