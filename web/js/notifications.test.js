/**
 * @jest-environment jsdom
 */
import * as notifications from './notifications.js';
import { appState } from './app-improved.js';
import * as ui from './ui-improved.js';
import * as state from './state.js';

// Mocker les dépendances
jest.mock('./ui-improved.js', () => ({
  showToast: jest.fn(),
}));
jest.mock('./state.js', () => ({
  setNotifications: jest.fn(),
  setUnreadNotificationsCount: jest.fn(),
  appState: { // Also mock appState from state.js if it's used
    unreadNotifications: 0,
  }
}));
jest.mock('./app-improved.js', () => ({
  appState: {
    unreadNotifications: 0,
  },
}));

describe('Module Notifications', () => {
  beforeEach(() => {
    // Réinitialiser les mocks et le DOM avant chaque test
    jest.clearAllMocks();
    document.body.innerHTML = `
      <div class="notification-indicator" style="display: none;">
        <span>Notifications</span>
        <span></span>
      </div>
    `;
    appState.unreadNotifications = 0;

    // ✅ CORRECTION: Faire en sorte que le mock mette à jour l'état pour que le test soit réaliste.
    state.setUnreadNotificationsCount.mockImplementation(count => {
      appState.unreadNotifications = count;
    });
  });

  describe('updateNotificationIndicator', () => {
    it("devrait afficher l'indicateur avec le bon nombre si des notifications non lues existent", () => {
      appState.unreadNotifications = 5;
      notifications.updateNotificationIndicator();

      const indicator = document.querySelector('.notification-indicator');
      expect(indicator.style.display).toBe('flex');
      expect(indicator.querySelector('span:last-child').textContent).toBe('Notifications (5)');
    });

    it("devrait masquer l'indicateur si aucune notification non lue n'existe", () => {
      appState.unreadNotifications = 0;
      notifications.updateNotificationIndicator();

      const indicator = document.querySelector('.notification-indicator');
      expect(indicator.style.display).toBe('none');
    });

    it("ne devrait pas planter si l'indicateur n'est pas dans le DOM", () => {
      document.body.innerHTML = ''; // Supprimer l'indicateur
      appState.unreadNotifications = 1;
      // S'attend à ce que l'appel ne lève pas d'erreur
      expect(() => notifications.updateNotificationIndicator()).not.toThrow();
    });
  });

  describe('clearNotifications', () => {
    it("devrait réinitialiser les notifications et masquer l'indicateur", () => {
      appState.unreadNotifications = 3;
      notifications.clearNotifications();

      expect(state.setUnreadNotificationsCount).toHaveBeenCalledWith(0);
      expect(state.setNotifications).toHaveBeenCalledWith([]);
      const indicator = document.querySelector('.notification-indicator');
      expect(indicator.style.display).toBe('none');
    });
  });

  describe('handleWebSocketNotification', () => {
    it("devrait afficher un toast et incrémenter le compteur de notifications", () => {
      appState.unreadNotifications = 2;
      const mockData = { message: 'Nouvelle tâche terminée', type: 'success' };

      notifications.handleWebSocketNotification(mockData);

      expect(ui.showToast).toHaveBeenCalledWith('Nouvelle tâche terminée', 'success');
      expect(state.setUnreadNotificationsCount).toHaveBeenCalledWith(3);
    });
  });
});