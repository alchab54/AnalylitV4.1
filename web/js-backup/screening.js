// web/js/screening.js (Fichier non fourni, voici une implémentation corrigée)

import { appState, elements } from './app-improved.js';
import { fetchAPI } from './api.js';
import { showToast, showLoadingOverlay, escapeHtml } from './ui-improved.js';
import { setScreeningDecisions } from './state.js'; // Supposant que cette fonction existe dans state.js

/**
 * Charge les décisions de screening pour le projet actuel.
 */
async function loadScreeningDecisions() {
    if (!appState.currentProject?.id) return;
    showLoadingOverlay(true, 'Chargement du screening...');
    try {
        const decisions = await fetchAPI(`/projects/${appState.currentProject.id}/screening-decisions`);
        setScreeningDecisions(decisions || []);
        renderScreeningView();
    } catch (error) {
        showToast(`Erreur de chargement du screening: ${error.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

/**
 * Affiche la vue de screening.
 */
export function renderScreeningView() {
    const container = elements.screeningContainer; // Supposant que elements.screeningContainer existe
    if (!container) return;

    if (!appState.currentProject) {
        container.innerHTML = `<div class="placeholder">Sélectionnez un projet pour commencer le screening.</div>`;
        return;
    }

    const decisions = appState.screeningDecisions || [];
    if (decisions.length === 0) {
        container.innerHTML = `<div class="placeholder">Aucun article à screener. Lancez un traitement par lot.</div>`;
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
