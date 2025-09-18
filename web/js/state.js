// web/js/state.js

import { appState } from './app-improved.js';
export function setProjects(projects) {
    appState.projects = projects;
    // This function should only update the state.
    // The calling module is responsible for triggering a re-render.
}

export function setCurrentProject(project) {
    appState.currentProject = project;
}

export function setAnalysisResults(results) {
    appState.analysisResults = results;
}

export function setSearchResults(articles, meta) {
    appState.searchResults = articles;
    appState.searchResultsMeta = meta;
}

export function setCurrentProjectExtractions(extractions) {
    appState.currentProjectExtractions = extractions;
}

export function setCurrentValidations(validations) {
    appState.currentValidations = validations;
}

export function setCurrentProjectGrids(grids) {
    appState.currentProjectGrids = grids;
}

export function toggleSelectedArticle(articleId) {
    if (appState.selectedSearchResults.has(articleId)) {
        appState.selectedSearchResults.delete(articleId);
    } else {
        appState.selectedSearchResults.add(articleId);
    }
}

export function clearSelectedArticles() {
    appState.selectedSearchResults.clear();
}

export function setQueuesStatus(status) {
    appState.queuesInfo = status;
}
