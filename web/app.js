// ================================================================
// AnalyLit V4.1 - Application Frontend (Version finale consolidée)
// ================================================================
import { fetchAPI } from './js/api.js';
import { loadProjects, handleCreateProject, renderProjectList, renderProjectSynthesis, renderProjectDetail, selectProject, deleteProject } from './js/projects.js';
import { loadProjectAnalyses, exportAnalyses, renderAnalysesSection, runProjectAnalysis, renderDiscussionDraft, renderKnowledgeGraph, initializeKnowledgeGraph, renderPrismaFlow, renderGenericAnalysisResult, handleRunDiscussionDraft, handleRunKnowledgeGraph, handleRunPrismaFlow, handleRunMetaAnalysis, handleRunDescriptiveStats } from './js/analyses.js';
import { loadSearchResults, handleDeleteSelectedArticles, selectAllArticles, showBatchProcessModal, startBatchProcessing, showRunExtractionModal, startFullExtraction, toggleSelectAll } from './js/articles.js';
import { loadRobSection, fetchAndDisplayRob, getBiasClass, handleRunRobAnalysis, getRobDomainFromKey } from './js/rob.js';
import { loadChatMessages, renderChatMessages, renderChatSection, sendChatMessage } from './js/chat.js';
const appState = {
    currentProject: null,
    projects: [],
    searchResults: [],
    searchResultsMeta: {},
    analysisProfiles: [],
    ollamaModels: [],
    prompts: [],
    currentProjectGrids: [],
    currentProjectExtractions: [],
    currentProjectChatHistory: [],
    socketConnected: false,
    currentSection: 'projects',
    socket: null,
    availableDatabases: [],
    notifications: [],
    unreadNotifications: 0,
    analysisResults: {},
    chatMessages: [],
    currentValidations: [],
    queuesInfo: [],
    selectedSearchResults: new Set()
};

let elements = {};

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Démarrage de AnalyLit V4.1 Frontend...');
    
    // Initialisation des éléments DOM
    Object.assign(elements, {
        sections: document.querySelectorAll('.section'),
        navButtons: document.querySelectorAll('.app-nav__button'),
        connectionStatus: document.querySelector('[data-connection-status]'),
        projectsList: document.getElementById('projectsList'),
        createProjectBtn: document.getElementById('createProjectBtn'),
        projectDetail: document.getElementById('projectDetail'),
        projectDetailContent: document.getElementById('projectDetailContent'),
        projectPlaceholder: document.getElementById('projectPlaceholder'),
        resultsContainer: document.getElementById('resultsContainer'),
        validationContainer: document.getElementById('validationContainer'),
        analysisContainer: document.getElementById('analysisContainer'),
        importContainer: document.getElementById('importContainer'),
        chatContainer: document.getElementById('chatContainer'),
        settingsContainer: document.getElementById('settingsContainer'),
        robContainer: document.getElementById('robContainer'),
        modalsContainer: document.getElementById('modalsContainer'),
        loadingOverlay: document.getElementById('loadingOverlay'),
        toastContainer: document.getElementById('toastContainer'),
        zoteroFileInput: document.getElementById('zoteroFileInput'),
        bulkPDFInput: document.getElementById('bulkPDFInput'),
        runIndexingBtn: document.getElementById('runIndexingBtn'),
        importZoteroPdfsBtn: document.getElementById('importZoteroPdfsBtn'),
        
    });

    setupEventListeners();
    initializeApplication();
});



async function handleRunIndexing() {
    if (!appState.currentProject?.id) {
        showToast('Aucun projet sélectionné.', 'warning');
        return;
    }

    try {
        showLoadingOverlay(true, 'Lancement de l\'indexation des PDFs...');
        await fetchAPI(`/projects/${appState.currentProject.id}/index-pdfs`, {
            method: 'POST'
        });
        showToast('L\'indexation des PDFs a été lancée en arrière-plan.', 'info');
    } catch (e) {
        showToast(`Erreur lors du lancement de l\'indexation: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}



async function loadProjectFilesSet(projectId) {
    if (!projectId) return new Set();
    try {
        const files = await fetchAPI(`/projects/${projectId}/files`);
        const filenames = (files || []).map(f => String(f.filename || '').replace(/\.pdf$/i, ''));
        return new Set(filenames);
    } catch (error) {
        console.error('Erreur chargement des fichiers projet:', error);
        return new Set();
    }
}

async function loadAnalysisProfiles() {
    appState.analysisProfiles = await fetchAPI('/profiles');
}

async function loadPrompts() {
    appState.prompts = await fetchAPI('/prompts');
}

async function loadOllamaModels() {
    appState.ollamaModels = await fetchAPI('/ollama/models');
}

async function loadAvailableDatabases() {
    appState.availableDatabases = await fetchAPI('/databases');
}

function showSection(sectionId) {
    appState.currentSection = sectionId;

    elements.sections.forEach(section => {
        section.classList.toggle('section--active', section.dataset.section === sectionId);
    });

    elements.navButtons.forEach(btn => {
        btn.classList.toggle('app-nav__button--active', btn.dataset.section === sectionId);
    });

    // Charger les données spécifiques à la section si nécessaire
    refreshCurrentSection();
}

function refreshCurrentSection() {
    switch (appState.currentSection) {
        case 'projects':
            if (appState.currentProject) {
                renderProjectDetail(appState.currentProject);
            }
            break;
        case 'results':
            loadSearchResults();
            break;
        case 'validation':
            loadValidationSection();
            break;
        case 'grids':
            renderGridsSection(appState.currentProject);
            break;
        case 'rob':
            loadRobSection();
            break;
        case 'analyses':
            loadProjectAnalyses();
            break;
        case 'import':
            renderImportSection();
            break;
        case 'chat':
            loadChatMessages();
            break;
        case 'settings':
            renderSettings();
            break;
        case 'reporting':
            renderReportingSection(appState.currentProject?.id);
            break;
        case 'search':
            renderSearchSection(appState.currentProject);
            break;
        default:
            // Ne rien faire pour les sections inconnues
            break;
    }
}


// ============================ 
// WebSocket Management
// ============================ 
function initializeWebSocket() {
    try {
        if (typeof io !== 'function') {
            console.warn('Client Socket.IO indisponible.');
            if (elements.connectionStatus) elements.connectionStatus.textContent = '❌';
            return;
        }
        
        appState.socket = io({ path: '/socket.io/' });
        
        appState.socket.on('connect', () => {
            console.log('✅ WebSocket connecté');
            appState.socketConnected = true;
            if (elements.connectionStatus) elements.connectionStatus.textContent = '✅';
            if (appState.currentProject) {
                appState.socket.emit('join_room', { room: appState.currentProject.id });
            }
        });
        
        appState.socket.on('disconnect', () => {
            console.warn('🔌 WebSocket déconnecté.');
            appState.socketConnected = false;
            if (elements.connectionStatus) elements.connectionStatus.textContent = '⏳';
        });
        
        appState.socket.on('notification', (data) => {
            console.log('🔔 Notification reçue:', data);
            handleWebSocketNotification(data);
        });
    } catch (e) {
        console.error('Erreur WebSocket:', e);
        if (elements.connectionStatus) elements.connectionStatus.textContent = '❌';
    }
}

function handleWebSocketNotification(data) {
    showToast(data.message, data.type || 'info');
    appState.unreadNotifications++;
    updateNotificationIndicator();

    const { type, project_id } = data;

    // Si la notification concerne le projet actuellement ouvert
    if (project_id && project_id === appState.currentProject?.id) {
        // Fusionner directement les nouvelles données reçues
        if (data.discussion_draft) {
            appState.currentProject.discussion_draft = data.discussion_draft;
        }
        if (data.knowledge_graph) {
            appState.currentProject.knowledge_graph = data.knowledge_graph;
        }
        if (data.prisma_flow_path) {
            appState.currentProject.prisma_flow_path = data.prisma_flow_path;
        }

        // Rafraîchir la section actuellement affichée avec les nouvelles données
        if (appState.currentSection === 'analyses') {
            renderAnalysesSection();
        } else {
            refreshCurrentProjectData(); // Fallback pour les autres sections
        }
        
    } else if (project_id) {
        // Si la notif concerne un autre projet, on met juste la liste à jour
        loadProjects().then(renderProjectList);
    }
}


async function refreshCurrentProjectData() {
    if (!appState.currentProject?.id) return; 
    
    try {
        const updatedProject = await fetchAPI(`/projects/${appState.currentProject.id}`);
        Object.assign(appState.currentProject, updatedProject);
        
        // Rafraîchir selon la section courante
        switch (appState.currentSection) {
            case 'projects':
                await loadProjects();
                renderProjectList();
                renderProjectDetail(appState.currentProject);
                break;
            case 'results':
                await loadSearchResults();
                break;
            case 'analyses':
                await loadProjectAnalyses();
                break;
            case 'chat':
                await loadChatMessages();
                break;
            case 'validation':
                await loadValidationSection();
                break;
            case 'grids':
                renderGridsSection(appState.currentProject);
                break;
            case 'rob':
                await loadRobSection();
                break;
        }
    } catch (e) {
        console.error('Erreur refresh project data:', e);
    }
}

// ============================ 
// UI rendering
// ============================ 




async function loadProjectFilesSet() {
  if (!appState.currentProject?.id) {
    appState.currentProjectFiles = new Set();
    return;
  }
  const files = await fetchAPI(`/projects/${appState.currentProject.id}/files`);
  const stems = (files || []).map(f => String(f.filename || '')
    .replace(/\.pdf$/i, '')
    .toLowerCase());
  appState.currentProjectFiles = new Set(stems);
}









// CORRECTION : Fonction pour valider manuellement un article
async function validateArticle(articleId, decision) {
    if (!appState.currentProject?.id) {
        showToast('Sélectionnez un projet', 'warning');
        return;
    }

    try {
        showLoadingOverlay(true, 'Validation en cours...');
        
        const response = await fetchAPI(`/projects/${appState.currentProject.id}/validate-article`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                article_id: articleId,
                decision: decision,
                score: decision === 'include' ? 8 : 2, // Note: score arbitraire pour la validation manuelle
                justification: decision === 'include' ? 'Article validé manuellement comme pertinent' : 'Article exclu manuellement'
            })
        });

        showToast(`Article ${decision === 'include' ? 'inclus' : 'exclu'}.`, 'success');
        
        // Rafraîchir les données
        await loadSearchResults();
        
    } catch (e) {
        console.error('Erreur validation article:', e);
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}



// ============================ 
// Import Section
// ============================ 
function renderImportSection() {
    if (!elements.importContainer) return; 
    
    if (!appState.currentProject) {
        elements.importContainer.innerHTML = `
            <div class="empty-state">
                <p>Sélectionnez un projet pour importer des fichiers.</p>
            </div>
        `;
        return;
    }

    elements.importContainer.innerHTML = `
        <div class="import-section">
            <h2>Import & Fichiers</h2>
            
            <div class="import-sources">
                <div class="import-card">
                    <h3>📚 Importer un export Zotero (.json)</h3>
                    <p>Chargez un fichier d\'export Zotero pour ajouter des références.</p>
                    <input type="file" id="zoteroFileInput" accept=".json" style="display: none;">
                    <button class="btn btn--primary" onclick="document.getElementById('zoteroFileInput').click()">
                        Choisir fichier JSON
                    </button>
                </div>
                
                <div class="import-card">
                    <h3>📄 Uploader des PDFs (jusqu\'à 20)</h3>
                    <p>Ces PDFs seront liés au projet courant.</p>
                    <input type="file" id="bulkPDFInput" accept=".pdf" multiple style="display: none;">
                    <button class="btn btn--primary" onclick="document.getElementById('bulkPDFInput').click()">
                        Choisir PDFs
                    </button>
                </div>
                
                <div class="import-card">
                    <h3>🔍 Indexer les PDFs pour le Chat RAG</h3>
                    <p>Permettra de poser des questions au corpus.</p>
                    <button class="btn btn--primary" id="runIndexingBtn">
                        Indexer maintenant
                    </button>
                </div>
                
                <div class="import-card">
                    <h3>🌐 Récupération automatique de PDFs</h3>
                    <p>Recherche automatique via Unpaywall pour les articles avec DOI.</p>
                    <button class="btn btn--secondary" onclick="handleFetchOnlinePDFs()">
                        Lancer recherche
                    </button>
                </div>
                
                <div class="import-card">
                    <h3>📝 Ajouter des articles manuellement</h3>
                    <p>Saisissez des identifiants d\'articles (PMID, DOI, ArXiv ID) séparés par des retours à la ligne.</p>
                    <button class="btn btn--secondary" onclick="showAddManualArticlesModal()">
                        Ajouter articles
                    </button>
                </div>
            </div>
        </div>
    `;
}

// ============================ 
// Chat Section
// ============================ 




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





function updateNotificationIndicator() {
    const indicator = document.querySelector('.notification-indicator');
    if (indicator) {
        indicator.textContent = appState.unreadNotifications;
        indicator.style.display = appState.unreadNotifications > 0 ? 'block' : 'none';
    }
}

function clearNotifications() {
  // Réinitialise le compteur et la liste en mémoire
  appState.unreadNotifications = 0;
  appState.notifications = [];
  updateNotificationIndicator();

  // Optionnel : vide un éventuel panneau de liste s'il existe
  const panel = document.getElementById('notificationsPanel');
  if (panel) {
    const list = panel.querySelector('.notifications-list');
    if (list) list.innerHTML = '';
  }
}

function renderValidationSection(kappaData) {
    if (!elements.validationContainer) return;

    const extractions = appState.currentValidations || [];
    const validatedCount = extractions.filter(ext => ext.user_validation_status).length;
    
    let kappaDisplay = '';
    if (kappaData && kappaData.kappa_result && kappaData.kappa_result !== "Non calculÃƒÂ©") {
        try {
            const kappa = JSON.parse(kappaData.kappa_result);
            kappaDisplay = `
                <div class="kappa-result-display">
                    <strong>Coefficient Kappa:</strong> ${kappa.kappa?.toFixed(3) || 'N/A'} 
                    (${kappa.interpretation || 'Non interprÃƒÂ©tÃƒÂ©'})
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
                        Ã¢Å“â€œ Inclure
                    </button>
                    <button class="btn btn--error btn--sm" onclick="validateExtraction('${extraction.id}', 'exclude')">
                        Ã¢Å“â€” Exclure
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
                            <h5>ValidÃƒÂ©s</h5>
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
                <h4>Articles Ãƒ  valider (${extractions.length})</h4>
                ${extractions.length > 0 ? validationItemsHtml : '<p>Aucune extraction Ãƒ  valider.</p>'}
            </div>
        </div>
    `;
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
                <button type="button" class="btn btn--secondary" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn--primary">Importer</button>
            </div>
        </form>
    `;
    showModal('Ã°Å¸â€œÂ¥ Importer des validations', content);
}

async function handleImportValidations(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    
    try {
        closeModal();
        showLoadingOverlay(true, 'Import des validations...');
        
        await fetchAPI(`/projects/${appState.currentProject.id}/import-validations`, {
            method: 'POST',
            body: formData
        });
        
        showToast('Validations importÃƒÂ©es avec succÃƒÂ¨s', 'success');
        await loadValidationSection();
    } catch (e) {
        showToast(`Erreur lors de l\'import: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

async function exportValidations() {
    try {
        window.open(`/api/projects/${appState.currentProject.id}/export-validations`);
        showToast('Export des validations lancÃƒÂ©', 'success');
    } catch (e) {
        showToast(`Erreur lors de l\'export: ${e.message}`, 'error');
    }
}

async function calculateKappa() {
    try {
        showLoadingOverlay(true, 'Calcul du coefficient Kappa...');
        
        await fetchAPI(`/projects/${appState.currentProject.id}/calculate-kappa`, {
            method: 'POST'
        });
        
        showToast('Calcul du Kappa lancÃƒÂ©', 'success');
        // Recharger aprÃƒÂ¨s un dÃƒÂ©lai pour laisser le temps au calcul
        setTimeout(() => loadValidationSection(), 2000);
    } catch (e) {
        showToast(`Erreur lors du calcul: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}




async function handleBulkActions() {
    const selectedIds = Array.from(appState.selectedSearchResults);
    const profileId = document.getElementById('bulkAnalysisProfile').value;
    const analysisMode = 'screening'; // Ou un autre mode si vous l'ajoutez
    
    if (selectedIds.length === 0 || !profileId) {
        showToast('Aucun article ou profil sélectionné.', 'warning');
        return;
    }

    closeModal('bulkActionsModal');
    showLoadingOverlay(true, `Lancement du traitement pour ${selectedIds.length} article(s)...`);

    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/bulk-process`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                article_ids: selectedIds,
                profile_id: profileId,
                analysis_mode: analysisMode
            })
        });
        showToast(`Traitement par lot lancé pour ${selectedIds.length} articles.`, 'success');
        appState.selectedSearchResults.clear(); // Vider la sélection
        // Recharger pour voir la progression
        loadSearchResults();
    } catch (e) {
        showToast(`Erreur lors du lancement du traitement par lot: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

async function renderSettings() {
    if (!elements.settingsContainer) return;
    const queuesHtml = await renderQueuesStatus();
    elements.settingsContainer.innerHTML = `
        <div class="settings-grid">
            <div class="settings-card">
                <div class="settings-card__header">
                    <h4>⚙️ Profils d'analyse</h4>
                </div>
                <div class="settings-card__content">
                    <p>Gérez les profils de modèles IA utilisés pour l'analyse.</p>
                    ${renderAnalysisProfiles()}
                </div>
            </div>

            <div class="settings-card">
                <div class="settings-card__header">
                    <h4>📝 Prompts</h4>
                </div>
                <div class="settings-card__content">
                    <p>Modifiez les templates de prompts utilisés par l'IA.</p>
                    ${renderPrompts()}
                </div>
            </div>

            <div class="settings-card">
                <div class="settings-card__header">
                    <h4>🤖 Modèles Ollama</h4>
                </div>
                <div class="settings-card__content">
                    <p>Téléchargez et gérez les modèles de langage locaux.</p>
                    ${renderOllamaModels()}
                </div>
            </div>

            <div class="settings-card">
                <div class="settings-card__header">
                    <h4>🔧 Files de tâches</h4>
                </div>
                <div class="settings-card__content">
                    <p>Statut des queues de traitement.</p>
                    ${queuesHtml}
                </div>
            </div>
        </div>
    `;
}

function renderAnalysisProfiles() {
    const profiles = appState.analysisProfiles || [];
    if (profiles.length === 0) {
        return '<p>Aucun profil disponible.</p>';
    }

    return `
        <div class="profiles-grid">
            ${profiles.map(profile => `
                <div class="profile-card">
                    <h5>${escapeHtml(profile.name)}</h5>
                    <div class="profile-models">
                        <div class="model-item">
                            <span class="model-label">Preprocessing:</span>
                            <span class="model-value">${escapeHtml(profile.preprocess_model)}</span>
                        </div>
                        <div class="model-item">
                            <span class="model-label">Extraction:</span>
                            <span class="model-value">${escapeHtml(profile.extract_model)}</span>
                        </div>
                        <div class="model-item">
                            <span class="model-label">Synthèse:</span>
                            <span class="model-value">${escapeHtml(profile.synthesis_model)}</span>
                        </div>
                    </div>
                    ${profile.is_custom ? `
                        <div class="profile-actions">
                            <button class="btn btn--sm btn--outline" onclick="editProfile('${profile.id}')">Modifier</button>
                            <button class="btn btn--sm btn--danger" onclick="deleteProfile('${profile.id}')">Supprimer</button>
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        </div>
        <button class="btn btn--primary btn--sm" onclick="showCreateProfileModal()">Créer un profil</button>
    `;
}

function renderPrompts() {
    const prompts = appState.prompts || [];
    if (prompts.length === 0) {
        return '<p>Aucun prompt disponible.</p>';
    }

    return `
        <div class="prompts-list">
            ${prompts.map(prompt => `
                <div class="prompt-item">
                    <div class="prompt-item__info">
                        <h5>${escapeHtml(prompt.name)}</h5>
                        <p>${escapeHtml(prompt.description || 'Aucune description')}</p>
                    </div>
                    <button class="btn btn--sm btn--outline" onclick="editPrompt('${prompt.name}')">Modifier</button>
                </div>
            `).join('')}
        </div>
    `;
}

function renderOllamaModels() {
    const models = appState.ollamaModels || [];
    if (models.length === 0) {
        return '<p>Aucun modèle installé</p>';
    }

    return `
        <div class="models-list">
            ${models.map(model => `
                <div class="model-item">
                    <div class="model-info">
                        <div class="model-name">${escapeHtml(model.name)}</div>
                        <div class="model-size">${formatBytes(model.size || 0)}</div>
                    </div>
                </div>
            `).join('')}
        </div>
        <button class="btn btn--primary btn--sm" onclick="showPullModelModal()">Télécharger un modèle</button>
    `;
}


function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showCreateProfileModals() {
    const modelOptions = appState.ollamaModels.map(model => 
        `<option value="${escapeHtml(model.name)}">${escapeHtml(model.name)}</option>`
    ).join('');

    const content = `
        <form onsubmit="handleCreateProfile(event)">
            <div class="form-group">
                <label class="form-label">Nom du profil</label>
                <input type="text" name="name" class="form-control" required>
            </div>
            <div class="form-group">
                <label class="form-label">Modèle de preprocessing</label>
                <select name="preprocess_model" class="form-control" required>
                    ${modelOptions}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Modèle d'extraction</label>
                <select name="extract_model" class="form-control" required>
                    ${modelOptions}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Modèle de synthèse</label>
                <select name="synthesis_model" class="form-control" required>
                    ${modelOptions}
                </select>
            </div>
            <div class="modal__actions">
                <button type="button" class="btn btn--secondary" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn--primary">Créer</button>
            </div>
        </form>
    `;
    showModal('➕ Créer un profil d\'analyse', content);
}

async function handleCreateProfile(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const profile = {
        name: formData.get('name'),
        preprocess_model: formData.get('preprocess_model'),
        extract_model: formData.get('extract_model'),
        synthesis_model: formData.get('synthesis_model')
    };

    try {
        closeModal();
        showLoadingOverlay(true, 'Création du profil...');
        
        await fetchAPI('/profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profile)
        });

        await loadInitialData();
        renderSettings();
        showToast('Profil créé avec succès', 'success');
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

function showPullModelModal() {
    const content = `
        <form onsubmit="handlePullModel(event)">
            <div class="form-group">
                <label class="form-label">Nom du modèle</label>
                <input type="text" name="model" class="form-control" placeholder="llama3.1:8b" required>
                <div class="form-text">
                    Exemples: llama3.1:8b, phi3:mini, gemma:2b
                </div>
            </div>
            <div class="modal__actions">
                <button type="button" class="btn btn--secondary" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn--primary">Télécharger</button>
            </div>
        </form>
    `;
    showModal('⬇️ Télécharger un modèle Ollama', content);
}

async function handlePullModel(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const model = formData.get('model');

    try {
        closeModal();
        showLoadingOverlay(true, `Téléchargement de ${model}...`);
        
        await fetchAPI('/ollama/pull', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model })
        });

        showToast('Téléchargement du modèle lancé', 'success');
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

function editPrompt(promptName) {
    const prompt = appState.prompts.find(p => p.name === promptName);
    if (!prompt) return;

    const content = `
        <form onsubmit="handleEditPrompt(event, '${promptName}')">
            <div class="form-group">
                <label class="form-label">Nom</label>
                <input type="text" name="name" value="${escapeHtml(prompt.name)}" class="form-control" readonly>
            </div>
            <div class="form-group">
                <label class="form-label">Description</label>
                <textarea name="description" class="form-control" rows="2">${escapeHtml(prompt.description || '')}</textarea>
            </div>
            <div class="form-group">
                <label class="form-label">Template</label>
                <textarea name="template" class="form-control" rows="10">${escapeHtml(prompt.template)}</textarea>
            </div>
            <div class="modal__actions">
                <button type="button" class="btn btn--secondary" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn--primary">Sauvegarder</button>
            </div>
        </form>
    `;
    showModal('✍️ Modifier le prompt', content, 'modal__content--large');
}

async function handleEditPrompt(event, promptName) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const promptData = {
        name: formData.get('name'),
        description: formData.get('description'),
        template: formData.get('template')
    };

    try {
        closeModal();
        showLoadingOverlay(true, 'Sauvegarde du prompt...');
        
        await fetchAPI('/prompts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(promptData)
        });

        await loadInitialData();
        renderSettings();
        showToast('Prompt sauvegardé avec succès', 'success');
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}
async function runATNAnalysis() {
    if (!appState.currentProject) {
        showToast('Sélectionnez un projet', 'warning');
        return;
    }
    
    try {
        showLoadingOverlay(true, 'Analyse ATN en cours...');
        
        await fetchAPI(`/projects/${appState.currentProject.id}/atn-analysis`, {
            method: 'POST'
        });
        
        showToast('Analyse ATN lancée', 'success');
        
        // Attendre et récupérer les résultats
        setTimeout(async () => {
            try {
                const metrics = await fetchAPI(`/projects/${appState.currentProject.id}/atn-metrics`);
                displayATNResults(metrics);
            } catch (e) {
                console.error('Erreur récupération métriques ATN:', e);
            }
        }, 5000); 
        
    } catch (e) {
        console.error('Erreur analyse ATN:', e);
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

function displayATNResults(metrics) {
    const content = document.getElementById('atnResultsContent');
    if (!content) return; 
    
    const empathyData = metrics.empathy_metrics || {};
    const aiTypes = metrics.ai_types_distribution || [];
    const regulatory = metrics.regulatory_compliance || {};
    
    content.innerHTML = `
        <div class="atn-results">
            <div class="metrics-section">
                <h4>📊 Métriques d'Empathie</h4>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <h5>Empathie IA Moyenne</h5>
                        <div class="metric-value">${empathyData.avg_ai_empathy ? empathyData.avg_ai_empathy.toFixed(2) : 'N/A'}</div>
                    </div>
                    <div class="metric-card">
                        <h5>Empathie Humaine Moyenne</h5>
                        <div class="metric-value">${empathyData.avg_human_empathy ? empathyData.avg_human_empathy.toFixed(2) : 'N/A'}</div>
                    </div>
                    <div class="metric-card">
                        <h5>Études avec scores d'empathie</h5>
                        <div class="metric-value">${empathyData.total_with_empathy || 0}</div>
                    </div>
                </div>
            </div>
            
            <div class="metrics-section">
                <h4>🤖 Types d'IA Utilisés</h4>
                <div class="ai-types-chart">
                    ${aiTypes.map(type => `
                        <div class="ai-type-item">
                            <span class="ai-type-name">${escapeHtml(type.ai_type)}</span>
                            <span class="ai-type-count">${type.count} études</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="metrics-section">
                <h4>⚖️ Conformité Réglementaire</h4>
                <div class="regulatory-stats">
                    <p><strong>RGPD mentionné :</strong> ${regulatory.total_gdpr_mentioned || 0} études</p>
                    <p><strong>Conformes RGPD :</strong> ${regulatory.gdpr_compliant || 0} études</p>
                </div>
            </div>
        </div>
    `;
    
    openModal('atnResultsModal');
}


async function showPRISMAModal() {
    if (!appState.currentProject) {
        showToast('Sélectionnez un projet', 'warning');
        return;
    }
    
    try {
        // Charger l'état PRISMA du projet
        // CORRECTION : Initialisation de prismaState ici pour éviter une variable globale flottante
        let prismaState = {
            checklist: {},
            projectId: null,
            completionRate: 0
        };
        const prismaData = await fetchAPI(`/projects/${appState.currentProject.id}/prisma-checklist`);
        prismaState = {
            checklist: prismaData.checklist || getDefaultPRISMAChecklist(),
            projectId: appState.currentProject.id,
            completionRate: prismaData.completion_rate || 0
        };
        
        renderPRISMAChecklist(prismaState);
        openModal('prismaModal');
        
    } catch (e) {
        console.error('Erreur chargement PRISMA:', e);
        // Utiliser la checklist par défaut
        const prismaState = {
            checklist: getDefaultPRISMAChecklist(),
            projectId: appState.currentProject.id,
            completionRate: 0
        };
        renderPRISMAChecklist(prismaState);
        openModal('prismaModal');
    }
}

function renderPRISMAChecklist(prismaState) {
    const content = document.getElementById('prismaChecklistContent');
    if (!content) return;
    
    let html = '';
    
    for (const [section, items] of Object.entries(prismaState.checklist)) {
        const sectionTitle = section.charAt(0).toUpperCase() + section.slice(1);
        
        html += `
            <div class="prisma-section">
                <h4 class="prisma-section-title">${sectionTitle}</h4>
                <div class="prisma-items">
        `;
        
        items.forEach(item => {
            html += `
                <div class="prisma-item">
                    <label class="prisma-checkbox">
                        <input type="checkbox" 
                               ${item.completed ? 'checked' : ''} 
                               onchange="togglePRISMAItem(this, '${item.id}')" />
                        <span class="prisma-item-text">${escapeHtml(item.item)}</span>
                    </label>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    }
    
    content.innerHTML = html;
    updatePRISMAProgress(prismaState);
}

function togglePRISMAItem(checkbox, itemId) {
    const prismaState = window.currentPrismaState; // Utiliser une référence globale flottante
    // Trouver et basculer l'item
    for (const section of Object.values(prismaState.checklist)) {
        const item = section.find(i => i.id === itemId);
        if (item) {
            item.completed = !item.completed;
            break;
        }
    }
    updatePRISMAProgress(prismaState);
}

function updatePRISMAProgress(prismaState) {
    if (!prismaState) return;
    const totalItems = Object.values(prismaState.checklist).flat().length;
    const completedItems = Object.values(prismaState.checklist)
        .flat()
        .filter(item => item.completed).length;
    
    prismaState.completionRate = Math.round((completedItems / totalItems) * 100);
    
    const progressElement = document.getElementById('prismaProgress');
    if (progressElement) {
        progressElement.textContent = `${prismaState.completionRate}% complété (${completedItems}/${totalItems})`;
    }
}
// ... Le reste du code de app.js (gestion des projets, recherche, validation, etc.)

async function savePRISMAProgress() {
    const prismaState = window.currentPrismaState;
    if (!prismaState || !prismaState.projectId) {
        showToast('Erreur: projet non sélectionné', 'error');
        return;
    }
    
    try {
        await fetchAPI(`/projects/${prismaState.projectId}/prisma-checklist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                checklist: prismaState.checklist,
                completion_rate: prismaState.completionRate
            })
        });
        
        showToast('Progression PRISMA-ScR sauvegardée', 'success');
        
    } catch (e) {
        console.error('Erreur sauvegarde PRISMA:', e);
        showToast(`Erreur: ${e.message}`, 'error');
    }
}


// Exposition globale
window.runATNAnalysis = runATNAnalysis;

function exportPRISMAReport() {
    const prismaState = window.currentPrismaState;
    const sections = Object.entries(prismaState.checklist);
    let report = '# Rapport PRISMA-ScR\n\n';
    report += `**Taux de completion:** ${prismaState.completionRate}%\n\n`;
    
    sections.forEach(([sectionName, items]) => {
        const sectionTitle = sectionName.charAt(0).toUpperCase() + sectionName.slice(1);
        report += `## ${sectionTitle}\n\n`;
        
        items.forEach(item => {
            const status = item.completed ? '✅' : '❌';
            report += `${status} ${item.item}\n\n`;
        });
    });
    
    // Télécharger le fichier
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PRISMA-ScR_${prismaState.projectId}.md`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    showToast('Rapport PRISMA-ScR exporté', 'success');
}

// Exposition globale

async function exportForThesis() {
    if (!appState.currentProject) {
        showToast('Sélectionnez un projet', 'warning');
        return;
    }
    
    try {
        showLoadingOverlay(true, 'Préparation export thèse...');
        
        const response = await fetch(`/api/projects/${appState.currentProject.id}/export/thesis`);
        const blob = await response.blob();
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `these_atn_${appState.currentProject.name}.zip`;
        a.click();
        
        showToast('Export thèse téléchargé avec succès !', 'success');
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

// Gestion des parties prenantes
async function showStakeholderManagement() {
    if (!appState.currentProject) {
        showToast('Sélectionnez un projet', 'warning');
        return;
    }
    
    try {
        const stakeholders = await fetchAPI(`/projects/${appState.currentProject.id}/stakeholders`);
        renderStakeholderGroups(stakeholders);
        openModal('stakeholderManagementModal');
    } catch (e) {
        console.error('Erreur chargement stakeholders:', e);
        showToast(`Erreur: ${e.message}`, 'error');
    }
}

function renderStakeholderGroups(stakeholders) {
    const container = document.getElementById('stakeholderGroupsList');
    if (!container) return;
    
    if (!stakeholders || stakeholders.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>Aucun groupe défini. Les groupes par défaut seront utilisés :</p>
                <div class="default-stakeholders">
                    <span class="stakeholder-badge" style="background: #4CAF50;">Patients/Soignés</span>
                    <span class="stakeholder-badge" style="background: #2196F3;">Professionnels de santé</span>
                    <span class="stakeholder-badge" style="background: #FF9800;">Développeurs/Tech</span>
                    <span class="stakeholder-badge" style="background: #9C27B0;">Régulateurs/Décideurs</span>
                    <span class="stakeholder-badge" style="background: #F44336;">Payeurs/Assurances</span>
                </div>
            </div>
        `;
        return;
    }
    
    const groupsHtml = stakeholders.map(group => `
        <div class="stakeholder-group-item" style="border-left: 4px solid ${group.color};">
            <div class="stakeholder-group-info">
                <h5>${escapeHtml(group.name)}</h5>
                <p>${escapeHtml(group.description || 'Aucune description')}</p>
            </div>
            <div class="stakeholder-group-actions">
                <button class="btn btn--sm btn--secondary" onclick="editStakeholderGroup('${group.id}')">Modifier</button>
                <button class="btn btn--sm btn--error" onclick="deleteStakeholderGroup('${group.id}')">Supprimer</button>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = groupsHtml;
}

async function addStakeholderGroup() {
    const name = document.getElementById('newStakeholderName')?.value?.trim();
    const color = document.getElementById('newStakeholderColor')?.value;
    const description = document.getElementById('newStakeholderDesc')?.value?.trim();
    
    if (!name) {
        showToast('Le nom du groupe est requis', 'warning');
        return;
    }
    
    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/stakeholders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                color: color,
                description: description
            })
        });
        
        showToast('Groupe ajouté avec succès', 'success');
        
        // Reset form
        document.getElementById('newStakeholderName').value = '';
        document.getElementById('newStakeholderColor').value = '#4CAF50';
        document.getElementById('newStakeholderDesc').value = '';
        
        // Refresh list
        showStakeholderManagement();
        
    } catch (e) {
        console.error('Erreur ajout stakeholder:', e);
        showToast(`Erreur: ${e.message}`, 'error');
    }
}

function toggleSelectAll(checked, source) {
    const checkboxes = document.querySelectorAll(`.article-checkbox[data-source="${source}"]`);
    checkboxes.forEach(cb => {
        const id = cb.dataset.id;
        cb.checked = checked;
        if (checked) {
            appState.selectedSearchResults.add(id);
        } else {
            appState.selectedSearchResults.delete(id);
        }
    });
    updateSelectionCounter();
}

async function selectProject(projectId) {
    await loadProjectGrids(projectId);
    try {
        const project = await fetchAPI(`/projects/${projectId}`);
        appState.currentProject = project;

        // Rejoindre la room WebSocket du projet
        if (appState.socket) {
            appState.socket.emit('join_room', { room: projectId });
        }

        appState.projectFiles = await loadProjectFilesSet(projectId);

        renderProjectList();
        renderProjectDetail(project);

        refreshCurrentSection();
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    }
}



// Formulaire: ajout manuel d’articles




async function handleZoteroFileUpload(event) {
    const file = event.target.files[0];
    if (!file || !appState.currentProject) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
        showLoadingOverlay(true, 'Upload du fichier Zotero...');
        
        await fetchAPI(`/projects/${appState.currentProject.id}/import-zotero-file`, {
            method: 'POST',
            body: formData
        });
        
        showToast('Import Zotero lancé', 'success');
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
        event.target.value = '';
    }
}

async function handleBulkPDFUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0 || !appState.currentProject) return;

    const formData = new FormData();
    Array.from(files).forEach(file => {
        formData.append('files', file);
    });

    try {
        showLoadingOverlay(true, `Upload de ${files.length} PDF(s)...`);
        
        await fetchAPI(`/projects/${appState.currentProject.id}/upload-pdfs-bulk`, {
            method: 'POST',
            body: formData
        });
        
        showToast('PDFs uploadés avec succès', 'success');
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
        event.target.value = '';
    }
}






function formatDate(dateString) {
    if (!dateString) return 'Non spécifié';
    return new Date(dateString).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Nettoyage et finalisation
window.addEventListener('beforeunload', () => {
    if (appState.socket && appState.socket.connected) {
        appState.socket.disconnect();
    }
});

console.log('✅ AnalyLit V4.1 Frontend chargé et prêt !');







async function handlePullOllamaModel() {
    const input = document.getElementById('ollamaModelInput');
    const modelName = (input && input.value) ? input.value.trim() : null;
    
    if (!modelName) {
        showToast('Saisissez le nom du modèle', 'warning');
        return;
    }
    
    try {
        showLoadingOverlay(true, `Téléchargement du modèle ${modelName}...`);
        await fetchAPI('/ollama/pull', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: modelName })
        });
        showToast(`Téléchargement de ${modelName} lancé`, 'success');
        if (input) input.value = '';
        
        setTimeout(async () => {
            try {
                appState.ollamaModels = await fetchAPI('/ollama/models');
                if (appState.currentSection === 'settings') {
                    loadSettings();
                }
            } catch (e) {
                console.error('Erreur rechargement modèles:', e);
            }
        }, 2000);
    } catch (e) {
        console.error('Erreur téléchargement modèle:', e);
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

// ============================ 
// FONCTIONS MANQUANTES À AJOUTER
// ============================ 

// Gestion des uploads PDF manuels
async function handleManualPDFUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    if (!appState.currentProject?.id) {
        showToast('Sélectionnez un projet avant d\'uploader', 'warning');
        return;
    }
    
    const formData = new FormData();
    Array.from(files).forEach(file => formData.append('files', file));
    
    try {
        showLoadingOverlay(true, `Upload de ${files.length} PDF(s)...`);
        const result = await fetchAPI(`/projects/${appState.currentProject.id}/upload-pdfs-bulk`, {
            method: 'POST',
            body: formData
        });
        
        showToast(`${result.successful.length} PDF(s) importés avec succès`, 'success');
        if (result.failed.length > 0) {
            console.warn('Échecs upload:', result.failed);
        }
    } catch (e) {
        showToast(`Erreur upload: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
        event.target.value = ''; // Reset input
    }
}

// Gestion des modales pour grilles d'extraction
function openGridModal(action = 'create', gridId = null) {
    const modal = document.getElementById('gridModal');
    if (!modal) return;
    
    const form = modal.querySelector('#gridForm');
    const titleElement = modal.querySelector('.modal__title');
    
    if (action === 'create') {
        titleElement.textContent = 'Nouvelle grille d\'extraction';
        form.reset();
        form.dataset.action = 'create';
    } else if (action === 'edit' && gridId) {
        titleElement.textContent = 'Modifier la grille';
        form.dataset.action = 'edit';
        form.dataset.gridId = gridId;
        
        // Charger les données de la grille
        const grid = appState.currentProjectGrids.find(g => g.id === gridId);
        if (grid) {
            form.querySelector('#gridName').value = grid.name;
            const fieldsData = JSON.parse(grid.fields || '[]');
            renderGridFields(fieldsData);
        }
    }
    
    openModal('gridModal');
}



async function handleRunIndexing() {
    if (!appState.currentProject?.id) {
        showToast('Aucun projet sélectionné pour l\'indexation', 'warning');
        return;
    }
    
    try {
        showLoadingOverlay(true, 'Lancement de l\'indexation...');
        
        await fetchAPI(`/projects/${appState.currentProject.id}/index`, {
            method: 'POST'
        });
        
        showToast('Indexation des PDFs lancée', 'success');
        
        // Rafraîchir le statut du projet
        await refreshCurrentProjectData();
        
    } catch (e) {
        showToast(`Erreur indexation: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

// Fonction pour rendre les champs de grille d'extraction dynamiques
function renderGridFields(fields = []) {
    const container = document.getElementById('gridFieldsContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    fields.forEach((field, index) => {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'grid-field-item';
        fieldDiv.innerHTML = `
            <div class="field-inputs">
                <input type="text" placeholder="Nom du champ" value="${escapeHtml(field.name || '')}" 
                       onchange="updateFieldName(${index}, this.value)">
                <textarea placeholder="Description (optionnelle)" 
                         onchange="updateFieldDescription(${index}, this.value)">${escapeHtml(field.description || '')}</textarea>
                <button type="button" class="btn btn--secondary btn--sm" onclick="removeGridField(${index})">
                    Supprimer
                </button>
            </div>
        `;
        container.appendChild(fieldDiv);
    });
    
    // Bouton d'ajout de champ
    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'btn btn--primary btn--sm';
    addButton.textContent = 'Ajouter un champ';
    addButton.onclick = addGridField;
    container.appendChild(addButton);
}

// Fonctions utilitaires pour la gestion des grilles
function addGridField() {
    const fields = getCurrentGridFields();
    fields.push({ name: '', description: '' });
    renderGridFields(fields);
}

function removeGridField(index) {
    const fields = getCurrentGridFields();
    fields.splice(index, 1);
    renderGridFields(fields);
}

function updateFieldName(index, value) {
    const fields = getCurrentGridFields();
    if (fields[index]) {
        fields[index].name = value;
    }
}

function updateFieldDescription(index, value) {
    const fields = getCurrentGridFields();
    if (fields[index]) {
        fields[index].description = value;
    }
}

function getCurrentGridFields() {
    const container = document.getElementById('gridFieldsContainer');
    if (!container) return [];
    
    const inputs = container.querySelectorAll('.field-inputs');
    return Array.from(inputs).map(input => ({
        name: input.querySelector('input[type="text"]')?.value || '',
        description: input.querySelector('textarea')?.value || ''
    }));
}

async function handleGridFormSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const action = form.dataset.action;
    const formData = new FormData(form);
    const gridData = {
        name: formData.get('name'),
        fields: getCurrentGridFields()
    };
    
    try {
        showLoadingOverlay(true, 'Sauvegarde de la grille...');
        
        if (action === 'create') {
            await fetchAPI(`/projects/${appState.currentProject.id}/grids`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(gridData)
            });
            showToast('Grille créée avec succès', 'success');
        } else if (action === 'edit') {
            const gridId = form.dataset.gridId;
            await fetchAPI(`/projects/${appState.currentProject.id}/grids/${gridId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(gridData)
            });
            showToast('Grille mise à jour', 'success');
        }
        
        closeModal('gridModal');
        await loadProjectGrids(); // Recharger les grilles
        
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}


// ================================================================
// === INITIALISATION FINALE
// ================================================================





// Exposer certaines fonctions globalement pour les événements inline HTML

// Exposition contrôlée des handlers au scope global (évite ReferenceError)

window.handleImportValidations = typeof handleImportValidations === 'function' ? handleImportValidations : (e) => { e.preventDefault(); console.warn("handleImportValidations non implémenté ou mal référencé."); };

window.deleteProject = typeof deleteProject === 'function' ? deleteProject : () => {};
window.selectProject = typeof selectProject === 'function' ? selectProject : () => {};

window.exportValidations = typeof exportValidations === 'function' ? exportValidations : () => {};
window.calculateKappa = typeof calculateKappa === 'function' ? calculateKappa : () => {};


window.handlePullModel = typeof handlePullModel === 'function' ? handlePullModel : () => {};
window.handleSaveZoteroSettings = typeof handleSaveZoteroSettings === 'function' ? handleSaveZoteroSettings : () => {};



window.openGridModal = typeof openGridModal === 'function' ? openGridModal : () => {};
window.handleDeleteGrid = typeof handleDeleteGrid === 'function' ? handleDeleteGrid : () => {};
window.openPromptModal = typeof openPromptModal === 'function' ? openPromptModal : () => {};
window.editPrompt = typeof editPrompt === 'function' ? editPrompt : () => {};
window.openProfileModal = typeof openProfileModal === 'function' ? openProfileModal : () => {};
window.fetchAndDisplayRob = typeof fetchAndDisplayRob === 'function' ? fetchAndDisplayRob : () => {};
window.deleteProfile = typeof deleteProfile === 'function' ? deleteProfile : () => {};

window.showPRISMAModal = showPRISMAModal;
window.togglePRISMAItem = togglePRISMAItem;
window.savePRISMAProgress = savePRISMAProgress;
window.exportPRISMAReport = exportPRISMAReport;

window.runAdvancedAnalysis = typeof runAdvancedAnalysis === 'function' ? runAdvancedAnalysis : () => {};
window.viewAnalysisPlot = typeof viewAnalysisPlot === 'function' ? viewAnalysisPlot : () => {};

window.exportAnalyses = exportAnalyses;
// Log de fin de chargement

window.exportForThesis = exportForThesis;
window.showStakeholderManagement = showStakeholderManagement;
window.addStakeholderGroup = addStakeholderGroup;

console.log('✅ AnalyLit V4.1 Frontend - Chargement complet terminé');





window.showBatchProcessModal = showBatchProcessModal;
window.startBatchProcessing = startBatchProcessing;
window.showRunExtractionModal = showRunExtractionModal;
window.startFullExtraction = startFullExtraction;
window.handleFetchOnlinePdfs = handleFetchOnlinePdfs;

window.toggleSelectAll = toggleSelectAll;
window.handleDeleteSelectedArticles = handleDeleteSelectedArticles;