// web/js/core.js

import { appState, elements } from './app-improved.js';
import { setProjects, setCurrentProject } from './state.js';
import {
    handleDeleteSelectedArticles,
    showBatchProcessModal,
    startBatchProcessing,
    showRunExtractionModal,
    startFullExtraction,
    toggleArticleSelection,
    viewArticleDetails,
    selectAllArticles, 
    loadSearchResults // --- LA FONCTION EST IMPORTÉE DEPUIS articles.js
} from './articles.js';
import {
    handleRunDiscussionDraft,
    handleRunKnowledgeGraph,
    handleRunMetaAnalysis,
    exportAnalyses,
    handleRunATNAnalysis,
    showRunAnalysisModal,
    runProjectAnalysis,
    showPRISMAModal,
    savePRISMAProgress,
    loadProjectAnalyses,
    exportPRISMAReport
} from './analyses.js';
import { sendChatMessage, loadChatMessages, renderChatInterface } from './chat.js';
import {
    handleCreateProject,
    deleteProject,
    selectProject,
    confirmDeleteProject,
    handleExportProject,
    loadProjects,
    renderProjectDetail
} from './projects.js';
import { handleRunRobAnalysis, fetchAndDisplayRob, loadRobSection, handleSaveRobAssessment } from './rob.js';
import { showSearchModal, handleMultiDatabaseSearch, renderSearchSection } from './search.js';
import { handleValidateExtraction, resetValidationStatus, filterValidationList, loadValidationSection } from './validation.js';
import {
    closeModal, toggleSidebar, showCreateProjectModal, showToast, showLoadingOverlay } from './ui-improved.js';
import { clearNotifications } from './notifications.js'; // Already correct
import { handleDeleteGrid, loadProjectGrids, renderGridsSection, showGridFormModal, addGridFieldInput, removeGridField, handleSaveGrid, triggerGridImport, handleGridImportUpload } from './grids.js';
import { renderReportingSection, generateBibliography, generateSummaryTable, exportSummaryTableExcel, savePrismaChecklist } from './reporting.js';
// CORRIGÉ: Ajout des imports pour les fonctions d'import et la gestion des modales
import {
    renderImportSection
} from './import.js';
import { showStakeholderManagementModal, addStakeholderGroup, deleteStakeholderGroup, runStakeholderAnalysis } from './stakeholders.js';
import { loadTasksSection } from './tasks.js';
import {
    renderSettings,
    showEditPromptModal,
    showEditProfileModal,
    deleteProfile,
    showPullModelModal,
    handleSaveProfile
} from './settings.js';
import { fetchAPI } from './api.js';

async function handleCancelTask(target) {
    const taskId = target.dataset.taskId;
    if (!taskId) return;
    try {
        await fetchAPI(`/tasks/${taskId}/cancel`, { method: 'POST' });
        showToast('Demande d\'annulation de la tâche envoyée.', 'info');
        showLoadingOverlay(false); // Masquer l'overlay immédiatement
    } catch (error) {
        showToast(`Erreur lors de l'annulation : ${error.message}`, 'error');
    }
}

async function handleRetryTask(target) {
    const taskId = target.dataset.taskId;
    if (!taskId) return;
    try {
        target.disabled = true;
        await fetchAPI(`/tasks/${taskId}/retry`, { method: 'POST' });
        showToast(`Tâche ${taskId} relancée.`, 'success');
    } catch (error) {
        showToast(`Erreur lors de la relance : ${error.message}`, 'error');
        target.disabled = false;
    }
}

function handleViewAnalysisResults(target) {
    const targetId = target.dataset.targetId;
    if (!targetId) return;
    const resultElement = document.getElementById(targetId);
    if (resultElement) {
        resultElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

/**
 * Mappe les valeurs de data-action aux fonctions de traitement.
 * L'objet est divisé par section pour une meilleure lisibilité.
 */

const uiActions = {
    'toggle-sidebar': toggleSidebar, // This is a click action, not a submit action
    'close-modal': (target) => closeModal(target.closest('.modal')?.id),
    'clear-notifications': () => clearNotifications(),
    'create-project-modal': showCreateProjectModal, // CORRIGÉ: La fonction est bien showCreateProjectModal
    'retry-task': handleRetryTask,
    'cancel-task': handleCancelTask,
    'show-section': (target) => showSection(target.dataset.sectionId),
    'view-analysis-results': handleViewAnalysisResults,
};

const projectActions = {
    'select-project': (target) => selectProject(target.dataset.projectId),
    'delete-project': (target) => deleteProject(target.dataset.projectId, target.dataset.projectName),
    'export-project': (target) => handleExportProject(target.dataset.projectId),
    'confirm-delete-project': (target) => confirmDeleteProject(target.dataset.projectId), // Nouvelle action
};

const articleActions = {
    'view-details': (target) => viewArticleDetails(target.dataset.articleId),
    'toggle-article-selection': (target) => toggleArticleSelection(target.dataset.articleId),
    'select-all-articles': (target) => selectAllArticles(target),
    'delete-selected-articles': () => handleDeleteSelectedArticles(),
    'paginate-results': (target) => loadSearchResults(parseInt(target.dataset.page, 10)),
    'batch-process-modal': showBatchProcessModal,
    'start-batch-process': startBatchProcessing,
};

const validationActions = {
    'validate-extraction': (target) => handleValidateExtraction(target.dataset.id, target.dataset.decision),
    'reset-validation': (target) => resetValidationStatus(target.dataset.id),
    'filter-validations': (target) => filterValidationList(target.dataset.status, target),
    'run-extraction-modal': showRunExtractionModal,
    'start-full-extraction': startFullExtraction,
};

const analysisActions = {
    'show-run-analysis-modal': showRunAnalysisModal,
    'run-analysis': (target) => runProjectAnalysis(target.dataset.analysisType),
    'run-atn-analysis': (target, event) => handleRunATNAnalysis(event),
    'run-discussion-draft': handleRunDiscussionDraft,
    'run-knowledge-graph': handleRunKnowledgeGraph,
    'show-prisma-modal': () => showPRISMAModal(),
    'save-prisma-progress': savePRISMAProgress,
    'export-prisma-report': exportPRISMAReport,
    'export-analyses': exportAnalyses,
};

const robActions = {
    'run-rob-analysis': handleRunRobAnalysis,
    'edit-rob': (target) => fetchAndDisplayRob(target.dataset.articleId, true),
    'cancel-edit-rob': (target) => fetchAndDisplayRob(target.dataset.articleId, false)
};

const gridActions = {
    'create-grid-modal': () => showGridFormModal(),
    'edit-grid': (target) => showGridFormModal(target.dataset.gridId),
    'delete-grid': (target) => handleDeleteGrid(target.dataset.gridId),
    'add-grid-field': addGridFieldInput,
    'triggerGridImport': triggerGridImport,
    'remove-grid-field': removeGridField,
};

const searchActions = {
    'show-search-modal': showSearchModal
};

const chatActions = {
    'send-chat-message': sendChatMessage,
    'submit-chat-on-enter': (target, event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendChatMessage();
        }
    },
};

const importExportActions = {
    'trigger-zotero-import': (target) => document.getElementById('zoteroFileInput').click(),
    'show-pmid-import-modal': showPmidImportModal,
    'trigger-upload-pdfs': (target) => document.getElementById('bulkPDFInput').click(),
    'index-pdfs': handleIndexPdfs,
    'zotero-sync': handleZoteroSync,
    'export-for-thesis': exportForThesis,
};

const stakeholderActions = {
    'manage-stakeholders': showStakeholderManagementModal,
    'add-stakeholder-group': addStakeholderGroup,
    'delete-stakeholder-group': (target) => deleteStakeholderGroup(target.dataset.groupId),
};

const reportingActions = {
    'generate-bibliography': generateBibliography,
    'generate-summary-table': generateSummaryTable,
    'export-summary-excel': exportSummaryTableExcel,
    'save-prisma-checklist': savePrismaChecklist,
};

const settingsActions = {
    'edit-prompt': (target) => showEditPromptModal(target.dataset.promptId),
    'create-prompt-modal': () => showEditPromptModal(null),
    'edit-profile': (target) => showEditProfileModal(target.dataset.id),
    'delete-profile': (target) => deleteProfile(target.dataset.profileId),
    'create-profile-modal': () => showEditProfileModal(null),
    'pull-model-modal': showPullModelModal
};

const clickActions = {
    ...uiActions,
    ...projectActions,
    ...articleActions,
    ...validationActions,
    ...analysisActions,
    ...robActions,
    ...gridActions,
    ...searchActions,
    ...chatActions,
    ...importExportActions,
    ...stakeholderActions,
    ...reportingActions,
    ...settingsActions
};

export function setupDelegatedEventListeners() {
    document.body.addEventListener('click', (event) => {
        const target = event.target.closest('[data-action]');
        if (!target) return;

        const actionName = target.dataset.action;
        const action = clickActions[actionName];

        if (action) {
            event.preventDefault();
            action(target, event);
        }
    });

    document.body.addEventListener('submit', (submitEvent) => {
        const target = submitEvent.target.closest('form[data-action]');
        if (!target) return;

        const actionName = target.dataset.action;
        // Actions spécifiques au submit
        const submitActions = { // This map handles form submissions
            'create-project': handleCreateProject,
            'submit-pmid-import': (event) => processPmidImport(event),
            'save-grid': handleSaveGrid,
            'save-rob-assessment': (event) => handleSaveRobAssessment(event),
            'save-profile-form': handleSaveProfile, // Assurez-vous que votre formulaire a data-action="save-profile-form"
            'save-zotero-settings': (event) => import('./settings.js').then(settings => settings.handleSaveZoteroSettings(event)), // This dynamic import is fine
            'run-multi-search': (event) => handleMultiDatabaseSearch(event)
        };
        const action = submitActions[actionName]; // Correction: action est la fonction handler
        if (action) {
            submitEvent.preventDefault();
            action(submitEvent);
        }
    });

    // CORRECTION : Ajout des listeners pour les inputs file
    document.body.addEventListener('change', (event) => {
        if (event.target.id === 'zoteroFileInput') {
            handleZoteroImport(event.target);
        } else if (event.target.id === 'bulkPDFInput') {
            handleUploadPdfs(event.target);
        } else if (event.target.id === 'grid-import-input') {
            handleGridImportUpload(event);
        }
    });

    // Listener pour la touche Entrée dans le chat
    document.body.addEventListener('keydown', (event) => {
        const target = event.target.closest('[data-action="submit-chat-on-enter"]');
        if (!target) return;
        const action = clickActions['submit-chat-on-enter'];
        if (action) action(target, event);
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
            showToast(data.message, data.type || 'info');
            
            // Logique de rafraîchissement basée sur le type de notification
            if (data.type === 'task_progress') {
                updateLoadingProgress(data.current, data.total, data.message, data.task_id);
            } else {
                handleTaskNotification(data);
            }
        });

        appState.socket.on('ANALYSIS_COMPLETED', (data) => {
            showToast(`Analyse "${data.analysis_type}" terminée.`, 'success');
            if (appState.currentSection === 'analyses') {
                console.log('Rafraîchissement de la section analyses...');
                loadProjectAnalyses();
            }
        });

        appState.socket.on('search_completed', (data) => {
            showToast(`Recherche terminée: ${data.total_results} articles trouvés.`, 'success');
            if (appState.currentSection === 'results') {
                console.log('Rafraîchissement de la section résultats...');
                loadSearchResults();
            }
        });

    } catch (e) {
        console.error('Erreur WebSocket:', e);
        if (elements.connectionStatus) elements.connectionStatus.textContent = '❌';
    }
}

function showSection(sectionId) {
    if (!sectionId) return;
    appState.currentSection = sectionId;

    // Sauvegarder la section active dans le localStorage
    localStorage.setItem('analylit_last_section', sectionId);

    if (elements.sections) {
        elements.sections.forEach(section => {
            section.classList.toggle('section--active', section.dataset.section === sectionId);
        });
    }
    if (elements.navButtons) {
        elements.navButtons.forEach(btn => {
            btn.classList.toggle('app-nav__button--active', btn.dataset.sectionId === sectionId);
        });
    }
    
    // Optimisation : Ne re-rendre la section que si elle n'a pas encore été rendue.
    if (!appState.renderedSections.has(sectionId)) {
        console.log(`First render for section: ${sectionId}`);
        // La logique de chargement des données est maintenant dans refreshCurrentSection
        refreshCurrentSection();
        appState.renderedSections.add(sectionId);
    }
}

export function refreshCurrentSection() {
    switch (appState.currentSection) {
        case 'projects':
            loadProjects(); // Toujours rafraîchir la liste des projets
            if (appState.currentProject) renderProjectDetail(appState.currentProject);
            break;
        case 'results':
            loadSearchResults();
            break;
        case 'validation':
            loadValidationSection();
            break;
        case 'grids':
            if (appState.currentProject) {
                loadProjectGrids(appState.currentProject.id);
                renderGridsSection(appState.currentProject, elements);
            }
            break;
        case 'rob':
            loadRobSection();
            break;
        case 'analyses':
            loadProjectAnalyses();
            break;
        case 'import':
            renderImportSection(appState.currentProject); // This is correct for 'import'
            break;
        case 'search':
            renderSearchSection(appState.currentProject);
            break;
        case 'settings':
            renderSettings();
            break;
        case 'tasks':
            loadTasksSection();
            break;
        case 'reporting':
            renderReportingSection(elements);
            break;
        case 'chat':
            loadChatMessages();
            renderChatInterface();
            break;
        default:
            break;
    }
}

export { showSection };

export function getStatusClass(status) {
    switch (status) {
        case 'completed':
        case 'search_completed':
            return 'status--success';
        case 'in_progress':
            return 'status--warning';
        case 'pending':
            return 'status--info';
        case 'error':
            return 'status--error';
        default:
            return 'status--secondary';
    }
}
