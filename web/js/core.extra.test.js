/**
 * @jest-environment jsdom
 */
import * as core from './core.js';
import * as state from './state.js'; // Import the real state to trigger events

// Mock minimal pour éviter les erreurs
jest.mock('./state.js', () => ({
    ...jest.requireActual('./state.js'),
    setCurrentSection: jest.fn((...args) => jest.requireActual('./state.js').setCurrentSection(...args)),
    appState: {
        currentSection: 'search'
    }
}));

jest.mock('./projects.js', () => ({ loadProjects: jest.fn() }));
jest.mock('./articles.js', () => ({ loadSearchResults: jest.fn() }));
jest.mock('./validation.js', () => ({ loadValidationSection: jest.fn() }));

jest.mock('./ui-improved.js', () => ({
    showToast: jest.fn()
}));

// Mock complet de socket.io-client
const mockIo = jest.fn(() => mockSocket);
const mockSocket = {
    on: jest.fn(),
    emit: jest.fn(),
};
jest.mock('socket.io-client', () => ({ io: mockIo }), { virtual: true });


describe('Core - Coverage Boost', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div class="app-section" id="projects" style="display: none;"></div>
            <div class="app-section" id="search" style="display: none;"></div>
            <button class="app-nav__button" data-section-id="projects">Projets</button>
            <button class="app-nav__button app-nav__button--active" data-section-id="search">Recherche</button>
        `;
        core.setupDelegatedEventListeners();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('showSection devrait afficher la bonne section et cacher les autres', () => {
        window.dispatchEvent(new CustomEvent('section-changed', { detail: { currentSection: 'projects' } }));

        const projectsSection = document.getElementById('projects');
        const searchSection = document.getElementById('search');

        expect(projectsSection.classList.contains('active')).toBe(true);
        expect(projectsSection.classList.contains('active')).toBe(true);
        expect(searchSection.style.display).toBe('none');
        expect(searchSection.classList.contains('active')).toBe(false);
    });

    it('showSection devrait mettre à jour les boutons de navigation', () => {
        window.dispatchEvent(new CustomEvent('section-changed', { detail: { currentSection: 'projects' } }));

        const projectsBtn = document.querySelector('[data-section-id="projects"]');
        const searchBtn = document.querySelector('[data-section-id="search"]');

        expect(projectsBtn.classList.contains('app-nav__button--active')).toBe(true);
        expect(searchBtn.classList.contains('app-nav__button--active')).toBe(false);
    });

    it('showSection devrait émettre un événement section-changed', () => {
        const eventListener = jest.fn();
        window.addEventListener('section-changed', eventListener);

        core.showSection('projects');

        expect(eventListener).toHaveBeenCalled();

        window.removeEventListener('section-changed', eventListener);
    });

    it('setupDelegatedEventListeners devrait configurer les gestionnaires d\'événements', () => {
        const addEventListenerSpy = jest.spyOn(document.body, 'addEventListener');
        core.setupDelegatedEventListeners();

        const calls = addEventListenerSpy.mock.calls;
        expect(calls.some(call => call[0] === 'click')).toBe(true);
        expect(calls.some(call => call[0] === 'submit')).toBe(true);
        expect(calls.some(call => call[0] === 'change')).toBe(true);

        addEventListenerSpy.mockRestore();
    });

    it('initializeWebSocket devrait tenter de créer une connexion WebSocket', () => {
        core.initializeWebSocket();
        expect(mockIo).toHaveBeenCalled();
    });

    it('devrait gérer les événements WebSocket', async () => {
        state.appState.currentProject = { id: 'proj-123' };
        core.initializeWebSocket();

        // Attendre que les listeners soient attachés
        await new Promise(resolve => setTimeout(resolve, 0));

        // Simuler un événement de connexion
        const connectCallback = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
        connectCallback();
        expect(mockSocket.emit).toHaveBeenCalledWith('join_room', { room: 'proj-123' });
    });
});