// web/app.js — Frontend complet AnalyLit v4.1 (JS pur, synchronisé)

const appState = {
    currentProject: null,
    projects: [],
    analysisProfiles: [],
    ollamaModels: [],
    prompts: [],
    currentProjectGrids: [],
    currentProjectExtractions: [],
    searchResults: [],
    availableDatabases: [],
    notifications: [],
    unreadNotifications: 0,
    selectedSearchResults: new Set(),
    socketConnected: false,
    currentSection: 'projects',
    socket: null,
    analysisResults: {},
    chatMessages: [],
    currentValidations: [],
    queuesInfo: []
};

let elements = {};

document.addEventListener('DOMContentLoaded', () => {
    elements = {
        sections: document.querySelectorAll('.section'),
        navButtons: document.querySelectorAll('.app-nav__button'),
        connectionStatus: document.querySelector('[data-connection-status]'),
        projectsList: document.getElementById('projectsList'),
        createProjectBtn: document.getElementById('createProjectBtn'),
        projectDetail: document.getElementById('projectDetail'),
        projectDetailContent: document.getElementById('projectDetailContent'),
        resultsContainer: document.getElementById('resultsContainer'),
        analysisContainer: document.getElementById('analysisContainer'),
        importContainer: document.getElementById('importContainer'),
        chatContainer: document.getElementById('chatContainer'),
        settingsContainer: document.getElementById('settingsContainer'),
        validationContainer: document.getElementById('validationContainer'),
        loadingOverlay: document.getElementById('loadingOverlay'),
        toastContainer: document.getElementById('toastContainer'),
        zoteroFileInput: document.getElementById('zoteroFileInput'),
        bulkPDFInput: document.getElementById('bulkPDFInput'),
        runIndexingBtn: document.getElementById('runIndexingBtn')
    };

    setupEventListeners();
    initializeApplication();
});

async function initializeApplication() {
    showLoadingOverlay(true, 'Initialisation...');
    try {
        initializeWebSocket();
        await loadInitialData();
        showSection('projects');
        await loadProjects();
        renderProjectList();
    } catch (e) {
        console.error('Init error:', e);
        showToast("Erreur lors de l'initialisation", 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

function setupEventListeners() {
    // Navigation onglets
    elements.navButtons.forEach(btn => {
        btn.addEventListener('click', () => showSection(btn.dataset.section));
    });

    // Nouveau projet
    if (elements.createProjectBtn) {
        elements.createProjectBtn.addEventListener('click', handleCreateProject);
    }

    // Imports
    if (elements.zoteroFileInput) {
        elements.zoteroFileInput.addEventListener('change', handleZoteroFileUpload);
    }
    if (elements.bulkPDFInput) {
        elements.bulkPDFInput.addEventListener('change', handleBulkPDFUpload);
    }
    if (elements.runIndexingBtn) {
        elements.runIndexingBtn.addEventListener('click', () => {
            if (!appState.currentProject?.id) {
                showToast('Sélectionnez un projet avant indexation', 'warning');
                return;
            }
            handleRunIndexing(appState.currentProject.id);
        });
    }

    // Fermeture des modales
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal') || e.target.classList.contains('modal__close')) {
            closeModal();
        }
    });

    // Écoute de la touche Échap pour fermer les modales
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
}

function showSection(name) {
    appState.currentSection = name;
    elements.sections.forEach(sec => {
        const active = sec.dataset?.section === name;
        sec.classList.toggle('section--active', active);
    });
    elements.navButtons.forEach(btn => {
        const active = btn.dataset?.section === name;
        btn.classList.toggle('app-nav__button--active', active);
    });

    // Charger les données de la section si projet sélectionné
    if (appState.currentProject?.id) {
        switch (name) {
            case 'results':
                loadSearchResults();
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
                loadSettings();
                break;
            case 'validation':
                loadValidationSection();
                break;
        }
    }
}

// ============================ 
// WebSocket Management
// ============================
function initializeWebSocket() {
    try {
        appState.socket = io({
            path: '/socket.io/',
            transports: ['websocket', 'polling']
        });

        appState.socket.on('connect', () => {
            console.log('WebSocket connecté');
            appState.socketConnected = true;
            updateConnectionStatus(true);
        });

        appState.socket.on('disconnect', () => {
            console.log('WebSocket déconnecté');
            appState.socketConnected = false;
            updateConnectionStatus(false);
        });

        appState.socket.on('notification', handleNotification);
        appState.socket.on('project_update', handleProjectUpdate);
        appState.socket.on('processing_complete', handleProcessingComplete);
    } catch (e) {
        console.error('Erreur WebSocket:', e);
        updateConnectionStatus(false);
    }
}

function handleNotification(data) {
    console.log('Notification reçue:', data);
    appState.notifications.unshift({
        id: Date.now(),
        ...data,
        timestamp: new Date().toISOString()
    });
    appState.unreadNotifications++;
    showToast(data.message, data.type || 'info');

    // Rejoindre la room du projet si nécessaire
    if (data.project_id && data.project_id !== appState.currentProject?.id) {
        appState.socket.emit('join_room', { room: data.project_id });
        console.log(`Rejoint la room du projet ${data.project_id}`);
    }

    // Rafraîchir les données si c'est le projet courant
    if (data.project_id === appState.currentProject?.id) {
        refreshCurrentProjectData();
    }
}

function handleProjectUpdate(data) {
    console.log('Mise à jour projet:', data);
    if (data.project_id === appState.currentProject?.id) {
        refreshCurrentProjectData();
    }
}

function handleProcessingComplete(data) {
    console.log('Traitement terminé:', data);
    showToast(`Traitement terminé: ${data.message}`, 'success');
    refreshCurrentProjectData();
}

function updateConnectionStatus(connected) {
    if (elements.connectionStatus) {
        elements.connectionStatus.textContent = connected ? '🟢 Connecté' : '🔴 Déconnecté';
        elements.connectionStatus.className = connected ? 'connection-status--connected' : 'connection-status--disconnected';
    }
}

// ============================
// API helpers
// ============================
async function fetchAPI(endpoint, options = {}) {
    const url = `/api${endpoint}`;
    const isFormData = options.body instanceof FormData;
    const headers = isFormData ? (options.headers || {}) : {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };

    const config = {
        method: options.method || 'GET',
        headers,
    };

    if (options.body !== undefined) {
        if (isFormData) config.body = options.body;
        else if (typeof options.body === 'string') config.body = options.body;
        else config.body = JSON.stringify(options.body);
    }

    const res = await fetch(url, config);
    if (!res.ok) {
        let payload = null;
        try {
            payload = await res.json();
        } catch (_) {}
        const msg = payload?.error || `Erreur HTTP ${res.status}`;
        throw new Error(msg);
    }

    if (res.status === 204 || res.headers.get('Content-Length') === '0') return null;
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
}

async function loadInitialData() {
    try {
        const [profiles, prompts, models, databases] = await Promise.all([
            fetchAPI('/analysis-profiles'),
            fetchAPI('/prompts'),
            fetchAPI('/ollama/models'),
            fetchAPI('/databases'),
        ]);

        appState.analysisProfiles = Array.isArray(profiles) ? profiles : [];
        appState.prompts = Array.isArray(prompts) ? prompts : [];
        appState.ollamaModels = Array.isArray(models) ? models : [];
        appState.availableDatabases = Array.isArray(databases) ? databases : [];
    } catch (e) {
        showToast("Chargement partiel des paramètres", 'warning');
    }
}

async function loadProjects() {
    try {
        appState.projects = await fetchAPI('/projects');
    } catch {
        appState.projects = [];
    }
}

async function refreshCurrentProjectData() {
    if (!appState.currentProject?.id) return;

    try {
        // Recharger les données du projet
        const updatedProject = await fetchAPI(`/projects/${appState.currentProject.id}`);
        appState.currentProject = updatedProject;

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
        }
    } catch (e) {
        console.error('Erreur refresh project data:', e);
    }
}

// ============================
// UI rendering
// ============================
function escapeHtml(text) {
    if (text === null || typeof text === 'undefined') return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };
    return String(text).replace(/[&<>"']/g, (m) => map[m]);
}

function renderProjectList() {
    if (!elements.projectsList) return;

    const projects = Array.isArray(appState.projects) ? appState.projects : [];
    if (projects.length === 0) {
        elements.projectsList.innerHTML = `
            <div class="projects-empty">
                <span class="projects-empty__icon">📁</span>
                <p>Aucun projet trouvé</p>
                <p>Créez votre premier projet pour commencer.</p>
            </div>
        `;
        if (elements.projectDetail) {
            elements.projectDetail.innerHTML = '<p>Sélectionnez un projet pour voir les détails.</p>';
        }
        return;
    }

    const projectsHtml = projects.map(project => {
        const isActive = appState.currentProject?.id === project.id;
        const statusClass = getStatusClass(project.status);
        
        return `
            <div class="project-card ${isActive ? 'project-card--active' : ''}" data-project-id="${project.id}">
                <div class="project-card__header">
                    <div class="project-card__info">
                        <h4 class="project-card__title">${escapeHtml(project.name)}</h4>
                        <p class="project-card__description">${escapeHtml(project.description || 'Aucune description')}</p>
                    </div>
                    <span class="status status--${statusClass}">${escapeHtml(project.status)}</span>
                </div>
                <div class="project-card__body">
                    <div class="project-card__stats">
                        <div class="stat-item">
                            <span class="stat-item__label">Articles</span>
                            <span class="stat-item__value">${project.pmids_count || 0}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-item__label">Traités</span>
                            <span class="stat-item__value">${project.processed_count || 0}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-item__label">Temps</span>
                            <span class="stat-item__value">${project.total_processing_time ? Math.round(project.total_processing_time) + 's' : '0s'}</span>
                        </div>
                    </div>
                </div>
                <div class="project-card__actions">
                    <button class="btn btn--primary btn--sm" onclick="selectProject('${project.id}')">Ouvrir</button>
                    <button class="btn btn--outline btn--sm" onclick="showProjectExportModal('${project.id}')">Exporter</button>
                    <button class="btn btn--danger btn--sm" onclick="deleteProject('${project.id}')">Supprimer</button>
                </div>
            </div>
        `;
    }).join('');

    elements.projectsList.innerHTML = `
        <div class="projects-grid">
            ${projectsHtml}
        </div>
    `;
}

function renderProjectDetail(project) {
    if (!project || !elements.projectDetailContent) return;

    const statusClass = getStatusClass(project.status);
    const stats = {
        total: project.pmids_count || 0,
        processed: project.processed_count || 0,
        time: project.total_processing_time ? `${Math.round(project.total_processing_time)}s` : '0s'
    };

    elements.projectDetailContent.innerHTML = `
        <div class="project-detail">
            <div class="project-detail__header">
                <h3>${escapeHtml(project.name)}</h3>
                <span class="status status--${statusClass}">${escapeHtml(project.status)}</span>
            </div>
            <div class="project-detail__body">
                <p class="project-description">${escapeHtml(project.description || 'Aucune description')}</p>
                
                <div class="project-stats">
                    <div class="stat-card">
                        <div class="stat-card__value">${stats.total}</div>
                        <div class="stat-card__label">Articles trouvés</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card__value">${stats.processed}</div>
                        <div class="stat-card__label">Articles traités</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card__value">${stats.time}</div>
                        <div class="stat-card__label">Temps total</div>
                    </div>
                </div>
                
                <div class="project-actions">
                    <button class="btn btn--primary" onclick="showMultiDatabaseSearchModal()">🔍 Nouvelle recherche</button>
                    <button class="btn btn--secondary" onclick="showRunPipelineModal()">⚙️ Lancer analyse</button>
                    <button class="btn btn--secondary" onclick="showRunAnalysisModal()">🔬 Analyses avancées</button>
                </div>
            </div>
        </div>
    `;
}

function getStatusClass(status) {
    const statusMap = {
        'pending': 'info',
        'searching': 'warning',
        'search_completed': 'info',
        'search_failed': 'error',
        'processing': 'warning',
        'synthesizing': 'warning',
        'generating_analysis': 'warning',
        'completed': 'success',
        'failed': 'error'
    };
    return statusMap[status] || 'info';
}

// ============================
// Search Results
// ============================
async function loadSearchResults() {
    if (!appState.currentProject?.id || !elements.resultsContainer) return;

    try {
        showLoadingOverlay(true, 'Chargement des résultats...');
        const [results, extractions] = await Promise.all([
            fetchAPI(`/projects/${appState.currentProject.id}/search-results`),
            fetchAPI(`/projects/${appState.currentProject.id}/extractions`)
        ]);
        
        appState.searchResults = results?.results || [];
        appState.currentProjectExtractions = extractions || [];
        renderSearchResults();
    } catch (e) {
        elements.resultsContainer.innerHTML = '<p class="error">Erreur lors du chargement des résultats.</p>';
        console.error('Erreur chargement résultats:', e);
    } finally {
        showLoadingOverlay(false);
    }
}

function renderSearchResults() {
    if (!elements.resultsContainer) return;
    
    const results = appState.searchResults || [];
    const extractions = appState.currentProjectExtractions || [];
    
    if (results.length === 0) {
        elements.resultsContainer.innerHTML = `
            <div class="results-placeholder">
                <span class="results-placeholder__icon">🔍</span>
                <p>Aucun résultat trouvé</p>
                <p>Lancez une recherche pour voir les articles trouvés.</p>
            </div>
        `;
        return;
    }

    // Créer une map des extractions pour accès rapide
    const extractionMap = new Map();
    extractions.forEach(ext => {
        extractionMap.set(ext.pmid, ext);
    });

    const resultsHeader = `
        <div class="results-header">
            <div class="results-stats">
                <div class="stat-card">
                    <div class="stat-card__value">${results.length}</div>
                    <div class="stat-card__label">Total</div>
                </div>
                <div class="stat-card stat-card--success">
                    <div class="stat-card__value">${extractions.length}</div>
                    <div class="stat-card__label">Traités</div>
                </div>
            </div>
            <div class="results-actions">
                <button class="btn btn--primary btn--sm" onclick="showRunPipelineModal()">⚙️ Traiter sélection</button>
                <button class="btn btn--secondary btn--sm" onclick="selectAllResults()">Tout sélectionner</button>
                <button class="btn btn--secondary btn--sm" onclick="clearResultSelection()">Déselectionner tout</button>
            </div>
        </div>
    `;

    const tableRows = results.map(result => {
        const extraction = extractionMap.get(result.article_id);
        const isSelected = appState.selectedSearchResults.has(result.article_id);
        const isProcessed = !!extraction;

        return `
            <tr class="result-row ${isProcessed ? 'result-row--processed' : ''}" data-article-id="${result.article_id}">
                <td class="actions-cell">
                    <input type="checkbox" 
                           ${isSelected ? 'checked' : ''} 
                           onchange="toggleResultSelection('${result.article_id}', this.checked)"
                           class="article-select-checkbox">
                </td>
                <td class="title-cell">
                    <div class="article-info">
                        <div class="title-text" onclick="toggleAbstractRow('${result.article_id}')">
                            ${escapeHtml(result.title || 'Titre non disponible')}
                        </div>
                        <div class="article-meta">
                            <span class="meta-item"><strong>ID:</strong> ${escapeHtml(result.article_id)}</span>
                            ${result.publication_date ? `<span class="meta-item"><strong>Date:</strong> ${escapeHtml(result.publication_date)}</span>` : ''}
                            ${result.journal ? `<span class="meta-item"><strong>Journal:</strong> ${escapeHtml(result.journal)}</span>` : ''}
                        </div>
                        <div class="article-links">
                            ${result.doi ? `<a href="https://doi.org/${result.doi}" target="_blank" class="doi-link">DOI</a>` : ''}
                            ${result.url ? `<a href="${result.url}" target="_blank" class="url-link">URL</a>` : ''}
                        </div>
                    </div>
                </td>
                <td class="authors-cell">
                    <div class="authors-display">${escapeHtml(result.authors || 'Non disponible')}</div>
                </td>
                <td>
                    <span class="source-badge source--${result.database_source}">${escapeHtml(result.database_source)}</span>
                </td>
                <td class="analysis-cell">
                    ${extraction ? `
                        <div class="extraction-summary">
                            <div class="score-display">
                                <span class="score-badge">${extraction.relevance_score || 0}/10</span>
                            </div>
                            <div class="extraction-meta">
                                <div class="extraction-source">Source: ${extraction.analysis_source || 'unknown'}</div>
                                ${extraction.extracted_data ? '<button class="btn btn--sm btn--outline" onclick="showExtractionDetails(\'' + result.article_id + '\')">Détails</button>' : ''}
                            </div>
                            ${extraction.relevance_justification ? `
                                <div class="extraction-justification">${escapeHtml(extraction.relevance_justification)}</div>
                            ` : ''}
                        </div>
                    ` : '<span class="status status--sm status--info">Pas encore analysé</span>'}
                </td>
            </tr>
            <tr class="abstract-row hidden" id="abstract-row-${result.article_id}">
                <td colspan="5">
                    <div class="abstract-content">
                        <div class="abstract-section">
                            <strong>Résumé:</strong>
                            <p>${escapeHtml(result.abstract || 'Résumé non disponible')}</p>
                        </div>
                        ${result.authors || result.journal || result.publication_date ? `
                            <div class="metadata-section">
                                <strong>Métadonnées complètes:</strong>
                                <div class="metadata-grid">
                                    ${result.authors ? `<div class="metadata-item"><strong>Auteurs:</strong> <span>${escapeHtml(result.authors)}</span></div>` : ''}
                                    ${result.journal ? `<div class="metadata-item"><strong>Journal:</strong> <span>${escapeHtml(result.journal)}</span></div>` : ''}
                                    ${result.publication_date ? `<div class="metadata-item"><strong>Date:</strong> <span>${escapeHtml(result.publication_date)}</span></div>` : ''}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    elements.resultsContainer.innerHTML = `
        ${resultsHeader}
        <div class="results-table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>Sél.</th>
                        <th>Article & Métadonnées</th>
                        <th>Auteurs</th>
                        <th>Source</th>
                        <th>Analyse & Score</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>
    `;
}

function toggleAbstractRow(articleId) {
    const abstractRow = document.getElementById(`abstract-row-${articleId}`);
    if (abstractRow) {
        abstractRow.classList.toggle('hidden');
    }
}

function toggleResultSelection(articleId, selected) {
    if (selected) {
        appState.selectedSearchResults.add(articleId);
    } else {
        appState.selectedSearchResults.delete(articleId);
    }
}

function selectAllResults() {
    appState.searchResults.forEach(result => {
        appState.selectedSearchResults.add(result.article_id);
    });
    renderSearchResults();
}

function clearResultSelection() {
    appState.selectedSearchResults.clear();
    renderSearchResults();
}

function showExtractionDetails(articleId) {
    const extraction = appState.currentProjectExtractions.find(ext => ext.pmid === articleId);
    const article = appState.searchResults.find(art => art.article_id === articleId);
    
    if (!extraction || !article) {
        showToast('Détails d\'extraction non trouvés', 'error');
        return;
    }

    let extractedDataHtml = '';
    if (extraction.extracted_data) {
        try {
            const data = JSON.parse(extraction.extracted_data);
            if (typeof data === 'object') {
                extractedDataHtml = Object.entries(data).map(([key, value]) => `
                    <div class="detail-item">
                        <label>${escapeHtml(key)}:</label>
                        <div class="detail-value">${escapeHtml(String(value))}</div>
                    </div>
                `).join('');
            } else {
                extractedDataHtml = `<div class="detail-text">${escapeHtml(String(data))}</div>`;
            }
        } catch {
            extractedDataHtml = `<div class="detail-text">${escapeHtml(extraction.extracted_data)}</div>`;
        }
    }

    const content = `
        <div class="extraction-details">
            <div class="extraction-header">
                <h4>${escapeHtml(article.title)}</h4>
                <div class="article-id-display">ID: ${escapeHtml(articleId)}</div>
            </div>
            
            <div class="extraction-details-grid">
                <div class="detail-item">
                    <label>Score de pertinence:</label>
                    <div class="detail-value score-value">${extraction.relevance_score || 0}/10</div>
                </div>
                <div class="detail-item">
                    <label>Source d'analyse:</label>
                    <div class="detail-value">${escapeHtml(extraction.analysis_source || 'Non spécifiée')}</div>
                </div>
            </div>

            ${extraction.relevance_justification ? `
                <div class="detail-section">
                    <label>Justification:</label>
                    <div class="detail-text">${escapeHtml(extraction.relevance_justification)}</div>
                </div>
            ` : ''}

            ${extractedDataHtml ? `
                <div class="detail-section">
                    <label>Données extraites:</label>
                    <div class="extraction-details-grid">
                        ${extractedDataHtml}
                    </div>
                </div>
            ` : ''}

            <div class="detail-section">
                <label>Liens:</label>
                <div class="detail-links">
                    ${article.doi ? `<a href="https://doi.org/${article.doi}" target="_blank" class="detail-link">Voir DOI</a>` : ''}
                    ${article.url ? `<a href="${article.url}" target="_blank" class="detail-link">Voir article</a>` : ''}
                </div>
            </div>
        </div>
    `;

    showModal('📋 Détails de l\'extraction', content, 'modal__content--large');
}

// ============================
// Analyses
// ============================
async function loadProjectAnalyses() {
    if (!appState.currentProject?.id || !elements.analysisContainer) return;

    const analyses = [
        {
            id: 'meta_analysis',
            title: '📊 Méta-analyse',
            description: 'Distribution des scores et IC95%.',
            available: true
        },
        {
            id: 'prisma_flow',
            title: '📋 Diagramme PRISMA',
            description: 'Flux PRISMA basé sur vos résultats.',
            available: true
        },
        {
            id: 'atn_scores',
            title: '🎯 Scores ATN',
            description: 'Score thématique sur extractions.',
            available: true
        },
        {
            id: 'knowledge_graph',
            title: '🌐 Graphe de connaissances',
            description: 'Visualisation des concepts et relations entre articles.',
            available: true
        },
        {
            id: 'discussion',
            title: '📝 Discussion',
            description: 'Génération automatique de section Discussion.',
            available: true
        }
    ];

    renderAnalyses(analyses);
}

function renderAnalyses(analyses) {
    if (!elements.analysisContainer) return;

    const analysesHtml = analyses.map(analysis => {
        const hasResult = appState.analysisResults[analysis.id];
        const result = hasResult ? appState.analysisResults[analysis.id] : null;

        return `
            <div class="analysis-card">
                <div class="analysis-card__header">
                    <h4>${analysis.title}</h4>
                </div>
                <div class="analysis-card__content">
                    <p>${analysis.description}</p>
                    ${hasResult ? `
                        <div class="analysis-result">
                            <h5>Résultat:</h5>
                            ${typeof result === 'string' ? escapeHtml(result) : escapeHtml(JSON.stringify(result, null, 2))}
                        </div>
                    ` : ''}
                    <button class="btn btn--primary btn--sm" onclick="runAnalysis('${analysis.id}')">
                        ${hasResult ? 'Relancer' : 'Lancer'}
                    </button>
                </div>
            </div>
        `;
    }).join('');

    elements.analysisContainer.innerHTML = `
        <div class="analysis-grid">
            ${analysesHtml}
        </div>
    `;
}

// ============================
// Import Section
// ============================
function renderImportSection() {
    if (!elements.importContainer || !appState.currentProject?.id) {
        if (elements.importContainer) {
            elements.importContainer.innerHTML = `
                <div class="import-placeholder">
                    <span class="import-placeholder__icon">📁</span>
                    <p>Sélectionnez un projet pour importer des fichiers.</p>
                </div>
            `;
        }
        return;
    }

    elements.importContainer.innerHTML = `
        <div class="import-sections">
            <div class="import-card">
                <h4>📚 Importer un export Zotero (.json)</h4>
                <p>Chargez un fichier d'export Zotero pour ajouter des références.</p>
                <div class="import-actions">
                    <input type="file" id="zoteroFileInput" accept=".json" style="display: none;">
                    <button class="btn btn--primary" onclick="document.getElementById('zoteroFileInput').click()">
                        Choisir fichier Zotero
                    </button>
                </div>
            </div>

            <div class="import-card">
                <h4>📄 Uploader des PDFs (jusqu'à 20)</h4>
                <p>Ces PDFs seront liés au projet courant.</p>
                <div class="import-actions">
                    <input type="file" id="bulkPDFInput" accept=".pdf" multiple style="display: none;">
                    <button class="btn btn--primary" onclick="document.getElementById('bulkPDFInput').click()">
                        Choisir PDFs
                    </button>
                </div>
            </div>

            <div class="import-card">
                <h4>🔍 Indexer les PDFs pour le Chat RAG</h4>
                <p>Permettra de poser des questions au corpus.</p>
                <div class="import-actions">
                    <button class="btn btn--primary" id="runIndexingBtn">Indexer les PDFs</button>
                </div>
            </div>

            <div class="import-card">
                <h4>🌐 Récupération automatique de PDFs</h4>
                <p>Recherche automatique via Unpaywall pour les articles avec DOI.</p>
                <div class="import-actions">
                    <button class="btn btn--secondary" onclick="showFetchOnlinePDFsModal()">
                        Configurer récupération
                    </button>
                </div>
            </div>

            <div class="import-card">
                <h4>📝 Ajouter des articles manuellement</h4>
                <p>Saisissez des identifiants d'articles (PMID, DOI, ArXiv ID) séparés par des retours à la ligne.</p>
                <div class="import-actions">
                    <button class="btn btn--secondary" onclick="showAddManualArticlesModal()">
                        Ajouter manuellement
                    </button>
                </div>
            </div>
        </div>
    `;
}

// ============================
// Chat Section
// ============================
async function loadChatMessages() {
    if (!appState.currentProject?.id || !elements.chatContainer) {
        if (elements.chatContainer) {
            elements.chatContainer.innerHTML = `
                <div class="chat-placeholder">
                    <span class="chat-placeholder__icon">💬</span>
                    <p>Sélectionnez un projet pour accéder au chat.</p>
                </div>
            `;
        }
        return;
    }

    try {
        const messages = await fetchAPI(`/projects/${appState.currentProject.id}/chat`);
        appState.chatMessages = messages || [];
        renderChatInterface(appState.chatMessages);
    } catch (e) {
        elements.chatContainer.innerHTML = '<p class="error">Erreur lors du chargement du chat.</p>';
    }
}

function renderChatInterface(messages = []) {
    if (!elements.chatContainer) return;

    const messagesHtml = messages.map(msg => `
        <div class="chat-message chat-message--${msg.role}">
            <div class="chat-message__content">${escapeHtml(msg.content)}</div>
            ${msg.sources ? `<div class="chat-message__sources">Sources: ${escapeHtml(msg.sources)}</div>` : ''}
        </div>
    `).join('');

    elements.chatContainer.innerHTML = `
        <div class="chat-interface">
            <div class="chat-header">
                <h3>💬 Chat avec le corpus</h3>
                <div class="chat-status">Prêt à répondre</div>
            </div>
            <div class="chat-messages">
                ${messages.length > 0 ? messagesHtml : `
                    <div class="chat-welcome">
                        <span class="chat-welcome__icon">🤖</span>
                        <p>Posez une question sur vos documents indexés</p>
                    </div>
                `}
            </div>
            <div class="chat-input">
                <textarea id="chatInput" class="form-control" placeholder="Posez votre question..." rows="3"></textarea>
                <button class="btn btn--primary" onclick="sendChatMessage()">Envoyer</button>
            </div>
        </div>
    `;
}

// ============================
// Validation Section
// ============================
async function loadValidationSection() {
    if (!appState.currentProject?.id || !elements.validationContainer) {
        if (elements.validationContainer) {
            elements.validationContainer.innerHTML = `
                <div class="validation-placeholder">
                    <span class="validation-placeholder__icon">✅</span>
                    <p>Sélectionnez un projet pour accéder à la validation.</p>
                </div>
            `;
        }
        return;
    }

    try {
        showLoadingOverlay(true, 'Chargement de la validation...');
        
        const [extractions, kappa] = await Promise.all([
            fetchAPI(`/projects/${appState.currentProject.id}/extractions`),
            fetchAPI(`/projects/${appState.currentProject.id}/inter-rater-stats`)
        ]);

        appState.currentValidations = extractions || [];
        renderValidationSection(kappa);
    } catch (e) {
        console.error('Erreur chargement validation:', e);
        elements.validationContainer.innerHTML = '<p class="error">Erreur lors du chargement de la validation.</p>';
    } finally {
        showLoadingOverlay(false);
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
                        ✓ Inclure
                    </button>
                    <button class="btn btn--error btn--sm" onclick="validateExtraction('${extraction.id}', 'exclude')">
                        ✗ Exclure
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

function validateExtraction(extractionId, decision) {
    // TODO: Implémenter la validation côté serveur
    console.log(`Validation: ${extractionId} -> ${decision}`);
    showToast(`Article ${decision === 'include' ? 'inclus' : 'exclu'}`, 'success');
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
    showModal('📥 Importer des validations', content);
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
        
        showToast('Validations importées avec succès', 'success');
        await loadValidationSection();
    } catch (e) {
        showToast(`Erreur lors de l'import: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

async function exportValidations() {
    try {
        window.open(`/api/projects/${appState.currentProject.id}/export-validations`);
        showToast('Export des validations lancé', 'success');
    } catch (e) {
        showToast(`Erreur lors de l'export: ${e.message}`, 'error');
    }
}

async function calculateKappa() {
    try {
        showLoadingOverlay(true, 'Calcul du coefficient Kappa...');
        
        await fetchAPI(`/projects/${appState.currentProject.id}/calculate-kappa`, {
            method: 'POST'
        });
        
        showToast('Calcul du Kappa lancé', 'success');
        // Recharger après un délai pour laisser le temps au calcul
        setTimeout(() => loadValidationSection(), 2000);
    } catch (e) {
        showToast(`Erreur lors du calcul: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

// ============================
// Settings Section
// ============================
async function loadSettings() {
    if (!elements.settingsContainer) return;
    renderSettings();
}

function renderSettings() {
    if (!elements.settingsContainer) return;

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
                    ${renderQueuesStatus()}
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

function renderQueuesStatus() {
    // TODO: Charger le statut des queues depuis l'API
    return `
        <div class="queue-status">
            <div class="queue-item">
                <span class="queue-name">Processing</span>
                <span class="queue-count">0 tâches</span>
            </div>
            <div class="queue-item">
                <span class="queue-name">Synthesis</span>
                <span class="queue-count">0 tâches</span>
            </div>
            <div class="queue-item">
                <span class="queue-name">Analysis</span>
                <span class="queue-count">0 tâches</span>
            </div>
        </div>
    `;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showCreateProfileModal() {
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
            body: profile
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
            body: { model }
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
    showModal('✏️ Modifier le prompt', content, 'modal__content--large');
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
            body: promptData
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

// ============================
// Project Actions
// ============================
async function handleCreateProject() {
    const name = prompt('Nom du projet:');
    const description = prompt('Description (optionnelle):');
    
    if (!name) return;

    try {
        showLoadingOverlay(true, 'Création du projet...');
        await fetchAPI('/projects', {
            method: 'POST',
            body: { name, description }
        });
        
        await loadProjects();
        renderProjectList();
        showToast('Projet créé', 'success');
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

async function deleteProject(projectId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce projet ?')) return;

    try {
        showLoadingOverlay(true, 'Suppression du projet...');
        await fetchAPI(`/projects/${projectId}`, { method: 'DELETE' });
        
        if (appState.currentProject?.id === projectId) {
            appState.currentProject = null;
            elements.projectDetailContent.innerHTML = '<p>Sélectionnez un projet pour voir les détails.</p>';
        }
        
        await loadProjects();
        renderProjectList();
        showToast('Projet supprimé', 'success');
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

async function selectProject(projectId) {
    try {
        const project = await fetchAPI(`/projects/${projectId}`);
        appState.currentProject = project;

        // Rejoindre la room WebSocket du projet
        if (appState.socket) {
            appState.socket.emit('join_room', { room: projectId });
        }

        renderProjectList();
        renderProjectDetail(project);

        // Charger les données selon la section courante
        switch (appState.currentSection) {
            case 'results':
                await loadSearchResults();
                break;
            case 'analyses':
                await loadProjectAnalyses();
                break;
            case 'import':
                renderImportSection();
                break;
            case 'chat':
                await loadChatMessages();
                break;
            case 'validation':
                await loadValidationSection();
                break;
        }
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    }
}

function showMultiDatabaseSearchModal() {
    if (!appState.currentProject) {
        showToast('Sélectionnez un projet', 'warning');
        return;
    }

    const databases = appState.availableDatabases.map(db => `
        <div class="checkbox-item">
            <input type="checkbox" id="db-${db.id}" value="${db.id}" checked>
            <label for="db-${db.id}">${escapeHtml(db.name)}</label>
        </div>
    `).join('');

    const content = `
        <form onsubmit="handleMultiDatabaseSearch(event)">
            <div class="form-group">
                <label class="form-label">Requête de recherche</label>
                <textarea name="query" class="form-control" rows="3" placeholder="Entrez votre requête de recherche..." required></textarea>
            </div>
            <div class="form-group">
                <label class="form-label">Bases de données</label>
                <div class="checkbox-group">
                    ${databases}
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Résultats max par base</label>
                <input type="number" name="max_results" value="50" min="1" max="200" class="form-control">
            </div>
            <div class="modal__actions">
                <button type="button" class="btn btn--secondary" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn--primary">Lancer la recherche</button>
            </div>
        </form>
    `;
    showModal('🔍 Recherche multi-bases', content);
}

async function handleMultiDatabaseSearch(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const query = formData.get('query');
    const maxResults = parseInt(formData.get('max_results'));
    const selectedDatabases = Array.from(event.target.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);

    if (!query || selectedDatabases.length === 0) {
        showToast('Veuillez remplir tous les champs', 'warning');
        return;
    }

    try {
        closeModal();
        showLoadingOverlay(true, 'Lancement de la recherche...');
        
        await fetchAPI('/search', {
            method: 'POST',
            body: {
                project_id: appState.currentProject.id,
                query,
                databases: selectedDatabases,
                max_results_per_db: maxResults
            }
        });
        
        showToast('Recherche lancée', 'success');
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

function showRunPipelineModal() {
    if (!appState.currentProject) {
        showToast('Sélectionnez un projet', 'warning');
        return;
    }

    const profiles = appState.analysisProfiles.map(profile => `
        <option value="${profile.id}">${escapeHtml(profile.name)}</option>
    `).join('');

    const content = `
        <form onsubmit="handleRunPipeline(event)">
            <div class="form-group">
                <label class="form-label">Profil d'analyse</label>
                <select name="profile" class="form-control" required>
                    ${profiles}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Mode d'analyse</label>
                <select name="analysis_mode" class="form-control" required>
                    <option value="screening">Screening (titre/résumé)</option>
                    <option value="full_extraction">Extraction complète (PDF requis)</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Articles sélectionnés</label>
                <div class="form-text">
                    ${appState.selectedSearchResults.size} article(s) sélectionné(s)
                </div>
            </div>
            <div class="modal__actions">
                <button type="button" class="btn btn--secondary" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn--primary">Lancer l'analyse</button>
            </div>
        </form>
    `;
    showModal('⚙️ Lancer l\'analyse', content);
}

async function handleRunPipeline(event) {
    event.preventDefault();
    
    if (!appState.currentProject || appState.selectedSearchResults.size === 0) {
        showToast('Sélectionnez au moins un article', 'warning');
        return;
    }

    const formData = new FormData(event.target);
    const profile = formData.get('profile');
    const analysisMode = formData.get('analysis_mode');

    try {
        closeModal();
        showLoadingOverlay(true, 'Lancement du pipeline...');
        
        await fetchAPI(`/projects/${appState.currentProject.id}/run`, {
            method: 'POST',
            body: {
                articles: Array.from(appState.selectedSearchResults),
                profile,
                analysis_mode: analysisMode
            }
        });
        
        showToast('Pipeline lancé', 'success');
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

function showRunAnalysisModal() {
    if (!appState.currentProject) {
        showToast('Sélectionnez un projet', 'warning');
        return;
    }

    const profiles = appState.analysisProfiles.map(profile => `
        <option value="${profile.id}">${escapeHtml(profile.name)}</option>
    `).join('');

    const content = `
        <form onsubmit="handleRunAnalysis(event)">
            <div class="form-group">
                <label class="form-label">Type d'analyse</label>
                <select name="analysis_type" class="form-control" required>
                    <option value="meta_analysis">Méta-analyse</option>
                    <option value="prisma_flow">Diagramme PRISMA</option>
                    <option value="atn_scores">Scores ATN</option>
                    <option value="knowledge_graph">Graphe de connaissances</option>
                    <option value="discussion">Génération de discussion</option>
                </select>
            </div>
            <div class="modal__actions">
                <button type="button" class="btn btn--secondary" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn--primary">Lancer l'analyse</button>
            </div>
        </form>
    `;
    showModal('🔬 Lancer une analyse', content);
}

async function handleRunAnalysis(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const analysisType = formData.get('analysis_type');

    try {
        closeModal();
        showLoadingOverlay(true, `Lancement de l'analyse ${analysisType}...`);
        
        await fetchAPI(`/projects/${appState.currentProject.id}/run-analysis`, {
            method: 'POST',
            body: { type: analysisType }
        });
        
        showToast('Analyse lancée avec succès', 'success');
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

// NOUVELLE FONCTION - Ajout manuel d'articles
function showAddManualArticlesModal() {
    if (!appState.currentProject) {
        showToast('Sélectionnez un projet', 'warning');
        return;
    }

    const content = `
        <form onsubmit="handleAddManualArticles(event)" class="manual-article-form">
            <div class="form-group">
                <label class="form-label">Identifiants d'articles</label>
                <textarea name="articles" class="form-control" rows="8" placeholder="Entrez les identifiants un par ligne:&#10;PMC1234567&#10;10.1000/article.doi&#10;arXiv:2301.12345" required></textarea>
                <div class="form-text">
                    Formats supportés: PMID, PMC, DOI, ArXiv ID<br>
                    Un identifiant par ligne
                </div>
            </div>
            <div class="form-group">
                <div class="checkbox-item">
                    <input type="checkbox" id="fetch_metadata" name="fetch_metadata" checked>
                    <label for="fetch_metadata">Récupérer automatiquement les métadonnées</label>
                </div>
            </div>
            <div class="modal__actions">
                <button type="button" class="btn btn--secondary" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn--primary">Ajouter les articles</button>
            </div>
        </form>
    `;
    showModal('📝 Ajouter des articles manuellement', content);
}

// NOUVELLE FONCTION - Gestionnaire pour l'ajout manuel d'articles
async function handleAddManualArticles(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const articlesText = formData.get('articles').trim();
    const fetchMetadata = formData.has('fetch_metadata');

    if (!articlesText) {
        showToast('Veuillez saisir au moins un identifiant d\'article', 'warning');
        return;
    }

    // Nettoyer et diviser les identifiants
    const articles = articlesText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    if (articles.length === 0) {
        showToast('Aucun identifiant valide trouvé', 'warning');
        return;
    }

    try {
        closeModal();
        showLoadingOverlay(true, `Ajout de ${articles.length} article(s)...`);
        
        const response = await fetchAPI(`/projects/${appState.currentProject.id}/add-manual-articles`, {
            method: 'POST',
            body: {
                articles: articles,
                fetch_metadata: fetchMetadata
            }
        });
        
        showToast(response.message, 'success');
        
        // Rafraîchir les données du projet
        await refreshCurrentProjectData();
        
        // Si on est sur la section résultats, les recharger
        if (appState.currentSection === 'results') {
            await loadSearchResults();
        }
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

function showFetchOnlinePDFsModal() {
    if (!appState.currentProject) {
        showToast('Sélectionnez un projet', 'warning');
        return;
    }

    const content = `
        <form onsubmit="handleFetchOnlinePDFs(event)">
            <div class="form-group">
                <label class="form-label">Identifiants d'articles avec DOI</label>
                <textarea name="articles" class="form-control" rows="6" placeholder="Entrez les identifiants un par ligne:&#10;10.1000/article.doi&#10;PMC1234567" required></textarea>
                <div class="form-text">
                    Recherche automatique via Unpaywall pour les articles en open access
                </div>
            </div>
            <div class="modal__actions">
                <button type="button" class="btn btn--secondary" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn--primary">Lancer la recherche</button>
            </div>
        </form>
    `;
    showModal('🌐 Récupération automatique de PDFs', content);
}

async function handleFetchOnlinePDFs(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const articlesText = formData.get('articles').trim();

    if (!articlesText) {
        showToast('Veuillez saisir au moins un identifiant', 'warning');
        return;
    }

    const articles = articlesText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    try {
        closeModal();
        showLoadingOverlay(true, 'Recherche de PDFs en ligne...');
        
        await fetchAPI(`/projects/${appState.currentProject.id}/fetch-online-pdfs`, {
            method: 'POST',
            body: { articles }
        });
        
        showToast('Recherche de PDFs lancée', 'success');
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

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

    async function handleRunIndexing(projectId) {
        try {
            showLoadingOverlay(true, 'Indexation des PDFs...');
            
            const response = await fetchAPI(`/projects/${projectId}/index`, {
                method: 'POST'
            });
            
            showToast('Indexation lancée', 'success');
            
        } catch (e) {
            console.error('Erreur indexation:', e);
            showToast(`Erreur: ${e.message}`, 'error');
        } finally {
            showLoadingOverlay(false);
        }
    }

    // ============================ 
    // Fonctions d'analyse
    // ============================

    async function loadProjectAnalyses() {
        if (!elements.analysisContainer) return;
        
        try {
            showLoadingOverlay(true, 'Chargement des analyses...');
            
            const project = appState.currentProject;
            if (!project) {
                elements.analysisContainer.innerHTML = '<p>Sélectionnez un projet pour voir les analyses.</p>';
                return;
            }

            renderAnalysisSection(project);
            
        } catch (e) {
            console.error('Erreur chargement analyses:', e);
            elements.analysisContainer.innerHTML = '<p>Erreur lors du chargement des analyses.</p>';
        } finally {
            showLoadingOverlay(false);
        }
    }

    async function handleRunAnalysis(projectId, analysisType) {
        try {
            showLoadingOverlay(true, `Lancement de l'analyse ${analysisType}...`);
            
            const response = await fetchAPI(`/projects/${projectId}/run-analysis`, {
                method: 'POST',
                body: { type: analysisType }
            });
            
            showToast(`Analyse ${analysisType} lancée`, 'success');
            
        } catch (e) {
            console.error(`Erreur analyse ${analysisType}:`, e);
            showToast(`Erreur: ${e.message}`, 'error');
        } finally {
            showLoadingOverlay(false);
        }
    }

    async function handleRunSynthesis(projectId) {
        const profileSelect = document.getElementById('synthesisProfileSelect');
        const profileId = profileSelect?.value || 'standard';
        
        try {
            showLoadingOverlay(true, 'Génération de la synthèse...');
            
            await fetchAPI(`/projects/${projectId}/run-synthesis`, {
                method: 'POST',
                body: { profile: profileId }
            });
            
            showToast('Synthèse lancée', 'success');
            
        } catch (e) {
            console.error('Erreur synthèse:', e);
            showToast(`Erreur: ${e.message}`, 'error');
        } finally {
            showLoadingOverlay(false);
        }
    }

    // ============================ 
    // Fonctions de pipeline
    // ============================

    async function handleRunPipeline(projectId) {
        const form = document.getElementById('runPipelineForm');
        if (!form) return;
        
        const formData = new FormData(form);
        const selectedArticles = Array.from(appState.selectedSearchResults);
        
        if (selectedArticles.length === 0) {
            showToast('Sélectionnez au moins un article', 'warning');
            return;
        }
        
        try {
            showLoadingOverlay(true, 'Lancement du pipeline...');
            
            const payload = {
                articles: selectedArticles,
                profile: formData.get('profile') || 'standard',
                analysis_mode: formData.get('analysis_mode') || 'screening',
                custom_grid_id: formData.get('custom_grid_id') || null
            };
            
            await fetchAPI(`/projects/${projectId}/run`, {
                method: 'POST',
                body: payload
            });
            
            showToast('Pipeline lancé', 'success');
            appState.selectedSearchResults.clear();
            await loadSearchResults();
            
        } catch (e) {
            console.error('Erreur pipeline:', e);
            showToast(`Erreur: ${e.message}`, 'error');
        } finally {
            showLoadingOverlay(false);
        }
    }

    // ============================ 
    // Fonctions upload/import
    // ============================

    async function handleZoteroFileUpload(event) {
        const file = event.target.files[0];
        if (!file || !appState.currentProject) return;
        
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            showLoadingOverlay(true, 'Import Zotero...');
            
            await fetchAPI(`/projects/${appState.currentProject.id}/import-zotero-file`, {
                method: 'POST',
                body: formData
            });
            
            showToast('Import Zotero lancé', 'success');
            event.target.value = '';
            
        } catch (e) {
            console.error('Erreur import Zotero:', e);
            showToast(`Erreur: ${e.message}`, 'error');
        } finally {
            showLoadingOverlay(false);
        }
    }

    async function handleBulkPDFUpload(event) {
        const files = Array.from(event.target.files);
        if (files.length === 0 || !appState.currentProject) return;
        
        const formData = new FormData();
        files.forEach(file => formData.append('files', file));
        
        try {
            showLoadingOverlay(true, 'Upload des PDFs...');
            
            const result = await fetchAPI(`/projects/${appState.currentProject.id}/upload-pdfs-bulk`, {
                method: 'POST',
                body: formData
            });
            
            showToast(`${result.successful.length} PDFs uploadés`, 'success');
            if (result.failed.length > 0) {
                showToast(`${result.failed.length} échecs`, 'warning');
            }
            
            event.target.value = '';
            
        } catch (e) {
            console.error('Erreur upload PDFs:', e);
            showToast(`Erreur: ${e.message}`, 'error');
        } finally {
            showLoadingOverlay(false);
        }
    }

    async function handleManualArticleImport() {
        const textarea = document.getElementById('manualArticlesTextarea');
        const fetchMetadata = document.getElementById('fetchMetadataCheckbox')?.checked || true;
        
        if (!textarea?.value.trim() || !appState.currentProject) {
            showToast('Saisissez des identifiants d\'articles', 'warning');
            return;
        }
        
        const articles = textarea.value
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
        
        if (articles.length === 0) {
            showToast('Aucun identifiant valide trouvé', 'warning');
            return;
        }
        
        try {
            showLoadingOverlay(true, 'Import des articles...');
            
            const result = await fetchAPI(`/projects/${appState.currentProject.id}/add-manual-articles`, {
                method: 'POST',
                body: {
                    articles: articles,
                    fetch_metadata: fetchMetadata
                }
            });
            
            showToast(result.message, 'success');
            textarea.value = '';
            await loadSearchResults();
            
        } catch (e) {
            console.error('Erreur import manuel:', e);
            showToast(`Erreur: ${e.message}`, 'error');
        } finally {
            showLoadingOverlay(false);
        }
    }

    // ============================ 
    // Fonctions de validation
    // ============================

    async function handleValidationAction(extractionId, action) {
        try {
            await fetchAPI(`/extractions/${extractionId}/validate`, {
                method: 'POST',
                body: { action: action }
            });
            
            showToast(`Article ${action === 'include' ? 'inclus' : 'exclu'}`, 'success');
            await loadValidationSection();
            
        } catch (e) {
            console.error('Erreur validation:', e);
            showToast(`Erreur: ${e.message}`, 'error');
        }
    }

    async function handleExportValidations(projectId) {
        try {
            const response = await fetch(`/api/projects/${projectId}/export-validations`);
            
            if (!response.ok) {
                throw new Error('Erreur export');
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `validations_${projectId}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            showToast('Export terminé', 'success');
            
        } catch (e) {
            console.error('Erreur export validations:', e);
            showToast(`Erreur: ${e.message}`, 'error');
        }
    }

    async function handleImportValidations(projectId) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const formData = new FormData();
            formData.append('file', file);
            
            try {
                showLoadingOverlay(true, 'Import des validations...');
                
                const result = await fetchAPI(`/projects/${projectId}/import-validations`, {
                    method: 'POST',
                    body: formData
                });
                
                showToast(result.message, 'success');
                await loadValidationSection();
                
            } catch (e) {
                console.error('Erreur import validations:', e);
                showToast(`Erreur: ${e.message}`, 'error');
            } finally {
                showLoadingOverlay(false);
            }
        };
        
        input.click();
    }

    async function handleCalculateKappa(projectId) {
        try {
            showLoadingOverlay(true, 'Calcul du Kappa...');
            
            await fetchAPI(`/projects/${projectId}/calculate-kappa`, {
                method: 'POST'
            });
            
            showToast('Calcul du Kappa lancé', 'success');
            
        } catch (e) {
            console.error('Erreur calcul Kappa:', e);
            showToast(`Erreur: ${e.message}`, 'error');
        } finally {
            showLoadingOverlay(false);
        }
    }

    // ============================ 
    // Fonctions de chat
    // ============================

    async function loadChatMessages() {
        if (!appState.currentProject?.id || !elements.chatContainer) return;
        
        try {
            const messages = await fetchAPI(`/projects/${appState.currentProject.id}/chat`);
            appState.chatMessages = Array.isArray(messages) ? messages : [];
            renderChatInterface(appState.chatMessages);
            
        } catch (e) {
            console.error('Erreur chargement chat:', e);
            elements.chatContainer.innerHTML = '<p>Erreur lors du chargement du chat.</p>';
        }
    }

    async function handleSendChatMessage() {
        const textarea = document.getElementById('chatInput');
        const question = textarea?.value.trim();
        
        if (!question || !appState.currentProject?.id) {
            showToast('Saisissez une question', 'warning');
            return;
        }
        
        // Ajouter le message utilisateur immédiatement
        const userMessage = {
            id: Date.now(),
            role: 'user',
            content: question,
            timestamp: new Date().toISOString()
        };
        
        appState.chatMessages.push(userMessage);
        renderChatInterface(appState.chatMessages);
        textarea.value = '';
        
        try {
            await fetchAPI(`/projects/${appState.currentProject.id}/chat`, {
                method: 'POST',
                body: { question: question }
            });
            
            showToast('Question envoyée', 'success');
            
            // Recharger les messages après un délai
            setTimeout(() => loadChatMessages(), 2000);
            
        } catch (e) {
            console.error('Erreur envoi message:', e);
            showToast(`Erreur: ${e.message}`, 'error');
            
            // Retirer le message utilisateur en cas d'erreur
            appState.chatMessages.pop();
            renderChatInterface(appState.chatMessages);
        }
    }

    // ============================ 
    // Fonctions de paramètres
    // ============================

    async function loadSettings() {
        if (!elements.settingsContainer) return;
        
        try {
            showLoadingOverlay(true, 'Chargement des paramètres...');
            
            const [queues, zoteroSettings] = await Promise.all([
                fetchAPI('/queues/info'),
                fetchAPI('/settings/zotero')
            ]);
            
            appState.queuesInfo = Array.isArray(queues) ? queues : [];
            renderSettingsSection(zoteroSettings);
            
        } catch (e) {
            console.error('Erreur chargement paramètres:', e);
            elements.settingsContainer.innerHTML = '<p>Erreur lors du chargement des paramètres.</p>';
        } finally {
            showLoadingOverlay(false);
        }
    }

    async function handleSaveZoteroSettings() {
        const form = document.getElementById('zoteroSettingsForm');
        if (!form) return;
        
        const formData = new FormData(form);
        
        try {
            await fetchAPI('/settings/zotero', {
                method: 'POST',
                body: {
                    userId: formData.get('userId'),
                    apiKey: formData.get('apiKey')
                }
            });
            
            showToast('Paramètres Zotero sauvegardés', 'success');
            
        } catch (e) {
            console.error('Erreur sauvegarde Zotero:', e);
            showToast(`Erreur: ${e.message}`, 'error');
        }
    }

    async function handlePullOllamaModel() {
        const input = document.getElementById('ollamaModelInput');
        const modelName = input?.value.trim();
        
        if (!modelName) {
            showToast('Saisissez le nom du modèle', 'warning');
            return;
        }
        
        try {
            showLoadingOverlay(true, `Téléchargement du modèle ${modelName}...`);
            
            await fetchAPI('/ollama/pull', {
                method: 'POST',
                body: { model: modelName }
            });
            
            showToast(`Téléchargement de ${modelName} lancé`, 'success');
            input.value = '';
            
            // Recharger la liste des modèles après un délai
            setTimeout(async () => {
                try {
                    appState.ollamaModels = await fetchAPI('/ollama/models');
                    renderSettingsSection();
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

    async function handleClearQueue(queueName) {
        try {
            await fetchAPI(`/queues/${queueName}/clear`, {
                method: 'POST'
            });
            
            showToast(`File ${queueName} vidée`, 'success');
            await loadSettings();
            
        } catch (e) {
            console.error(`Erreur vidage file ${queueName}:`, e);
            showToast(`Erreur: ${e.message}`, 'error');
        }
    }

    // ============================ 
    // Utilitaires UI
    // ============================

    function showLoadingOverlay(show, message = 'Chargement...') {
        if (!elements.loadingOverlay) return;
        
        elements.loadingOverlay.classList.toggle('loading-overlay--show', show);
        
        if (show && message) {
            const messageEl = elements.loadingOverlay.querySelector('.loading-overlay__message');
            if (messageEl) {
                messageEl.textContent = message;
            }
        }
    }

    function showToast(message, type = 'info', duration = 5000) {
        if (!elements.toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        
        const iconMap = {
            success: '✅',
            error: '❌', 
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        toast.innerHTML = `
            <span class="toast__icon">${iconMap[type] || iconMap.info}</span>
            <span class="toast__message">${escapeHtml(message)}</span>
            <button class="toast__close" onclick="this.parentElement.remove()">&times;</button>
        `;
        
        elements.toastContainer.appendChild(toast);
        
        // Auto-suppression
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, duration);
    }

    function closeModal() {
        const modals = document.querySelectorAll('.modal--show');
        modals.forEach(modal => {
            modal.classList.remove('modal--show');
        });
    }

    function getStatusClass(status) {
        const statusMap = {
            'pending': 'status--info',
            'searching': 'status--warning',
            'search_completed': 'status--success',
            'processing': 'status--warning',
            'synthesizing': 'status--warning',
            'completed': 'status--success',
            'failed': 'status--error',
            'search_failed': 'status--error'
        };
        
        return statusMap[status] || 'status--info';
    }

    // ============================ 
    // Event handlers globaux
    // ============================

    // Gestion de la sélection d'articles
    function toggleArticleSelection(articleId, checked) {
        if (checked) {
            appState.selectedSearchResults.add(articleId);
        } else {
            appState.selectedSearchResults.delete(articleId);
        }
        
        // Mettre à jour l'affichage du compteur
        updateSelectionCounter();
    }

    function selectAllArticles() {
        const checkboxes = document.querySelectorAll('.article-select-checkbox');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        
        checkboxes.forEach(cb => {
            cb.checked = !allChecked;
            toggleArticleSelection(cb.value, !allChecked);
        });
    }

    function updateSelectionCounter() {
        const counter = document.querySelector('.selection-counter');
        if (counter) {
            const count = appState.selectedSearchResults.size;
            counter.textContent = `${count} article(s) sélectionné(s)`;
        }
    }

    // Gestion des détails d'articles
    function toggleAbstractRow(articleId) {
        const abstractRow = document.getElementById(`abstract-${articleId}`);
        if (abstractRow) {
            abstractRow.classList.toggle('hidden');
        }
    }

    function showExtractionDetails(extractionId) {
        const extraction = appState.currentProjectExtractions.find(e => e.id === extractionId);
        if (!extraction) return;
        
        const modal = document.getElementById('extractionDetailsModal');
        if (!modal) return;
        
        const modalContent = modal.querySelector('.modal__body');
        if (!modalContent) return;
        
        let extractedDataHtml = '';
        if (extraction.extracted_data) {
            try {
                const data = JSON.parse(extraction.extracted_data);
                extractedDataHtml = Object.entries(data)
                    .map(([key, value]) => `
                        <div class="detail-section">
                            <label>${escapeHtml(key)}:</label>
                            <div class="detail-text">${escapeHtml(String(value))}</div>
                        </div>
                    `).join('');
            } catch (e) {
                extractedDataHtml = `
                    <div class="detail-section">
                        <label>Données extraites (JSON):</label>
                        <div class="detail-json">${escapeHtml(extraction.extracted_data)}</div>
                    </div>
                `;
            }
        }
        
        modalContent.innerHTML = `
            <div class="extraction-details">
                <div class="extraction-header">
                    <h4>${escapeHtml(extraction.title || 'Article sans titre')}</h4>
                    <div class="article-id-display">ID: ${escapeHtml(extraction.pmid)}</div>
                </div>
                
                <div class="extraction-details-grid">
                    <div class="detail-item">
                        <label>Score de pertinence</label>
                        <div class="detail-value score-value">${extraction.relevance_score || 'N/A'}/10</div>
                    </div>
                    
                    <div class="detail-item">
                        <label>Source d'analyse</label>
                        <div class="detail-value">${escapeHtml(extraction.analysis_source || 'N/A')}</div>
                    </div>
                    
                    <div class="detail-item">
                        <label>Date de création</label>
                        <div class="detail-value">${extraction.created_at ? new Date(extraction.created_at).toLocaleDateString() : 'N/A'}</div>
                    </div>
                </div>
                
                ${extraction.relevance_justification ? `
                    <div class="detail-section">
                        <label>Justification</label>
                        <div class="detail-text">${escapeHtml(extraction.relevance_justification)}</div>
                    </div>
                ` : ''}
                
                ${extractedDataHtml}
            </div>
        `;
        
        modal.classList.add('modal--show');
    }

    // Initialisation finale
    window.analylit = {
        // API publique pour les fonctions accessibles depuis le HTML
        toggleArticleSelection,
        selectAllArticles,
        toggleAbstractRow,
        showExtractionDetails,
        handleValidationAction,
        handleSendChatMessage,
        handleManualArticleImport,
        handleExportValidations: () => handleExportValidations(appState.currentProject?.id),
        handleImportValidations: () => handleImportValidations(appState.currentProject?.id),
        handleCalculateKappa: () => handleCalculateKappa(appState.currentProject?.id),
        handleSaveZoteroSettings,
        handlePullOllamaModel,
        handleClearQueue
    };
    
    console.log('AnalyLit v4.1 initialisé');
})();
