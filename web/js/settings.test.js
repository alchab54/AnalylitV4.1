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
      <div id="profile-list-container"></div>
      <div id="installed-models-list"></div>
      <div id="download-progress" style="display:none;"></div>
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
      expect(api.fetchAPI).toHaveBeenCalledWith('/analysis-profiles');
      expect(api.fetchAPI).toHaveBeenCalledWith('/prompts');
      expect(api.fetchAPI).toHaveBeenCalledWith('/ollama/models');
      expect(api.fetchAPI).toHaveBeenCalledWith('/queues/info');
    });

    it('devrait gérer une erreur lors du chargement des profils', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {}); // Masquer l'erreur dans la console de test
      api.fetchAPI.mockImplementation((url) => (url === '/api/analysis-profiles' ? Promise.reject('API Error') : Promise.resolve([])));
      await settings.loadAnalysisProfiles();
      expect(state.setAnalysisProfiles).toHaveBeenCalledWith([]);
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

      expect(api.fetchAPI).toHaveBeenCalledWith('/analysis-profiles', expect.objectContaining({ method: 'POST' }));
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

      expect(api.fetchAPI).toHaveBeenCalledWith('/analysis-profiles/existing-id', expect.objectContaining({ method: 'PUT' }));
      expect(ui.showToast).toHaveBeenCalledWith("Profil 'Profil Mis à Jour' sauvegardé.", 'success');
    });
  });

  describe('handleDeleteProfile', () => {
    it('devrait appeler showConfirmModal pour un profil valide', async () => {
      appState.selectedProfileId = 'p1';
      appState.analysisProfiles = [{ id: 'p1', name: 'Profil à supprimer', is_default: false }];

      await settings.handleDeleteProfile();

      expect(ui.showConfirmModal).toHaveBeenCalled();
      expect(ui.showConfirmModal.mock.calls[0][0]).toBe('Confirmer la suppression');
    });

    it('ne devrait pas supprimer un profil par défaut', async () => {
      appState.selectedProfileId = 'p-default';
      appState.analysisProfiles = [{ id: 'p-default', name: 'Default', is_default: true }];

      await settings.handleDeleteProfile();

      expect(ui.showConfirmModal).not.toHaveBeenCalled();
      expect(ui.showToast).toHaveBeenCalledWith("Impossible de supprimer ce profil (défaut ou non sélectionné).", 'warn');
    });
  });

  describe('downloadModel', () => {
    it('devrait appeler l\'API et afficher un succès', async () => {
      api.fetchAPI.mockResolvedValue({ success: true });
      // ✅ CORRECTION: Add the missing DOM elements for the progress indicator.
      document.body.innerHTML += `<div id="download-progress"></div><span id="download-status"></span>`;

      await settings.downloadModel('llama3');

      expect(api.fetchAPI).toHaveBeenCalledWith('/ollama/pull', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ model: 'llama3' })
      }));
      expect(ui.showToast).toHaveBeenCalledWith('Modèle llama3 téléchargé avec succès', 'success');
    });

    it("devrait afficher une erreur si l'API échoue", async () => {
      api.fetchAPI.mockRejectedValue(new Error('Network Error'));
      // ✅ CORRECTION: Add the missing DOM elements to prevent a secondary error.
      document.body.innerHTML += `<div id="download-progress"></div><span id="download-status"></span>`;

      await settings.downloadModel('llama3');

      expect(ui.showToast).toHaveBeenCalledWith('Erreur téléchargement: Network Error', 'error');
    });
  });

  describe('handleClearQueue', () => {
    it('devrait appeler showConfirmModal avec les bonnes options', async () => {
      await settings.handleClearQueue('default');

      expect(ui.showConfirmModal).toHaveBeenCalledWith(
        'Vider la file d\'attente',
        'Êtes-vous sûr de vouloir vider la file "default" ? Toutes les tâches en attente seront perdues.',
        expect.any(Object)
      );
    });
  });

  describe('selectProfile', () => {
    it("ne devrait rien faire si l'ID du profil est invalide", () => {
      appState.analysisProfiles = [{ id: 'p1', name: 'Profil 1' }];
      document.body.innerHTML += `<div class="list-item" data-profile-id="p1"></div>`;

      settings.selectProfile('invalid-id');

      expect(state.setSelectedProfileId).not.toHaveBeenCalled();
      expect(document.querySelector('.list-item.active')).toBeNull();
    });
  });
});