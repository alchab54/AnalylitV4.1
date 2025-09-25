// web/js/search.js
import { fetchAPI } from './api.js';
import { appState } from './app-improved.js';
import { showToast, escapeHtml } from './ui-improved.js';
import { API_ENDPOINTS, MESSAGES } from './constants.js';

export function renderSearchSection(project) {
    const container = document.getElementById('searchContainer');
    if (!container) return;

    if (!project) {
        container.innerHTML = `<div class="placeholder">${MESSAGES.selectProjectForSearch}</div>`;
        return;
    }

    const databases = appState.availableDatabases || [];

    container.innerHTML = `
        <div class="thesis-search-header">
            <h3>🔍 Recherche Bibliographique</h3>
            <p>Recherchez dans PubMed, CrossRef et d'autres bases pour votre thèse ATN.</p>
        </div>
        <div class="modern-tabs">
            <div class="tab-header-modern">
                <button type="button" class="tab-link-modern active" data-tab="simple-search">Recherche Simple</button>
                <button type="button" class="tab-link-modern" data-tab="expert-search">Recherche Experte</button>
            </div>
            <div class="tab-content-modern">
                <div id="simple-search" class="tab-panel active">
                    ${createSimpleSearchForm(databases)}
                </div>
                <div id="expert-search" class="tab-panel">
                    ${createExpertSearchForm(databases)}
                </div>
            </div>
        </div>
        <div id="search-results-status"></div>
    `;

    // Attacher les écouteurs d'événements pour les onglets
    container.querySelectorAll('.tab-link-modern').forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;
            container.querySelectorAll('.tab-link-modern').forEach(btn => btn.classList.remove('active'));
            container.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });
}

function createSimpleSearchForm(databases) {
    const dbCheckboxes = databases.map(db => `
        <label class="db-checkbox">
            <input type="checkbox" name="databases" value="${db.id}" checked>
            <span class="db-name">${escapeHtml(db.name)}</span>
        </label>
    `).join('');

    return `
        <form data-action="run-multi-search">
            <div class="search-input-group">
                <input name="query" type="text" placeholder="alliance thérapeutique numérique, thérapie digitale..." class="search-input" required>
                <button type="submit" class="btn btn-primary search-btn">🔍 Lancer la recherche</button>
            </div>
            <div class="search-databases">${dbCheckboxes}</div>
            <div class="search-options-advanced">
                <label>Résultats max par base <input type="number" name="max_results" value="100" min="10" max="500" class="form-control" style="width: 100px; display: inline-block;"></label>
            </div>
        </form>
    `;
}

function createExpertSearchForm(databases) {
    const dbInputs = databases.map(db => `
        <div class="form-group">
            <label for="expert-query-${db.id}">${escapeHtml(db.name)}</label>
            <input type="text" id="expert-query-${db.id}" name="${db.id}" class="form-control" placeholder="Ex: (digital therap*) AND (therapeutic alliance)">
        </div>
    `).join('');

    return `
        <form data-action="run-expert-search">
            <p class="text-muted">Construisez des requêtes spécifiques pour chaque base de données.</p>
            ${dbInputs}
            <div class="search-options-advanced">
                <label>Résultats max par base <input type="number" name="max_results" value="100" min="10" max="500" class="form-control" style="width: 100px; display: inline-block;"></label>
            </div>
            <button type="submit" class="btn btn-primary search-btn">🔍 Lancer la recherche experte</button>
        </form>
    `;
}

export async function handleMultiDatabaseSearch(event) {
    event.preventDefault();
    if (!appState.currentProject?.id) {
        showToast(MESSAGES.selectProjectFirst, 'warning');
        return;
    }

    const form = event.target;
    const query = form.querySelector('input[name="query"]').value.trim();
    const databases = Array.from(form.querySelectorAll('input[name="databases"]:checked')).map(cb => cb.value);
    const maxResults = parseInt(form.querySelector('input[name="max_results"]').value, 10);

    if (!query) {
        showToast(MESSAGES.searchQueryRequired, 'warning');
        return;
    }
    if (databases.length === 0) {
        showToast('Veuillez sélectionner au moins une base de données.', 'warning');
        return;
    }

    const searchPayload = {
        project_id: appState.currentProject.id,
        query: query,
        databases: databases,
        max_results_per_db: maxResults,
    };

    await executeSearch(searchPayload);
}

export async function handleExpertSearch(event) {
    event.preventDefault();
    if (!appState.currentProject?.id) {
        showToast(MESSAGES.selectProjectFirst, 'warning');
        return;
    }

    const form = event.target;
    const maxResults = parseInt(form.querySelector('input[name="max_results"]').value, 10);
    const expertQueries = {};
    let hasQuery = false;

    appState.availableDatabases.forEach(db => {
        const input = form.querySelector(`input[name="${db.id}"]`);
        if (input && input.value.trim()) {
            expertQueries[db.id] = input.value.trim();
            hasQuery = true;
        }
    });

    if (!hasQuery) {
        showToast(MESSAGES.expertQueryRequired, 'warning');
        return;
    }

    const searchPayload = {
        project_id: appState.currentProject.id,
        expert_queries: expertQueries,
        max_results_per_db: maxResults,
    };

    await executeSearch(searchPayload);
}

async function executeSearch(payload) {
    const statusContainer = document.getElementById('search-results-status');
    if (statusContainer) {
        statusContainer.innerHTML = `<div class="loading-indicator">${MESSAGES.searching}</div>`;
    }

    try {
        const response = await fetchAPI(API_ENDPOINTS.search, { method: 'POST', body: payload });

        if (response.task_id) {
            showToast(MESSAGES.searchStarted, 'success');
            if (statusContainer) statusContainer.innerHTML = `<div class="success-indicator">${MESSAGES.searchStarted}</div>`;
        }
    } catch (error) {
        showToast(`Erreur: ${error.message}`, 'error');
        if (statusContainer) statusContainer.innerHTML = `<div class="error-indicator">Erreur: ${error.message}</div>`;
    }
}

export function showSearchModal() {
    // Implémenter la logique pour afficher une modale de recherche si nécessaire
    console.log("showSearchModal a été appelée");
}