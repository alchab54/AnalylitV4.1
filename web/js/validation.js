// web/js/validation.js
import { appState, elements } from './app-improved.js';
import { fetchAPI } from './api.js';
import { showLoadingOverlay, escapeHtml } from './ui-improved.js';
import { showToast } from './toast.js';
import { API_ENDPOINTS, MESSAGES, SELECTORS } from './constants.js';
import { loadProjectGrids } from './grids.js';
import { setCurrentValidations } from './state.js';

// CORRIGÉ: Ajout des exports manquants
export async function handleValidateExtraction(extractionId, decision) {
    if (!appState.currentProject?.id || !extractionId) return;
    
    try {
        // Utiliser l'évaluateur actif depuis l'état de l'application
        const activeEvaluator = appState.activeEvaluator || 'evaluator1'; // Default to evaluator1 if not set

        await fetchAPI(API_ENDPOINTS.projectExtractionDecision(appState.currentProject.id, extractionId), {
            method: 'PUT',
            body: { decision: decision, evaluator: activeEvaluator }
        });
        
        await loadValidationSection();
        showToast(MESSAGES.decisionUpdated, 'success');
    } catch (error) {
        showToast(`${MESSAGES.validationError} : ${error.message}`, 'error');
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
        const validationContainer = document.querySelector(SELECTORS.validationContainer);
        if (validationContainer) {
            validationContainer.innerHTML = `
                <div class="section-empty">
                    <h3>${MESSAGES.noProjectSelectedValidation}</h3>
                    <p>${MESSAGES.selectProjectForValidation}</p>
                </div>`;
        }
        return;
    }
    
    await loadProjectExtractions(appState.currentProject.id);
}

async function loadProjectExtractions(projectId) {
    if (!appState.currentProject) return;
    
    const extractions = await fetchAPI(API_ENDPOINTS.projectExtractions(projectId));
    setCurrentValidations(extractions);
}

export async function renderValidationSection(project) {
    const container = document.querySelector(SELECTORS.validationContainer);
    if (!container || !project) {
        if(container) container.innerHTML = `
            <div class="section-empty">
                <h3>${MESSAGES.noProjectSelectedValidation}</h3>
                <p>${MESSAGES.selectProjectForValidation}</p>
            </div>`;
        return;
    }

    showLoadingOverlay(true, MESSAGES.loadingValidations);

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
                    <h2>${MESSAGES.validationSectionTitle}</h2>
                    <button class="btn btn--secondary" data-action="calculate-kappa">
                        ${MESSAGES.calculateKappaButton}
                    </button>
                    <div class="evaluator-selection">
                        <label for="activeEvaluator">${MESSAGES.activeEvaluator}</label>
                        <select id="activeEvaluator" class="form-select">
                            <option value="evaluator1" ${appState.activeEvaluator === 'evaluator1' ? 'selected' : ''}>${MESSAGES.evaluator1}</option>
                            <option value="evaluator2" ${appState.activeEvaluator === 'evaluator2' ? 'selected' : ''}>${MESSAGES.evaluator2}</option>
                        </select>
                    </div>
                    <div class="validation-stats">
                        <div class="stat-item stat-item--included">
                            <span class="stat-value">${included.length}</span>
                            <span class="stat-label">${MESSAGES.included}</span>
                        </div>
                        <div class="stat-item stat-item--excluded">
                            <span class="stat-value">${excluded.length}</span>
                            <span class="stat-label">${MESSAGES.excluded}</span>
                        </div>
                        <div class="stat-item stat-item--pending">
                            <span class="stat-value">${pending.length}</span>
                            <span class="stat-label">${MESSAGES.pending}</span>
                        </div>
                    </div>
                </div>

                <div class="validation-filters">
                    <button class="filter-btn filter-btn--active" data-action="filter-validations" data-status="all">
                        ${MESSAGES.all}
                    </button>
                    <button class="filter-btn" data-action="filter-validations" data-status="include">
                        ${MESSAGES.included} (${included.length})
                    </button>
                    <button class="filter-btn" data-action="filter-validations" data-status="exclude">  
                        ${MESSAGES.excluded} (${excluded.length})
                    </button>
                    <button class="filter-btn" data-action="filter-validations" data-status="pending">
                        ${MESSAGES.pending} (${pending.length})
                    </button>
                </div>

                ${included.length > 0 ? `
                    <div class="extraction-launch">
                        <h4>${MESSAGES.launchFullExtraction}</h4>
                        <p>${MESSAGES.launchFullExtractionDescription(included.length)}</p>
                        <button class="btn btn--primary" data-action="run-extraction-modal">
                            ${MESSAGES.launchExtractionButton}
                        </button>
                    </div>
                ` : ''}

                <div class="validation-list">
                    ${extractions.map(extraction => renderValidationItem(extraction)).join('')}
                </div>
            </div>`;

        // Add event listener for activeEvaluator dropdown
        const activeEvaluatorSelect = container.querySelector('#activeEvaluator');
        if (activeEvaluatorSelect) {
            activeEvaluatorSelect.addEventListener('change', (event) => {
                appState.activeEvaluator = event.target.value;
                loadValidationSection(); // Re-render the section with the new active evaluator
            });
        }

        // Add event listener for Calculate Kappa button
        const calculateKappaButton = container.querySelector('[data-action="calculate-kappa"]');
        if (calculateKappaButton) {
            calculateKappaButton.addEventListener('click', async () => {
                await calculateKappa();
            });
        }

    } catch (e) {
        container.innerHTML = `
            <div class="error-state">
                <h3>${MESSAGES.validationErrorTitle}</h3>
                <p>${MESSAGES.errorDisplayingValidation}</p>
            </div>`;
    } finally {
        showLoadingOverlay(false);
    }
}

function renderValidationItem(extraction) {
    const article = appState.searchResults.find(art => art.article_id === extraction.pmid);
    const title = article?.title || extraction.title || MESSAGES.titleUnavailable;
    
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
                    <strong>${MESSAGES.justification}</strong> ${escapeHtml(extraction.relevance_justification || MESSAGES.none)}
                </p>
                
                <div class="validation-item__actions">
                    <button class="btn btn--sm btn--success" 
                            data-action="validate-extraction" 
                            data-id="${extraction.id}" 
                            data-decision="include">
                        ${MESSAGES.includeButton}
                    </button>
                    <button class="btn btn--sm btn--danger" 
                            data-action="validate-extraction" 
                            data-id="${extraction.id}" 
                            data-decision="exclude">
                        ${MESSAGES.excludeButton}
                    </button>
                    <button class="btn btn--sm btn--secondary" 
                            data-action="reset-validation" 
                            data-id="${extraction.id}">
                        ${MESSAGES.resetButton}
                    </button>
                </div>
            </div>
        </div>`;
}

// New function to calculate Kappa
export async function calculateKappa() {
    if (!appState.currentProject?.id) {
        showToast(MESSAGES.selectProjectForKappa, 'error');
        return;
    }

    showLoadingOverlay(true, MESSAGES.calculatingKappa);
    try {
        const response = await fetchAPI(API_ENDPOINTS.projectCalculateKappa(appState.currentProject.id), {
            method: 'POST'
        });
        if (response.success) {
            showToast(MESSAGES.kappaCalculationStarted(response.task_id), 'success');
        } else {
            showToast(MESSAGES.errorCalculatingKappa(response.message), 'error');
        }
    } catch (error) {
        showToast(MESSAGES.errorApiKappa(error.message), 'error');
    } finally {
        showLoadingOverlay(false);
    }
}