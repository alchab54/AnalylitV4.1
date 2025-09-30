/**
 * @jest-environment jsdom
 */
import * as chat from './chat.js';
import { appState } from './app-improved.js';
import * as api from './api.js';
import * as ui from './ui-improved.js';
import * as state from './state.js';

// Mocker les dépendances
jest.mock('./api.js');
jest.mock('./ui-improved.js', () => ({
  showToast: jest.fn(),
  escapeHtml: (str) => str,
}));
jest.mock('./state.js', () => ({
  setChatMessages: jest.fn(),
}));
jest.mock('./app-improved.js', () => ({
  appState: {
    currentProject: null,
    chatMessages: [],
  },
}));

describe('Module Chat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = `
      <div id="chatContainer"></div>
      <textarea id="chatInput"></textarea>
    `;
    appState.currentProject = { id: 'proj-1' };
    appState.chatMessages = [];
    state.setChatMessages.mockImplementation((messages) => {
      appState.chatMessages = messages;
    });
  });

  describe('loadChatMessages', () => {
    it('devrait charger les messages et les afficher', async () => {
      const mockMessages = [{ sender: 'ai', content: 'Bonjour !' }];
      api.fetchAPI.mockResolvedValue(mockMessages);

      await chat.loadChatMessages();

      expect(api.fetchAPI).toHaveBeenCalledWith('/projects/proj-1/chat-history');
      expect(state.setChatMessages).toHaveBeenCalledWith(mockMessages);
      expect(document.querySelector('.chat-message--ai')).not.toBeNull();
      expect(document.body.innerHTML).toContain('Bonjour !');
    });

    it("devrait afficher un message si aucun projet n'est sélectionné", async () => {
      appState.currentProject = null;
      await chat.loadChatMessages();
      expect(document.getElementById('chatContainer').innerHTML).toContain('Aucun projet sélectionné');
    });
  });

  describe('sendChatMessage', () => {
    it('devrait envoyer un message et mettre à jour l\'interface', async () => {
      api.fetchAPI.mockResolvedValue({});
      document.getElementById('chatInput').value = 'Ma question';

      await chat.sendChatMessage();

      // Vérifie que le message de l'utilisateur est affiché immédiatement
      expect(document.querySelector('.chat-message--user')).not.toBeNull();
      expect(document.body.innerHTML).toContain('Ma question');

      // Vérifie que l'API a été appelée
      expect(api.fetchAPI).toHaveBeenCalledWith('/projects/proj-1/chat', expect.any(Object));
      expect(ui.showToast).toHaveBeenCalledWith('Question envoyée. Réponse en cours...', 'info');
    });

    it("ne devrait rien faire si la question est vide", async () => {
      document.getElementById('chatInput').value = '   '; // Espace vide
      await chat.sendChatMessage();

      expect(api.fetchAPI).not.toHaveBeenCalled();
      expect(ui.showToast).toHaveBeenCalledWith('Veuillez saisir une question', 'warning');
    });
  });
});
