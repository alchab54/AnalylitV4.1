import { appState } from '../app.js';
import {
    handleDeleteSelectedArticles,
    showBatchProcessModal,
    handleSelectAll,
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
import { handleSendChatMessage } from './chat.js';
import {
    handleCreateProject,
    handleDeleteProject,
    selectProject,
    handleExportProject
} from './projects.js';
import { handleRunRobAnalysis } from './rob.js';
import { showSearchModal, handleMultiDatabaseSearch } from './search.js';
import {
    handleDeleteGrid,
    handleValidateExtraction,
    resetValidationStatus,
    filterValidationList
} from './validation.js';
import {
    closeModal,
    toggleSidebar,
    showCreateProjectModal
} from './ui.js';
import { clearNotifications, updateNotificationIndicator } from './notifications.js';

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
    'select-all-articles': handleSelectAll,
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
    'send-chat-message': handleSendChatMessage,
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