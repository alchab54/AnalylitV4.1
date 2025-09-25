// web/js/articles.js
import { fetchAPI } from './api.js';
import { appState, elements } from './app-improved.js';
import { showLoadingOverlay, showModal, closeModal, escapeHtml, showToast } from './ui-improved.js'; // Corrected import
import { loadProjectFilesSet } from './projects.js';
import { showSearchModal } from './search.js'; // Assuming this is correct
import { setSearchResults, clearSelectedArticles, addSelectedArticle, removeSelectedArticle, getSelectedArticles, toggleAllArticles, setCurrentProjectExtractions, setCurrentSection } from './state.js';
import { loadProjectGrids } from './grids.js';
import { API_ENDPOINTS, MESSAGES, SELECTORS } from './constants.js';

export async function loadSearchResults(page = 1) {
    showLoadingOverlay(true, MESSAGES.loadingResults);
    
    if (!appState.currentProject?.id) {
        if (elements.resultsContainer) {
            elements.resultsContainer.innerHTML = `
                <div class="results-empty">
                    <h3>${MESSAGES.noProjectSelected}</h3> 
                    <p>${MESSAGES.selectProjectToViewResults}</p> 
                </div>`;
        }
        showLoadingOverlay(false);
        return;
    }

    try {
        const results = await fetchAPI(API_ENDPOINTS.projectSearchResults(appState.currentProject.id) + `?page=${page}`);
        setSearchResults(results.articles || [], results.meta || {});
        
        const extractions = await fetchAPI(API_ENDPOINTS.projectExtractions(appState.currentProject.id)); // This endpoint needs to be defined in constants.js
        setCurrentProjectExtractions(extractions);
        
        renderSearchResultsTable();
    } catch (error) {
        showToast(`Erreur: ${error.message}`, 'error');
        if (elements.resultsContainer) {
            elements.resultsContainer.innerHTML = `<div class="error-state">Erreur de chargement des résultats.</div>`;
        }
    } finally {
        showLoadingOverlay(false);
    }
}

export function renderSearchResultsTable() {
    const container = document.querySelector(SELECTORS.resultsContainer);
    if (!container) return;
    
    if (!appState.currentProject) {
        elements.resultsContainer.innerHTML = `
            <div class="results-empty">
                <h3>${MESSAGES.noProjectSelected}</h3> 
                <p>${MESSAGES.selectProjectToViewResults}</p> 
            </div>`;
        return;
    }

    if (!appState.searchResults || appState.searchResults.length === 0) {
    if (!container) return;
    elements.resultsContainer.innerHTML = `
        <div class="results-empty">
            <i class="fas fa-search fa-3x text-muted mb-3"></i>
            <h4>Aucun article trouvé</h4>
            <p>Lancez une recherche pour commencer à collecter des articles.</p>
        </div>
    `;
        return;
    }

    const { currentProjectExtractions, currentProjectFiles, searchResults } = appState;

    const tableRows = appState.searchResults.map(article => {
        const isSelected = isArticleSelected(article.article_id);
        const extraction = currentProjectExtractions.find(e => e.pmid === article.article_id);
        
        // Vérifier si le PDF existe
        const pdfExists = currentProjectFiles?.has(article.article_id.replace(/^PMID:/, '').toLowerCase());
        
        return `
            <tr class="result-row ${isSelected ? 'result-row--selected' : ''}" data-article-id="${article.article_id}">
                <td>
                    <input type="checkbox" 
                           data-action="toggle-article-selection" 
                           data-article-id="${article.article_id}"
                           ${isSelected ? 'checked' : ''}>
                </td>
                <td>
                    <div class="article-title">
                        <strong>${escapeHtml(article.title)}</strong>
                        ${pdfExists ? '<span class="pdf-badge">📄 PDF</span>' : ''}
                    </div>
                    <div class="article-meta">
                        <span>${escapeHtml(article.authors)}</span> • 
                        <em>${escapeHtml(article.journal)}</em> • 
                        <span>${escapeHtml(article.publication_date)}</span>
                    </div>
                </td>
                <td class="score-column">
                    ${extraction ? 
                        `<span class="relevance-score">${extraction.relevance_score || 'N/A'}</span>` : 
                        '<span class="no-analysis">-</span>'
                    }
                </td>
                <td class="actions-column">
                    <button class="btn btn--sm btn--secondary" 
                            data-action="view-details" 
                            data-article-id="${article.article_id}">
                        Détails
                    </button>
                </td>
            </tr>`;
    }).join('');

    container.innerHTML = `
        <div class="results-header">
            <div class="results-stats">
                <strong>${appState.searchResults.length}</strong> articles trouvés
                <span class="selection-counter">
                    <strong id="selectedCount">${getSelectedArticles().length}</strong> sélectionnés
                </span>
            </div>
            <div class="results-actions">
                <button class="btn btn--secondary" id="selectAllBtn" data-action="select-all-articles">
                    Tout sélectionner
                </button>
                <button class="btn btn--primary" 
                        data-action="batch-process-modal"
                        ${getSelectedArticles().length === 0 ? 'disabled' : ''}>
                    Traiter la sélection
                </button>
                <button class="btn btn--danger" 
                        data-action="delete-selected-articles"
                        ${getSelectedArticles().length === 0 ? 'disabled' : ''}>
                    Supprimer sélection
                </button>
            </div>
        </div>
        
        <div class="results-table-container">
            <table class="results-table">
                <thead>
                    <tr>
                        <th width="40">
                            <input type="checkbox" id="selectAllCheckbox" data-action="select-all-articles-checkbox">
                        </th>
                        <th>Article</th>
                        <th width="80">Score IA</th>
                        <th width="100">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>`;

    updateSelectionCounter();
}

export function displayEmptyArticlesState() {
    const tableBody = document.querySelector(SELECTORS.articleTableBody); // Cible le corps du tableau
    if (!tableBody) return;
    tableBody.innerHTML = `
        <tr class="empty-state-row">
            <td colspan="6" class="text-center py-4">
                <i class="fas fa-search fa-3x text-muted mb-3"></i>
                <h4>Aucun article trouvé</h4>
                <p>Lancez une recherche pour commencer à collecter des articles.</p>
            </td>
        </tr>
    `;
}

export function updateSelectionCounter() {
    const counter = document.querySelector('#selectedCount'); 
    const selectedCount = getSelectedArticles().length;
    if (counter) {
        counter.textContent = selectedCount;
    }
    
    // Mettre à jour l'état des boutons
    const batchBtn = document.querySelector('[data-action="batch-process-modal"]'); 
    const deleteBtn = document.querySelector('[data-action="delete-selected-articles"]'); 
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    
    const hasSelection = selectedCount > 0;
    if (batchBtn) batchBtn.disabled = !hasSelection;
    if (deleteBtn) deleteBtn.disabled = !hasSelection;
    if (selectAllCheckbox) selectAllCheckbox.checked = hasSelection && selectedCount === (appState.searchResults?.length || 0);
}

export function updateAllRowSelections() {
    const checkboxes = document.querySelectorAll('[data-action="toggle-article-selection"]');
    checkboxes.forEach(checkbox => {
        const articleId = checkbox.dataset.articleId; // Correction: articleId est une string
        checkbox.checked = isArticleSelected(articleId);
        
        const row = checkbox.closest('.result-row');
        if (row) {
            row.classList.toggle('result-row--selected', checkbox.checked);
        }
    });
    
    updateSelectionCounter();
}

export function toggleArticleSelection(articleId) {
    // La logique de l'état est maintenant centrale, cette fonction est appelée par le listener
    // et va déclencher l'événement 'articles-selection-changed'
    if (isArticleSelected(articleId)) removeSelectedArticle(articleId);
    else addSelectedArticle(articleId);
}

export function selectAllArticles(shouldSelect) {
    const allArticleIds = appState.searchResults.map(article => article.article_id);
    toggleAllArticles(allArticleIds, shouldSelect);

    const selectAllBtn = document.getElementById('selectAllBtn');
    if (selectAllBtn) {
        selectAllBtn.textContent = shouldSelect ? 'Tout désélectionner' : 'Tout sélectionner';
    }
    const selectAllCheckbox = document.getElementById('selectAllCheckbox');
    if (selectAllCheckbox) selectAllCheckbox.checked = shouldSelect;
    updateAllRowSelections();
}

export async function viewArticleDetails(articleId) {
    const article = appState.searchResults.find(a => a.article_id === articleId);
    const extraction = appState.currentProjectExtractions.find(e => e.pmid === articleId);
    
    if (!article) {
        showToast(MESSAGES.articleNotFound, 'error');
        return;
    }

    const extractionDetails = extraction ? 
        `<div class="extraction-details">
            <h4>Analyse IA</h4>
            <p><strong>Score:</strong> ${extraction.relevance_score}/10</p>
            <p><strong>Justification:</strong> ${escapeHtml(extraction.relevance_justification || 'Aucune')}</p>
         </div>` : 
        '<p class="no-analysis">Aucune analyse IA effectuée pour cet article.</p>';

    const content = `
        <div class="article-details">
            <h3>${escapeHtml(article.title)}</h3>
            <div class="article-meta">
                <p><strong>Auteurs:</strong> ${escapeHtml(article.authors)}</p>
                <p><strong>Journal:</strong> <em>${escapeHtml(article.journal)}</em>, ${escapeHtml(article.publication_date)}</p>
                <p><strong>DOI:</strong> ${article.doi ? `<a href="https://doi.org/${article.doi}" target="_blank">${article.doi}</a>` : 'N/A'}</p>
                <p><strong>ID:</strong> ${escapeHtml(articleId)}</p>
            </div>
            
            <div class="article-abstract">
                <h4>Résumé</h4>
                <p>${escapeHtml(article.abstract)}</p>
            </div>
            
            ${extractionDetails}
        </div>`;

    // Utiliser la modale dédiée #articleDetailModal
    const modalContent = document.getElementById('articleDetailContent');
    if (modalContent) modalContent.innerHTML = content;
    openModal('articleDetailModal');
}

export async function handleDeleteSelectedArticles() {
    const selectedArticles = getSelectedArticles();
    if (selectedArticles.length === 0) {
        showToast(MESSAGES.noArticleSelected, 'warning');
        return;
    }

    if (!confirm(MESSAGES.confirmDeleteArticles(selectedArticles.length))) {
        return;
    }

    try {
        const response = await fetchAPI(API_ENDPOINTS.articlesBatchDelete, {
            method: 'POST',
            body: JSON.stringify({
                article_ids: selectedArticles.map(a => a.id),
                project_id: appState.currentProject.id
            })
        });

        // CORRECTION : Utilise job_id au lieu de task_id
        if (response.job_id) {
            showToast(MESSAGES.deleteStarted(response.job_id), 'success');
            // Actualiser la liste des articles
            // La mise à jour se fera via un événement WebSocket ou un rechargement de la section
            // loadSearchResults(); // Ou attendre un événement WebSocket
        }
    } catch (error) {
        showToast(`Erreur lors de la suppression : ${error.message}`, 'error');
    }
}

export function showBatchProcessModal() {
    const selectedCount = getSelectedArticles().length;
    
    if (selectedCount === 0) {
        showToast(MESSAGES.noArticleSelected, 'warning');
        return;
    }

    const profiles = appState.analysisProfiles || [];
    const profileOptions = profiles.map(p => 
        `<option value="${p.id}">${escapeHtml(p.name)}</option>`
    ).join('');

    const content = `
        <div class="batch-process-modal">
            <p>Vous êtes sur le point de lancer un traitement par lot sur <strong>${selectedCount}</strong> article(s).</p>
            
            <div class="form-group">
                <label class="form-label" for="analysis-profile-select">Profil d'analyse:</label>
                <select id="analysis-profile-select" class="form-control">
                    ${profileOptions}
                </select>
            </div>
            
            <div class="modal-actions">
                <button class="btn btn--secondary" data-action="close-modal">Annuler</button>
                <button class="btn btn--primary" data-action="start-batch-process">Lancer le traitement</button>
            </div>
        </div>`;

    // Utiliser la modale dédiée #batchProcessModal
    const modal = document.getElementById('batchProcessModal');
    if (modal) modal.querySelector('.modal-body').innerHTML = content;
    openModal('batchProcessModal');
}

export async function startBatchProcessing() {
    closeModal('genericModal');
    
    const selectedIds = getSelectedArticles();
    const profileSelect = document.querySelector('#analysis-profile-select'); 
    const profileId = profileSelect ? profileSelect.value : null;
    
    if (selectedIds.length === 0) return;

    showLoadingOverlay(true, MESSAGES.screeningStarted(selectedIds.length));
    
    try {
        await fetchAPI(API_ENDPOINTS.projectRun(appState.currentProject.id), {
            method: 'POST',
            body: {
                articles: selectedIds,
                analysis_mode: 'screening',
                profile: profileId,
            }
        });
        
        showToast(MESSAGES.screeningTaskStarted, 'success');
        setCurrentSection('validation'); // Utilise la fonction de state.js
        
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false, '');
    }
}

export async function showRunExtractionModal() {
    if (!appState.currentProject) return;

    const includedArticles = (appState.currentProjectExtractions || []) // Read from state
        .filter(e => e.user_validation_status === 'include');
    
    if (includedArticles.length === 0) {
        showToast(MESSAGES.noArticleToExtract, 'warning');
        return;
    }

    // Charger les grilles si elles ne sont pas déjà dans l'état
    if (!appState.currentProjectGrids || appState.currentProjectGrids.length === 0) { // Read from state
        await loadProjectGrids(appState.currentProject.id);
    }

    const gridsOptions = (appState.currentProjectGrids || []).map(g => 
        `<option value="${g.id}">${escapeHtml(g.name)}</option>`
    ).join('');

    const content = `
        <div class="extraction-modal">
            <p>Vous êtes sur le point de lancer une extraction complète sur les 
               <strong>${includedArticles.length} article(s)</strong> que vous avez inclus.</p>
            
            <div class="form-group">
                <label class="form-label" for="extraction-grid-select">Grille d'extraction:</label>
                <select id="extraction-grid-select" class="form-control" required>
                    <option value="">-- Sélectionner une grille --</option>
                    ${gridsOptions}
                </select>
            </div>
            
            <div class="modal-actions">
                <button class="btn btn--secondary" data-action="close-modal">Annuler</button>
                <button class="btn btn--primary" data-action="start-full-extraction">Lancer l'extraction</button>
            </div>
        </div>`;

    showModal(MESSAGES.fullExtractionModalTitle, content);
}

export async function startFullExtraction() {
    const gridSelect = document.querySelector('#extraction-grid-select'); 
    const gridId = gridSelect ? gridSelect.value : null;
    
    if (!gridId) {
        showToast(MESSAGES.noGridSelectedForExtraction, 'warning');
        return;
    }

    closeModal('genericModal');
    
    const includedArticles = (appState.currentProjectExtractions || [])
        .filter(e => e.user_validation_status === 'include');
    
    const articleIds = includedArticles.map(e => e.pmid);

    showLoadingOverlay(true, MESSAGES.extractionStarted(articleIds.length));
    
    try {
        await fetchAPI(API_ENDPOINTS.projectRun(appState.currentProject.id), {
            method: 'POST',
            body: {
                articles: articleIds,
                analysis_mode: 'full_extraction',
                custom_grid_id: gridId,
            }
        });
        
        showToast(MESSAGES.extractionTaskStarted, 'success');
        setCurrentSection('validation'); // Utilise la fonction de state.js
        
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}