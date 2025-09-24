// web/app.js
// ================================================================
// AnalyLit V4.1 - Application Frontend (Version améliorée)
// ================================================================
import { layoutOptimizer } from './layout-optimizer.js';
import { showLoadingOverlay, closeModal, openModal } from './ui-improved.js';
import { showToast, showSuccess, showError } from './toast.js';
import { loadProjects, selectProject, handleCreateProject, confirmDeleteProject, deleteProject } from './projects.js';
import { loadAnalysisProfiles, openProfileEditor, handleDeleteProfile, handleSaveProfile, loadOllamaModels, renderSettings } from './settings.js';
import { renderImportSection, handleZoteroImport, showPmidImportModal, handleUploadPdfs, handleIndexPdfs, handleZoteroSync, processPmidImport, exportForThesis } from './import.js';
import { startBatchProcessing, showRunExtractionModal, startFullExtraction } from './articles.js'; // Corrected from pipeline.js and results.js
import { renderKnowledgeGraph, loadProjectAnalyses, exportAnalyses, runProjectAnalysis, showPRISMAModal, savePRISMAProgress, exportPRISMAReport } from './analyses.js';
import { handleGeneratePrisma, renderReportingSection, generateBibliography, generateSummaryTable, exportSummaryTableExcel, savePrismaChecklist } from './reporting.js';
import stakeholdersModule from './stakeholders.js';
import reportingModule from './reporting.js';
import { handleRunMetaAnalysis } from './analyses.js'; // Corrected from stats.js
import { loadValidationSection, handleValidateExtraction, resetValidationStatus, filterValidationList } from './validation.js';
import { loadQueuesStatus, handleClearQueue, handlePullModel, showEditPromptModal, handleSavePrompt } from './settings.js'; // Corrected from admin.js
import { setupDelegatedEventListeners, refreshCurrentSection, showSection, initializeWebSocket } from './core.js';
import { showGridFormModal, addGridFieldInput, handleSaveGrid, loadProjectGrids, handleDeleteGrid, removeGridField, triggerGridImport, handleGridImportUpload } from './grids.js'; // Corrected import
import { sendChatMessage, loadChatMessages, renderChatInterface } from './chat.js'; // Corrected import
import { fetchTasks } from './tasks.js';
import { ThemeManager } from './theme-manager.js';

export const API_BASE_URL = CONFIG.API_BASE_URL;

export const WEBSOCKET_URL = CONFIG.WEBSOCKET_URL;

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
    activeEvaluator: 'evaluator1',
    performance: {
        startTime: performance.now(),
        loadTimes: {},
        errors: []
    }
};

export let elements = {};

document.addEventListener('DOMContentLoaded', async () => {
    console.log(MESSAGES.appStart);

    // Initialiser le gestionnaire de thème
    appState.themeManager = new ThemeManager();

    // Sélection et vérification des éléments DOM
    const queries = {
        sections:        document.querySelectorAll(SELECTORS.sections),
        navButtons:      document.querySelectorAll(SELECTORS.navButtons),
        connectionStatus: document.querySelector(SELECTORS.connectionStatus),
        projectsList:   document.querySelector(SELECTORS.projectsList),
        createProjectBtn: document.querySelector(SELECTORS.createProjectBtn),
        projectDetail:  document.querySelector(SELECTORS.projectDetail),
        projectDetailContent: document.querySelector(SELECTORS.projectDetailContent),
        projectPlaceholder:   document.querySelector(SELECTORS.projectPlaceholder),
        resultsContainer:     document.querySelector(SELECTORS.resultsContainer),
        validationContainer:  document.querySelector(SELECTORS.validationContainer),
        analysisContainer:    document.querySelector(SELECTORS.analysisContainer),
        importContainer:      document.querySelector(SELECTORS.importContainer),
        chatContainer:        document.querySelector(SELECTORS.chatContainer),
        settingsContainer:    document.querySelector(SELECTORS.settingsContainer),
        robContainer:         document.querySelector(SELECTORS.robContainer),
        modalsContainer:      document.querySelector(SELECTORS.modalsContainer),
        loadingOverlay:       document.querySelector(SELECTORS.loadingOverlay),
        toastContainer:       document.querySelector(SELECTORS.toastContainer),
        reportingContainer:   document.querySelector(SELECTORS.reportingContainer),
        tasksContainer:       document.querySelector(SELECTORS.tasksContainer),
        newProjectForm:       document.querySelector(SELECTORS.newProjectForm),
        gridsContainer:       document.querySelector(SELECTORS.gridsContainer),
        searchContainer:      document.querySelector(SELECTORS.searchContainer),
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
        console.error(MESSAGES.missingDOMElement, missing);
        showToast(MESSAGES.errorUI, 'error');
        return;
    }

    initializeApplication();

     // Initialiser l'optimiseur de layout
    layoutOptimizer.init();
    layoutOptimizer.setupResponsiveOptimization();
    
    // Auto-optimisation sur changement de section
    document.addEventListener('click', (e) => {
        if (e.target.matches('.app-nav__button')) {
            setTimeout(() => layoutOptimizer.optimizeCurrentSection(), 200);
        }
    });
});

async function initializeApplication() {
    const t0 = performance.now();
    try {
        setupDelegatedEventListeners();
        initializeWebSocket();
        stakeholdersModule.init();
        reportingModule.init();
        setInterval(fetchTasks, 5000); // Refresh tasks every 5 seconds
        await loadInitialData();

        const last = localStorage.getItem(CONFIG.LOCAL_STORAGE_LAST_SECTION) || 'projects';
        showSection(last);

        if (appState.projects.length && !appState.currentProject) {
            const id = appState.projects[0].id;
            await selectProject(id);
            if (last==='projects') refreshCurrentSection();
        }

        setupKeyboardShortcuts();
        setupPerformanceMonitoring();

        const initMs = performance.now() - t0;
        console.log(MESSAGES.appInitialized(initMs.toFixed(2)));
        appState.performance.loadTimes.initialization = initMs;
    } catch (err) {
        console.error(MESSAGES.initError, err);
        appState.performance.errors.push({type:'init',error:err.message,timestamp:Date.now()});
        showToast(MESSAGES.loadError, 'error');
    }
}

async function loadInitialData() {
    const t1 = performance.now();
    try {
        await Promise.all([loadProjects(), loadAvailableDatabases(), loadAnalysisProfiles()]);
        const loadMs = performance.now() - t1;
        appState.performance.loadTimes.initialData = loadMs;
        console.log(MESSAGES.initialDataLoaded(loadMs.toFixed(2)));
    } catch (err) {
        console.error(MESSAGES.initialDataError, err);
        throw err;
    }
}

async function loadAvailableDatabases() {
    try {
        appState.availableDatabases = await fetchAPI(API_ENDPOINTS.databases);
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
        console.log(MESSAGES.appStateLog, report);
        return report;
    }
};

console.log(MESSAGES.debugInterface);
