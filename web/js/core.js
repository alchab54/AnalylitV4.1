// web/js/core.js
import { appState, elements } from '../app.js';
import { loadInitialData, initializeWebSocket, showSection } from '../app.js';
import { selectProject, deleteProject } from './projects.js';
import { viewArticleDetails, toggleArticleSelection, sortResults, selectAllArticles, showBatchProcessModal, handleDeleteSelectedArticles, showRunExtractionModal } from './articles.js';
import { handleRunIndexing, handleFetchOnlinePdfs, showAddManualArticlesModal, handleImportZoteroPdfs, handleZoteroFileUpload, handleBulkPDFUpload } from './import.js';
import { editProfile, deleteProfile, showCreateProfileModal, editPrompt, showPullModelModal, handleSaveZoteroSettings, loadAnalysisProfiles, loadPrompts, loadOllamaModels, renderSettings, fetchAndDisplayRob } from './settings.js';
import { runProjectAnalysis, exportAnalyses } from './analyses.js';


export function getStatusClass(status) {
    const s = (status || 'pending').toLowerCase();
    if (s.includes('completed') || s.includes('finished')) return 'status--success';
    if (s.includes('error') || s.includes('failed')) return 'status--error';
    if (s.includes('processing') || s.includes('running') || s.includes('searching')) return 'status--warning';
    if (s.includes('pending')) return 'status--info';
    return 'status--secondary';
}

const clickActions = {
    // Projects
    'select-project': (target) => selectProject(target.dataset.projectId),
    'delete-project': (target, event) => {
        event.stopPropagation();
        deleteProject(target.dataset.projectId);
    },
    'create-project-modal': () => showModal('newProjectModal'),

    // Articles / Results
    'view-details': (target) => viewArticleDetails(target.dataset.articleId),
    'sort-results': (target) => sortResults(target.dataset.sortKey),
    'select-all-articles': () => selectAllArticles(),
    'batch-process-modal': () => showBatchProcessModal(),
    'delete-selected-articles': () => handleDeleteSelectedArticles(),
    'run-extraction-modal': () => showRunExtractionModal(),

    // Import
    'trigger-zotero-upload': () => document.getElementById('zoteroFileInput')?.click(),
    'trigger-pdf-upload': () => document.getElementById('bulkPDFInput')?.click(),
    'run-indexing': () => handleRunIndexing(),
    'fetch-online-pdfs': () => handleFetchOnlinePdfs(),
    'show-manual-add': () => showAddManualArticlesModal(),
    'import-zotero-pdfs': () => handleImportZoteroPdfs(),

    // Settings
    'edit-profile': (target) => editProfile(target.dataset.id),
    'delete-profile': (target) => deleteProfile(target.dataset.id),
    'create-profile-modal': () => showCreateProfileModal(),
    'edit-prompt': (target) => editPrompt(target.dataset.id),
    'pull-model-modal': () => showPullModelModal(),

    // Analyses (from modal)
    'run-analysis': (target) => runProjectAnalysis(target.dataset.analysisType),

    // Navigation
    'show-section': (target) => showSection(target.dataset.section),
    
    // Other static buttons from index.html
    'show-search-modal': () => window.showSearchModal(), // Assumes showSearchModal is on window
    'show-run-analysis-modal': () => window.showRunAnalysisModal(), // Assumes showRunAnalysisModal is on window
    'show-rob-details': (target) => {
        const articleId = target.dataset.articleId;
        if (articleId) {
            fetchAndDisplayRob(articleId);
        }
    },
};

function setupDelegatedEventListeners() {
    document.body.addEventListener('click', (event) => {
        const target = event.target.closest('[data-action]');
        if (target && target.dataset.action) {
            const action = target.dataset.action;
            if (clickActions[action]) {
                event.preventDefault();
                clickActions[action](target, event);
            }
        }
    });
}

function setupDirectEventListeners() {
    // Listeners for forms or specific inputs
    document.getElementById('newProjectForm')?.addEventListener('submit', handleCreateProject);
    document.getElementById('manualArticleForm')?.addEventListener('submit', handleAddManualArticles);
    document.getElementById('multiSearchForm')?.addEventListener('submit', handleMultiSearch);
    document.getElementById('zoteroFileInput')?.addEventListener('change', handleZoteroFileUpload);
    document.getElementById('bulkPDFInput')?.addEventListener('change', handleBulkPDFUpload);

    // Specific listener for article selection checkboxes
    elements.resultsContainer?.addEventListener('change', (event) => {
        const checkbox = event.target.closest('.article-checkbox');
        if (checkbox) {
            toggleArticleSelection(checkbox.dataset.articleId, checkbox.checked);
        }
    });

    // Navigation buttons (could be delegated, but this is also fine)
    elements.navButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            showSection(e.target.dataset.section);
        });
    });
}

export async function initializeApplication() {
    showLoadingOverlay(true, 'Chargement initial des données...');
    try {
        await loadInitialData();
        await loadProjects();
        renderProjectList();
        initializeWebSocket();
        setupDirectEventListeners();
        setupDelegatedEventListeners();
    } catch (e) {
        console.error('Erreur lors de l'initialisation de l'application:', e);
        showToast(`Erreur critique: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

export async function loadSettingsData() {
    showLoadingOverlay(true, 'Chargement des paramètres...');
    try {
        await Promise.all([
            loadAnalysisProfiles(),
            loadPrompts(),
            loadOllamaModels()
        ]);
    } catch (e) {
        showToast("Erreur lors du chargement des données de paramètres.", "error");
        console.error("Erreur loadSettingsData:", e);
    } finally {
        showLoadingOverlay(false);
    }
}
