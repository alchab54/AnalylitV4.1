// web/js/screening.js (Fichier non fourni, voici une implémentation corrigée)

import { appState, elements } from './app-improved.js';
import { fetchAPI } from './api.js';
import { showToast, showLoadingOverlay, escapeHtml } from './ui-improved.js'; // Use ui-improved.js for toast
import { API_ENDPOINTS, MESSAGES } from './constants.js';
import { setScreeningDecisions } from './state.js';

/**
 * Charge les décisions de screening pour le projet actuel.
 */
async function loadScreeningDecisions() {
    if (!appState.currentProject?.id) return;
    showLoadingOverlay(true, MESSAGES.loadingScreening);
    try {
        const decisions = await fetchAPI(API_ENDPOINTS.projectScreeningDecisions(appState.currentProject.id));
        setScreeningDecisions(decisions || []);
        renderScreeningView(appState.screeningDecisions);
    } catch (error) {
        showToast(`${MESSAGES.errorLoadingScreening}: ${error.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

/**
 * Affiche la vue de screening.
 */
export function renderScreeningView(decisions = appState.screeningDecisions) {
    const container = elements.screeningContainer(); // Use elements getter
    if (!container) return;

    if (!appState.currentProject) {
        container.innerHTML = `<div class="placeholder">${MESSAGES.selectProjectForScreening}</div>`;
        return;
    }
    
    if (decisions.length === 0) {
        container.innerHTML = `<div class="placeholder">${MESSAGES.noArticlesToScreen}</div>`;
        return;
    }

    // Logique pour afficher la liste des articles à screener...
    container.innerHTML = `
        <div class="section-header">
            <h2>Screening des Articles</h2>
        </div>
        <div class="screening-list">
            ${decisions.map(item => `
                <div class="screening-item">
                    <h4>${escapeHtml(item.title)}</h4>
                    <p>${escapeHtml(item.abstract)}</p>
                    {/* ... boutons pour inclure/exclure ... */}
                </div>
            `).join('')}
        </div>
    `;
}

// Initialisation de la section
export function initializeScreeningSection() {
    if (appState.currentProject) {
        loadScreeningDecisions();
    } else {
        renderScreeningView();
    }
}