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

    it('toggleAllArticles devrait sélectionner ou désélectionner tous les articles', () => {
        const articleIds = ['art1', 'art2', 'art3'];

        // Sélectionner tout
        state.toggleAllArticles(articleIds, true);
        expect(state.appState.selectedSearchResults.size).toBe(3);
        expect(state.isArticleSelected('art2')).toBe(true);

        // Désélectionner tout
        state.toggleAllArticles(articleIds, false);
        expect(state.appState.selectedSearchResults.size).toBe(0);
        expect(state.isArticleSelected('art2')).toBe(false);
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

  it('setStakeholders devrait mettre à jour les parties prenantes et émettre un événement', () => {
    const mockStakeholders = [{ id: 's1', name: 'Dr. Smith' }];
    const dispatchEventSpy = jest.spyOn(window, 'dispatchEvent');

    state.setStakeholders(mockStakeholders);

    expect(state.appState.stakeholders).toEqual(mockStakeholders);
    expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(CustomEvent));
    expect(dispatchEventSpy.mock.calls[0][0].type).toBe('stakeholders-updated');
  });

  it('setPrompts devrait mettre à jour les prompts et émettre un événement', () => {
    const mockPrompts = [{ id: 'p1', name: 'Synthèse' }];
    const dispatchEventSpy = jest.spyOn(window, 'dispatchEvent');

    state.setPrompts(mockPrompts);

    expect(state.appState.prompts).toEqual(mockPrompts);
    expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(CustomEvent));
    expect(dispatchEventSpy.mock.calls[0][0].type).toBe('prompts-updated');
  });

  it('filterSearchResults devrait filtrer les articles par statut', () => {
    state.appState.searchResults = [
      { title: 'Article A', status: 'completed' },
      { title: 'Article B', status: 'pending' },
      { title: 'Article C', status: 'completed' },
    ];

    const filtered = state.filterSearchResults({ status: 'completed' });

    expect(filtered).toHaveLength(2);
    expect(filtered[0].title).toBe('Article A');
    });
});