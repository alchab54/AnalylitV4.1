import { appState } from '../app.js';
import {
    handleDeleteSelectedArticles,
    showBatchProcessModal,
    startBatchProcessing,
    showRunExtractionModal,
    startFullExtraction,
    toggleArticleSelection,
    viewArticleDetails,
    selectAllArticles
} from './articles.js';
import {
    handleRunDiscussionDraft,
    handleRunKnowledgeGraph,
    handleRunMetaAnalysis,
    handleRunPrismaFlow,
    handleRunDescriptiveStats,
    exportAnalyses,
    handleRunATNAnalysis
} from './analyses.js';
import { sendChatMessage } from './chat.js';
import {
    handleCreateProject,
    handleDeleteProject,
    selectProject,
    handleExportProject
} from './projects.js';
import { handleRunRobAnalysis } from './rob.js';
import { showSearchModal, handleMultiDatabaseSearch } from './search.js';
import { handleValidateExtraction, resetValidationStatus, filterValidationList } from './validation.js';
import {
    closeModal,
    toggleSidebar,
    showCreateProjectModal
} from './ui.js';
import { clearNotifications, updateNotificationIndicator } from './notifications.js';
import { handleDeleteGrid } from './grids.js';

/**
 * Mappe les valeurs de data-action aux fonctions de traitement correspondantes.
 * C'est le cœur du système de délégation d'événements.
 */
const clickActions = {
    // Core & UI
    'toggle-sidebar': toggleSidebar,
    'close-modal': (target) => closeModal(target.dataset.modalId),
    'clear-notifications': clearNotifications,
    'toggle-notifications': updateNotificationIndicator,
    'create-project-modal': showCreateProjectModal,

    // Projects
    'create-project': handleCreateProject,
    'select-project': (target) => selectProject(target.dataset.projectId),
    'delete-project': (target) => deleteProject(target.dataset.projectId),
    'export-project': (target) => handleExportProject(target.dataset.projectId),

    // Articles
    'view-details': (target) => viewArticleDetails(target.dataset.articleId),
    'toggle-article-selection': (target) => toggleArticleSelection(target.dataset.articleId, target.checked),
    'select-all-articles': selectAllArticles,
    'delete-selected-articles': handleDeleteSelectedArticles,
    'batch-process-modal': showBatchProcessModal,
    'start-batch-process': startBatchProcessing,
    'run-extraction-modal': showRunExtractionModal,
    'start-full-extraction': startFullExtraction,

    // Analyses
    'run-atn-analysis': handleRunATNAnalysis,
    'run-discussion-draft': handleRunDiscussionDraft,
    'run-knowledge-graph': handleRunKnowledgeGraph,
    'run-prisma-flow': handleRunPrismaFlow,
    'run-meta-analysis': handleRunMetaAnalysis,
    'run-descriptive-stats': handleRunDescriptiveStats,
    'export-analyses': exportAnalyses,

    // Risk of Bias (RoB)
    'run-rob-analysis': handleRunRobAnalysis,
    'show-rob-details': (target) => fetchAndDisplayRob(target.dataset.articleId),

    // Validation
    'validate-extraction': (target) => handleValidateExtraction(target.dataset.id, target.dataset.decision),
    'reset-validation': (target) => resetValidationStatus(target.dataset.id),
    'filter-validations': (target) => filterValidationList(target.dataset.status),
    'delete-grid': handleDeleteGrid,

    // Search
    'show-search-modal': showSearchModal,
    'run-multi-search': handleMultiDatabaseSearch,

    // Chat
    'send-chat-message': sendChatMessage,
};

/**
 * Configure un écouteur d'événements global sur document.body pour gérer tous les clics
 * sur les éléments ayant un attribut `data-action`.
 */
export function setupDelegatedEventListeners() {
    document.body.addEventListener('click', (event) => {
        const target = event.target.closest('[data-action]');
        if (!target) return;

        const actionName = target.dataset.action;
        const action = clickActions[actionName];

        if (action) {
            event.preventDefault(); // Empêche le comportement par défaut (ex: soumission de formulaire, navigation)
            action(target, event); // Appelle la fonction de traitement avec la cible et l'événement original
        }
    });
}

export function initializeWebSocket() {
    try {
        if (typeof io !== 'function') {
            console.warn('Client Socket.IO indisponible.');
            if (elements.connectionStatus) elements.connectionStatus.textContent = '❌';
            return;
        }
        
        appState.socket = io({ path: '/socket.io/' });
        
        appState.socket.on('connect', () => {
            console.log('✅ WebSocket connecté');
            appState.socketConnected = true;
            if (elements.connectionStatus) elements.connectionStatus.textContent = '✅';
            if (appState.currentProject) {
                appState.socket.emit('join_room', { room: appState.currentProject.id });
            }
        });
        
        appState.socket.on('disconnect', () => {
            console.warn('🔌 WebSocket déconnecté.');
            appState.socketConnected = false;
            if (elements.connectionStatus) elements.connectionStatus.textContent = '⏳';
        });
        
        appState.socket.on('notification', (data) => {
            console.log('🔔 Notification reçue:', data);
            // handleWebSocketNotification(data); // Cette fonction devra être importée ou déplacée ici
        });
    } catch (e) {
        console.error('Erreur WebSocket:', e);
        if (elements.connectionStatus) elements.connectionStatus.textContent = '❌';
    }
}

export function showSection(sectionId) {
    appState.currentSection = sectionId;

    elements.sections.forEach(section => {
        section.classList.toggle('section--active', section.dataset.section === sectionId);
    });

    elements.navButtons.forEach(btn => {
        btn.classList.toggle('app-nav__button--active', btn.dataset.section === sectionId);
    });

    // Charger les données spécifiques à la section si nécessaire
    refreshCurrentSection();
}

export function refreshCurrentSection() {
    switch (appState.currentSection) {
        case 'projects':
            if (appState.currentProject) {
                renderProjectDetail(appState.currentProject);
            }
            break;
        case 'results':
            loadSearchResults();
            break;
        case 'validation':
            loadValidationSection();
            break;
        // ... ajouter les autres cas ici
        default:
            break;
    }
}

/**
 * Retourne une classe CSS en fonction du statut du projet.
 * @param {string} status - Le statut du projet.
 * @returns {string} La classe CSS correspondante.
 */
export function getStatusClass(status) {
    switch (status) {
        case 'completed': return 'status--success';
        case 'in_progress': return 'status--warning';
        case 'pending': return 'status--info';
        default: return 'status--secondary';
    }
}