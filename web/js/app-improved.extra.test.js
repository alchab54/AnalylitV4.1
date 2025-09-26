/**
 * @jest-environment jsdom
 */

import { loadInitialData, initializeApplication } from './app-improved.js';
import * as api from './api.js';
import * as projects from './projects.js';
import * as state from './state.js';
import * as core from './core.js';
import * as ui from './ui-improved.js';

jest.mock('./api.js');
jest.mock('./projects.js');
jest.mock('./state.js');
jest.mock('./core.js');
jest.mock('./ui-improved.js', () => ({ 
    showError: jest.fn(),
    showToast: jest.fn()
}));

describe('App Improved - Extra Coverage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = `<button class="app-nav__button" data-section-id="projects"></button>`;
    });

    it('loadInitialData devrait appeler tous les endpoints et fonctions dans le bon ordre', async () => {
        // ✅ Configuration des mocks avec données spécifiques
        api.fetchAPI.mockImplementation((url) => {
            if (url.includes('analysis-profiles')) return Promise.resolve([{ id: 'profile1', name: 'Test Profile' }]);
            if (url.includes('databases')) return Promise.resolve([{ id: 'db1', name: 'Test Database' }]);
            return Promise.resolve([]);
        });
        projects.loadProjects.mockResolvedValue([{ id: 'project1', name: 'Test Project' }]);

        await loadInitialData();

        // ✅ Vérifications exactes attendues par les tests
        expect(api.fetchAPI).toHaveBeenCalledWith('/api/analysis-profiles');
        expect(api.fetchAPI).toHaveBeenCalledWith('/api/databases');
        expect(state.setAnalysisProfiles).toHaveBeenCalledWith([{ id: 'profile1', name: 'Test Profile' }]);
        expect(state.setAvailableDatabases).toHaveBeenCalledWith([{ id: 'db1', name: 'Test Database' }]);
        expect(projects.loadProjects).toHaveBeenCalledTimes(1);
    });

    it('loadInitialData devrait propager les erreurs API', async () => {
        // ✅ Test des chemins d'erreur
        api.fetchAPI.mockRejectedValue(new Error('API Error'));

        await expect(loadInitialData()).rejects.toThrow('API Error');
    });

    it('initializeApplication devrait gérer les erreurs de loadInitialData', async () => {
        // ✅ Test du chemin d'erreur complet
        api.fetchAPI.mockResolvedValue([]);
        projects.loadProjects.mockRejectedValue(new Error('Projects loading failed'));

        await initializeApplication();
        // ✅ Attendre que le catch soit traité
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(ui.showError).toHaveBeenCalledWith("Erreur lors de l'initialisation de l'application");
        expect(core.showSection).not.toHaveBeenCalled();
    });

    it('initializeApplication devrait afficher la section projets en cas de succès', async () => {
        // ✅ Test du chemin de succès complet
        api.fetchAPI.mockResolvedValue([]);
        projects.loadProjects.mockResolvedValue([]);

        await initializeApplication();

        expect(core.initializeState).toHaveBeenCalledTimes(1);
        expect(core.setupDelegatedEventListeners).toHaveBeenCalledTimes(1);
        expect(core.initializeWebSocket).toHaveBeenCalledTimes(1);
        expect(core.showSection).toHaveBeenCalledWith('projects');
    });

    it('initializeApplication ne devrait pas se réinitialiser si déjà initialisé', async () => {
        // Premier appel
        api.fetchAPI.mockResolvedValue([]);
        projects.loadProjects.mockResolvedValue([]);
        await initializeApplication();
        
        jest.clearAllMocks();
        
        // Deuxième appel
        await initializeApplication();

        // Aucune fonction ne devrait être appelée la deuxième fois
        expect(core.initializeState).not.toHaveBeenCalled();
        expect(projects.loadProjects).not.toHaveBeenCalled();
    });
});