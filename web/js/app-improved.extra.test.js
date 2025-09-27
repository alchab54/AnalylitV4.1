/**
 * @jest-environment jsdom
 */
describe('App Improved - Extra Coverage', () => {
    let api, projects, state, core, ui, appImproved;
 
    beforeEach(() => {
        // ✅ CORRECTION: Reset modules to clear the `isInitialized` flag in app-improved.js
        jest.resetModules();
        jest.clearAllMocks();
 
        // Re-mock all dependencies for the fresh module instance
        jest.mock('./api.js', () => ({ fetchAPI: jest.fn() }));
        jest.mock('./projects.js', () => ({ loadProjects: jest.fn() }));
        jest.mock('./state.js', () => ({
            initializeState: jest.fn(),
            setAnalysisProfiles: jest.fn(),
            setAvailableDatabases: jest.fn(),
        }));
        jest.mock('./core.js', () => ({
            setupDelegatedEventListeners: jest.fn(),
            initializeWebSocket: jest.fn(),
            showSection: jest.fn(),
        }));
        jest.mock('./ui-improved.js', () => ({
            showError: jest.fn(),
            showToast: jest.fn(),
        }));
 
        // Re-require the modules after mocking
        api = require('./api.js');
        projects = require('./projects.js');
        state = require('./state.js');
        core = require('./core.js');
        ui = require('./ui-improved.js');
        appImproved = require('./app-improved.js');
 
        document.body.innerHTML = `<button class="app-nav__button" data-section-id="projects"></button>`;
    });
 
    it('loadInitialData devrait appeler tous les endpoints et fonctions dans le bon ordre', async () => {
        api.fetchAPI.mockImplementation((url) => {
            if (url.includes('analysis-profiles')) return Promise.resolve([{ id: 'profile1', name: 'Test Profile' }]);
            if (url.includes('databases')) return Promise.resolve([{ id: 'db1', name: 'Test Database' }]);
            return Promise.resolve([]);
        });
        projects.loadProjects.mockResolvedValue([{ id: 'project1', name: 'Test Project' }]);
 
        await appImproved.loadInitialData();
 
        expect(api.fetchAPI).toHaveBeenCalledWith('/api/analysis-profiles');
        expect(api.fetchAPI).toHaveBeenCalledWith('/api/databases');
        expect(state.setAnalysisProfiles).toHaveBeenCalledWith([{ id: 'profile1', name: 'Test Profile' }]);
        expect(state.setAvailableDatabases).toHaveBeenCalledWith([{ id: 'db1', name: 'Test Database' }]);
        expect(projects.loadProjects).toHaveBeenCalledTimes(1);
    });
 
    it('loadInitialData devrait propager les erreurs API', async () => {
        api.fetchAPI.mockRejectedValue(new Error('API Error'));
 
        await expect(appImproved.loadInitialData()).rejects.toThrow('API Error');
    });
 
    it('initializeApplication devrait gérer les erreurs de loadInitialData', async () => {
        api.fetchAPI.mockResolvedValue([]);
        projects.loadProjects.mockRejectedValue(new Error('Projects loading failed'));
 
        await appImproved.initializeApplication();
        await new Promise(resolve => setTimeout(resolve, 0));
 
        expect(ui.showError).toHaveBeenCalledWith("Erreur lors de l'initialisation de l'application");
        expect(core.showSection).not.toHaveBeenCalled();
    });
 
    it('initializeApplication devrait afficher la section projets en cas de succès', async () => {
        api.fetchAPI.mockResolvedValue([]);
        projects.loadProjects.mockResolvedValue([]);
 
        await appImproved.initializeApplication();
 
        expect(state.initializeState).toHaveBeenCalledTimes(1);
        expect(core.setupDelegatedEventListeners).toHaveBeenCalledTimes(1);
        expect(core.initializeWebSocket).toHaveBeenCalledTimes(1);
        expect(core.showSection).toHaveBeenCalledWith('projects');
    });

    it('initializeApplication ne devrait pas se réinitialiser si déjà initialisé', async () => {
        api.fetchAPI.mockResolvedValue([]);
        projects.loadProjects.mockResolvedValue([]);
        await appImproved.initializeApplication();
 
        // Clear mocks to check the second call
        jest.clearAllMocks();
 
        await appImproved.initializeApplication();
 
        expect(state.initializeState).not.toHaveBeenCalled();
        expect(projects.loadProjects).not.toHaveBeenCalled();
    });
});