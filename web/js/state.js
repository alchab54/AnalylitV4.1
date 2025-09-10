// web/js/state.js
import { appState } from '../app.js';
import { renderProjectList, renderProjectDetail } from './projects.js';
import { renderSearchResultsTable, updateSelectionCounter } from './articles.js';
import { updateNotificationIndicator } from './core.js';
import { renderAnalysesSection } from './analyses.js';
import { renderChatInterface } from './chat.js';
import { renderValidationSection } from './validation.js';

// --- Setters pour l'état global ---

export function setProjects(projects) {
    appState.projects = projects || [];
    renderProjectList();
}

export function setCurrentProject(project) {
    appState.currentProject = project;
    renderProjectList(); // Pour màj l'item actif
    renderProjectDetail(project);
}

export function setSearchResults(results, meta = {}) {
    appState.searchResults = results || [];
    appState.searchResultsMeta = meta;
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
    updateSelectionCounter();
    renderSearchResultsTable(); // Re-render pour décocher les cases
}

export function setNotifications(notifications, unreadCount) {
    appState.notifications = notifications || [];
    appState.unreadNotifications = unreadCount || 0;
    updateNotificationIndicator();
}

export function setAnalysisResults(results) {
    appState.analysisResults = results || {};
    renderAnalysesSection();
}

export function setChatMessages(messages) {
    appState.chatMessages = messages || [];
    renderChatInterface();
}

export function addChatMessage(message) {
    appState.chatMessages.push(message);
    renderChatInterface();
}

export function setCurrentValidations(validations) {
    appState.currentValidations = validations || [];
    renderValidationSection();
}