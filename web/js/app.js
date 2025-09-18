// web/app.js
// ================================================================
// AnalyLit V4.1 - Application Frontend (Version améliorée)
// ================================================================

import { showToast, showLoadingOverlay, closeModal, openModal } from './web/js/ui-improved.js';
import { loadProjects, selectProject, handleNewProject, handleConfirmDelete, deleteProject } from './web/js/projects.js';
import { loadAnalysisProfiles, openProfileEditor, handleDeleteProfile, handleSaveProfile } from './web/js/settings.js';
import { loadOllamaModels } from './web/js/settings.js';
import { handleSaveZoteroSettings, handleImportFromZotero, startZoteroStatusPolling } from './web/js/import.js';
import { handlePrepareAnalysis, handleRunPipeline, handleRunSynthesis, handlePdfUpload } from './web/js/pipeline.js';
import { handleExportResults, handleExportAll } from './web/js/results.js';
import { handleGenerateDiscussion, handleGenerateGraph, renderKnowledgeGraph } from './web/js/analysis.js';
import { handleGeneratePrisma } from './web/js/reports.js';
import { handleRunMetaAnalysis, handleRunDescriptiveStats, handleRunAtnScore } from './web/js/stats.js';
import { loadArticlesForValidation, handleValidationDecision } from './web/js/validation.js';
import { handleClearQueue, handlePullModel, openPromptEditor, handleSavePrompt, renderQueueStatus, renderOllamaModels, renderPromptsList, renderSettingsPage } from './web/js/admin.js';
import { openGridEditor, addGridFieldRow, handleSaveGrid, loadProjectGrids } from './web/js/grids.js';
import { handleStartIndexing, handleSendChatMessage, renderChatHistory } from './web/js/chat.js';

export const API_BASE_URL = '/api';

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
    selectedSearchResults: new Set(),
    prismaChecklist: null,
    renderedSections: new Set(),
    themeManager: null,
    performance: {
        startTime: performance.now(),
        loadTimes: {},
        errors: []
    }
};

export let elements = {};

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Démarrage de AnalyLit V4.1 Frontend (Version améliorée)...');

    // Initialiser le gestionnaire de thème
    appState.themeManager = new ThemeManager();

    // Sélection et vérification des éléments DOM
    const queries = {
        sections:        document.querySelectorAll('.section'),
        navButtons:      document.querySelectorAll('.app-nav__button'),
        connectionStatus: document.querySelector('[data-connection-status]'),
        projectsList:   document.getElementById('projectsList'),
        createProjectBtn: document.getElementById('createProjectBtn'),
        projectDetail:  document.getElementById('projectDetail'),
        projectDetailContent: document.getElementById('projectDetailContent'),
        projectPlaceholder:   document.getElementById('projectPlaceholder'),
        resultsContainer:     document.getElementById('resultsContainer'),
        validationContainer:  document.getElementById('validationContainer'),
        analysisContainer:    document.getElementById('analysisContainer'),
        importContainer:      document.getElementById('importContainer'),
        chatContainer:        document.getElementById('chatContainer'),
        settingsContainer:    document.getElementById('settingsContainer'),
        robContainer:         document.getElementById('robContainer'),
        modalsContainer:      document.getElementById('modalsContainer'),
        loadingOverlay:       document.getElementById('loadingOverlay'),
        toastContainer:       document.getElementById('toastContainer'),
        reportingContainer:   document.getElementById('reportingContainer'),
        tasksContainer:       document.getElementById('tasksContainer'),
        newProjectForm:       document.getElementById('newProjectForm'),
        gridsContainer:       document.getElementById('gridsContainer'),
        searchContainer:      document.getElementById('searchContainer'),
    };

    const critical = ['sections','navButtons','loadingOverlay','toastContainer'];
    const missing = [];

    for (const [key, el] of Object.entries(queries)) {
        elements[key] = el;
        if (!el || (el instanceof NodeList && el.length === 0)) {
            if (critical.includes(key)) missing.push(key);
        }
    }

    if (missing.length) {
        console.error('Éléments DOM critiques manquants:', missing);
        showToast("Erreur : éléments d'interface manquants", 'error');
        return;
    }

    initializeApplication();
});

async function initializeApplication() {
    const t0 = performance.now();
    try {
        setupDelegatedEventListeners();
        initializeWebSocket();
        setupTasksAutoRefresh();
        await loadInitialData();

        const last = localStorage.getItem('analylit_last_section') || 'projects';
        showSection(last);

        if (appState.projects.length && !appState.currentProject) {
            const id = appState.projects[0].id;
            await selectProject(id);
            if (last==='projects') refreshCurrentSection();
        }

        setupKeyboardShortcuts();
        setupPerformanceMonitoring();

        const initMs = performance.now() - t0;
        console.log(`✅ Application initialisée en ${initMs.toFixed(2)}ms`);
        appState.performance.loadTimes.initialization = initMs;
    } catch (err) {
        console.error("❌ Erreur d'initialisation:", err);
        appState.performance.errors.push({type:'init',error:err.message,timestamp:Date.now()});
        showToast("Impossible de charger l'application. Rechargez la page.", 'error');
    }
}

async function loadInitialData() {
    const t1 = performance.now();
    try {
        await Promise.all([loadProjects(), loadAvailableDatabases(), loadSettingsData()]);
        const loadMs = performance.now() - t1;
        appState.performance.loadTimes.initialData = loadMs;
        console.log(`📊 Données initiales chargées en ${loadMs.toFixed(2)}ms`);
    } catch (err) {
        console.error('Erreur chargement initial:', err);
        throw err;
    }
}

async function loadAvailableDatabases() {
    try {
        appState.availableDatabases = await fetchAPI('databases');
    } catch {
        appState.availableDatabases = [];
    }
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
        if ((e.ctrlKey||e.metaKey)&&e.key==='k') { e.preventDefault(); showSection('search'); }
        if (e.key==='Escape') document.querySelector('.modal--show')?.classList.remove('modal--show');
        if (e.altKey && /^[1-9]$/.test(e.key)) {
            e.preventDefault();
            const seq = ['projects','search','results','validation','grids','rob','analyses','import','chat'];
            showSection(seq[+e.key-1]);
        }
    });
}

function setupPerformanceMonitoring() {
    window.addEventListener('error', ev => {
        appState.performance.errors.push({type:'js',error:ev.error?.message||ev.message,filename:ev.filename,line:ev.lineno,timestamp:Date.now()});
    });
    window.addEventListener('unhandledrejection', ev => {
        appState.performance.errors.push({type:'promise',error:ev.reason?.message||ev.reason,timestamp:Date.now()});
    });
    const orig = showSection;
    window.showSection = function(sec) {
        const t = performance.now();
        const res = orig.call(this,sec);
        appState.performance.loadTimes[`section_${sec}`]=performance.now()-t;
        return res;
    };
}

export function getPerformanceReport() {
    const total = performance.now() - appState.performance.startTime;
    return {
        totalRunTime: total,
        loadTimes: appState.performance.loadTimes,
        errorCount: appState.performance.errors.length,
        errors: appState.performance.errors.slice(-10),
        memoryUsage: performance.memory ? {
            used: Math.round(performance.memory.usedJSHeapSize/1024/1024),
            total: Math.round(performance.memory.totalJSHeapSize/1024/1024),
            limit: Math.round(performance.memory.jsHeapSizeLimit/1024/1024)
        } : null
    };
}

window.AnalyLit = {
    state: appState,
    elements,
    performance: getPerformanceReport,
    switchTheme: theme => appState.themeManager.setTheme(theme),
    exportState: () => {
        const report = {
            currentProject: appState.currentProject?.id,
            currentSection: appState.currentSection,
            projectsCount: appState.projects.length,
            selectedResults: appState.selectedSearchResults.size,
            performance: getPerformanceReport()
        };
        console.log('État de l\'application:', report);
        return report;
    }
};

console.log('🎯 Interface de debug disponible: window.AnalyLit');
