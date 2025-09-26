/**
 * @jest-environment jsdom
 */
import * as state from './state.js';

describe('Module State', () => {
  beforeEach(() => {
    // Réinitialiser l'état avant chaque test
    state.initializeState();
    // Espionner dispatchEvent pour vérifier que les événements sont bien envoyés
    jest.spyOn(window, 'dispatchEvent');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('setProjects devrait mettre à jour appState.projects et dispatcher un événement', () => {
    const mockProjects = [{ id: '1', name: 'Projet Test' }];
    state.setProjects(mockProjects);

    expect(state.appState.projects).toEqual(mockProjects);
    expect(window.dispatchEvent).toHaveBeenCalledWith(expect.any(CustomEvent));
    const dispatchedEvent = window.dispatchEvent.mock.calls[0][0];
    expect(dispatchedEvent.type).toBe('projects-updated');
    expect(dispatchedEvent.detail).toEqual({ projects: mockProjects });
  });

  it('setCurrentProject devrait mettre à jour appState.currentProject et dispatcher un événement', () => {
    const mockProject = { id: '1', name: 'Projet Actif' };
    state.setCurrentProject(mockProject);

    expect(state.appState.currentProject).toEqual(mockProject);
    expect(window.dispatchEvent).toHaveBeenCalledWith(expect.any(CustomEvent));
    const dispatchedEvent = window.dispatchEvent.mock.calls[0][0];
    expect(dispatchedEvent.type).toBe('current-project-changed');
    expect(dispatchedEvent.detail).toEqual({ project: mockProject });
  });

  it('setCurrentSection devrait mettre à jour appState.currentSection et dispatcher un événement', () => {
    state.setCurrentSection('analyses');

    expect(state.appState.currentSection).toBe('analyses');
    expect(window.dispatchEvent).toHaveBeenCalledWith(expect.any(CustomEvent));
    const dispatchedEvent = window.dispatchEvent.mock.calls[0][0];
    expect(dispatchedEvent.type).toBe('section-changed');
    expect(dispatchedEvent.detail.currentSection).toBe('analyses');
  });

  it('addSelectedArticle et getSelectedArticles devraient fonctionner ensemble', () => {
    expect(state.getSelectedArticles()).toEqual([]);

    state.addSelectedArticle('article-1');
    expect(state.getSelectedArticles()).toEqual(['article-1']);
    expect(window.dispatchEvent).toHaveBeenCalledWith(expect.any(CustomEvent));

    state.addSelectedArticle('article-2');
    expect(state.getSelectedArticles()).toEqual(['article-1', 'article-2']);

    state.removeSelectedArticle('article-1');
    expect(state.getSelectedArticles()).toEqual(['article-2']);
  });
});