// web/js/state.js

import { appState } from '../app.js';
import { renderProjectList, renderProjectDetail, updateProjectListSelection } from './projects.js';
import { renderSearchResultsTable, updateSelectionCounter, updateAllRowSelections } from './articles.js';
import { updateNotificationIndicator } from './notifications.js';
import { renderAnalysesSection } from './analyses.js';
import { renderChatInterface } from './chat.js';
import { renderValidationSection } from './validation.js';
import { renderGridsSection } from './grids.js';

// --- Setters pour l'état global ---

export function setProjects(projects) {
    appState.projects = Array.isArray(projects) ? projects : [];
    renderProjectList();
}

export function setCurrentProject(project) {
    appState.currentProject = project;
    updateProjectListSelection(); // Pour màj l'item actif
    renderProjectDetail(project);
}

export function setSearchResults(results, meta = {}) {
    appState.searchResults = Array.isArray(results) ? results : [];
    appState.searchResultsMeta = meta || {};
    renderSearchResultsTable();
}

export function addSelectedArticle(articleId) {
    if (!appState.selectedSearchResults.has(articleId)) {
        appState.selectedSearchResults.add(articleId);
        updateSelectionCounter();
    }
}

export function removeSelectedArticle(articleId) {
    if (appState.selectedSearchResults.has(articleId)) {
        appState.selectedSearchResults.delete(articleId);
        updateSelectionCounter();
    }
}

export function toggleSelectedArticle(articleId) {
    if (appState.selectedSearchResults.has(articleId)) {
        appState.selectedSearchResults.delete(articleId);
    } else {
        appState.selectedSearchResults.add(articleId);
    }
    updateSelectionCounter();
}

export function clearSelectedArticles() {
    appState.selectedSearchResults.clear();
    // Met à jour l'UI sans re-rendu complet
    updateAllRowSelections();
}

export function setNotifications(notifications, unreadCount) {
    appState.notifications = Array.isArray(notifications) ? notifications : [];
    appState.unreadNotifications = typeof unreadCount === 'number' ? unreadCount : 0;
    updateNotificationIndicator();
}

export function setAnalysisResults(results) {
    appState.analysisResults = results || {};
    renderAnalysesSection();
}

export function setChatMessages(messages) {
    appState.chatMessages = Array.isArray(messages) ? messages : [];
    renderChatInterface(appState.chatMessages);
}

export function addChatMessage(message) {
    if (message) {
        appState.chatMessages.push(message);
        renderChatInterface(appState.chatMessages);
    }
}

export function setCurrentValidations(validations) {
    appState.currentValidations = Array.isArray(validations) ? validations : [];
    if (appState.currentProject) {
        renderValidationSection(appState.currentProject);
    }
}

export function setQueuesStatus(queuesInfo) {
    appState.queuesInfo = queuesInfo;
}

// CORRIGÉ : Ajout du setter manquant pour les grilles du projet
export function setCurrentProjectGrids(grids) {
    appState.currentProjectGrids = Array.isArray(grids) ? grids : [];
    if (appState.currentSection === 'grids' && appState.currentProject) {
        renderGridsSection(appState.currentProject);
    }
}

// CORRIGÉ : Ajout du setter pour les extractions
export function setCurrentProjectExtractions(extractions) {
    appState.currentProjectExtractions = Array.isArray(extractions) ? extractions : [];
    // Déclencher un re-render des résultats si nécessaire
    if (appState.currentSection === 'results') {
        renderSearchResultsTable();
    }
}