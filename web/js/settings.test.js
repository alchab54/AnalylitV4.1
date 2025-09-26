/**
 * @jest-environment jsdom
 */
import * as settings from './settings.js';
import { appState } from './app-improved.js';
import * as api from './api.js';
import * as ui from './ui-improved.js';
import * as state from './state.js';

// Mocker les dépendances
jest.mock('./api.js');
jest.mock('./ui-improved.js', () => ({
  showToast: jest.fn(),
  showConfirmModal: jest.fn(),
}));
jest.mock('./state.js', () => ({
  setAnalysisProfiles: jest.fn(),
  setPrompts: jest.fn(),
  setOllamaModels: jest.fn(),
  setQueuesStatus: jest.fn(),
  setSelectedProfileId: jest.fn(),
}));
jest.mock('./app-improved.js', () => ({
  appState: {
    analysisProfiles: [],
    prompts: [],
    queuesInfo: null,
    ollamaModels: [],
    selectedProfileId: null,
  },
}));

describe('Module Settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = `
      <div id="settingsContainer">
        <div id="settingsTitle"></div>
      </div>
      <div id="settingsContent"></div>
      <form id="profile-edit-form">
        <input id="profile-id" value="">
        <input id="profile-name" value="">
        <textarea id="profile-description"></textarea>
        <input type="checkbox" id="profile-is_default">
        <button id="delete-profile-btn" type="button">Supprimer</button>
        <button type="submit">Sauvegarder</button>
      </form>
    `;
    // Mock Ace editor
    global.ace = {
      edit: jest.fn(() => ({
        setTheme: jest.fn(),
        session: { setMode: jest.fn() },
        setValue: jest.fn(),
        getValue: jest.fn(() => 'test prompt'),
      })),
    };
  });

  describe('loadSettingsData', () => {
    it('devrait appeler toutes les fonctions de chargement de données', async () => {
      api.fetchAPI.mockResolvedValue([]); // Mock pour tous les appels
      await settings.loadSettingsData();
      expect(api.fetchAPI).toHaveBeenCalledWith('/api/analysis-profiles');
      expect(api.fetchAPI).toHaveBeenCalledWith('/api/prompts');
      expect(api.fetchAPI).toHaveBeenCalledWith('/api/ollama/models');
      expect(api.fetchAPI).toHaveBeenCalledWith('/api/queues/info');
    });
  });

  describe('renderSettings', () => {
    it('devrait rendre la section des paramètres avec les données chargées', async () => {
      appState.analysisProfiles = [{ id: '1', name: 'Default' }];
      appState.prompts = [{ id: 'p1', name: 'Prompt 1' }];
      appState.queuesInfo = { queues: [] };
      api.fetchAPI.mockResolvedValue({ models: [] }); // pour loadOllamaModels

      await settings.renderSettings();

      expect(document.getElementById('settingsContainer').innerHTML).not.toBe('');
      expect(document.querySelector('.tab-btn[data-tab="profiles"]')).not.toBeNull();
    });
  });

  describe('handleSaveProfile', () => {
    it('devrait sauvegarder un nouveau profil (POST)', async () => {
      api.fetchAPI.mockResolvedValue({ id: 'new-id', name: 'Nouveau Profil' });
      const mockEvent = {
        preventDefault: jest.fn(),
        target: document.getElementById('profile-edit-form'),
      };

      await settings.handleSaveProfile(mockEvent);

      expect(api.fetchAPI).toHaveBeenCalledWith('/api/analysis-profiles', expect.objectContaining({ method: 'POST' }));
      expect(ui.showToast).toHaveBeenCalledWith("Profil 'Nouveau Profil' sauvegardé.", 'success');
    });

    it('devrait mettre à jour un profil existant (PUT)', async () => {
      document.getElementById('profile-id').value = 'existing-id';
      api.fetchAPI.mockResolvedValue({ id: 'existing-id', name: 'Profil Mis à Jour' });
      const mockEvent = {
        preventDefault: jest.fn(),
        target: document.getElementById('profile-edit-form'),
      };

      await settings.handleSaveProfile(mockEvent);

      expect(api.fetchAPI).toHaveBeenCalledWith('/api/analysis-profiles/existing-id', expect.objectContaining({ method: 'PUT' }));
      expect(ui.showToast).toHaveBeenCalledWith("Profil 'Profil Mis à Jour' sauvegardé.", 'success');
    });
  });
});