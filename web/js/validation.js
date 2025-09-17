// web/js/validation.js
import { appState, elements } from '../app.js';
import { fetchAPI } from './api.js';
import { showLoadingOverlay, showToast, escapeHtml } from './ui-improved.js';
import { loadProjectGrids } from './grids.js';
import { setCurrentValidations } from './state.js';

// CORRIGÉ: Ajout des exports manquants
export async function handleValidateExtraction(extractionId, decision) {
    if (!appState.currentProject?.id || !extractionId) return;
    
    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/extractions/${extractionId}/decision`, {
            method: 'PUT',
            body: { decision: decision, evaluator: 'evaluator1' }
        });
        
        await loadValidationSection();
        showToast('Décision mise à jour.', 'success');
    } catch (error) {
        showToast(`Erreur de validation : ${error.message}`, 'error');
    }
}

export async function resetValidationStatus(extractionId) {
    await handleValidateExtraction(extractionId, '');
}

export function filterValidationList(status, target) {
    // Retirer la classe active de tous les boutons de filtre
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('filter-btn--active');
    });
    
    // Ajouter la classe active au bouton cliqué
    target.classList.add('filter-btn--active');
    
    // Filtrer les éléments
    const items = document.querySelectorAll('.validation-item');
    items.forEach(item => {
        const itemStatus = item.dataset.status;
        if (status === 'all' || itemStatus === status) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

export async function loadValidationSection() {
    if (!appState.currentProject) {
        const validationContainer = document.getElementById('validationContainer');
        if (validationContainer) {
            validationContainer.innerHTML = `
                <div class="section-empty">
                    <h3>Aucun projet sélectionné</h3>
                    <p>Sélectionnez un projet pour voir les données de validation.</p>
                </div>`;
        }
        return;
    }
    
    await loadProjectExtractions(appState.currentProject.id);
}

async function loadProjectExtractions(projectId) {
    if (!appState.currentProject) return;
    
    const extractions = await fetchAPI(`/projects/${projectId}/extractions`);
    setCurrentValidations(extractions);
}

export async function renderValidationSection(project) {
    const container = document.getElementById('validationContainer');
    if (!container || !project) {
        if(container) container.innerHTML = `
            <div class="section-empty">
                <h3>Aucun projet sélectionné</h3>
                <p>Sélectionnez un projet pour voir la validation.</p>
            </div>`;
        return;
    }

    showLoadingOverlay(true, 'Chargement des validations...');

    try {
        const extractions = appState.currentValidations || [];
        const included = extractions.filter(e => e.user_validation_status === 'include');
        const excluded = extractions.filter(e => e.user_validation_status === 'exclude');
        const pending = extractions.filter(e => !e.user_validation_status);

        const grids = appState.currentProjectGrids || [];
        const gridOptions = grids.map(g => 
            `<option value="${g.id}">${escapeHtml(g.name)}</option>`
        ).join('');

        container.innerHTML = `
            <div class="validation-section">
                <div class="validation-header">
                    <h2>Validation Inter-Évaluateurs</h2>
                    <div class="validation-stats">
                        <div class="stat-item stat-item--included">
                            <span class="stat-value">${included.length}</span>
                            <span class="stat-label">Inclus</span>
                        </div>
                        <div class="stat-item stat-item--excluded">
                            <span class="stat-value">${excluded.length}</span>
                            <span class="stat-label">Exclus</span>
                        </div>
                        <div class="stat-item stat-item--pending">
                            <span class="stat-value">${pending.length}</span>
                            <span class="stat-label">En attente</span>
                        </div>
                    </div>
                </div>

                <div class="validation-filters">
                    <button class="filter-btn filter-btn--active" data-action="filter-validations" data-status="all">
                        Tous
                    </button>
                    <button class="filter-btn" data-action="filter-validations" data-status="include">
                        Inclus (${included.length})
                    </button>
                    <button class="filter-btn" data-action="filter-validations" data-status="exclude">  
                        Exclus (${excluded.length})
                    </button>
                    <button class="filter-btn" data-action="filter-validations" data-status="pending">
                        En attente (${pending.length})
                    </button>
                </div>

                ${included.length > 0 ? `
                    <div class="extraction-launch">
                        <h4>Lancer l'extraction complète</h4>
                        <p>Lancez une extraction détaillée sur les <strong>${included.length} article(s)</strong> que vous avez inclus.</p>
                        <button class="btn btn--primary" data-action="run-extraction-modal">
                            Lancer l'extraction
                        </button>
                    </div>
                ` : ''}

                <div class="validation-list">
                    ${extractions.map(extraction => renderValidationItem(extraction)).join('')}
                </div>
            </div>`;
    } catch (e) {
        container.innerHTML = `
            <div class="error-state">
                <h3>Erreur</h3>
                <p>Erreur lors de l'affichage de la section de validation.</p>
            </div>`;
    } finally {
        showLoadingOverlay(false);
    }
}

function renderValidationItem(extraction) {
    const article = appState.searchResults.find(art => art.article_id === extraction.pmid);
    const title = article?.title || extraction.title || 'Titre non disponible';
    
    const statusClass = extraction.user_validation_status === 'include' ? 'included' : 
                       extraction.user_validation_status === 'exclude' ? 'excluded' : 'pending';
    
    return `
        <div class="validation-item" data-status="${extraction.user_validation_status || 'pending'}">
            <div class="validation-item__header">
                <h4 class="validation-item__title">${escapeHtml(title)}</h4>
                <div class="validation-item__score">
                    Score IA: ${extraction.relevance_score != null ? extraction.relevance_score.toFixed(1) : 'N/A'}/10
                </div>
            </div>
            
            <div class="validation-item__content">
                <p class="validation-item__justification">
                    <strong>Justification:</strong> ${escapeHtml(extraction.relevance_justification || 'Aucune')}
                </p>
                
                <div class="validation-item__actions">
                    <button class="btn btn--sm btn--success" 
                            data-action="validate-extraction" 
                            data-id="${extraction.id}" 
                            data-decision="include">
                        Inclure
                    </button>
                    <button class="btn btn--sm btn--danger" 
                            data-action="validate-extraction" 
                            data-id="${extraction.id}" 
                            data-decision="exclude">
                        Exclure
                    </button>
                    <button class="btn btn--sm btn--secondary" 
                            data-action="reset-validation" 
                            data-id="${extraction.id}">
                        Réinitialiser
                    </button>
                </div>
            </div>
        </div>`;
}