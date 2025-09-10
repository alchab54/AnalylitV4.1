// ============================
// Validation Section
// ============================

async function loadValidationSection() {
    if (!appState.currentProject) {
        if (elements.validationContainer) {
            elements.validationContainer.innerHTML = '<p>Sélectionnez un projet pour voir les données de validation.</p>';
        }
        return;
    }
    
    try {
        const extractions = await fetchAPI(`/projects/${appState.currentProject.id}/extractions`);
        appState.currentValidations = extractions || [];
        renderValidationSection();
    } catch (e) {
        console.error('Erreur chargement validation:', e);
        showToast('Erreur lors du chargement de la validation', 'error');
    }
}

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
                <div class="card__header">
                    <h4>Statut de la Validation</h4>
                </div>
                <div class="card__body metrics-grid">
                    <div class="metric-card">
                        <h5>Inclus</h5>
                        <div class="metric-value">${included.length}</div>
                    </div>
                    <div class="metric-card">
                        <h5>Exclus</h5>
                        <div class="metric-value">${excluded.length}</div>
                    </div>
                    <div class="metric-card">
                        <h5>En attente</h5>
                        <div class="metric-value">${pending.length}</div>
                    </div>
                </div>
            </div>

            <div class="card mt-24">
                <div class="card__header">
                    <h4>Articles Validés</h4>
                    <div class="button-group">
                        <button class="btn btn--sm" onclick="filterValidationList('included')">Voir Inclus</button>
                        <button class="btn btn--sm" onclick="filterValidationList('excluded')">Voir Exclus</button>
                    </div>
                </div>
                <div class="card__body" id="validatedListContainer">
                    </div>
            </div>

            <div class="card mt-24">
                 <div class="card__header"><h4>Étape suivante : Extraction complète</h4></div>
                 <div class="card__body">
                     <p>Lancez une extraction détaillée sur les <strong>${included.length} article(s)</strong> que vous avez inclus.</p>
                     <button class="btn btn--primary" id="runFullExtractionBtn">Lancer l'extraction</button>
                 </div>
            </div>
        `;
        
        // Afficher la liste des inclus par défaut
        filterValidationList('included');

    } catch (e) {
        console.error('Erreur renderValidationSection:', e);
        container.innerHTML = '<p class="text-error">Erreur lors de l\'affichage de la section de validation.</p>';
    } finally {
        showLoadingOverlay(false);
    }
}

function filterValidationList(status) {
    const container = document.getElementById('validatedListContainer');
    if (!container) return;

    const filteredArticles = appState.currentValidations.filter(e => e.user_validation_status === status);

    if (filteredArticles.length === 0) {
        container.innerHTML = `<p class="text-muted">Aucun article dans cette catégorie.</p>`;
        return;
    }

    const listHtml = filteredArticles.map(extraction => {
        const article = appState.searchResults.find(art => art.article_id === extraction.pmid);
        const title = article?.title || extraction.title || 'Titre non disponible';
        return `
            <div class="validation-item">
                <div class="validation-item__info">
                    <h4>${escapeHtml(title)}</h4>
                </div>
                <div class="validation-item__actions">
                    <button class="btn btn--secondary btn--sm" onclick="resetValidationStatus('${extraction.id}')">Annuler la décision</button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = listHtml;
}

async function resetValidationStatus(extractionId) {
    if (!confirm("Êtes-vous sûr de vouloir annuler cette décision ? L'article retournera dans la liste de validation.")) {
        return;
    }
    // Appel à la même fonction de validation avec une décision vide
    await handleValidateExtraction(extractionId, ''); 
    // Recharger la section pour mettre à jour les compteurs et les listes
    await renderValidationSection(appState.currentProject);
}

async function handleValidateExtraction(extractionId, decision) {
    if (!appState.currentProject?.id || !extractionId) {
        showToast('Erreur : projet ou ID d\'extraction manquant.', 'error');
        return;
    }

    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/extractions/${extractionId}/decision`, {
            method: 'PUT',
            body: {
                decision: decision,
                evaluator: 'evaluator1'
            }
        });

        // Mettre à jour l'état local
        const extraction = appState.currentValidations.find(e => e.id === extractionId);
        if (extraction) {
            extraction.user_validation_status = decision;
        }
        
        // Re-afficher la section pour mettre à jour les compteurs et listes
        await renderValidationSection(appState.currentProject);
        showToast('Validation enregistrée.', 'success');

    } catch (error) {
        console.error('Erreur validation extraction:', error);
        showToast(`Erreur de validation : ${error.message}`, 'error');
    }
}
function showImportValidationsModal() {
    const content = `
        <form onsubmit="handleImportValidations(event)">
            <div class="form-group">
                <label class="form-label">Fichier CSV des validations</label>
                <input type="file" name="validations_file" accept=".csv" class="form-control" required>
                <div class="form-text">
                    Le fichier doit contenir les colonnes: articleId, decision
                </div>
            </div>
            <div class="modal__actions">
                <button type="button" class="btn btn--secondary" onclick="closeModal('genericModal')">Annuler</button>
                <button type="submit" class="btn btn--primary">Importer</button>
            </div>
        </form>
    `;
    showModal('Importer des validations', content);
}

async function handleImportValidations(event) {
    event.preventDefault();
    const form = event.target;
    const fileInput = form.querySelector('input[type="file"]');
    if (!fileInput.files[0]) {
        showToast('Veuillez sélectionner un fichier.', 'warning');
        return;
    }
    const formData = new FormData();
    formData.append('validations_file', fileInput.files[0]);
    
    try {
        closeModal('genericModal');
        showLoadingOverlay(true, 'Import des validations...');
        
        await fetchAPI(`/projects/${appState.currentProject.id}/import-validations`, {
            method: 'POST',
            body: formData
        });
        
        showToast('Validations importées avec succès', 'success');
        await loadValidationSection();
    } catch (e) {
        showToast(`Erreur lors de l'import: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

async function exportValidations() {
    if (!appState.currentProject?.id) {
        showToast('Sélectionnez un projet pour exporter.', 'warning');
        return;
    }
    try {
        window.open(`/api/projects/${appState.currentProject.id}/export-validations`);
        showToast('Export des validations lancé', 'info');
    } catch (e) {
        showToast(`Erreur lors de l'export: ${e.message}`, 'error');
    }
}

async function calculateKappa() {
    if (!appState.currentProject?.id) {
        showToast('Sélectionnez un projet pour calculer Kappa.', 'warning');
        return;
    }
    try {
        showLoadingOverlay(true, 'Calcul du coefficient Kappa...');
        
        const result = await fetchAPI(`/projects/${appState.currentProject.id}/calculate-kappa`, {
            method: 'POST'
        });
        
        showToast('Calcul du Kappa terminé', 'success');
        await loadValidationSection(); 
        if(result) {
            renderValidationSection(result);
        }

    } catch (e) {
        showToast(`Erreur lors du calcul: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

window.validateExtraction = handleValidateExtraction;
window.filterValidationList = filterValidationList;
window.resetValidationStatus = resetValidationStatus;