import { fetchAPI } from './api.js';
import { appState, elements } from '../app.js'; // Assuming appState and elements are defined in app.js and will be imported
import { showLoadingOverlay, showToast, showModal, closeModal, escapeHtml } from './ui.js'; // Assuming these are in ui.js or core.js
import { loadProjectFilesSet } from './projects.js'; // Assuming this is in projects.js
import { showSearchModal } from './search.js';
import { setSearchResults, clearSelectedArticles, toggleSelectedArticle } from './state.js';
import { showSection } from './core.js';

// Functions related to search results and articles will be moved here

export async function loadSearchResults() {
  showLoadingOverlay(true, 'Chargement des résultats...');
  if (!appState.currentProject?.id) {
    elements.resultsContainer.innerHTML = `
      <div class="card"><div class="card__body">
        Sélectionnez un projet pour voir les résultats.
      </div></div>`;
    showLoadingOverlay(false);
    return;
  }

  try {
    const [searchResults, extractions] = await Promise.all([
      fetchAPI(`/projects/${appState.currentProject.id}/results`),
      fetchAPI(`/projects/${appState.currentProject.id}/extractions`)
    ]);

    setSearchResults(searchResults);
    appState.currentProjectExtractions = extractions || [];
    
    renderSearchResultsTable();
  } catch (e) {
    elements.resultsContainer.innerHTML = '<p>Erreur lors du chargement des résultats.</p>';
    console.error('Erreur loadSearchResults:', e);
  } finally {
    showLoadingOverlay(false);
  }
}

function renderResultsHeader(count) {
  return `
    <h3>Résultats (${count} articles)</h3>
    <div class="results-actions">
      <button class="btn btn--primary btn--sm" data-action="show-search-modal">🔍 Nouvelle recherche</button>
      <button class="btn btn--secondary btn--sm" data-action="select-all-articles">Tout sélectionner</button>
      <button class="btn btn--accent btn--sm" data-action="batch-process-modal">Traiter la sélection (<span id="selectionCounter">0</span>)</button>
    </div>
  `;
}

function renderArticleRow(article, extraction, pdfExists, isSelected) {
  const score = extraction.relevance_score ?? '';
  const justification = extraction.relevance_justification || '';

  const pdfBadge = pdfExists
    ? `<span class="badge badge--success">PDF</span>`
    : `<span class="badge badge--secondary">Aucun</span>`;

  const titleDisplay = (article.title || 'Titre non disponible').length > 80
    ? (article.title || 'Titre non disponible').substring(0, 80) + '...'
    : (article.title || 'Titre non disponible');

  const authorsDisplay = (article.authors || '').length > 40
    ? (article.authors || '').substring(0, 40) + '...'
    : (article.authors || '');

  const scoreDisplay = (score !== undefined && score !== null && score !== '')
    ? `<span class="score-badge ${score >= 7 ? 'score--high' : score >= 4 ? 'score--medium' : 'score--low'}">${score}/10</span>`
    : `<span class="badge badge--secondary">Pas analysé</span>`;

  return `
    <tr class="article-row" data-article-id="${escapeHtml(article.article_id)}">
      <td class="select-cell"><input type="checkbox" class="article-checkbox" data-article-id="${escapeHtml(article.article_id)}" ${isSelected ? 'checked' : ''}></td>
      <td class="article-main">
        <div class="article-title" title="${escapeHtml(article.title || '')}">${escapeHtml(titleDisplay)}</div>
        <div class="article-meta">
          <span class="article-id">ID: ${escapeHtml(article.article_id)}</span>
          ${article.journal ? `• <span class="article-journal">${escapeHtml(article.journal)}</span>` : ''}
          ${article.publication_date ? `• <span class="article-year">${escapeHtml(article.publication_date)}</span>` : ''}
        </div>
        <div class="article-authors" title="${escapeHtml(article.authors || '')}">${escapeHtml(authorsDisplay)}</div>
      </td>
      <td class="source-cell">
        <span class="source-badge source--${escapeHtml((article.database_source || 'unknown').toLowerCase())}">${escapeHtml((article.database_source || '').toUpperCase())}</span>
      </td>
      <td class="pdf-cell">${pdfBadge}</td>
      <td class="score-cell">
        ${scoreDisplay}
        ${justification ? `<div class="score-justification" title="${escapeHtml(justification)}">${escapeHtml(justification.length > 50 ? justification.substring(0, 50) + '...' : justification)}</div>` : ''}
      </td>
      <td class="actions-cell">
        <button class="btn btn--sm btn--outline" data-action="view-details" data-article-id="${escapeHtml(article.article_id)}" title="Voir détails">👁️</button>
        ${article.url ? `<a href="${article.url}" target="_blank" class="btn btn--sm btn--outline">🔗</a>` : ''}
      </td>
    </tr>`;
}

function renderResultsEmptyState(reason) {
  let message = '';
  switch (reason) {
    case 'no-project':
      message = 'Sélectionnez un projet pour voir les résultats.';
      break;
    case 'no-results':
      message = '<h4>Aucun résultat</h4><p>Lancez une recherche pour voir les articles trouvés.</p>';
      break;
    default:
      message = 'Aucun résultat à afficher.';
  }
  return `<div class="card"><div class="card__body text-center">${message}</div></div>`;
}

export function renderSearchResultsTable() {
  if (!elements.resultsContainer) return;

  if (!appState.currentProject?.id) {
    elements.resultsContainer.innerHTML = renderResultsEmptyState('no-project');
    return;
  }

  const results = appState.searchResults || [];
  if (results.length === 0) {
    elements.resultsContainer.innerHTML = renderResultsEmptyState('no-results');
    return;
  }

  const extractionById = Object.fromEntries(
    (appState.currentProjectExtractions || []).map(e => [e.pmid, e])
  );

  const rows = results.map(article => {
    const extraction = extractionById[article.article_id] || {};
    const pdfExists = hasPdfForArticle(article.article_id);
    const isSelected = appState.selectedSearchResults.has(article.article_id);
    return renderArticleRow(article, extraction, pdfExists, isSelected);
  }).join('');

  const headerHtml = renderResultsHeader(results.length);

  elements.resultsContainer.innerHTML = `
    <div class="card">
      <div class="card__header">
        ${headerHtml}
      </div>
      <div class="card__body">
        <div class="table-container">
          <table class="table table--compact">
            <thead>
              <tr>
                <th class="col-select"><input type="checkbox" data-action="select-all-articles" title="Tout sélectionner/désélectionner"></th>
                <th class="col-main sortable" data-action="sort-results" data-sort-key="title">Article & Métadonnées</th>
                <th class="col-source sortable" data-action="sort-results" data-sort-key="database_source">Source</th>
                <th class="col-pdf">PDF</th>
                <th class="col-score sortable" data-action="sort-results" data-sort-key="relevance_score">Score IA</th>
                <th class="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </div>`;
  updateSelectionCounter();
}

export function viewArticleDetails(articleId) {
  if (!articleId) {
    showToast('ID article manquant', 'error');
    return;
  }

  // Chercher l'article dans les résultats de recherche
  const article = appState.searchResults.find(r => r.article_id === articleId);
  const extraction = appState.currentProjectExtractions.find(e => e.pmid === articleId);

  if (!article) {
    showToast('Article non trouvé', 'error');
    return;
  }

  // Créer le contenu de la modale avec les détails
  const modalContent = `
    <div class="article-details">
      <h3>${escapeHtml(article.title || 'Titre non disponible')}</h3>
      
      <div class="article-meta">
        <p><strong>Auteurs:</strong> ${escapeHtml(article.authors || 'Non spécifiés')}</p>
        <p><strong>Journal:</strong> ${escapeHtml(article.journal || 'Non spécifié')}</p>
        <p><strong>Date:</strong> ${escapeHtml(article.publication_date || 'Non spécifiée')}</p>
        <p><strong>DOI:</strong> ${article.doi ? `<a href="https://doi.org/${article.doi}" target="_blank">${article.doi}</a>` : 'Non disponible'}</p>
        <p><strong>Source:</strong> ${escapeHtml(article.database_source || 'Inconnue')}</p>
      </div>

      ${article.abstract ? `
        <div class="article-abstract">
          <h4>Résumé</h4>
          <p>${escapeHtml(article.abstract)}</p>
        </div>
      ` : ''}

      ${extraction ? `
        <div class="article-extraction">
          <h4>Évaluation IA</h4>
          <p><strong>Score de pertinence:</strong> ${extraction.relevance_score || 'N/A'}/10</p>
          <p><strong>Justification:</strong> ${escapeHtml(extraction.relevance_justification || 'Aucune')}</p>
          
          ${extraction.extracted_data ? `
            <h4>Données extraites</h4>
            <pre class="extraction-data">${escapeHtml(JSON.stringify(JSON.parse(extraction.extracted_data), null, 2))}</pre>
          ` : ''}
        </div>
      ` : ''}

      <div class="article-actions">
        ${article.url ? `<a href="${article.url}" target="_blank" class="btn btn--secondary btn--sm">Voir sur ${article.database_source}</a>` : ''}
      </div>
    </div>
  `;

  // Créer et afficher la modale
  const modal = document.createElement('div');
  modal.className = 'modal modal--show';
  modal.innerHTML = `
    <div class="modal__content modal__content--large">
      <div class="modal__header">
        <h3>Détails de l'article</h3>
        <button type="button" class="modal__close" onclick="closeModal()">×</button>
      </div>
      <div class="modal__body">
        ${modalContent}
      </div>
    </div>
  `;

  // Ajouter la modale au DOM
  document.body.appendChild(modal);

  // Gestion de fermeture par clic sur le fond
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.classList.contains('modal__close')) {
      document.body.removeChild(modal);
    }
  });
}

export function toggleAbstractRow(articleId) {
    const abstractRow = document.getElementById(`abstract-${articleId}`);
    if (abstractRow) {
        abstractRow.classList.toggle('hidden');
    }
}

export function hasPdfForArticle(articleId) {
  if (!appState.currentProjectFiles) return false;
  const stem = sanitizeForFilename(articleId);
  return appState.currentProjectFiles.has(stem);
}

export function sanitizeForFilename(name) {
  // Miroir du backend: remplace <>:"/\|?* par _ et met en minuscules
  return String(name || '').replace(/[<>:"/\\|?*]/g, '_').trim().toLowerCase();
}

export function toggleArticleSelection(articleId, checked) {
    toggleSelectedArticle(articleId);
}

export function updateSelectionCounter() {
    const counters = document.querySelectorAll('#selectionCounter');
    counters.forEach(counter => {
        counter.textContent = `${appState.selectedSearchResults.size} article(s) sélectionné(s)`;
    }
}

export function selectAllArticles() {
  const allIds = (appState.searchResults || []).map(a => a.article_id);
  const allCurrentlySelected = allIds.length > 0 && allIds.every(id => appState.selectedSearchResults.has(id));

  if (allCurrentlySelected) {
    clearSelectedArticles();
  } else {
    allIds.forEach(id => toggleSelectedArticle(id, true));
    renderSearchResultsTable(); // Re-render to update checkboxes
  }
}

export function toggleSelectAll(checked, source) {
    const checkboxes = document.querySelectorAll(`.article-checkbox[data-source="${source}"]`);
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

export async function handleDeleteSelectedArticles() {
    const selectedIds = Array.from(appState.selectedSearchResults);
    if (selectedIds.length === 0) {
        showToast('Aucun article sélectionné.', 'warning');
        return;
    }
    if (!confirm(`Êtes-vous sûr de vouloir supprimer définitivement ${selectedIds.length} article(s) ? Cette action est irréversible.`)) {
        return;
    }

    showLoadingOverlay(true, 'Suppression en cours...');
    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/articles`, {
            method: 'DELETE',
            body: { article_ids: selectedIds }
        });
        
        // Mettre à jour l'état local pour un affichage instantané
        setSearchResults(appState.searchResults.filter(a => !selectedIds.includes(a.article_id)));
        appState.currentProjectExtractions = appState.currentProjectExtractions.filter(e => !selectedIds.includes(e.pmid));
        clearSelectedArticles();
        
        showToast('Articles supprimés avec succès.', 'success');
        renderSearchResultsTable(); // Re-afficher le tableau mis à jour
    } catch (error) {
        showToast(`Erreur : ${error.message}`, 'error');
    }
}

export function showBatchProcessModal() {
    const selectedCount = appState.selectedSearchResults.size;
    if (selectedCount === 0) {
        showToast('Veuillez sélectionner au moins un article.', 'warning');
        return;
    }

    const content = `
        <p>Vous êtes sur le point de lancer un traitement par lot sur ${selectedCount} article(s).</p>
        <p>Veuillez choisir un profil d'analyse:</p>
        <select id="batch-analysis-profile" class="form-control">
            ${appState.analysisProfiles.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
        </select>
        <div class="modal__actions">
            <button type="button" class="btn btn--secondary" onclick="closeModal('genericModal')">Annuler</button>
            <button type="button" class="btn btn--primary" onclick="startBatchProcessing()">Lancer</button>
        </div>
    `;
    showModal('Traitement par lot', content);
}

export function startBatchProcessing() {
    const selectedIds = Array.from(appState.selectedSearchResults);
    const profileId = document.getElementById('batch-analysis-profile').value;
    
    try {
        showLoadingOverlay(true, 'Lancement du traitement par lot...');
        closeModal('genericModal');
        
        fetchAPI(`/projects/${appState.currentProject.id}/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                articles: selectedIds,
                profile: profileId,
                analysis_mode: 'screening'
            })
        });
        
        showToast('Traitement par lot lancé.', 'success');
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    }
}

export function showRunExtractionModal() {
    const includedArticles = appState.currentValidations.filter(e => e.user_validation_status === 'include');
    if (includedArticles.length === 0) {
        showToast("Aucun article n'a été validé comme 'Inclus'.", 'warning');
        return;
    }

    if (appState.currentProjectGrids.length === 0) {
        showToast("Aucune grille d'extraction n'a été créée ou importée pour ce projet.", 'error');
        showSection('grids'); // Redirige l'utilisateur pour créer une grille
        return;
    }

    const modalContent = `
        <p>Vous êtes sur le point de lancer une extraction complète sur les <strong>${includedArticles.length} article(s)</strong> que vous avez inclus.</p>
        <div class="form-group">
            <label for="extractionGridSelect" class="form-label">Choisir une grille d'extraction :</label>
            <select id="extractionGridSelect" class="form-control">
                ${appState.currentProjectGrids.map(grid => `<option value="${grid.id}">${escapeHtml(grid.name)}</option>`).join('')}
            </select>
        </div>
         <div class="form-group">
            <label for="extractionProfileSelect" class="form-label">Choisir un profil d'analyse :</label>
            <select id="extractionProfileSelect" class="form-control">
                ${appState.analysisProfiles.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
            </select>
        </div>
    `;
    showModal('Lancer l\'extraction complète', modalContent, 'startFullExtraction()');
}

export async function startFullExtraction() {
    const gridId = document.getElementById('extractionGridSelect').value;
    const profileId = document.getElementById('extractionProfileSelect').value;
    const includedArticlesIds = appState.currentValidations
        .filter(e => e.user_validation_status === 'include')
        .map(e => e.pmid);

    if (!gridId) {
        showToast("Veuillez sélectionner une grille.", "warning");
        return;
    }

    closeModal();
    showLoadingOverlay(true, 'Lancement de l\'extraction...');
    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/run`, {
            method: 'POST',
            body: {
                articles: includedArticlesIds,
                profile: profileId,
                analysis_mode: 'full_extraction',
                custom_grid_id: gridId
            }
        });
        showToast('Tâche d\'extraction lancée avec succès.', 'success');
    } catch (error) {
        showToast(`Erreur lors du lancement de l\'extraction: ${error.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}
