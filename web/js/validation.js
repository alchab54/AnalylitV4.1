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

async function handleValidateExtraction(extractionId, decision) {
    if (!appState.currentProject?.id || !extractionId) {
        showToast('Erreur : projet ou ID d\'extraction manquant.', 'error');
        return;
    }
    const buttonGroup = document.querySelector(`.validation-item[data-extraction-id="${extractionId}"] .validation-item__actions`);
    if (buttonGroup) buttonGroup.innerHTML = `<div class="loading-spinner"></div>`;

    try {
        // CORRECTION : Appel de la bonne route avec la bonne méthode (PUT)
        await fetchAPI(`/projects/${appState.currentProject.id}/extractions/${extractionId}/decision`, {
            method: 'PUT',
            body: {
                decision: decision,
                evaluator: 'evaluator1' // L'évaluateur est défini ici
            }
        });

        // Mise à jour de l'état local pour refléter le changement
        const extraction = appState.currentValidations.find(e => e.id === extractionId);
        if (extraction) {
            extraction.user_validation_status = decision;
        }

        // Mise à jour visuelle de l'interface sans recharger toute la page
        const validatedItem = document.querySelector(`.validation-item[data-extraction-id="${extractionId}"]`);
        if (validatedItem) {
            const statusBadge = document.createElement('div');
            statusBadge.className = `status status--${decision === 'include' ? 'success' : 'error'}`;
            statusBadge.textContent = decision === 'include' ? 'Inclus' : 'Exclus';
            if (buttonGroup) {
                buttonGroup.innerHTML = '';
                buttonGroup.appendChild(statusBadge);
            }
        }
        showToast('Validation enregistrée.', 'success');
    } catch (error) {
        console.error('Erreur validation extraction:', error);
        showToast(`Erreur de validation : ${error.message}`, 'error');
        // En cas d'erreur, on ré-affiche les boutons pour que l'utilisateur puisse réessayer
        if (buttonGroup) {
             buttonGroup.innerHTML = `<button class="btn btn--success btn--sm" onclick="handleValidateExtraction('${extractionId}', 'include')">✓ Inclure</button> <button class="btn btn--error btn--sm" onclick="handleValidateExtraction('${extractionId}', 'exclude')">✗ Exclure</button>`;
        }
    }
}

function renderValidationSection(kappaData) {
    if (!elements.validationContainer) return;

    const extractions = appState.currentValidations || [];
    const validatedCount = extractions.filter(ext => ext.user_validation_status).length;
    
    let kappaDisplay = '';
    if (kappaData && kappaData.kappa_result && kappaData.kappa_result !== "Non calculé") {
        try {
            const kappa = JSON.parse(kappaData.kappa_result);
            kappaDisplay = `
                <div class="kappa-result-display">
                    <strong>Coefficient Kappa:</strong> ${kappa.kappa?.toFixed(3) || 'N/A'} 
                    (${kappa.interpretation || 'Non interprété'})
                    <br>
                    <small>${kappa.n_comparisons || 0} comparaisons - Accord: ${(kappa.agreement_rate * 100)?.toFixed(1) || 0}%</small>
                </div>
            `;
        } catch (e) {
            kappaDisplay = `<div class="kappa-result-display">${kappaData.kappa_result}</div>`;
        }
    }

    const validationItemsHtml = extractions.map(extraction => {
        const article = appState.searchResults.find(art => art.article_id === extraction.pmid);
        const title = article?.title || extraction.title || 'Titre non disponible';
        
        return `
            <div class="validation-item" data-extraction-id="${extraction.id}">
                <div class="validation-item__info">
                    <h4>${escapeHtml(title)}</h4>
                    <p><strong>Score IA:</strong> ${extraction.relevance_score || 'N/A'}/10</p>
                    <p><strong>Justification:</strong> ${escapeHtml(extraction.relevance_justification || 'Aucune')}</p>
                </div>
                <div class="validation-item__actions">
                    <button class="btn btn--success btn--sm" onclick="validateExtraction('${extraction.id}', 'include')">
                        ✔ Inclure
                    </button>
                    <button class="btn btn--error btn--sm" onclick="validateExtraction('${extraction.id}', 'exclude')">
                        ✖ Exclure
                    </button>
                </div>
            </div>
        `;
    }).join('');

    elements.validationContainer.innerHTML = `
        <div class="validation-content">
            <div class="validation-stats">
                <div class="stat-card">
                    <h4>Statistiques de validation</h4>
                    <div class="metrics-grid">
                        <div class="metric-card">
                            <h5>Total</h5>
                            <div class="metric-value">${extractions.length}</div>
                        </div>
                        <div class="metric-card">
                            <h5>Validés</h5>
                            <div class="metric-value">${validatedCount}</div>
                        </div>
                        <div class="metric-card">
                            <h5>Restants</h5>
                            <div class="metric-value">${extractions.length - validatedCount}</div>
                        </div>
                    </div>
                    ${kappaDisplay}
                </div>
            </div>

            <div class="validation-actions">
                <h4>Actions de validation</h4>
                <div class="button-group">
                    <button class="btn btn--primary" onclick="exportValidations()">Exporter validations (CSV)</button>
                    <button class="btn btn--secondary" onclick="showImportValidationsModal()">Importer validations</button>
                    <button class="btn btn--secondary" onclick="calculateKappa()">Calculer Kappa</button>
                </div>
            </div>

            <div class="validation-list">
                <h4>Articles à valider (${extractions.length})</h4>
                ${extractions.length > 0 ? validationItemsHtml : '<p>Aucune extraction à valider.</p>'}
            </div>
        </div>
    `;
}

async function handleValidateExtraction(extractionId, decision) {
    if (!appState.currentProject?.id || !extractionId) {
        showToast('Erreur : projet ou ID d\'extraction manquant.', 'error');
        return;
    }
    const buttonGroup = document.querySelector(`.validation-item[data-extraction-id="${extractionId}"] .validation-item__actions`);
    if (buttonGroup) buttonGroup.innerHTML = `<div class="loading-spinner"></div>`;

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

        // Mettre à jour l'affichage
        const validatedItem = document.querySelector(`.validation-item[data-extraction-id="${extractionId}"]`);
        if (validatedItem) {
            const statusBadge = document.createElement('div');
            statusBadge.className = `status status--${decision === 'include' ? 'success' : 'error'}`;
            statusBadge.textContent = decision === 'include' ? 'Inclus' : 'Exclus';
            buttonGroup.innerHTML = '';
            buttonGroup.appendChild(statusBadge);
        }
        showToast('Validation enregistrée.', 'success');
    } catch (error) {
        console.error('Erreur validation extraction:', error);
        showToast(`Erreur lors de la validation : ${error.message}`, 'error');
        // Restaurer les boutons en cas d'erreur
        if (buttonGroup) {
             buttonGroup.innerHTML = `<button class="btn btn--success btn--sm" onclick="handleValidateExtraction('${extractionId}', 'include')">✓ Inclure</button> <button class="btn btn--error btn--sm" onclick="handleValidateExtraction('${extractionId}', 'exclude')">✗ Exclure</button>`;
        }
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