// web/js/search.js

import { API_ENDPOINTS, SELECTORS, MESSAGES } from './constants.js';
import { fetchAPI } from './api.js';
import { showLoadingOverlay, escapeHtml, openModal } from './ui-improved.js';
import { showToast } from './toast.js';
import { appState, elements } from './app-improved.js';

export function renderSearchSection(project) {
    const container = document.querySelector(SELECTORS.searchContainer);
    if (!container) return;

    if (!project) {
        container.innerHTML = `<div class="card"><div class="card__body text-center"><p>${MESSAGES.selectProjectForSearch}</p></div></div>`;
        return;
    }

    const dbOptions = appState.availableDatabases.map(db => `
        <label class="checkbox-item">
            <input type="checkbox" name="databases" value="${db.id}" ${db.enabled ? 'checked' : ''}>
            ${escapeHtml(db.name)}
        </label>
    `).join('');

    container.innerHTML = `
        <div class="card">
            <div class="card__body">
                <form id="multiSearchForm" data-action="run-multi-search">
                    <div class="form-group">
                        <label for="searchQueryInput" class="form-label">Requête de recherche</label>
                        <input type="text" id="searchQueryInput" name="query" class="form-control" placeholder="Ex: therapeutic alliance AND (digital OR virtual)..." required>
                    </div>
                    <div id="expertSearchContainer" style="display: none;">
                        <!-- Les champs de recherche experte seront injectés ici -->
                    </div>

                    <div class="form-group">
                        <label class="form-label">Bases de données</label>
                        <div class="checkbox-group">${dbOptions}</div>
                    </div>

                    <div class="form-group">
                        <label class="checkbox-item">
                            <input type="checkbox" id="expertSearchToggle">
                            Recherche Experte (requête spécifique par base)
                        </label>
                    </div>

                    <div class="form-group">
                        <label for="maxResultsInput" class="form-label">Résultats max par base</label> 
                        <input type="number" id="maxResultsInput" name="max_results" class="form-control" value="50" min="10" max="200">
                    </div>
                    <button type="submit" class="btn btn--primary">Lancer la recherche</button>
                </form>
            </div>
        </div>
        <div id="resultsContainer" class="mt-24"></div>
    `;

    // Ajout des écouteurs pour le mode expert
    const expertToggle = document.getElementById('expertSearchToggle');
    const simpleSearchContainer = document.querySelector('#multiSearchForm .form-group:first-child');
    const expertSearchContainer = document.getElementById('expertSearchContainer');
    const dbCheckboxes = document.querySelectorAll('input[name="databases"]');

    const updateExpertSearchUI = () => {
        const isExpertMode = expertToggle.checked;
        simpleSearchContainer.style.display = isExpertMode ? 'none' : 'block';
        expertSearchContainer.style.display = isExpertMode ? 'block' : 'none';
        document.getElementById('searchQueryInput').required = !isExpertMode;

        if (isExpertMode) {
            const selectedDbs = Array.from(dbCheckboxes).filter(cb => cb.checked);
            expertSearchContainer.innerHTML = selectedDbs.map(db => `
                <div class="form-group">
                    <label for="expertQuery_${db.value}" class="form-label">Requête pour ${escapeHtml(db.labels[0].textContent.trim())}</label>
                    <textarea id="expertQuery_${db.value}" name="expert_query_${db.value}" class="form-control" rows="3" placeholder="Syntaxe spécifique pour ${escapeHtml(db.labels[0].textContent.trim())}..."></textarea>
                </div>
            `).join('');
        } else {
            expertSearchContainer.innerHTML = '';
        }
    };

    expertToggle.addEventListener('change', updateExpertSearchUI);
    dbCheckboxes.forEach(cb => cb.addEventListener('change', () => {
        if (expertToggle.checked) {
            updateExpertSearchUI();
        }
    }));
}

export async function handleMultiDatabaseSearch(event) {
    event.preventDefault();
    if (!appState.currentProject) return;

    const form = event.target;
    const isExpertMode = form.elements.expertSearchToggle?.checked;
    const max_results = parseInt(form.elements.max_results.value, 10);
    const databases = Array.from(form.elements.databases).filter(cb => cb.checked).map(cb => cb.value);

    let searchPayload = {
        project_id: appState.currentProject.id,
        databases: databases,
        max_results_per_db: max_results,
    };

    if (isExpertMode) {
        const expertQueries = {};
        let allQueriesEmpty = true;
        for (const db of databases) {
            const textarea = form.elements[`expert_query_${db}`]; // Correction: Utilisation de la bonne syntaxe
            if (textarea && textarea.value.trim()) {
                expertQueries[db] = textarea.value.trim();
                allQueriesEmpty = false;
            }
        }
        if (allQueriesEmpty) {
            showToast(MESSAGES.expertQueryRequired, 'warning');
            return;
        }
        searchPayload.expert_queries = expertQueries;
    } else {
        const query = form.elements.query.value;
        if (!query.trim()) {
            showToast(MESSAGES.searchQueryRequired, 'warning');
            return;
        }
        searchPayload.query = query;
    }

    showLoadingOverlay(true, MESSAGES.searching);
    try {
        await fetchAPI(API_ENDPOINTS.search, { method: 'POST', body: searchPayload });
        showToast(MESSAGES.searchStarted, 'success');
    } catch (error) {
        showToast(`${MESSAGES.error}: ${error.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

export function showSearchModal() {
    if (!appState.currentProject) {
        showToast(MESSAGES.selectProjectForSearch, 'warning');
        return;
    }

    const dbOptions = appState.availableDatabases.map(db => `
        <label class="checkbox-item">
            <input type="checkbox" name="databases" value="${db.id}" ${db.enabled ? 'checked' : ''}>
            ${escapeHtml(db.name)}
        </label>
    `).join('');

    const content = `
        <form id="modalSearchForm">
            <div class="form-group">
                <label for="modalSearchQuery" class="form-label">Requête</label>
                <input type="text" id="modalSearchQuery" name="query" class="form-control" placeholder="Ex: therapeutic alliance AND digital..." required>
            </div>
            <div class="form-group"><label class="form-label">Bases de données</label><div class="checkbox-group">${dbOptions}</div></div>
            <div class="form-group"><label for="modalMaxResults" class="form-label">Résultats max par base</label><input type="number" id="modalMaxResults" name="max_results" class="form-control" value="50" min="10" max="200"></div>
            <button type="submit" class="btn btn--primary" data-action="run-multi-search">Lancer la recherche</button>
        </form>
    `;
    openModal(MESSAGES.newSearch, content);
}

let sortState = { key: 'relevance_score', asc: false };

export function sortResults(key) {
    if (sortState.key === key) {
        sortState.asc = !sortState.asc;
    } else {
        sortState.key = key;
        sortState.asc = key === 'title'; // Par défaut, tri ascendant pour le titre
    }

    appState.searchResults.sort((a, b) => {
        let valA, valB;
        if (key === 'relevance_score') {
            const extraA = appState.currentProjectExtractions.find(e => e.pmid === a.article_id) || { relevance_score: -1 };
            const extraB = appState.currentProjectExtractions.find(e => e.pmid === b.article_id) || { relevance_score: -1 };
            valA = extraA.relevance_score;
            valB = extraB.relevance_score;
        } else {
            valA = a[key] || '';
            valB = b[key] || '';
        }

        if (valA < valB) return sortState.asc ? -1 : 1;
        if (valA > valB) return sortState.asc ? 1 : -1;
        return 0;
    });

    renderSearchResultsTable();
}

// Fonction utilitaire pour vérifier la présence d'un PDF
export function hasPdfForArticle(articleId) {
    if (!appState.projectFiles) return false;
    const sanitizedId = sanitizeForFilename(articleId);
    return appState.projectFiles.has(sanitizedId);
}
export function sanitizeForFilename(name) {
    return String(name || '').replace(/[<>:"/\\|?*]/g, '_').trim();
}
