// web/js/core.js

import { appState, elements, initializeEventHandlers } from './app-improved.js';
import { setProjects, setCurrentProject, setActiveEvaluator, setCurrentSection, setConnectionStatus } from './state.js';
import {
    handleDeleteSelectedArticles,
    showBatchProcessModal,
    startBatchProcessing,
    showRunExtractionModal,
    startFullExtraction,
    toggleArticleSelection,
    viewArticleDetails,
    selectAllArticles, 
    loadSearchResults 
} from './articles.js';
import { 
    exportAnalyses,
    runProjectAnalysis,
    showPRISMAModal,
    savePRISMAProgress,
    loadProjectAnalyses,
    exportPRISMAReport,
    renderAnalysesSection as renderAnalysesSectionFromAnalyses, // Alias pour éviter conflit
    showRunAnalysisModal,
    handleDeleteAnalysis
} from './analyses.js';
import { sendChatMessage, loadChatMessages, renderChatInterface } from './chat.js';
import {
    handleCreateProject,
    deleteProject, // This was already correct, but I'm confirming it.
    selectProject,
    confirmDeleteProject, // This was already correct
    handleExportProject,
    loadProjects,
    renderProjectDetail
} from './projects.js';
import { handleRunRobAnalysis, fetchAndDisplayRob, loadRobSection, handleSaveRobAssessment } from './rob.js';
import { showSearchModal, handleMultiDatabaseSearch, renderSearchSection } from './search.js';
import { handleValidateExtraction, resetValidationStatus, filterValidationList, loadValidationSection, renderValidationSection, calculateKappa } from './validation.js'; // Corrected import
import {
    closeModal, toggleSidebar, showCreateProjectModal, showToast, showLoadingOverlay, showSuccess, showError } from './ui-improved.js';
import { clearNotifications, updateNotificationIndicator, handleWebSocketNotification } from './notifications.js';
import { handleDeleteGrid, loadProjectGrids, renderGridsSection, showGridFormModal, addGridFieldInput, removeGridField, handleSaveGrid, triggerGridImport, handleGridImportUpload } from './grids.js';
import { renderReportingSection, generateBibliography, generateSummaryTable, exportSummaryTableExcel, savePrismaChecklist } from './reporting.js';
// CORRIGÉ: Ajout des imports pour les fonctions d'import et la gestion des modales
import { 
    showPmidImportModal, // Corrected import
    handleIndexPdfs,
    handleZoteroSync,
    exportForThesis,
    renderImportSection,
    // CORRIGÉ: Ces fonctions étaient manquantes dans les imports de core.js mais nécessaires pour les listeners
    handleZoteroImport,
    handleUploadPdfs,
    processPmidImport
} from './import.js';
import { showStakeholderManagementModal, addStakeholderGroup, deleteStakeholderGroup, runStakeholderAnalysis, renderStakeholdersSection } from './stakeholders.js'; // Corrected import
import { fetchTasks, renderTasks } from './tasks.js';
import {
    renderSettings,
    showEditPromptModal,
    showEditProfileModal,
    deleteProfile,
    showPullModelModal,
    handleSaveProfile
} from './settings.js'; // This was already correct
import { fetchAPI } from './api.js';
import { API_ENDPOINTS, MESSAGES, CONFIG } from './constants.js';

export function showSection(sectionId) {
    setCurrentSection(sectionId);
}

async function handleCancelTask(target) {
    const taskId = target.dataset.taskId;
    if (!taskId) return;
    try {
        await fetchAPI(API_ENDPOINTS.taskCancel(taskId), { method: 'POST' });
        showToast(MESSAGES.taskCancelRequestSent, 'info');
        showLoadingOverlay(false); // Masquer l'overlay immédiatement
    } catch (error) {
        showToast(`${MESSAGES.taskCancelError}: ${error.message}`, 'error');
    }
}

async function handleRetryTask(target) {
    const taskId = target.dataset.taskId;
    if (!taskId) return;
    try {
        target.disabled = true;
        await fetchAPI(API_ENDPOINTS.taskRetry(taskId), { method: 'POST' });
        showToast(MESSAGES.taskRetrySuccess(taskId), 'success');
    } catch (error) {
        showToast(`${MESSAGES.taskRetryError}: ${error.message}`, 'error');
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
    'set-active-evaluator': (target) => setActiveEvaluator(target.value),
    'show-section': (target) => showSection(target.dataset.sectionId),
    'view-analysis-results': handleViewAnalysisResults,
};

const compactModeAction = {
    'toggle-compact-mode': () => { document.body.classList.toggle('compact'); localStorage.setItem(CONFIG.COMPACT_MODE_STORAGE, document.body.classList.contains('compact')); },
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
    'calculate-kappa': calculateKappa,
    'run-extraction-modal': showRunExtractionModal,
    'start-full-extraction': startFullExtraction,
};

const analysisActions = {
    'run-analysis': (target) => runProjectAnalysis(target.dataset.analysisType),
    'show-prisma-modal': () => showPRISMAModal(),
    'save-prisma-progress': savePRISMAProgress,
    'export-prisma-report': exportPRISMAReport,
    'export-analyses': exportAnalyses,
    'show-advanced-analysis-modal': showRunAnalysisModal,
    'delete-analysis': (target) => handleDeleteAnalysis(target.dataset.analysisType),
};

const robActions = { // This was already correct
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
    'trigger-upload-pdfs': (target) => document.getElementById('bulkPDFInput').click(), // Corrected action
    'index-pdfs': handleIndexPdfs,
    'zotero-sync': handleZoteroSync,
    'export-for-thesis': exportForThesis,
};

const stakeholderActions = {
    'manage-stakeholders': showStakeholderManagementModal,
    'add-stakeholder-group': addStakeholderGroup, // This was already correct
    'run-stakeholder-analysis': runStakeholderAnalysis,
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
    ,...compactModeAction
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
const action = submitActions[actionName];
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

    // Gestionnaire d'événements personnalisés pour la sélection de projet
    document.addEventListener('project-select', (event) => {
        const { projectId } = event.detail;
        if (projectId) {
            selectProject(projectId);
        }
    });
}

export function initializeWebSocket() {
    try {
        if (typeof io !== 'function') {
            console.warn(MESSAGES.socketUnavailable);
            if (elements.connectionStatus) elements.connectionStatus.textContent = '❌';
            return;
        }

        appState.socket = io(CONFIG.WEBSOCKET_URL, { path: '/socket.io/', transports: ['websocket', 'polling'] });

        appState.socket.on('connect', () => {
            console.log(MESSAGES.websocketConnected);
            setConnectionStatus('connected');
            if (elements.connectionStatus()) elements.connectionStatus().textContent = '✅';
            if (appState.currentProject?.id) { // Check if currentProject and its ID exist
                appState.socket.emit('join_room', { room: appState.currentProject.id });
            }
        });
        
        appState.socket.on('disconnect', () => {
            console.warn(MESSAGES.websocketDisconnected);
            appState.socketConnected = false;
            if (elements.connectionStatus) elements.connectionStatus.textContent = '⏳';
        });

        appState.socket.on('notification', (data) => {
            console.log(MESSAGES.notificationReceived, data);
            handleWebSocketNotification(data);
            
            // Logique de rafraîchissement basée sur le type de notification
            if (data.type === 'task_progress' && data.task_id) {
                // updateLoadingProgress(data.current, data.total, data.message, data.task_id);
            } else {
                // handleTaskNotification(data);
            }
        });

        appState.socket.on('ANALYSIS_COMPLETED', (data) => {
            showSuccess(MESSAGES.analysisComplete(data.analysis_type));
            if (appState.currentSection === 'analyses') {
                console.log(MESSAGES.refreshingAnalyses);
                loadProjectAnalyses();
            }
        });

        appState.socket.on('search_completed', (data) => {
            showSuccess(MESSAGES.searchComplete(data.total_results));
            if (appState.currentSection === 'results') {
                console.log(MESSAGES.refreshingResults);
                loadSearchResults();
            }
        });

    } catch (e) {
        console.error(MESSAGES.websocketError, e);
        if (elements.connectionStatus()) elements.connectionStatus().textContent = '❌';
    }
}

export function refreshCurrentSection() {
    switch (appState.currentSection) {
        case 'projects':
            loadProjects(); // Toujours rafraîchir la liste des projets
            if (appState.currentProject) {
                renderProjectDetail(appState.currentProject);
            }
            break;
        case 'results':
            loadSearchResults();
            break;
        case 'validation':
            loadValidationSection(); // This will call renderValidationSection internally
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
            // ✅ CORRECTION CRITIQUE: Appeler renderAnalysesSection() 
            console.log('🔧 Refreshing analyses section'); // Debug
            const { renderAnalysesSection } = await import('./analyses.js');
            renderAnalysesSection(); // APPEL MANQUANT !
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
            fetchTasks(); // This will call renderTasks internally
            break;
        case 'reporting':
            renderReportingSection(elements);
            break;
        case 'chat':
            loadChatMessages();
            renderChatInterface();
            break;
        case 'stakeholders':
            renderStakeholdersSection(appState.currentProject); // Use render function
            break;
        default:
            break;
    }
}

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

// ============================
// UI Update from State Events
// ============================

/**
 * Met à jour l'interface utilisateur lorsqu'une section change.
 * @param {CustomEvent} event - L'événement 'section-changed'
 */
function handleSectionChange(event) {
    const { currentSection } = event.detail;
    const sections = document.querySelectorAll('.app-section');
    const navButtons = document.querySelectorAll('.app-nav__button');

    sections.forEach(section => {
        section.style.display = section.id === currentSection ? 'block' : 'none';
        section.classList.toggle('active', section.id === currentSection);
    });

    navButtons.forEach(btn => {
        btn.classList.toggle('app-nav__button--active', btn.dataset.sectionId === currentSection);
    });
    
    refreshCurrentSection();
}

window.addEventListener('section-changed', handleSectionChange);
