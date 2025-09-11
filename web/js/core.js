import { appState } from '../app.js';
import {
    toggleArticleSelection,
    selectAllArticles,
    handleDeleteSelectedArticles,
    showBatchProcessModal,
    startBatchProcessing,
    showRunExtractionModal,
    startFullExtraction,
    toggleAbstractRow,
    viewArticleDetails,
} from './articles.js';
import {
    handleRunDiscussionDraft,
    handleRunKnowledgeGraph,
    handleRunPrismaFlow,
    handleRunMetaAnalysis,
    handleRunDescriptiveStats,
    exportAnalyses,
} from './analyses.js';
import { handleRunRobAnalysis } from './rob.js';
import { handleSendChatMessage } from './chat.js';
import {
    handleCreateProject,
    selectProject,
    deleteProject,
    handleUpdateProjectSettings,
    exportProjectData,
} from './projects.js';
import { handleMultiDatabaseSearch } from './search.js';
import {
    handleValidateExtraction,
    handleDeleteGrid,
    handleSaveGrid,
    handleRunGridExtraction,
    handleExportGrid,
} from './validation.js';
import { clearNotifications, showSection, refreshCurrentSection } from './ui.js';

/**
 * Mappe les valeurs de data-action aux fonctions de traitement correspondantes.
 * Chaque fonction reçoit l'élément cible (target) comme argument.
 */
const clickActions = {
    // --- Core UI Actions ---
    'show-section': (target) => showSection(target.dataset.section),
    'refresh-section': () => refreshCurrentSection(),
    'clear-notifications': clearNotifications,

    // --- Project Actions ---
    'create-project': handleCreateProject,
    'select-project': selectProject,
    'delete-project': deleteProject,
    'update-project-settings': handleUpdateProjectSettings,
    'export-project-data': exportProjectData,

    // --- Article/Search Actions ---
    'toggle-article-selection': toggleArticleSelection,
    'select-all-articles': selectAllArticles,
    'delete-selected-articles': handleDeleteSelectedArticles,
    'show-batch-process-modal': showBatchProcessModal,
    'start-batch-processing': startBatchProcessing,
    'show-run-extraction-modal': showRunExtractionModal,
    'start-full-extraction': startFullExtraction,
    'toggle-abstract': toggleAbstractRow,
    'view-article-details': viewArticleDetails,

    // --- Analysis Actions ---
    'run-discussion-draft': handleRunDiscussionDraft,
    'run-knowledge-graph': handleRunKnowledgeGraph,
    'run-prisma-flow': handleRunPrismaFlow,
    'run-meta-analysis': handleRunMetaAnalysis,
    'run-descriptive-stats': handleRunDescriptiveStats,
    'export-analyses': exportAnalyses,

    // --- Risk of Bias (RoB) Actions ---
    'run-rob-analysis': handleRunRobAnalysis,

    // --- Chat Actions ---
    'send-chat-message': handleSendChatMessage,

    // --- New Search Actions ---
    'multi-database-search': handleMultiDatabaseSearch,

    // --- Validation/Grid Actions ---
    'validate-extraction': handleValidateExtraction,
    'delete-grid': handleDeleteGrid,
    'save-grid': handleSaveGrid,
    'run-grid-extraction': handleRunGridExtraction,
    'export-grid': handleExportGrid,
};

/**
 * Met en place un gestionnaire d'événements délégué sur `document.body`
 * pour gérer toutes les actions de clic via l'attribut `data-action`.
 */
export function setupDelegatedEventListeners() {
    document.body.addEventListener('click', (event) => {
        const target = event.target.closest('[data-action]');

        if (target && target.dataset.action) {
            const action = target.dataset.action;
            const handler = clickActions[action];

            if (handler) {
                event.preventDefault(); // Empêche le comportement par défaut (ex: soumission de formulaire)
                handler(target); // Appelle la fonction correspondante avec l'élément cliqué
            } else {
                console.warn(`No click handler found for action: ${action}`);
            }
        }
    });
}