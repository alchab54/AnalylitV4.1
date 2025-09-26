/**
 * @jest-environment jsdom
 */
import * as stakeholders from './stakeholders.js';
import { appState } from './app-improved.js';
import * as api from './api.js';
import * as ui from './ui-improved.js';
import * as state from './state.js';

// Mocker les dépendances
jest.mock('./api.js');
jest.mock('./ui-improved.js', () => ({
  showToast: jest.fn(),
  showError: jest.fn(),
  showModal: jest.fn(),
  closeModal: jest.fn(),
  escapeHtml: (str) => str,
}));
jest.mock('./state.js', () => ({
  setStakeholders: jest.fn(),
  setStakeholderGroups: jest.fn(),
}));
jest.mock('./app-improved.js', () => ({
  appState: {
    currentProject: null,
    stakeholderGroups: [],
  },
  elements: {}, // Pas d'éléments exportés directement utilisés
}));

describe('Module Stakeholders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = `<div id="stakeholdersContainer"></div>`;
    appState.currentProject = { id: 'proj-1' };
  });

  describe('renderStakeholdersSection', () => {
    it("devrait afficher un message si aucun projet n'est sélectionné", () => {
      appState.currentProject = null;
      stakeholders.renderStakeholdersSection(null);
      expect(document.getElementById('stakeholdersContainer').innerHTML).toContain('Sélectionnez un projet pour gérer les parties prenantes.');
    });

    it('devrait appeler loadStakeholders si un projet est sélectionné', async () => {
      api.fetchAPI.mockResolvedValue([]); // Mock pour loadStakeholders
      await stakeholders.renderStakeholdersSection(appState.currentProject);
      expect(api.fetchAPI).toHaveBeenCalledWith('/projects/proj-1/stakeholders');
    });
  });

  describe('loadStakeholders', () => {
    it("devrait gérer une erreur de l'API", async () => {
      api.fetchAPI.mockRejectedValue(new Error('API Error'));
      await stakeholders.loadStakeholders('proj-1');
      expect(ui.showError).toHaveBeenCalledWith('Erreur lors du chargement des parties prenantes.');
    });
  });

  describe('loadStakeholders (via render)', () => {
    it('devrait charger et afficher les parties prenantes', async () => {
      const mockStakeholders = [{ id: 's1', name: 'Chercheur A' }];
      // Mock the API call for loading stakeholders
      api.fetchAPI.mockResolvedValue(mockStakeholders); 

      await stakeholders.renderStakeholdersSection(appState.currentProject);

      // Wait for the next tick of the event loop to ensure DOM updates are processed
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(state.setStakeholders).toHaveBeenCalledWith(mockStakeholders);
      expect(document.querySelector('.stakeholder-item')).not.toBeNull();
      expect(document.body.innerHTML).toContain('Chercheur A');
      const list = document.getElementById('stakeholdersList');
      expect(list).not.toBeNull();
      expect(list.innerHTML).toContain('Chercheur A');
    });
  });

  describe('addStakeholderGroup', () => {
    it('devrait appeler l\'API pour créer un groupe', async () => {
      const groupData = { name: 'Nouveau Groupe' };
      const newGroup = { id: 'g1', ...groupData };
      api.fetchAPI.mockResolvedValue(newGroup);

      await stakeholders.addStakeholderGroup('proj-1', groupData);

      expect(api.fetchAPI).toHaveBeenCalledWith('/projects/proj-1/stakeholder-groups', expect.any(Object));
      expect(state.setStakeholderGroups).toHaveBeenCalledWith([newGroup]);
      expect(ui.showToast).toHaveBeenCalledWith('Groupe de parties prenantes créé avec succès.', 'success');
    });

    it("ne devrait rien faire si aucun projectId n'est fourni", async () => {
      await stakeholders.addStakeholderGroup(null, { name: 'Test' });
      expect(api.fetchAPI).not.toHaveBeenCalled();
      expect(ui.showError).toHaveBeenCalledWith('ID du projet requis pour ajouter un groupe de parties prenantes.');
    });

    it("devrait afficher une erreur si l'API échoue", async () => {
      const groupData = { name: 'Nouveau Groupe' };
      api.fetchAPI.mockRejectedValue(new Error('API Failure'));

      const result = await stakeholders.addStakeholderGroup('proj-1', groupData);

      expect(result).toBeNull();
      expect(ui.showError).toHaveBeenCalledWith('Erreur lors de la création du groupe.');
      expect(state.setStakeholderGroups).not.toHaveBeenCalled();
    });
  });

  describe('deleteStakeholderGroup', () => {
    it("devrait appeler l'API pour supprimer un groupe après confirmation", async () => {
      window.confirm = jest.fn(() => true);
      api.fetchAPI.mockResolvedValue({});
      appState.stakeholderGroups = [{ id: 'g1', name: 'Groupe à supprimer' }];

      await stakeholders.deleteStakeholderGroup('g1');

      expect(window.confirm).toHaveBeenCalled();
      expect(api.fetchAPI).toHaveBeenCalledWith('/projects/proj-1/stakeholder-groups/g1', { method: 'DELETE' });
      expect(state.setStakeholderGroups).toHaveBeenCalledWith([]);
      expect(ui.showToast).toHaveBeenCalledWith('Groupe supprimé avec succès.', 'success');
    });

    it("ne devrait rien faire si l'utilisateur annule la confirmation", async () => {
      window.confirm = jest.fn(() => false);

      await stakeholders.deleteStakeholderGroup('g1');

      expect(window.confirm).toHaveBeenCalled();
      expect(api.fetchAPI).not.toHaveBeenCalled();
    });

    it("devrait afficher une erreur si l'API échoue", async () => {
      window.confirm = jest.fn(() => true);
      api.fetchAPI.mockRejectedValue(new Error('API Failure'));
      appState.stakeholderGroups = [{ id: 'g1', name: 'Groupe' }];

      const result = await stakeholders.deleteStakeholderGroup('g1');

      expect(result).toBe(false);
      expect(ui.showError).toHaveBeenCalledWith('Erreur lors de la suppression du groupe.');
      // L'état ne doit pas changer en cas d'erreur
      expect(state.setStakeholderGroups).not.toHaveBeenCalled();
    });
  });
});
