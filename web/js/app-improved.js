// web/js/app-improved.js

import { appState, initializeState, setConnectionStatus, setAnalysisProfiles, setAvailableDatabases } from './state.js';
import { fetchAPI } from './api.js';
import { API_ENDPOINTS } from './constants.js';
// ✅ IMPORT AJOUTÉ pour showError
import * as ui from './ui-improved.js';
import * as projects from './projects.js';
import { showSection, setupDelegatedEventListeners, initializeWebSocket } from './core.js';

// ============================
// Objet elements - UNIQUE EXPORT
// ============================

export const elements = {
    // Éléments de navigation
    header: () => document.querySelector('.app-header'),
    nav: () => document.querySelector('.app-nav'),
    main: () => document.querySelector('.app-main'),
    container: () => document.querySelector('.container'),
    
    // Éléments de projet
    projectsList: () => document.querySelector('#projects-list'),
    projectDetail: () => document.querySelector('#projectDetail'),
    projectPlaceholder: () => document.querySelector('#projectPlaceholder'),
    createProjectBtn: () => document.querySelector('#create-project-btn'),
    
    // Modales
    newProjectModal: () => document.getElementById('newProjectModal'),
    genericModal: () => document.getElementById('genericModal'),
    
    // Overlays et interfaces
    loadingOverlay: () => document.getElementById('loadingOverlay'),
    toastContainer: () => document.getElementById('toastContainer'),
    connectionStatus: () => document.getElementById('connection-status'),
    
    // Sections
    projectsSection: () => document.getElementById('projects'),
    articlesSection: () => document.getElementById('articles'),
    analysesSection: () => document.getElementById('analyses'),
    settingsSection: () => document.getElementById('settings'),
    robContainer: () => document.getElementById('robContainer'),
    
    // Formulaires
    createProjectForm: () => document.getElementById('createProjectForm'),
    projectNameInput: () => document.getElementById('projectName'),
    projectDescriptionInput: () => document.getElementById('projectDescription'),
    analysisMode: () => document.getElementById('analysisMode')
};

// ============================
// Variables globales
// ============================

let isInitialized = false;

// ============================
// Fonctions principales
// ============================

/**
 * Initialise tous les gestionnaires d'événements
 */
function initializeEventHandlers() {
    setupDelegatedEventListeners();
    console.log('🔧 Gestionnaires d\'événements initialisés');
}

/**
 * Charge les données initiales de l'application
 */
export async function loadInitialData() {
    try {
        const [profiles, databases] = await Promise.all([
            fetchAPI(API_ENDPOINTS.analysisProfiles),
            fetchAPI(API_ENDPOINTS.databases)
        ]);
        setAnalysisProfiles(profiles || []);
        setAvailableDatabases(databases || []);
        await projects.loadProjects();
    } catch (error) {
        // Laisser initializeApplication gérer l'erreur
        throw error;
    }
}

/**
 * Charge les profils d'analyse
 */
async function loadAnalysisProfiles() {
    try {
        const { fetchAPI } = await import('./api.js');
        const response = await fetchAPI(API_ENDPOINTS.analysisProfiles);
        return response || [];
    } catch (error) {
        console.error('Erreur lors du chargement des profils d\'analyse:', error);
        setAnalysisProfiles([]);
        return [];
    }
}

/**
 * Charge les bases de données disponibles
 */
async function loadAvailableDatabases() {
    try {
        const { fetchAPI } = await import('./api.js');
        const databases = await fetchAPI(API_ENDPOINTS.databases);
        setAvailableDatabases(databases || []);
    } catch (error) {
        console.error('Erreur lors du chargement des bases de données:', error);
        setAvailableDatabases([]);
    }
}

/**
 * Affiche un message d'erreur
 */
function showError(message) {
    import('./ui-improved.js').then(ui => ui.showError ? ui.showError(message) : ui.showToast(message, 'error'));
}

/**
 * Point d'entrée principal de l'application
 */
export async function initializeApplication() {
    if (isInitialized) return;
    console.log('🚀 Démarrage de AnalyLit V4.1 Frontend (Version améliorée)...');
    try {
        const startTime = performance.now();
        
        // Initialisation de l'état
        initializeState();
        
        // Initialisation des gestionnaires d'événements
        initializeEventHandlers();
        
        // Initialisation du WebSocket
        initializeWebSocket();

        await loadInitialData();
        
        // Afficher la section par défaut uniquement si tout s'est bien passé
        const projectsButton = document.querySelector('.app-nav__button[data-section-id="projects"]');
        if (projectsButton) {
            showSection?.('projects');
            document.querySelectorAll('.app-nav__button').forEach(btn => btn.classList.remove('app-nav__button--active'));
            projectsButton.classList.add('app-nav__button--active');
            console.log('🎯 Section projets activée par défaut via app-improved.js');
        }
        isInitialized = true;
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation:', error);
        
        // Message exact attendu par le test
        ui.showError('Erreur lors de l\'initialisation de l\'application');
        // ✅ IMPORTANT: Ne pas appeler showSection en cas d'erreur
    }
}

// ============================
// Initialisation automatique
// ============================

document.addEventListener('DOMContentLoaded', initializeApplication);

// ============================
// Interface de debug globale
// ============================

window.AnalyLit = {
    appState,
    elements,
    reinitialize: () => {
        isInitialized = false;
        location.reload();
    },
    debug: {
        showState: () => console.log('État actuel:', appState),
        showProjects: () => console.log('Projets:', appState.projects),
        forceRender: async () => {
            if (appState.projects) {
                const { renderProjectCards } = await import('./ui-improved.js');
                renderProjectCards(appState.projects);
            }
        },
        checkElements: () => {
            Object.entries(elements).forEach(([key, getter]) => {
                const element = getter();
                console.log(`${key}:`, element ? '✅ Trouvé' : '❌ Manquant', element);
            });
        }
    }
};

console.log('🎯 Interface de debug disponible: window.AnalyLit');

// EXPORT UNIQUE - Pas de duplication !
export { appState, initializeEventHandlers };
