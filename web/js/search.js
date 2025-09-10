// web/js/search.js
import { appState, elements } from '../app.js';
import { fetchAPI } from './api.js';
import { showLoadingOverlay, showToast, escapeHtml, openModal, closeModal } from './ui.js';

function renderSearchSection(project) {
    const container = document.getElementById('searchContainer');
    if (!container) return;

    if (!project) {
        container.innerHTML = `<div class="card"><div class="card__body text-center"><p>Veuillez sélectionner un projet pour commencer une recherche.</p></div></div>`;
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
                <form id="multiSearchForm">
                    <div class="form-group">
                        <label for="searchQueryInput" class="form-label">Requête de recherche</label>
                        <input type="text" id="searchQueryInput" name="query" class="form-control" placeholder="Ex: therapeutic alliance AND (digital OR virtual)..." required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Bases de données</label>
                        <div class="checkbox-group">${dbOptions}</div>
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
    
    document.getElementById('multiSearchForm').addEventListener('submit', handleMultiSearch);
    // Afficher les résultats existants
    renderSearchResultsTable();
} 

async function handleMultiSearch(event) {
    event.preventDefault();
    if (!appState.currentProject) return;

    const form = event.target;
    const query = form.elements.query.value;
    const max_results = parseInt(form.elements.max_results.value, 10);
    const databases = Array.from(form.elements.databases).filter(cb => cb.checked).map(cb => cb.value);

    showLoadingOverlay(true, 'Recherche en cours...');
    try {
        await fetchAPI('/search', {
            method: 'POST',
            body: {
                project_id: appState.currentProject.id,
                query: query,
                databases: databases,
                max_results_per_db: max_results
            }
        });
        showToast('Recherche lancée en arrière-plan. Les résultats apparaîtront progressivement.', 'success');
    } catch (error) {
        showToast(`Erreur : ${error.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

export function showSearchModal() {
    if (!appState.currentProject) {
        showToast('Veuillez sélectionner un projet pour lancer une recherche.', 'warning');
        return;
    }

    const dbOptions = appState.availableDatabases.map(db => `
        <label class="checkbox-item">
            <input type="checkbox" name="databases" value="${db.id}" ${db.enabled ? 'checked' : ''}>
            ${escapeHtml(db.name)}
        </label>
    `).join('');

    const content = `
        <form id="modalSearchForm" onsubmit="handleModalSearch(event)">
            <div class="form-group">
                <label for="modalSearchQuery" class="form-label">Requête de recherche</label>
                <input type="text" id="modalSearchQuery" name="query" class="form-control" placeholder="Ex: therapeutic alliance AND digital..." required>
            </div>
            <div class="form-group"><label class="form-label">Bases de données</label><div class="checkbox-group">${dbOptions}</div></div>
            <div class="form-group"><label for="modalMaxResults" class="form-label">Résultats max par base</label><input type="number" id="modalMaxResults" name="max_results" class="form-control" value="50" min="10" max="200"></div>
            <button type="submit" class="btn btn--primary">Lancer la recherche</button>
        </form>
    `;
    openModal('Nouvelle Recherche', content);
}

function renderSearchResultsTable() {
    const container = document.getElementById('resultsContainer');
    if (!container) return;

    const articles = appState.searchResults || [];
    
    // Barre d'actions qui apparaît au-dessus du tableau
    const actionsHeader = `
        <div class="results-actions-header">
            <div id="selection-counter">0 article(s) sélectionné(s)</div>
            <div class="button-group">
                <button class="btn btn--danger btn--sm" onclick="handleDeleteSelectedArticles()">Supprimer la sélection</button>
            </div>
        </div>
    `;

    if (articles.length === 0) {
        container.innerHTML = '<div class="card"><div class="card__body text-center"><p>Aucun article trouvé pour ce projet.</p></div></div>';
        return;
    }

    const groupedBySource = articles.reduce((acc, article) => {
        const source = article.database_source || 'Inconnue';
        if (!acc[source]) acc[source] = [];
        acc[source].push(article);
        return acc;
    }, {});

    let tableHtml = '';
    for (const source in groupedBySource) {
        const sourceArticles = groupedBySource[source];
        tableHtml += `
            <h4 class="source-group-header">${escapeHtml(source)} (${sourceArticles.length})</h4>
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th style="width: 5%;"><input type="checkbox" onchange="toggleSelectAll(this.checked, '${source}')"></th>
                            <th class="sortable" onclick="sortResults('relevance_score')">Score</th>
                            <th class="sortable" onclick="sortResults('title')">Titre</th>
                            <th class="sortable" onclick="sortResults('publication_date')">Année</th>
                            <th>Auteurs</th>
                            <th>PDF</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sourceArticles.map(article => {
                            const extraction = appState.currentProjectExtractions.find(e => e.pmid === article.article_id) || {};
                            const hasPdf = hasPdfForArticle(article.article_id);
                            const isSelected = appState.selectedSearchResults.has(article.article_id);
                            return `
                                <tr class="${extraction.user_validation_status === 'include' ? 'row-included' : ''}">
                                    <td><input type="checkbox" class="article-checkbox" data-source="${source}" data-id="${article.article_id}" ${isSelected ? 'checked' : ''}></td>
                                    <td>${(extraction.relevance_score != null ? extraction.relevance_score.toFixed(1) : 'N/A')}</td>
                                    <td>${escapeHtml(article.title)}</td>
                                    <td>${escapeHtml(article.publication_date)}</td>
                                    <td>${escapeHtml(article.authors)}</td>
                                    <td>${hasPdf ? '✔️' : '❌'}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="card">
            <div class="card__header">
                <h4>${articles.length} Articles Trouvés</h4>
            </div>
            <div class="card__body">
                ${actionsHeader}
                ${tableHtml}
            </div>
        </div>
    `;

    // Attacher les listeners pour les checkboxes
    document.querySelectorAll('.article-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            if (e.target.checked) {
                appState.selectedSearchResults.add(id);
            } else {
                appState.selectedSearchResults.delete(id);
            }
            updateSelectionCounter();
        });
    });
    updateSelectionCounter(); // Mettre à jour le compteur au premier affichage
}

let sortState = { key: 'relevance_score', asc: false };

function sortResults(key) {
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

function toggleSelectAll(checked) {
    const checkboxes = document.querySelectorAll('.article-checkbox');
    checkboxes.forEach(cb => {
        const id = cb.dataset.id;
        cb.checked = checked;
        if (checked) {
            appState.selectedSearchResults.add(id);
        } else {
            appState.selectedSearchResults.delete(id);
        }
    });
    updateSelectionCounter();
}

function updateSelectionCounter() {
    const counter = document.getElementById('selection-counter');
    if (counter) {
        counter.textContent = `${appState.selectedSearchResults.size} article(s) sélectionné(s)`;
    }
}

async function handleDeleteSelectedArticles() {
    const selectedIds = Array.from(appState.selectedSearchResults);
    if (selectedIds.length === 0) {
        showToast('Aucun article sélectionné.', 'warning');
        return;
    }

    if (!confirm(`Êtes-vous sûr de vouloir supprimer définitivement ${selectedIds.length} article(s) ?`)) {
        return;
    }

    showLoadingOverlay(true, 'Suppression en cours...');
    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/articles`, {
            method: 'DELETE',
            body: { article_ids: selectedIds }
        });
        
        // Mettre à jour l'état local pour refléter la suppression
        appState.searchResults = appState.searchResults.filter(a => !selectedIds.includes(a.article_id));
        appState.currentProjectExtractions = appState.currentProjectExtractions.filter(e => !selectedIds.includes(e.pmid));
        appState.selectedSearchResults.clear();
        
        showToast('Articles supprimés avec succès.', 'success');
        renderSearchResultsTable(); // Re-afficher le tableau mis à jour
    } catch (error) {
        showToast(`Erreur : ${error.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

// Fonction utilitaire pour vérifier la présence d'un PDF
function hasPdfForArticle(articleId) {
    if (!appState.projectFiles) return false;
    const sanitizedId = sanitizeForFilename(articleId);
    return appState.projectFiles.has(sanitizedId);
}
function sanitizeForFilename(name) {
    return String(name || '').replace(/[<>:"/\\|?*]/g, '_').trim();
}


// Assurez-vous d'exposer les nouvelles fonctions si elles sont appelées par onclick
window.toggleSelectAll = toggleSelectAll;
window.handleDeleteSelectedArticles = handleDeleteSelectedArticles;
window.showSearchModal = showSearchModal;
