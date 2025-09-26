/**
 * @jest-environment jsdom
 */
 
import * as core from './core.js';
 
// Mock minimal pour éviter les erreurs
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
        core.showSection('projects');
 
        const projectsSection = document.getElementById('projects');
        const searchSection = document.getElementById('search');
        
        expect(projectsSection.style.display).toBe('block');
        expect(projectsSection.classList.contains('active')).toBe(true);
        expect(searchSection.style.display).toBe('none');
        expect(searchSection.classList.contains('active')).toBe(false);
    });
 
    it('showSection devrait mettre à jour les boutons de navigation', () => {
        core.showSection('projects');
 
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
 
        expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
        expect(addEventListenerSpy).toHaveBeenCalledWith('submit', expect.any(Function));
        expect(addEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));
        expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
        
        addEventListenerSpy.mockRestore();
    });
 
    it('initializeWebSocket devrait gérer l\'absence de socket.io', () => {
        // ✅ CORRECTION: Test sans socket.io disponible
        global.io = undefined;
        
        expect(() => core.initializeWebSocket()).not.toThrow();
        
        // Si io n'est pas disponible, la fonction devrait logger un warning
        // et mettre à jour le statut de connexion
    });
 
    it('initializeWebSocket devrait créer une connexion si io est disponible', () => {
        // ✅ CORRECTION: Mock complet de socket.io
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
});