import { appState, elements } from './app-improved.js';
import { fetchAPI } from './api.js'; // Already correct
import { showToast, showLoadingOverlay, escapeHtml } from './ui-improved.js';

export async function loadRobSection() {
    if (!elements.robContainer) return;

    if (!appState.currentProject?.id) {
        elements.robContainer.innerHTML = `<div class="empty-state"><p>Sélectionnez un projet pour évaluer le risque de biais.</p></div>`;
        return;
    }

    // On se base sur les articles déjà chargés dans `searchResults`
    const articles = appState.searchResults || [];
    if (articles.length === 0) {
        elements.robContainer.innerHTML = `<div class="empty-state"><p>Aucun article dans ce projet. Lancez une recherche d'abord.</p></div>`;
        return;
    }

    // On s'assure que les extractions sont chargées pour avoir les données RoB
    const extractions = appState.currentProjectExtractions || [];

    const articlesHtml = articles.map(article => `
        <div class="rob-article-card" id="rob-card-${article.article_id}">
            <div class="rob-article-header">
                <input type="checkbox" class="article-select-checkbox" data-action="toggle-article-selection" data-article-id="${escapeHtml(article.article_id)}">
                <h4 class="rob-article-title">${escapeHtml(article.title)}</h4>
                <button class="btn btn--secondary btn--sm" data-action="edit-rob" data-article-id="${article.article_id}">Éditer</button>
            </div>
            <div class="rob-assessment-summary" id="rob-summary-${article.article_id}">
                <!-- Le résumé de l'évaluation sera chargé ici -->
            </div>
        </div>
    `).join('');

    elements.robContainer.innerHTML = `
        <div class="section-header__actions">
            <button class="btn btn--primary" data-action="run-rob-analysis">Lancer l'analyse RoB sur la sélection</button>
        </div>
        <div class="rob-list mt-24">${articlesHtml}</div>
    `;
}

export async function fetchAndDisplayRob(articleId, editMode = false) { // Already exported, but keeping for consistency with request
    const summaryContainer = document.getElementById(`rob-summary-${articleId}`);
    if (!summaryContainer) return;

    try {
        summaryContainer.innerHTML = `<div class="loading-spinner"></div>`;
        const robData = await fetchAPI(`/projects/${appState.currentProject.id}/risk-of-bias/${articleId}`);

        if (!robData || Object.keys(robData).length === 0) {
            summaryContainer.innerHTML = `<p class="text-secondary">Aucune évaluation de biais pour cet article. Lancez l'analyse.</p>`;
            return;
        }

        if (editMode) {
            summaryContainer.innerHTML = renderRobEditForm(articleId, robData);
        } else {
            summaryContainer.innerHTML = renderRobDetails(robData);
        }

    } catch (e) {
        summaryContainer.innerHTML = `<p class="error">Erreur: ${e.message}</p>`;
    }
}

function renderRobDetails(robData) {
    return `
        <div class="rob-details">
            <div class="rob-domain">
                <strong>Randomisation:</strong>
                <span class="status status--${getBiasClass(robData.domain_1_bias)}">${robData.domain_1_bias || 'N/A'}</span>
                <p class="rob-justification">${escapeHtml(robData.domain_1_justification)}</p>
            </div>
            <div class="rob-domain">
                <strong>Données manquantes:</strong>
                <span class="status status--${getBiasClass(robData.domain_2_bias)}">${robData.domain_2_bias || 'N/A'}</span>
                <p class="rob-justification">${escapeHtml(robData.domain_2_justification)}</p>
            </div>
            <div class="rob-domain rob-overall">
                <strong>Évaluation globale:</strong>
                <span class="status status--${getBiasClass(robData.overall_bias)}">${robData.overall_bias || 'N/A'}</span>
                <p class="rob-justification">${escapeHtml(robData.overall_justification)}</p>
            </div>
        </div>
    `;
}

function renderRobEditForm(articleId, robData) {
    const biasOptions = ['Low risk', 'Some concerns', 'High risk', 'No information'];
    const renderSelect = (name, selectedValue) => `
        <select name="${name}" class="form-control">
            ${biasOptions.map(opt => `<option value="${opt}" ${selectedValue === opt ? 'selected' : ''}>${opt}</option>`).join('')}
        </select>
    `;

    return `
        <form class="rob-edit-form" data-action="save-rob-assessment" data-article-id="${articleId}">
            <div class="form-group">
                <label class="form-label">1. Biais dans le processus de randomisation</label>
                ${renderSelect('domain_1_bias', robData.domain_1_bias)}
                <textarea name="domain_1_justification" class="form-control mt-8" rows="2" placeholder="Justification...">${escapeHtml(robData.domain_1_justification || '')}</textarea>
            </div>
            <div class="form-group">
                <label class="form-label">2. Biais dû aux données manquantes</label>
                ${renderSelect('domain_2_bias', robData.domain_2_bias)}
                <textarea name="domain_2_justification" class="form-control mt-8" rows="2" placeholder="Justification...">${escapeHtml(robData.domain_2_justification || '')}</textarea>
            </div>
            <div class="form-group">
                <label class="form-label">Évaluation globale du risque de biais</label>
                ${renderSelect('overall_bias', robData.overall_bias)}
                <textarea name="overall_justification" class="form-control mt-8" rows="2" placeholder="Justification globale...">${escapeHtml(robData.overall_justification || '')}</textarea>
            </div>
            <div class="form-actions">
                <button type="button" class="btn btn--secondary" data-action="cancel-edit-rob" data-article-id="${articleId}">Annuler</button>
                <button type="submit" class="btn btn--primary">Sauvegarder</button>
            </div>
        </form>
    `;
}

export async function handleSaveRobAssessment(event) { // Already exported, but keeping for consistency with request
    event.preventDefault();
    const form = event.target.closest('form');
    if (!form) return;

    const articleId = form.dataset.articleId;
    if (!articleId) return;

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    data.article_id = articleId;

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Sauvegarde...';

    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/risk-of-bias`, {
            method: 'POST',
            body: data
        });
        showToast('Évaluation sauvegardée.', 'success');
        loadRobSection(); // Recharger la section pour voir les changements
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
        button.disabled = false;
        button.textContent = 'Sauvegarder';
    }
}

function getBiasClass(bias) {
    if (!bias) return 'info';
    const biasLower = bias.toLowerCase();
    if (biasLower.includes('low')) return 'success';
    if (biasLower.includes('some concerns')) return 'warning';
    if (biasLower.includes('high')) return 'error';
    return 'info';
}

export async function handleRunRobAnalysis() { // Already exported, but keeping for consistency with request
    if (!appState.currentProject) return;
    const selectedIds = Array.from(appState.selectedSearchResults);
    if (selectedIds.length === 0) {
        showToast("Veuillez sélectionner au moins un article pour l'analyse RoB.", 'warning');
        return;
    }
    showLoadingOverlay(true, `Lancement de l'analyse RoB pour ${selectedIds.length} article(s)...`);
    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/run-rob-analysis`, {
            method: 'POST',
            body: { article_ids: selectedIds }
        });
        showToast("Analyse du risque de biais lancée. Les résultats apparaîtront progressivement.", 'success');
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

export function getRobDomainFromKey(key) {
    const domainMap = {
        'domain_1_bias': 'Biais dans le processus de randomisation',
        'domain_2_bias': 'Biais dus aux écarts par rapport aux interventions prévues',
        // Ajoutez d'autres domaines ici si nécessaire
        'overall_bias': 'Biais global'
    };
    return domainMap[key] || key.replace(/_/g, ' ');
}