// web/js/articles.js
import { fetchAPI } from './api.js';
import { appState, elements } from './app-improved.js';
import { showLoadingOverlay, showToast, showModal, closeModal, escapeHtml } from './ui-improved.js';
import { loadProjectFilesSet } from './projects.js';
import { showSearchModal } from './search.js';
import { setSearchResults, clearSelectedArticles, toggleSelectedArticle, setCurrentProjectExtractions } from './state.js';
import { showSection } from './core.js';
import { loadProjectGrids } from './grids.js';
import { API_ENDPOINTS, MESSAGES, SELECTORS } from './constants.js';

function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

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
        const results = await fetchAPI(`${API_ENDPOINTS.projectSearchResults(appState.currentProject.id)}?page=${page}`);
        setSearchResults(results.articles || [], results.meta || {});

        const extractions = await fetchAPI(API_ENDPOINTS.projectExtractions(appState.currentProject.id));
        setCurrentProjectExtractions(extractions);

        renderSearchResultsTable();
    } catch (error) {
        showToast(`Erreur: ${error.message}`, 'error');
        if (elements.resultsContainer) {
            elements.resultsContainer.innerHTML = `<div class="error-state">${MESSAGES.errorLoadingResults}</div>`;
        }
    } finally {
        showLoadingOverlay(false);
    }
}

export function renderSearchResultsTable() {
    if (!elements.resultsContainer) return;

    if (!appState.currentProject) {
        elements.resultsContainer.innerHTML = `
            <div class="results-empty">
                <h3>${MESSAGES.noProjectSelected}</h3>
                <p>${MESSAGES.selectProjectToViewResults}</p>
            </div>`;
        return;
    }

    if (appState.searchResults.length === 0) {
        elements.resultsContainer.innerHTML = `
            <div class="empty-state text-center py-5">
                <i class="fas fa-search fa-3x text-muted mb-3"></i>
                <h4>${MESSAGES.noArticlesFoundTitle}</h4>
                <p>${MESSAGES.noArticlesFoundText}</p>
            </div>
        `;
        return;
    }

    const { selectedSearchResults, currentProjectExtractions, currentProjectFiles } = appState;

    const tableRows = appState.searchResults.map(article => {
        const isSelected = selectedSearchResults.has(article.article_id);
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

    elements.resultsContainer.innerHTML = `
        <div class="results-header">
            <div class="results-stats">
                <strong>${appState.searchResults.length}</strong> articles trouvés
                <span class="selection-counter">
                    <strong id="${SELECTORS.selectedCount.substring(1)}">${selectedSearchResults.size}</strong> sélectionnés
                </span>
            </div>
            <div class="results-actions">
                <button class="btn btn--secondary" data-action="select-all-articles">
                    Tout sélectionner
                </button>
                <button class="btn btn--primary"
                        data-action="batch-process-modal"
                        ${selectedSearchResults.size === 0 ? 'disabled' : ''}>
                    Traiter la sélection
                </button>
                <button class="btn btn--danger"
                        data-action="delete-selected-articles"
                        ${selectedSearchResults.size === 0 ? 'disabled' : ''}>
                    Supprimer sélection
                </button>
            </div>
        </div>

        <div class="results-table-container">
            <table class="results-table">
                <thead>
                    <tr>
                        <th width="40">
                            <input type="checkbox" id="${SELECTORS.selectAllArticlesCheckbox.substring(1)}">
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

export function updateSelectionCounter() {
    const counter = document.querySelector(SELECTORS.selectedCount);
    if (counter) {
        counter.textContent = appState.selectedSearchResults.size;
    }

    // Mettre à jour l'état des boutons
    const batchBtn = document.querySelector(SELECTORS.batchProcessBtn);
    const deleteBtn = document.querySelector(SELECTORS.deleteSelectedBtn);

    const hasSelection = appState.selectedSearchResults.size > 0;
    if (batchBtn) batchBtn.disabled = !hasSelection;
    if (deleteBtn) deleteBtn.disabled = !hasSelection;
}

export function updateAllRowSelections() {
    const checkboxes = document.querySelectorAll(SELECTORS.toggleArticleSelection);
    checkboxes.forEach(checkbox => {
        const articleId = checkbox.dataset.articleId;
        checkbox.checked = appState.selectedSearchResults.has(articleId);

        const row = checkbox.closest('.result-row');
        if (row) {
            row.classList.toggle('result-row--selected', checkbox.checked);
        }
    });

    updateSelectionCounter();
}

export function toggleArticleSelection(articleId) {
    toggleSelectedArticle(articleId);
    updateAllRowSelections();
}

export function selectAllArticles(target) {
    const allSelected = appState.selectedSearchResults.size === appState.searchResults.length;

    if (allSelected) {
        clearSelectedArticles();
        target.textContent = 'Tout sélectionner';
    } else {
        appState.searchResults.forEach(article => {
            appState.selectedSearchResults.add(article.article_id);
        });
        target.textContent = 'Tout désélectionner';
    }

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

    showModal(MESSAGES.articleDetailsTitle, content);
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

        if (response.job_id) {
            showToast(MESSAGES.deleteStarted(response.job_id), 'success');
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('articles:refresh'));
            }, 2000);
        }
    } catch (error) {
        showToast(`Erreur lors de la suppression : ${error.message}`, 'error');
    }
}

export function showBatchProcessModal() {
    const selectedCount = appState.selectedSearchResults.size;

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
                <label class="form-label" for="${SELECTORS.analysisProfileSelect.substring(1)}">Profil d'analyse:</label>
                <select id="${SELECTORS.analysisProfileSelect.substring(1)}" class="form-control">
                    ${profileOptions}
                </select>
            </div>

            <div class="modal-actions">
                <button class="btn btn--secondary" data-action="close-modal">Annuler</button>
                <button class="btn btn--primary" data-action="start-batch-process">Lancer le traitement</button>
            </div>
        </div>`;

    showModal(MESSAGES.batchProcessModalTitle, content);
}

export async function startBatchProcessing() {
    closeModal('genericModal');

    const selectedIds = Array.from(appState.selectedSearchResults);
    const profileSelect = document.querySelector(SELECTORS.analysisProfileSelect);
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
        showSection('validation');

    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false, '');
    }
}

export async function showRunExtractionModal() {
    if (!appState.currentProject) return;

    const includedArticles = (appState.currentProjectExtractions || [])
        .filter(e => e.user_validation_status === 'include');

    if (includedArticles.length === 0) {
        showToast(MESSAGES.noArticleToExtract, 'warning');
        return;
    }

    if (appState.currentProjectGrids.length === 0) {
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
                <label class="form-label" for="${SELECTORS.extractionGridSelect.substring(1)}">Grille d'extraction:</label>
                <select id="${SELECTORS.extractionGridSelect.substring(1)}" class="form-control" required>
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
    const gridSelect = document.querySelector(SELECTORS.extractionGridSelect);
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
        showSection('validation');

    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}
