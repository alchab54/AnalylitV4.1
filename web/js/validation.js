// web/js/validation.js
import { setCurrentValidations } from './state.js';

export async function renderValidationSection(project) {
    const container = document.getElementById('validationContainer');
    if (!container || !project) return;

    showLoadingOverlay(true, 'Chargement des validations...');
    try {
        await Promise.all([
            loadProjectExtractions(project.id),
            loadProjectGrids(project.id)
        ]);
        
        const extractions = appState.currentValidations || []; // This should be set by a setter
        const included = extractions.filter(e => e.user_validation_status === 'include');
        const excluded = extractions.filter(e => e.user_validation_status === 'exclude');
        const pending = extractions.filter(e => !e.user_validation_status);

        const conflicts = extractions.filter(e => {
            try {
                const validations = JSON.parse(e.validations || '{}');
                return validations.evaluator1 && validations.evaluator2 && validations.evaluator1 !== validations.evaluator2;
            } catch {
                return false;
            }
        });

        container.innerHTML = `
            <div class="card">
                <div class="card__header"><h4>Statut de la Validation</h4></div>
                <div class="card__body metrics-grid">
                    <div class="metric-card"><h5 class="metric-value">${included.length}</h5><p>Inclus</p></div>
                    <div class="metric-card"><h5 class="metric-value">${excluded.length}</h5><p>Exclus</p></div>
                    <div class="metric-card"><h5 class="metric-value">${pending.length}</h5><p>En attente</p></div>
                </div>
            </div>

            <div class="card mt-24">
                <div class="card__header"><h4>Articles en attente de validation (${pending.length})</h4></div>
                <div class="card__body validation-list">
                    ${pending.length > 0 ? pending.map(renderValidationItem).join('') : '<p class="text-muted">Aucun article en attente.</p>'}
                </div>
            </div>

            <div class="card mt-24">
                <div class="card__header">
                    <h4>Articles Validés</h4>
                    <div class="button-group">
                        <button class="btn btn--sm" data-action="filter-validations" data-status="include">Voir Inclus (${included.length})</button>
                        <button class="btn btn--sm" data-action="filter-validations" data-status="exclude">Voir Exclus (${excluded.length})</button>
                    </div>
                </div>
                <div class="card__body validation-list" id="validatedListContainer"></div>
            </div>

            <div class="card mt-24">
                 <div class="card__header"><h4>Étape suivante : Extraction complète</h4></div>
                 <div class="card__body">
                     <p>Lancez une extraction détaillée sur les <strong>${included.length} article(s)</strong> que vous avez inclus.</p>
                     <button class="btn btn--primary" data-action="run-extraction-modal">Lancer l'extraction</button>
                 </div>
            </div>
        `;
        
        filterValidationList('include');

    } catch (e) {
        console.error('Erreur renderValidationSection:', e);
        container.innerHTML = '<p class="text-error">Erreur lors de l\'affichage de la section de validation.</p>';
    } finally {
        showLoadingOverlay(false);
    }
}

function renderConflictItem(extraction) {
    const article = appState.searchResults.find(art => art.article_id === extraction.pmid);
    const title = article?.title || extraction.title || 'Titre non disponible';
    const validations = JSON.parse(extraction.validations || '{}');

    return `
        <div class="validation-item validation-item--conflict">
            <div class="validation-item__info">
                <h4>${escapeHtml(title)}</h4>
                <div class="conflict-details">
                    <span class="decision-badge decision--${validations.evaluator1}">Éval 1: ${validations.evaluator1}</span>
                    <span class="decision-badge decision--${validations.evaluator2}">Éval 2: ${validations.evaluator2}</span>
                </div>
                <p><strong>Score IA:</strong> ${extraction.relevance_score != null ? extraction.relevance_score.toFixed(1) : 'N/A'}/10</p>
            </div>
            <div class="validation-item__actions">
                <p>Résoudre en choisissant :</p>
                <button class="btn btn--success btn--sm" data-action="validate-extraction" data-id="${extraction.id}" data-decision="include">✓ Inclure</button>
                <button class="btn btn--error btn--sm" data-action="validate-extraction" data-id="${extraction.id}" data-decision="exclude">✗ Exclure</button>
            </div>
        </div>
    `;
}

function renderValidationItem(extraction) {
    const article = appState.searchResults.find(art => art.article_id === extraction.pmid);
    const title = article?.title || extraction.title || 'Titre non disponible';
    let actionHtml;

    if (extraction.user_validation_status === 'include') {
        actionHtml = `<div class="status status--success">Inclus</div><button class="btn btn--sm" data-action="reset-validation" data-id="${extraction.id}">Annuler</button>`;
    } else if (extraction.user_validation_status === 'exclude') {
        actionHtml = `<div class="status status--error">Exclus</div><button class="btn btn--sm" data-action="reset-validation" data-id="${extraction.id}">Annuler</button>`;
    } else {
        actionHtml = `
            <button class="btn btn--success btn--sm" data-action="validate-extraction" data-id="${extraction.id}" data-decision="include">✓ Inclure</button>
            <button class="btn btn--error btn--sm" data-action="validate-extraction" data-id="${extraction.id}" data-decision="exclude">✗ Exclure</button>
        `;
    }

    return `
        <div class="validation-item" data-extraction-id="${extraction.id}">
            <div class="validation-item__info">
                <h4>${escapeHtml(title)}</h4>
                <p><strong>Score IA:</strong> ${extraction.relevance_score != null ? extraction.relevance_score.toFixed(1) : 'N/A'}/10 | <strong>Justification:</strong> ${escapeHtml(extraction.relevance_justification || 'Aucune')}</p>
            </div>
            <div class="validation-item__actions">${actionHtml}</div>
        </div>
    `;
}

export function filterValidationList(status) {
    const container = document.getElementById('validatedListContainer');
    if (!container) return;
    const filtered = appState.currentValidations.filter(e => e.user_validation_status === status);
    if (filtered.length === 0) {
        container.innerHTML = `<p class="text-muted">Aucun article dans cette catégorie.</p>`;
        return;
    }
    container.innerHTML = filtered.map(renderValidationItem).join('');
}

export async function resetValidationStatus(extractionId) {
    await handleValidateExtraction(extractionId, ''); 
}

export async function handleValidateExtraction(extractionId, decision) {
    if (!appState.currentProject?.id || !extractionId) return;
    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/extractions/${extractionId}/decision`, {
            method: 'PUT',
            body: { decision: decision, evaluator: 'evaluator1' }
        });
        await renderValidationSection(appState.currentProject);
        showToast('Décision mise à jour.', 'success');
    } catch (error) {
        showToast(`Erreur de validation : ${error.message}`, 'error');
    }
}

export async function loadValidationSection() {
    if (!appState.currentProject) {
        if (elements.validationContainer) {
            elements.validationContainer.innerHTML = '<p>Sélectionnez un projet pour voir les données de validation.</p>';
        }
        return;
    }
    const extractions = await fetchAPI(`/projects/${appState.currentProject.id}/extractions`);
    setCurrentValidations(extractions);
}