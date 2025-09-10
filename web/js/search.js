// web/js/search.js

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

function renderSearchResultsTable() {
    const container = document.getElementById('resultsContainer');
    if (!container) return;

    const articles = appState.searchResults || [];
    if (articles.length === 0) {
        container.innerHTML = '<div class="card"><div class="card__body text-center"><p>Aucun article trouvé pour ce projet.</p></div></div>';
        return;
    }

    // En-têtes de tableau cliquables pour le tri
    const headers = `
        <th class="sortable" onclick="sortResults('relevance_score')">Score IA</th>
        <th class="sortable" onclick="sortResults('title')">Titre</th>
        <th class="sortable" onclick="sortResults('publication_date')">Année</th>
        <th>Auteurs</th>
        <th>PDF</th>
    `;

    const rows = articles.map(article => {
        const extraction = appState.currentProjectExtractions.find(e => e.pmid === article.article_id) || {};
        const hasPdf = hasPdfForArticle(article.article_id);

        return `
            <tr class="${extraction.user_validation_status === 'include' ? 'row-included' : ''}">
                <td>${(extraction.relevance_score || 0).toFixed(1)}</td>
                <td>${escapeHtml(article.title)}</td>
                <td>${escapeHtml(article.publication_date)}</td>
                <td>${escapeHtml(article.authors)}</td>
                <td>${hasPdf ? '✔️' : '❌'}</td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <div class="card">
            <div class="card__header">
                <h4>${articles.length} Articles</h4>
            </div>
            <div class="table-container">
                <table class="table">
                    <thead><tr>${headers}</tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>
    `;
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

// Fonction utilitaire pour vérifier la présence d'un PDF
function hasPdfForArticle(articleId) {
    if (!appState.projectFiles) return false;
    const sanitizedId = sanitizeForFilename(articleId);
    return appState.projectFiles.has(sanitizedId);
}
function sanitizeForFilename(name) {
    return String(name || '').replace(/[<>:"/\\|?*]/g, '_').trim();
}