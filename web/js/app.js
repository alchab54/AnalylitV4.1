// ================================================================
// AnalyLit V4.1 - Application Frontend (Version améliorée)
// ================================================================
import { setupDelegatedEventListeners, showSection, refreshCurrentSection, initializeWebSocket } from './js/core.js';
import { handleCreateProject, loadProjects, renderProjectDetail, selectProject } from './js/projects.js';
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
import { loadTasksSection, setupTasksAutoRefresh } from './js/tasks.js';
import { fetchAPI } from './js/api.js';
import { showToast, showLoadingOverlay } from './js/ui.js';
import { ThemeManager } from './js/theme-manager.js';

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
    themeManager: null, // Pour gérer les thèmes
    performance: {
        startTime: performance.now(),
        loadTimes: {},
        errors: []
    }
};

export let elements = {};

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Démarrage de AnalyLit V4.1 Frontend (Version améliorée)...');
    
    // Initialiser le gestionnaire de thème en premier
    appState.themeManager = new ThemeManager();
    
    // Initialisation des éléments DOM avec validation améliorée
    const elementQueries = {
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
        reportingContainer: document.getElementById('reportingContainer'),
        tasksContainer: document.getElementById('tasksContainer'),
        newProjectForm: document.getElementById('newProjectForm'),
        gridsContainer: document.getElementById('gridsContainer'),
        searchContainer: document.getElementById('searchContainer')
    };

    // Assign elements et vérifier les éléments manquants
    let missingElements = [];
    for (const key in elementQueries) {
        elements[key] = elementQueries[key];
        if (!elements[key] || (elements[key] instanceof NodeList && elements[key].length === 0)) {
            // Éléments critiques vs optionnels
            const criticalElements = ['sections', 'navButtons', 'loadingOverlay', 'toastContainer'];
            if (criticalElements.includes(key)) {
                missingElements.push(key);
            }
        }
    }

    if (missingElements.length > 0) {
        console.error('Éléments DOM critiques manquants:', missingElements);
        showToast('Erreur : éléments d\'interface manquants', 'error');
        return;
    }

    initializeApplication();
});

async function initializeApplication() {
    const initStart = performance.now();
    
    try {
        // Phase 1: Setup event listeners
        setupDelegatedEventListeners();
        
        // Phase 2: Initialize WebSocket
        initializeWebSocket();
        
        // Phase 3: Setup auto-refresh for tasks
        setupTasksAutoRefresh();
        
        // Phase 4: Load initial data
        await loadInitialData();
        
        // Phase 5: Restore last section or default to projects
        const lastSection = localStorage.getItem('analylit_last_section') || 'projects';
        showSection(lastSection);
        
        // Phase 6: Auto-select first project if available
        if (appState.projects.length > 0 && !appState.currentProject) {
            const firstProjectId = appState.projects[0].id;
            console.log('🎯 Auto-sélection du premier projet:', firstProjectId);
            await selectProject(firstProjectId);
            if (lastSection === 'projects') refreshCurrentSection();
        }
        
        // Phase 7: Setup additional features
        setupKeyboardShortcuts();
        setupPerformanceMonitoring();
        
        const initTime = performance.now() - initStart;
        console.log(`✅ Application initialisée en ${initTime.toFixed(2)}ms`);
        appState.performance.loadTimes.initialization = initTime;
        
    } catch (error) {
        console.error("❌ Erreur d'initialisation:", error);
        appState.performance.errors.push({
            type: 'initialization',
            error: error.message,
            timestamp: Date.now()
        });
        showToast("Impossible de charger l'application. Rechargez la page.", 'error');
    }
}

async function loadInitialData() {
    const loadStart = performance.now();
    
    try {
        await Promise.all([
            loadProjects(),
            loadAvailableDatabases(),
            loadSettingsData()
        ]);
        
        const loadTime = performance.now() - loadStart;
        appState.performance.loadTimes.initialData = loadTime;
        console.log(`📊 Données initiales chargées en ${loadTime.toFixed(2)}ms`);
        
    } catch (error) {
        console.error('Erreur lors du chargement des données initiales:', error);
        throw error;
    }
}

async function loadAvailableDatabases() {
    try {
        appState.availableDatabases = await fetchAPI('/databases');
    } catch (error) {
        console.warn('Impossible de charger les bases de données:', error);
        appState.availableDatabases = [];
    }
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
        // Ctrl/Cmd + K pour ouvrir la recherche
        if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
            event.preventDefault();
            showSection('search');
        }
        
        // Echap pour fermer les modales
        if (event.key === 'Escape') {
            const openModal = document.querySelector('.modal--show');
            if (openModal) {
                openModal.classList.remove('modal--show');
            }
        }
        
        // Alt + 1-9 pour naviguer entre les sections
        if (event.altKey && /^[1-9]$/.test(event.key)) {
            event.preventDefault();
            const sections = ['projects', 'search', 'results', 'validation', 'grids', 'rob', 'analyses', 'import', 'chat'];
            const sectionIndex = parseInt(event.key) - 1;
            if (sections[sectionIndex]) {
                showSection(sections[sectionIndex]);
            }
        }
    });
}

function setupPerformanceMonitoring() {
    // Surveiller les erreurs JavaScript
    window.addEventListener('error', (event) => {
        appState.performance.errors.push({
            type: 'javascript',
            error: event.error?.message || event.message,
            filename: event.filename,
            line: event.lineno,
            timestamp: Date.now()
        });
    });

    // Surveiller les erreurs de promesse non gérées
    window.addEventListener('unhandledrejection', (event) => {
        appState.performance.errors.push({
            type: 'promise',
            error: event.reason?.message || event.reason,
            timestamp: Date.now()
        });
    });

    // Performance de chargement des sections
    const originalShowSection = window.showSection;
    if (originalShowSection) {
        window.showSection = function(sectionId) {
            const start = performance.now();
            const result = originalShowSection.call(this, sectionId);
            const end = performance.now();
            
            appState.performance.loadTimes[`section_${sectionId}`] = end - start;
            
            return result;
        };
    }
}

// Export des fonctions utilitaires pour le debugging
export function getPerformanceReport() {
    const totalTime = performance.now() - appState.performance.startTime;
    
    return {
        totalRunTime: totalTime,
        loadTimes: appState.performance.loadTimes,
        errorCount: appState.performance.errors.length,
        errors: appState.performance.errors.slice(-10), // Dernières 10 erreurs
        memoryUsage: performance.memory ? {
            used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
            total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
            limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
        } : null
    };
}

// Debug helper accessible depuis la console
window.AnalyLit = {
    state: appState,
    elements: elements,
    performance: getPerformanceReport,
    switchTheme: (theme) => appState.themeManager.setTheme(theme),
    exportState: () => {
        const exportData = {
            currentProject: appState.currentProject?.id,
            currentSection: appState.currentSection,
            projectsCount: appState.projects.length,
            selectedResults: appState.selectedSearchResults.size,
            performance: getPerformanceReport()
        };
        console.log('État de l\'application:', exportData);
        return exportData;
    }
};

console.log('🎯 Interface de debug disponible: window.AnalyLit');