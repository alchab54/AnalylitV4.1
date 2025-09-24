// web/js/app-improved.js

import { appState, initializeState } from './state.js';
import { API_ENDPOINTS, SELECTORS, MESSAGES } from './constants.js';
import { showSection } from './core.js';

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
    // Gestionnaire de navigation
    document.addEventListener('click', handleNavigation);
    
    // Gestionnaire de modales
    document.addEventListener('click', handleModalActions);
    
    // Gestionnaire de formulaires
    document.addEventListener('submit', handleForms);
    
    // Gestionnaire d'événements personnalisés
    document.addEventListener('project-select', handleProjectSelect);
    
    console.log('🔧 Gestionnaires d\'événements initialisés');
}

/**
 * Gestionnaire unifié de navigation
 */
function handleNavigation(event) {
    const button = event.target.closest('[data-action="show-section"]');
    if (!button) return;
    
    event.preventDefault();
    
    const sectionId = button.dataset.sectionId;
    if (sectionId) {
        // Mettre à jour l'état actif des boutons
        document.querySelectorAll('.app-nav__button').forEach(btn => {
            btn.classList.remove('app-nav__button--active');
        });
        button.classList.add('app-nav__button--active');
        
        // Afficher la section
        showSection(sectionId);
    }
}

/**
 * Gestionnaire des actions de modales
 */
function handleModalActions(event) {
    const action = event.target.dataset.action;
    
    switch (action) {
        case 'create-project-modal':
            import('./ui-improved.js').then(({ showCreateProjectModal }) => {
                showCreateProjectModal();
            });
            break;
            
        case 'close-modal':
            import('./ui-improved.js').then(({ closeModal }) => {
                closeModal();
            });
            break;
            
        case 'select-project':
            const projectId = event.target.closest('[data-project-id]')?.dataset.projectId;
            if (projectId) {
                import('./projects.js').then(({ selectProject }) => {
                    selectProject(projectId);
                });
            }
            break;
    }
}

/**
 * Gestionnaire de formulaires
 */
function handleForms(event) {
    const form = event.target;
    const formType = form.dataset.form;
    
    switch (formType) {
        case 'create-project':
            event.preventDefault();
            import('./projects.js').then(({ handleCreateProject }) => {
                handleCreateProject(event);
            });
            break;
    }
}

/**
 * Gestionnaire de sélection de projet (événement personnalisé)
 */
function handleProjectSelect(event) {
    const { projectId } = event.detail;
    import('./projects.js').then(({ selectProject }) => {
        selectProject(projectId);
    });
}

/**
 * Charge les données initiales de l'application
 */
async function loadInitialData() {
    const startTime = performance.now();
    
    try {
        // Import dynamique pour éviter les dépendances circulaires
        const { loadProjects } = await import('./projects.js');
        
        // Chargement en parallèle des données essentielles
        const promises = [
            loadProjects(),
            loadAnalysisProfiles()
        ];
        
        await Promise.all(promises);
        
        const endTime = performance.now();
        console.log(`📊 Données initiales chargées en ${(endTime - startTime).toFixed(2)}ms`);
        
    } catch (error) {
        console.error('Erreur lors du chargement des données initiales:', error);
        throw error;
    }
}

/**
 * Charge les profils d'analyse
 */
async function loadAnalysisProfiles() {
    try {
        const { fetchAPI } = await import('./api.js');
        const profiles = await fetchAPI(API_ENDPOINTS.analysisProfiles);
        appState.analysisProfiles = profiles || [];
        return profiles;
    } catch (error) {
        console.error('Erreur lors du chargement des profils d\'analyse:', error);
        appState.analysisProfiles = [];
        return [];
    }
}

/**
 * Affiche un message d'erreur
 */
function showError(message) {
    import('./toast.js').then(({ showError }) => {
        showError(message);
    });
}

/**
 * Point d'entrée principal de l'application
 */
async function initializeApplication() {
    if (isInitialized) return;
    
    console.log('🚀 Démarrage de AnalyLit V4.1 Frontend (Version améliorée)...');
    
    try {
        const startTime = performance.now();
        
        // Initialisation de l'état
        initializeState();
        
        // Initialisation des gestionnaires d'événements
        initializeEventHandlers();
        
        // Chargement des données initiales
        await loadInitialData();
        
        // Affichage de la section par défaut
        await showSection('projects');
        
        const endTime = performance.now();
        console.log(`✅ Application initialisée en ${(endTime - startTime).toFixed(2)}ms`);
        
        isInitialized = true;
        
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation:', error);
        showError('Erreur lors de l\'initialisation de l\'application');
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
export { appState, loadInitialData, initializeEventHandlers };
