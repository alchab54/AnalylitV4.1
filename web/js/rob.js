import { appState, elements } from '../app.js';
import { fetchAPI } from './api.js';
import { showToast, showLoadingOverlay, escapeHtml } from './ui.js';

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

    const articlesHtml = articles.map(article => `
        <div class="rob-article-card" id="rob-card-${article.article_id}">
            <div class="rob-article-header">
                <input type="checkbox" class="article-select-checkbox" value="${escapeHtml(article.article_id)}" onchange="toggleArticleSelection('${escapeHtml(article.article_id)}', this.checked)">
                <h4 class="rob-article-title">${escapeHtml(article.title)}</h4>
                <button class="btn btn--sm btn--outline" onclick="fetchAndDisplayRob('${article.article_id}')">Voir/Éditer</button>
            </div>
            <div class="rob-assessment-summary" id="rob-summary-${article.article_id}">
                <!-- Le résumé de l'évaluation sera chargé ici -->
            </div>
        </div>
    `).join('');

    elements.robContainer.innerHTML = `<div class="rob-list">${articlesHtml}</div>`;
}

export async function fetchAndDisplayRob(articleId) {
    const summaryContainer = document.getElementById(`rob-summary-${articleId}`);
    if (!summaryContainer) return;

    try {
        summaryContainer.innerHTML = `<div class="loading-spinner"></div>`;
        const robData = await fetchAPI(`/projects/${appState.currentProject.id}/risk-of-bias?article_id=${articleId}`);

        if (Object.keys(robData).length === 0) {
            summaryContainer.innerHTML = `<p class="text-secondary">Aucune évaluation de biais pour cet article. Lancez l'analyse.</p>`;
            return;
        }

        summaryContainer.innerHTML = `
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

    } catch (e) {
        summaryContainer.innerHTML = `<p class="error">Erreur: ${e.message}</p>`;
    }
}

export function getBiasClass(bias) {
    if (!bias) return 'info';
    const biasLower = bias.toLowerCase();
    if (biasLower.includes('low')) return 'success';
    if (biasLower.includes('some concerns')) return 'warning';
    if (biasLower.includes('high')) return 'error';
    return 'info';
}

export async function handleRunRobAnalysis() {
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