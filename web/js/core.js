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
    renderAnalysesSection,
    handleRunATNAnalysis, // Alias pour éviter conflit
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
    renderProjectDetail,
    handleDuplicateProject
} from './projects.js';
import { handleRunRobAnalysis, fetchAndDisplayRob, loadRobSection, handleSaveRobAssessment } from './rob.js'; 
import { showSearchModal, handleMultiDatabaseSearch, handleExpertSearch, renderSearchSection } from './search.js';
import { handleValidateExtraction, resetValidationStatus, filterValidationList, loadValidationSection, renderValidationSection, calculateKappa } from './validation.js'; // Corrected import
import {
    closeModal, toggleSidebar, showCreateProjectModal, showToast, showLoadingOverlay, showSuccess, showError, openModal } from './ui-improved.js';
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
    handleDownloadSelectedModel,
    showPullModelModal,
    downloadModel,
    handleSaveProfile
} from './settings.js'; // This was already correct
import { fetchAPI } from './api.js';
import AdminDashboard from './admin-dashboard.js';
import { API_ENDPOINTS, MESSAGES, CONFIG } from './constants.js';

export function showSection(sectionId) {
    setCurrentSection(sectionId);
    try {
      const event = new CustomEvent('section-changed', {
        detail: { currentSection: sectionId }
      });
      window.dispatchEvent(event);
    } catch (e) {
      const evt = document.createEvent ? document.createEvent('Event') : null;
      if (evt) {
        evt.initEvent('section-changed', true, true);
        evt.detail = { currentSection: sectionId };
        window.dispatchEvent(evt);
      }
    }
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

const adminDashboard = new AdminDashboard();

/**
 * Mappe les valeurs de data-action aux fonctions de traitement.
 * L'objet est divisé par section pour une meilleure lisibilité.
 */

const clickActions = {
    // UI & Navigation
    'toggle-sidebar': toggleSidebar,
    'close-modal': (target) => closeModal(target.closest('.modal')?.id),
    'clear-notifications': clearNotifications,
    'show-section': (target) => showSection(target.dataset.sectionId),
    'toggle-theme': () => import('./theme-manager.js').then(module => new module.ThemeManager().toggleTheme()),
    'toggle-compact-mode': () => { document.body.classList.toggle('compact'); localStorage.setItem(CONFIG.COMPACT_MODE_STORAGE, document.body.classList.contains('compact')); },

    // Projects
    'create-project-modal': () => openModal('newProjectModal'),
    'select-project': (target) => selectProject(target.dataset.projectId),
    'delete-project': (target) => deleteProject(target.dataset.projectId, target.dataset.projectName),
    'export-project': (target) => handleExportProject(target.dataset.projectId),
    'confirm-delete-project': (target) => confirmDeleteProject(target.dataset.projectId),
    'duplicate-project': (target) => handleDuplicateProject(target.dataset.projectId),

    // Articles
    'view-details': (target) => viewArticleDetails(target.dataset.articleId),
    'toggle-article-selection': (target) => toggleArticleSelection(target.dataset.articleId),
    'select-all-articles': (target) => selectAllArticles(target),
    'delete-selected-articles': () => handleDeleteSelectedArticles(),
    'paginate-results': (target) => loadSearchResults(parseInt(target.dataset.page, 10)),
    'batch-process-modal': showBatchProcessModal,
    'start-batch-process': startBatchProcessing,

    // Validation
    'validate-extraction': (target) => handleValidateExtraction(target.dataset.id, target.dataset.decision),
    'reset-validation': (target) => resetValidationStatus(target.dataset.id),
    'filter-validations': (target) => filterValidationList(target.dataset.status, target),
    'calculate-kappa': calculateKappa,
    'run-extraction-modal': showRunExtractionModal,
    'start-full-extraction': startFullExtraction,

    // Analyses
    'run-analysis': (target) => runProjectAnalysis(target.dataset.analysisType),
    'atn-analysis': () => showSection('atn-analysis'),
    'run-atn-analysis': handleRunATNAnalysis,
    'show-prisma-modal': () => showPRISMAModal(),
    'save-prisma-progress': savePRISMAProgress,
    'export-prisma-report': exportPRISMAReport,
    'export-analyses': exportAnalyses,
    'show-advanced-analysis-modal': () => openModal('advancedAnalysisModal'),
    'delete-analysis': (target) => handleDeleteAnalysis(target.dataset.analysisType),
    'run-advanced-analysis': (target) => runProjectAnalysis(target.dataset.analysisType),
    'view-analysis-results': (target) => {
        const targetId = target.dataset.targetId;
        if (!targetId) return;
        const resultElement = document.getElementById(targetId);
        if (resultElement) resultElement.style.display = 'block';
    },

    // Risk of Bias (RoB)
    'run-rob-analysis': handleRunRobAnalysis,
    'edit-rob': (target) => fetchAndDisplayRob(target.dataset.articleId, true),
    'cancel-edit-rob': (target) => fetchAndDisplayRob(target.dataset.articleId, false),

    // Grids
    'create-grid-modal': () => showGridFormModal(),
    'edit-grid': (target) => showGridFormModal(target.dataset.gridId),
    'delete-grid': (target) => handleDeleteGrid(target.dataset.gridId),
    'add-grid-field': addGridFieldInput,
    'triggerGridImport': triggerGridImport,
    'remove-grid-field': removeGridField,

    // Search
    'show-search-modal': showSearchModal,

    // Chat
    'send-chat-message': sendChatMessage,
    'submit-chat-on-enter': (target, event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendChatMessage();
        }
    },

    // Import/Export
    'trigger-zotero-import': () => document.getElementById('zoteroFileInput').click(),
    'show-pmid-import-modal': showPmidImportModal,
    'trigger-upload-pdfs': () => document.getElementById('bulkPDFInput').click(),
    'index-pdfs': handleIndexPdfs,
    'zotero-sync': handleZoteroSync,
    'export-for-thesis': exportForThesis,

    // Stakeholders
    'manage-stakeholders': showStakeholderManagementModal,
    'add-stakeholder-group': addStakeholderGroup,
    'run-stakeholder-analysis': runStakeholderAnalysis,
    'delete-stakeholder-group': (target) => deleteStakeholderGroup(target.dataset.groupId),

    // Reporting
    'generate-bibliography': generateBibliography,
    'generate-summary-table': generateSummaryTable,
    'export-summary-excel': exportSummaryTableExcel,
    'save-prisma-checklist': savePrismaChecklist,

    // Settings
    'edit-prompt': (target) => showEditPromptModal(target.dataset.promptId),
    'create-prompt-modal': () => showEditPromptModal(null),
    'edit-profile': (target) => showEditProfileModal(target.dataset.id),
    'download-selected-model': handleDownloadSelectedModel,
    'delete-profile': (target) => deleteProfile(target.dataset.profileId),
    'create-profile-modal': () => showEditProfileModal(null),
    'pull-model-modal': showPullModelModal,

    // Tasks
    'retry-task': handleRetryTask,
    'cancel-task': handleCancelTask,
    'set-active-evaluator': (target) => setActiveEvaluator(target.value)
    ,
    // Admin Dashboard
    'admin-refresh-data': () => adminDashboard.refreshData(),
    'admin-clear-failed-tasks': () => adminDashboard.clearFailedTasks(),
    'admin-cancel-task': (target) => adminDashboard.cancelTask(target.dataset.taskId)
};

export function setupDelegatedEventListeners() {
    document.body.addEventListener('click', (event) => {
        const target = event.target.closest('[data-action]');
        if (!target) return;

        const actionName = target.dataset.action;
        const action = clickActions[actionName];

        if (action) {
            // event.preventDefault(); // Peut causer des problèmes, laissons le comportement par défaut
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
            'save-zotero-settings': (event) => import('./settings.js').then(settings => settings.handleSaveZoteroSettings(event)),
            'run-multi-search': (event) => handleMultiDatabaseSearch(event),
            'run-expert-search': (event) => handleExpertSearch(event)
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

/**
 * Met à jour l'indicateur de connexion WebSocket dans l'en-tête.
 * @param {string} status - 'connected', 'connecting', ou 'disconnected'.
 */
function updateConnectionIndicatorUI(status) {
    const container = elements.connectionStatus();
    if (!container) return;

    const dot = container.querySelector('.status-dot');
    const text = container.querySelector('.status-text');

    if (!dot || !text) return;

    // Retirer les anciennes classes de statut
    dot.classList.remove('connected', 'connecting', 'disconnected');

    switch (status) {
        case 'connected':
            dot.classList.add('connected');
            text.textContent = 'Connecté';
            break;
        case 'disconnected':
            dot.classList.add('disconnected');
            text.textContent = 'Déconnecté';
            break;
        default: // 'connecting' ou autre
            dot.classList.add('connecting');
            text.textContent = 'Connexion...';
            break;
    }
}

export async function initializeWebSocket() {
    try {
        if (typeof io !== 'function') {
            console.warn(MESSAGES.socketUnavailable);
            if (elements.connectionStatus) elements.connectionStatus.textContent = '❌';
            return;
        }

        // ✅ CORRECTION: Forcer la connexion WebSocket vers le backend sur le port 5001,
        // en contournant le serveur de développement (8888).
        const { CONFIG } = await import('./constants.js');
        appState.socket = io(CONFIG.WEBSOCKET_URL, { path: '/socket.io/', transports: ['websocket', 'polling'] });

        appState.socket.on('connect', () => {
            console.log(MESSAGES.websocketConnected);
            setConnectionStatus('connected');
            updateConnectionIndicatorUI('connected');
            if (appState.currentProject?.id) { // Check if currentProject and its ID exist
                appState.socket.emit('join_room', { room: appState.currentProject.id });
            }
        });
        
        appState.socket.on('disconnect', () => {
            console.warn(MESSAGES.websocketDisconnected);
            setConnectionStatus('disconnected');
            updateConnectionIndicatorUI('disconnected');
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
            showToast(MESSAGES.analysisComplete(data.analysis_type), 'success');
            if (appState.currentSection === 'analyses') {
                console.log(MESSAGES.refreshingAnalyses);
                loadProjectAnalyses();
            }
        });

        appState.socket.on('search_completed', (data) => {
            showToast(MESSAGES.searchComplete(data.total_results || 0), 'success');
            // Rediriger automatiquement vers la section des résultats
            showSection('results');
        });

    } catch (e) {
        console.error(MESSAGES.websocketError, e);
        updateConnectionIndicatorUI('disconnected');
    }
}

const sectionRefreshActions = {
    'projects': () => {
        loadProjects();
        if (appState.currentProject) {
            renderProjectDetail(appState.currentProject);
        }
    },
    'results': loadSearchResults,
    'validation': loadValidationSection,
    'grids': () => {
        if (appState.currentProject) {
            loadProjectGrids(appState.currentProject.id);
            renderGridsSection(appState.currentProject, elements);
        }
    },
    'rob': loadRobSection,
    'analyses': () => {
        if (appState.currentProject) {
            loadProjectAnalyses();
        }
    },
    'import': () => renderImportSection(appState.currentProject),
    'search': () => renderSearchSection(appState.currentProject),
    'settings': renderSettings,
    'tasks': fetchTasks,
    'chat': loadChatMessages,
    'stakeholders': () => renderStakeholdersSection(appState.currentProject),
};

export async function refreshCurrentSection() {
    const action = sectionRefreshActions[appState.currentSection];
    if (action) {
        action();
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
    const { currentSection } = event.detail; // Correction: Assurer que la variable est déclarée
    const sections = document.querySelectorAll('.app-section'); 
    const navButtons = document.querySelectorAll('.app-nav__button');

    sections.forEach(section => {
        // Utiliser la classe 'active' comme défini dans frontend-fix.css
        section.classList.toggle('active', section.id === currentSection); 
    });

    navButtons.forEach(btn => {
        // Utiliser la bonne classe et le bon dataset
        btn.classList.toggle('app-nav__button--active', btn.dataset.sectionId === currentSection); 
    });
    
    refreshCurrentSection();
}

window.addEventListener('section-changed', handleSectionChange);
