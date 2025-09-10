// web/js/validation.js
async function renderValidationSection(project) {
    const container = document.getElementById('validationContainer');
    if (!container || !project) return;

    showLoadingOverlay(true, 'Chargement des validations...');
    try {
        await Promise.all([
            loadProjectExtractions(project.id),
            loadProjectGrids(project.id)
        ]);
        
        const extractions = appState.currentValidations || [];
        const included = extractions.filter(e => e.user_validation_status === 'include');
        const excluded = extractions.filter(e => e.user_validation_status === 'exclude');
        const pending = extractions.filter(e => !e.user_validation_status);

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
                        <button class="btn btn--sm" onclick="filterValidationList('include')">Voir Inclus (${included.length})</button>
                        <button class="btn btn--sm" onclick="filterValidationList('exclude')">Voir Exclus (${excluded.length})</button>
                    </div>
                </div>
                <div class="card__body validation-list" id="validatedListContainer"></div>
            </div>

            <div class="card mt-24">
                 <div class="card__header"><h4>Étape suivante : Extraction complète</h4></div>
                 <div class="card__body">
                     <p>Lancez une extraction détaillée sur les <strong>${included.length} article(s)</strong> que vous avez inclus.</p>
                     <button class="btn btn--primary" id="runFullExtractionBtn">Lancer l'extraction</button>
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

function renderValidationItem(extraction) {
    const article = appState.searchResults.find(art => art.article_id === extraction.pmid);
    const title = article?.title || extraction.title || 'Titre non disponible';
    let actionHtml;

    if (extraction.user_validation_status === 'include') {
        actionHtml = `<div class="status status--success">Inclus</div><button class="btn btn--sm" onclick="resetValidationStatus('${extraction.id}')">Annuler</button>`;
    } else if (extraction.user_validation_status === 'exclude') {
        actionHtml = `<div class="status status--error">Exclus</div><button class="btn btn--sm" onclick="resetValidationStatus('${extraction.id}')">Annuler</button>`;
    } else {
        actionHtml = `
            <button class="btn btn--success btn--sm" onclick="handleValidateExtraction('${extraction.id}', 'include')">✓ Inclure</button>
            <button class="btn btn--error btn--sm" onclick="handleValidateExtraction('${extraction.id}', 'exclude')">✗ Exclure</button>
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

function filterValidationList(status) {
    const container = document.getElementById('validatedListContainer');
    if (!container) return;
    const filtered = appState.currentValidations.filter(e => e.user_validation_status === status);
    if (filtered.length === 0) {
        container.innerHTML = `<p class="text-muted">Aucun article dans cette catégorie.</p>`;
        return;
    }
    container.innerHTML = filtered.map(renderValidationItem).join('');
}

async function resetValidationStatus(extractionId) {
    await handleValidateExtraction(extractionId, ''); 
}

async function handleValidateExtraction(extractionId, decision) {
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

window.validateExtraction = handleValidateExtraction;
window.filterValidationList = filterValidationList;
window.resetValidationStatus = resetValidationStatus;