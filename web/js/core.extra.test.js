/**
 * @jest-environment jsdom
 */
 
import * as core from './core.js';
import * as ui from './ui-improved.js';
import * as articles from './articles.js';
import * as notifications from './notifications.js';
import * as analyses from './analyses.js';
import * as grids from './grids.js';
import * as state from './state.js';
import { appState } from './app-improved.js';

// Mock minimal pour éviter les erreurs
jest.mock('./ui-improved.js', () => ({
    showToast: jest.fn(),
    renderProjectCards: jest.fn(),
    toggleSidebar: jest.fn(),
    clearNotifications: jest.fn(),
    triggerGridImport: jest.fn(),
    addGridFieldInput: jest.fn(),
    removeGridField: jest.fn(),
}));
jest.mock('./articles.js');
jest.mock('./notifications.js');
jest.mock('./analyses.js');
jest.mock('./grids.js');
jest.mock('./state.js');
jest.mock('./app-improved.js', () => ({
    appState: {
        currentSection: 'projects', // Provide a default value
        currentProject: { id: 'test-project' },
    },
    // ✅ CORRECTION: The 'elements' object was missing from the mock.
    // The error in projects.js happens because it tries to access elements.projectsList.
    elements: {
        projectsList: jest.fn(),
    }
}));


describe('Core - Coverage Boost', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div class="app-section" id="projects" style="display: none;"></div>
            <div class="app-section" id="search" style="display: none;"></div>
            <button class="app-nav__button" data-section-id="projects">Projets</button>
            <button class="app-nav__button app-nav__button--active" data-section-id="search">Recherche</button>
            <div id="connection-status"></div>
        `;
        jest.clearAllMocks();
    });

    it('showSection devrait émettre un événement section-changed', () => {
        const eventListener = jest.fn();
        window.addEventListener('section-changed', eventListener);
        core.showSection('projects');
        expect(eventListener).toHaveBeenCalled();
        window.removeEventListener('section-changed', eventListener);
    });

    it('showSection devrait mettre à jour les boutons de navigation', () => {
        core.showSection('projects');
 
        const projectsBtn = document.querySelector('[data-section-id="projects"]');
        const searchBtn = document.querySelector('[data-section-id="search"]');
        
        expect(projectsBtn.classList.contains('app-nav__button--active')).toBe(true);
        expect(searchBtn.classList.contains('app-nav__button--active')).toBe(false);
    });

    it('setupDelegatedEventListeners devrait configurer les gestionnaires d\'événements', () => {
        const addEventListenerSpy = jest.spyOn(document.body, 'addEventListener');
        
        core.setupDelegatedEventListeners();
 
        expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
        expect(addEventListenerSpy).toHaveBeenCalledWith('submit', expect.any(Function));
        expect(addEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));
        expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
        
        addEventListenerSpy.mockRestore();
    });

    it('initializeWebSocket devrait gérer l\'absence de socket.io', () => {
        global.io = undefined;
        expect(() => core.initializeWebSocket()).not.toThrow();
    });

    it('initializeWebSocket devrait créer une connexion si io est disponible', () => {
        const mockSocket = {
            on: jest.fn(),
            emit: jest.fn()
        };
        
        global.io = jest.fn().mockReturnValue(mockSocket);
        
        core.initializeWebSocket();
        
        expect(global.io).toHaveBeenCalledWith('/', expect.any(Object));
        expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
        expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
        expect(mockSocket.on).toHaveBeenCalledWith('notification', expect.any(Function));
    });

    describe('Tests des actions déléguées', () => {
        beforeEach(() => {
            // On doit ré-initialiser les listeners pour chaque test de cette sous-suite
            core.setupDelegatedEventListeners();
        });

        it('devrait appeler toggleSidebar', () => {
            document.body.innerHTML = `<button data-action="toggle-sidebar"></button>`;
            document.querySelector('[data-action="toggle-sidebar"]').click();
            expect(ui.toggleSidebar).toHaveBeenCalled();
        });

        it('devrait appeler clearNotifications', () => {
            document.body.innerHTML = `<button data-action="clear-notifications"></button>`;
            document.querySelector('[data-action="clear-notifications"]').click();
            expect(notifications.clearNotifications).toHaveBeenCalled();
        });

        it('devrait appeler setActiveEvaluator', () => {
            document.body.innerHTML = `<select data-action="set-active-evaluator"><option value="eval2"></option></select>`;
            const select = document.querySelector('select');
            select.value = 'eval2';
            select.dispatchEvent(new Event('click', { bubbles: true })); // Simuler un clic pour le listener
            expect(state.setActiveEvaluator).toHaveBeenCalledWith('eval2');
        });

        it('devrait appeler toggleArticleSelection', () => {
            document.body.innerHTML = `<input type="checkbox" data-action="toggle-article-selection" data-article-id="art1">`;
            document.querySelector('input').click();
            expect(articles.toggleArticleSelection).toHaveBeenCalledWith('art1');
        });

        it('devrait appeler paginate-results', () => {
            document.body.innerHTML = `<button data-action="paginate-results" data-page="3"></button>`;
            document.querySelector('button').click();
            expect(articles.loadSearchResults).toHaveBeenCalledWith(3);
        });

        it('devrait appeler savePRISMAProgress', () => {
            document.body.innerHTML = `<button data-action="save-prisma-progress"></button>`;
            document.querySelector('button').click();
            expect(analyses.savePRISMAProgress).toHaveBeenCalled();
        });

        it('devrait appeler exportPRISMAReport', () => {
            document.body.innerHTML = `<button data-action="export-prisma-report"></button>`;
            document.querySelector('button').click();
            expect(analyses.exportPRISMAReport).toHaveBeenCalled();
        });

        it('devrait appeler les actions de grille', () => {
            document.body.innerHTML = `
                <button data-action="triggerGridImport"></button>
                <button data-action="add-grid-field"></button>
                <div class="grid-field-item"><button data-action="remove-grid-field"></button></div>
            `;
            document.querySelector('[data-action="triggerGridImport"]').click();
            expect(grids.triggerGridImport).toHaveBeenCalled();

            document.querySelector('[data-action="add-grid-field"]').click();
            expect(grids.addGridFieldInput).toHaveBeenCalled();

            const removeBtn = document.querySelector('[data-action="remove-grid-field"]');
            removeBtn.click();
            expect(grids.removeGridField).toHaveBeenCalledWith(removeBtn, expect.any(Event));
        });
    });

    describe('Tests des événements WebSocket', () => {
        let mockSocket;

        beforeEach(() => {
            mockSocket = { on: jest.fn(), emit: jest.fn() };
            global.io = jest.fn(() => mockSocket);
            core.initializeWebSocket();
            // ✅ CORRECTION: We need to spy on a function within the same module
            // to check if it has been called.
            jest.spyOn(core, 'showSection').mockImplementation(() => {});
        });

        afterEach(() => {
            // Restore the original implementation after each test
            jest.restoreAllMocks();
        });

        it('devrait gérer ANALYSIS_COMPLETED', () => {
            // Trouver le handler pour 'ANALYSIS_COMPLETED'
            const analysisCompletedHandler = mockSocket.on.mock.calls.find(call => call[0] === 'ANALYSIS_COMPLETED')[1];
            appState.currentSection = 'analyses';
            analysisCompletedHandler({ analysis_type: 'discussion' }); // Simuler l'événement
            expect(ui.showToast).toHaveBeenCalledWith('Analyse discussion terminée.', 'success');
            expect(analyses.loadProjectAnalyses).toHaveBeenCalled();
        });

        it('devrait gérer search_completed', () => {
            const searchCompletedHandler = mockSocket.on.mock.calls.find(call => call[0] === 'search_completed')[1];
            searchCompletedHandler({ total_results: 42 });
            expect(ui.showToast).toHaveBeenCalledWith('Recherche terminée (42 résultats).', 'success');
            expect(core.showSection).toHaveBeenCalledWith('results');
        });
    });
});