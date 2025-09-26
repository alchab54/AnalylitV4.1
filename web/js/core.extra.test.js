/**
 * @jest-environment jsdom
 */
import * as core from './core.js';
import * as state from './state.js';

// Mock minimal pour éviter les erreurs
jest.mock('./state.js', () => ({
    setCurrentSection: jest.fn(),
    appState: {
        currentSection: 'search'
    }
}));

jest.mock('./ui-improved.js', () => ({
    showToast: jest.fn()
}));

describe('Core - Coverage Boost', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div class="app-section" id="projects" style="display: none;"></div>
            <div class="app-section" id="search" style="display: none;"></div>
            <button class="app-nav__button" data-section-id="projects">Projets</button>
            <button class="app-nav__button app-nav__button--active" data-section-id="search">Recherche</button>
        `;
    });

    it('showSection devrait afficher la bonne section et cacher les autres', () => {
        // Simulate the event listener that calls handleSectionChange
        const handleSectionChange = core.__get__('handleSectionChange');
        handleSectionChange({ detail: { currentSection: 'projects' } });

        const projectsSection = document.getElementById('projects');
        const searchSection = document.getElementById('search');
        
        expect(projectsSection.style.display).toBe('block');
        expect(projectsSection.classList.contains('active')).toBe(true);
        expect(searchSection.style.display).toBe('none');
        expect(searchSection.classList.contains('active')).toBe(false);
    });

    it('showSection devrait mettre à jour les boutons de navigation', () => {
        const handleSectionChange = core.__get__('handleSectionChange');
        handleSectionChange({ detail: { currentSection: 'projects' } });

        const projectsBtn = document.querySelector('[data-section-id="projects"]');
        const searchBtn = document.querySelector('[data-section-id="search"]');
        
        expect(projectsBtn.classList.contains('app-nav__button--active')).toBe(true);
        expect(searchBtn.classList.contains('app-nav__button--active')).toBe(false);
    });

    it('showSection devrait émettre un événement section-changed', () => {
        const eventListener = jest.fn();
        window.addEventListener('section-changed', eventListener);

        state.setCurrentSection('projects');

        expect(eventListener).toHaveBeenCalled();
        
        window.removeEventListener('section-changed', eventListener);
    });

    it('setupDelegatedEventListeners devrait configurer les gestionnaires d\'événements', () => {
        const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
        
        core.setupDelegatedEventListeners(); // This function is called in the test setup

        expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
        expect(addEventListenerSpy).toHaveBeenCalledWith('submit', expect.any(Function));
        expect(addEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));
        
        addEventListenerSpy.mockRestore();
    });

    it('initializeWebSocket devrait tenter de créer une connexion WebSocket', () => {
        // Mock WebSocket
        global.WebSocket = jest.fn().mockImplementation(() => ({
            onopen: null,
            onmessage: null,
            onclose: null,
            onerror: null
        }));

        core.initializeWebSocket(); // This function is called in the test setup

        expect(global.WebSocket).toHaveBeenCalledWith(expect.stringContaining('ws://'));
    });
});