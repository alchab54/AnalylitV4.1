// ================================================================
// AnalyLit V4.1 - Application Frontend (Version finale consolidée)
// ================================================================
import { setupDelegatedEventListeners, showSection, refreshCurrentSection, initializeWebSocket } from './js/core.js';
import { loadProjects, renderProjectDetail } from './js/projects.js';
import { loadSearchResults } from './js/articles.js';
import { loadRobSection } from './js/rob.js';
import { loadChatMessages } from './js/chat.js';
import { loadValidationSection, renderValidationSection } from './js/validation.js';
import { renderGridsSection } from './js/grids.js';
import { loadProjectAnalyses, renderAnalysesSection } from './js/analyses.js';
import { renderImportSection } from './js/import.js';
import { renderReportingSection } from './js/reporting.js';
import { renderSearchSection } from './js/search.js';
import { renderSettings, loadSettingsData } from './js/settings.js';
import { fetchAPI } from './js/api.js';
import { showToast, showLoadingOverlay } from './js/ui.js';

export const appState = {
    currentProject: null,
    projects: [],
    searchResults: [],
    searchResultsMeta: {},
    analysisProfiles: [],
    ollamaModels: [],
    prompts: [],
    currentProjectGrids: [],
    currentProjectExtractions: [],
    currentProjectChatHistory: [],
    socketConnected: false,
    currentSection: 'projects',
    socket: null,
    availableDatabases: [],
    notifications: [],
    unreadNotifications: 0,
    analysisResults: {},
    chatMessages: [],
    currentValidations: [],
    queuesInfo: [],
    selectedSearchResults: new Set()
};

export let elements = {};

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Démarrage de AnalyLit V4.1 Frontend...');
    
    // Initialisation des éléments DOM
    Object.assign(elements, {
        sections: document.querySelectorAll('.section'),
        navButtons: document.querySelectorAll('.app-nav__button'),
        connectionStatus: document.querySelector('[data-connection-status]'),
        projectsList: document.getElementById('projectsList'),
        createProjectBtn: document.getElementById('createProjectBtn'),
        projectDetail: document.getElementById('projectDetail'),
        projectDetailContent: document.getElementById('projectDetailContent'),
        projectPlaceholder: document.getElementById('projectPlaceholder'),
        resultsContainer: document.getElementById('resultsContainer'),
        validationContainer: document.getElementById('validationContainer'),
        analysisContainer: document.getElementById('analysisContainer'),
        importContainer: document.getElementById('importContainer'),
        chatContainer: document.getElementById('chatContainer'),
        settingsContainer: document.getElementById('settingsContainer'),
        robContainer: document.getElementById('robContainer'),
        modalsContainer: document.getElementById('modalsContainer'),
        loadingOverlay: document.getElementById('loadingOverlay'),
        toastContainer: document.getElementById('toastContainer'),
        zoteroFileInput: document.getElementById('zoteroFileInput'),
        bulkPDFInput: document.getElementById('bulkPDFInput'),
    });

    initializeApplication();
});

async function initializeApplication() {
    setupDelegatedEventListeners();
    initializeWebSocket();
    try {
        await loadInitialData();
        showSection('projects');
    } catch (error) {
        console.error("Erreur d'initialisation:", error);
        showToast("Impossible de charger les données initiales.", 'error', elements);
    } finally {
        showLoadingOverlay(false, '', elements);
    }
}


async function loadAnalysisProfiles() {
    appState.analysisProfiles = await fetchAPI('/profiles');
}

async function loadPrompts() {
    appState.prompts = await fetchAPI('/prompts');
}

async function loadOllamaModels() {
    appState.ollamaModels = await fetchAPI('/ollama/models');
}

async function loadAvailableDatabases() {
    appState.availableDatabases = await fetchAPI('/databases');
}

async function loadInitialData() {
    await Promise.all([
        loadProjects(),
        loadAvailableDatabases(), // Gardons celui-ci pour l'instant car il n'est pas dans loadSettingsData
        loadSettingsData()
    ]);
}

async function loadProjectFilesSet() {
  if (!appState.currentProject?.id) {
    appState.currentProjectFiles = new Set();
    return;
  }
  const files = await fetchAPI(`/projects/${appState.currentProject.id}/files`);
  const stems = (files || []).map(f => String(f.filename || '')
    .replace(/\.pdf$/i, '')
    .toLowerCase());
  appState.currentProjectFiles = new Set(stems);
}
