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

const handlers = {
    'show-section': (el) => showSection(el.dataset.section),
    'create-project': () => handleCreateProject(),
    'select-project': (el) => selectProject(el.closest('[data-project-id]').dataset.projectId),
    'delete-project': (el) => deleteProject(el.closest('[data-project-id]').dataset.projectId)
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
