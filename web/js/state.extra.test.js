/**
 * @jest-environment jsdom
 */
import * as state from './state.js';

describe('State - Coverage Boost', () => {
    beforeEach(() => {
        // Reset l'état entre chaque test
        state.initializeState();
        jest.clearAllMocks();
    });

    it('initializeState devrait initialiser tous les états', () => {
        state.initializeState();

        expect(state.appState.projects).toEqual([]);
        expect(state.appState.currentProject).toBeNull();
        expect(state.appState.searchResults).toEqual([]);
        expect(state.appState.selectedSearchResults).toEqual(new Set());
        expect(state.appState.currentSection).toBe('projects');
    });

    it('setSearchResults devrait mettre à jour les résultats et émettre un événement', () => {
        const eventListener = jest.fn();
        window.addEventListener('search-results-updated', eventListener);

        const results = [{ id: '1', title: 'Test Article' }];
        state.setSearchResults(results);

        expect(state.appState.searchResults).toEqual(results);
        expect(eventListener).toHaveBeenCalled();
        
        window.removeEventListener('search-results-updated', eventListener);
    });

    it('addSelectedArticle et removeSelectedArticle devraient gérer la sélection', () => {
        state.addSelectedArticle('article1');
        state.addSelectedArticle('article2');
        
        expect(state.isArticleSelected('article1')).toBe(true);
        expect(state.isArticleSelected('article2')).toBe(true);
        expect(state.getSelectedArticles()).toEqual(['article1', 'article2']);

        state.removeSelectedArticle('article1');
        expect(state.isArticleSelected('article1')).toBe(false);
        expect(state.getSelectedArticles()).toEqual(['article2']);
    });

    it('clearSelectedArticles devrait vider la sélection', () => {
        state.addSelectedArticle('article1');
        state.addSelectedArticle('article2');
        
        state.clearSelectedArticles();
        
        expect(state.appState.selectedSearchResults.size).toBe(0);
        expect(state.getSelectedArticles()).toEqual([]);
    });

    it('setConnectionStatus devrait mettre à jour le statut de connexion', () => {
        state.setConnectionStatus('disconnected');
        expect(state.appState.isConnected).toBe(false);

        state.setConnectionStatus('connected');
        expect(state.appState.isConnected).toBe(true);
    });

    it('setCurrentProjectExtractions devrait mettre à jour les extractions', () => {
        const extractions = [{ id: 'ext1', data: 'test' }];
        state.setCurrentProjectExtractions(extractions);
        
        expect(state.appState.currentProjectExtractions).toEqual(extractions);
    });

    it('updateNotificationCount devrait gérer le compteur de notifications', () => {
        state.setNotificationCount(5);
        expect(state.appState.notificationCount).toBe(5); // Corrected property name

        state.incrementNotificationCount();
        expect(state.appState.notificationCount).toBe(6); // Corrected property name

        state.setNotificationCount(0);
        expect(state.appState.notificationCount).toBe(0); // Corrected property name
    });
});