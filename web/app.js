// web/app.js — Frontend complet AnalyLit v4.1 (JS pur, synchronisé) - CORRIGÉ

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
        "'": '&#x27;'
    };
    return String(text).replace(/[&<>"']/g, (m) => map[m]);
}

function renderProjectList() {
    if (!elements.projectsList) return;
    
    const projects = Array.isArray(appState.projects) ? appState.projects : [];
    
    if (projects.length === 0) {
        elements.projectsList.innerHTML = `
            <div class="projects-empty">
                <span class="projects-empty__icon">📋</span>
                <p>Aucun projet créé. Cliquez sur "Nouveau projet" pour commencer.</p>
            </div>
        `;
        return;
    }
    
    const projectsHtml = projects.map(project => {
        const isActive = appState.currentProject?.id === project.id;
        const statusClass = getStatusClass(project.status);
        
        return `
            <div class="project-card ${isActive ? 'project-card--active' : ''}" onclick="selectProject('${project.id}')">
                <div class="project-card__header">
                    <div class="project-card__info">
                        <h3 class="project-card__title">${escapeHtml(project.name)}</h3>
                        <p class="project-card__description">${escapeHtml(project.description || 'Aucune description')}</p>
                    </div>
                    <span class="status ${statusClass}">${escapeHtml(project.status || 'pending')}</span>
                </div>
                <div class="project-card__body">
                    <div class="project-card__stats">
                        <div class="stat-item">
                            <span class="stat-item__label">Total</span>
                            <span class="stat-item__value">${project.pmids_count || 0}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-item__label">Traités</span>
                            <span class="stat-item__value">${project.processed_count || 0}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-item__label">Durée</span>
                            <span class="stat-item__value">${project.total_processing_time ? Math.round(project.total_processing_time) + 's' : '0s'}</span>
                        </div>
                    </div>
                </div>
                <div class="project-card__actions">
                    <button class="btn btn--secondary btn--sm" onclick="event.stopPropagation(); selectProject('${project.id}')">Ouvrir</button>
                    <button class="btn btn--outline btn--sm btn--danger" onclick="event.stopPropagation(); deleteProject('${project.id}')">Supprimer</button>
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
    if (!elements.projectDetailContent || !project) {
        elements.projectDetailContent.innerHTML = '<p>Sélectionnez un projet pour voir les détails.</p>';
        return;
    }

    const statusClass = getStatusClass(project.status);
    const stats = {
        total: project.pmids_count || 0,
        processed: project.processed_count || 0,
        time: project.total_processing_time ? `${Math.round(project.total_processing_time)}s` : '0s'
    };

    elements.projectDetailContent.innerHTML = `
        <div class="card">
            <div class="card__header">
                <div>
                    <h3>${escapeHtml(project.name)}</h3>
                    <span class="status ${statusClass}">${escapeHtml(project.status || 'pending')}</span>
                </div>
                <div class="project-actions">
                    <button class="btn btn--primary btn--sm" onclick="showMultiDatabaseSearchModal()">🔍 Rechercher</button>
                    <button class="btn btn--secondary btn--sm" onclick="showRunPipelineModal()">⚙️ Analyser</button>
                </div>
            </div>
            <div class="card__body">
                <p>${escapeHtml(project.description || 'Aucune description')}</p>
                <div class="project-card__stats">
                    <div class="stat-item">
                        <span class="stat-item__label">Articles trouvés</span>
                        <span class="stat-item__value">${stats.total}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-item__label">Articles traités</span>
                        <span class="stat-item__value">${stats.processed}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-item__label">Temps de traitement</span>
                        <span class="stat-item__value">${stats.time}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function getStatusClass(status) {
    const statusMap = {
        'pending': 'status--info',
        'searching': 'status--info',
        'search_completed': 'status--success',
        'processing': 'status--warning',
        'completed': 'status--success',
        'failed': 'status--error',
        'search_failed': 'status--error'
    };
    return statusMap[status] || 'status--info';
}

async function loadSearchResults() {
    if (!appState.currentProject?.id) return;
    
    try {
        // Charger les résultats de recherche ET les extractions
        const [results, extractions] = await Promise.all([
            fetchAPI(`/projects/${appState.currentProject.id}/search-results`),
            fetchAPI(`/projects/${appState.currentProject.id}/extractions`)
        ]);
        
        appState.searchResults = results?.results || [];
        appState.currentProjectExtractions = extractions || [];
        
        renderSearchResults();
    } catch (e) {
        console.error('Erreur loadSearchResults:', e);
        showToast('Erreur lors du chargement des résultats', 'error');
        renderSearchResults();
    }
}

// FONCTION CORRIGÉE - Affichage complet des détails du screening
function renderSearchResults() {
    if (!elements.resultsContainer) return;

    if (!appState.searchResults?.length) {
        elements.resultsContainer.innerHTML = `
            <div class="results-placeholder">
                <span class="results-placeholder__icon">📊</span>
                <p>Aucun résultat de recherche.</p>
                <p>Lancez une recherche pour voir les articles trouvés.</p>
            </div>
        `;
        return;
    }

    // Créer un index des extractions par article_id
    const extractionsByArticle = {};
    if (appState.currentProjectExtractions) {
        appState.currentProjectExtractions.forEach(extraction => {
            extractionsByArticle[extraction.pmid] = extraction;
        });
    }

    const resultsHtml = appState.searchResults.map(result => {
        const extraction = extractionsByArticle[result.article_id];
        const isProcessed = !!extraction;
        
        // Extraire l'année de la date de publication
        const publicationYear = result.publication_date ? 
            new Date(result.publication_date).getFullYear() || 
            result.publication_date.match(/\d{4}/) ? result.publication_date.match(/\d{4}/)[0] : 'N/A'
            : 'N/A';
        
        // Truncate abstract for display
        const abstractPreview = result.abstract && result.abstract.length > 200 ? 
            result.abstract.substring(0, 200) + '...' : (result.abstract || 'Pas de résumé disponible');

        return `
            <tr class="result-row ${isProcessed ? 'result-row--processed' : ''}" data-article-id="${result.article_id}">
                <td>
                    <input type="checkbox" 
                           ${appState.selectedSearchResults.has(result.article_id) ? 'checked' : ''} 
                           onchange="toggleArticleSelection('${result.article_id}')">
                </td>
                <td class="title-cell">
                    <div class="article-info">
                        <div class="title-text" onclick="toggleAbstractRow('${result.article_id}')">
                            ${escapeHtml(result.title || 'Titre non disponible')}
                        </div>
                        <div class="article-meta">
                            <div class="meta-item">
                                <strong>Année:</strong> ${publicationYear}
                            </div>
                            ${result.journal ? `<div class="meta-item"><strong>Journal:</strong> ${escapeHtml(result.journal)}</div>` : ''}
                            <div class="meta-item">
                                <strong>ID:</strong> <span class="article-id">${escapeHtml(result.article_id)}</span>
                            </div>
                        </div>
                        <div class="article-links">
                            ${result.doi ? `<a href="https://doi.org/${result.doi}" target="_blank" class="doi-link">DOI</a>` : ''}
                            ${result.url ? `<a href="${result.url}" target="_blank" class="url-link">URL</a>` : ''}
                        </div>
                    </div>
                </td>
                <td class="authors-cell">
                    <div class="authors-display" title="${escapeHtml(result.authors || 'Auteurs non disponibles')}">
                        ${escapeHtml(result.authors || 'N/A')}
                    </div>
                </td>
                <td class="source-cell">
                    <span class="source-badge source--${escapeHtml(result.database_source || 'unknown')}">
                        ${escapeHtml(result.database_source || 'unknown')}
                    </span>
                </td>
                <td class="analysis-cell">
                    ${extraction ? `
                        <div class="extraction-summary">
                            <div class="score-display">
                                <span class="score-badge">${extraction.relevance_score}/10</span>
                            </div>
                            <div class="extraction-meta">
                                <div class="extraction-source">
                                    <strong>Source:</strong> ${extraction.analysis_source || 'abstract'}
                                </div>
                                ${extraction.relevance_justification ? `
                                    <div class="extraction-justification">
                                        ${escapeHtml(extraction.relevance_justification)}
                                    </div>
                                ` : ''}
                            </div>
                            <div class="extraction-actions">
                                ${extraction.extracted_data ? `
                                    <button class="btn btn--sm btn--outline" onclick="showExtractionDetails('${extraction.id}')">
                                        Détails
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    ` : `
                        <div class="no-analysis">
                            <span class="status status--info status--sm">Non analysé</span>
                        </div>
                    `}
                </td>
            </tr>
            <tr id="abstract-row-${result.article_id}" class="abstract-row hidden">
                <td colspan="5">
                    <div class="abstract-content">
                        <div class="abstract-section">
                            <strong>Résumé :</strong>
                            <p>${escapeHtml(abstractPreview)}</p>
                        </div>
                        ${result.authors || result.journal || result.publication_date ? `
                            <div class="metadata-section">
                                <strong>Métadonnées complètes :</strong>
                                <div class="metadata-grid">
                                    ${result.authors ? `
                                        <div class="metadata-item">
                                            <strong>Auteurs :</strong>
                                            <span>${escapeHtml(result.authors)}</span>
                                        </div>
                                    ` : ''}
                                    ${result.journal ? `
                                        <div class="metadata-item">
                                            <strong>Journal :</strong>
                                            <span>${escapeHtml(result.journal)}</span>
                                        </div>
                                    ` : ''}
                                    ${result.publication_date ? `
                                        <div class="metadata-item">
                                            <strong>Date de publication :</strong>
                                            <span>${escapeHtml(result.publication_date)}</span>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Statistiques
    const totalResults = appState.searchResults.length;
    const processedResults = Object.keys(extractionsByArticle).length;
    const selectedCount = appState.selectedSearchResults.size;

    elements.resultsContainer.innerHTML = `
        <div class="results-header">
            <div class="results-stats">
                <div class="stat-card">
                    <div class="stat-card__value">${totalResults}</div>
                    <div class="stat-card__label">Total</div>
                </div>
                <div class="stat-card stat-card--success">
                    <div class="stat-card__value">${processedResults}</div>
                    <div class="stat-card__label">Analysés</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card__value">${selectedCount}</div>
                    <div class="stat-card__label">Sélectionnés</div>
                </div>
            </div>
            <div class="results-actions">
                <button class="btn btn--outline btn--sm" onclick="selectAllArticles()">Tout sélectionner</button>
                <button class="btn btn--outline btn--sm" onclick="deselectAllArticles()">Tout désélectionner</button>
                <button class="btn btn--primary btn--sm" onclick="showRunPipelineModal()" 
                        ${selectedCount === 0 ? 'disabled' : ''}>
                    Analyser la sélection (${selectedCount})
                </button>
            </div>
        </div>
        
        <div class="results-table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th width="50">Sél.</th>
                        <th>Article & Métadonnées</th>
                        <th width="200">Auteurs</th>
                        <th width="100">Source</th>
                        <th width="250">Analyse & Score</th>
                    </tr>
                </thead>
                <tbody>
                    ${resultsHtml}
                </tbody>
            </table>
        </div>
    `;
}

// Fonctions utilitaires pour l'affichage des résultats
function toggleAbstractRow(articleId) {
    const row = document.getElementById(`abstract-row-${articleId}`);
    if (row) {
        row.classList.toggle('hidden');
    }
}

function showExtractionDetails(extractionId) {
    const extraction = appState.currentProjectExtractions.find(e => e.id === extractionId);
    if (!extraction) return;

    let extractedDataHtml = '';
    if (extraction.extracted_data) {
        try {
            const data = typeof extraction.extracted_data === 'string' ? 
                JSON.parse(extraction.extracted_data) : extraction.extracted_data;
            
            extractedDataHtml = `
                <div class="detail-section">
                    <label>Données extraites :</label>
                    <div class="detail-json">${JSON.stringify(data, null, 2)}</div>
                </div>
            `;
        } catch (e) {
            extractedDataHtml = `
                <div class="detail-section">
                    <label>Données extraites :</label>
                    <div class="detail-text">${escapeHtml(extraction.extracted_data)}</div>
                </div>
            `;
        }
    }

    const content = `
        <div class="extraction-details">
            <div class="extraction-header">
                <h4>${escapeHtml(extraction.title || 'Article sans titre')}</h4>
                <div class="article-id-display">ID: ${escapeHtml(extraction.pmid)}</div>
            </div>
            
            <div class="extraction-details-grid">
                <div class="detail-item">
                    <label>Score de pertinence :</label>
                    <div class="detail-value score-value">${extraction.relevance_score}/10</div>
                </div>
                <div class="detail-item">
                    <label>Source d'analyse :</label>
                    <div class="detail-value">${extraction.analysis_source || 'abstract'}</div>
                </div>
                <div class="detail-item">
                    <label>Date d'analyse :</label>
                    <div class="detail-value">${extraction.created_at ? new Date(extraction.created_at).toLocaleDateString() : 'N/A'}</div>
                </div>
            </div>
            
            ${extraction.relevance_justification ? `
                <div class="detail-section">
                    <label>Justification :</label>
                    <div class="detail-text">${escapeHtml(extraction.relevance_justification)}</div>
                </div>
            ` : ''}
            
            ${extractedDataHtml}
        </div>
    `;

    showModal('📊 Détails de l\'extraction', content);
}

function toggleArticleSelection(articleId) {
    if (appState.selectedSearchResults.has(articleId)) {
        appState.selectedSearchResults.delete(articleId);
    } else {
        appState.selectedSearchResults.add(articleId);
    }
    // Re-render pour mettre à jour les compteurs
    renderSearchResults();
}

function selectAllArticles() {
    appState.selectedSearchResults.clear();
    appState.searchResults.forEach(result => {
        appState.selectedSearchResults.add(result.article_id);
    });
    renderSearchResults();
}

function deselectAllArticles() {
    appState.selectedSearchResults.clear();
    renderSearchResults();
}

async function loadProjectAnalyses() {
    if (!elements.analysisContainer || !appState.currentProject?.id) return;

    try {
        const project = await fetchAPI(`/projects/${appState.currentProject.id}`);
        appState.analysisResults = {
            synthesis: project.synthesis_result,
            discussion: project.discussion_draft,
            knowledge_graph: project.knowledge_graph,
            prisma_flow_path: project.prisma_flow_path,
            analysis_result: project.analysis_result,
            analysis_plot_path: project.analysis_plot_path
        };
        
        renderProjectAnalyses();
    } catch (e) {
        console.error('Erreur loadProjectAnalyses:', e);
        elements.analysisContainer.innerHTML = `
            <div class="analysis-placeholder">
                <span class="analysis-placeholder__icon">⚠️</span>
                <p>Erreur lors du chargement des résultats.</p>
            </div>
        `;
    }
}

function renderProjectAnalyses() {
    if (!elements.analysisContainer) return;

    if (!appState.currentProject) {
        elements.analysisContainer.innerHTML = `
            <div class="analysis-placeholder">
                <span class="analysis-placeholder__icon">📊</span>
                <p>Sélectionnez un projet pour voir les analyses.</p>
            </div>
        `;
        return;
    }

    const analyses = [
        {
            id: 'meta_analysis',
            title: '📊 Méta-analyse',
            description: 'Distribution des scores et IC95%.',
            hasResult: !!appState.analysisResults?.analysis_result,
            result: appState.analysisResults?.analysis_result,
            plotPath: appState.analysisResults?.analysis_plot_path
        },
        {
            id: 'prisma_flow',
            title: '📋 Diagramme PRISMA',
            description: 'Flux PRISMA basé sur vos résultats.',
            hasResult: !!appState.analysisResults?.prisma_flow_path,
            result: appState.analysisResults?.prisma_flow_path
        },
        {
            id: 'atn_scores',
            title: '🎯 Scores ATN',
            description: 'Score thématique sur extractions.',
            hasResult: false
        },
        {
            id: 'knowledge_graph',
            title: '🌐 Graphe de connaissances',
            description: 'Visualisation des concepts et relations entre articles.',
            hasResult: !!appState.analysisResults?.knowledge_graph,
            result: appState.analysisResults?.knowledge_graph
        },
        {
            id: 'discussion',
            title: '📝 Discussion',
            description: 'Génération automatique de section Discussion.',
            hasResult: !!appState.analysisResults?.discussion,
            result: appState.analysisResults?.discussion
        }
    ];

    const analysesHtml = analyses.map(analysis => {
        const { hasResult, result, title, description } = analysis;
        
        return `
            <div class="analysis-card">
                <div class="analysis-card__header">
                    <h4>${title}</h4>
                </div>
                <div class="analysis-card__content">
                    <p>${escapeHtml(description)}</p>
                    ${hasResult ? `
                        <div class="analysis-result">
                            <h5>Résultat :</h5>
                            ${typeof result === 'string' ? escapeHtml(result) : escapeHtml(JSON.stringify(result, null, 2))}
                        </div>
                    ` : ''}
                    <button class="btn btn--primary btn--sm" onclick="runAnalysis('${analysis.id}')">
                        Lancer
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

function renderImportSection() {
    if (!elements.importContainer) return;

    if (!appState.currentProject) {
        elements.importContainer.innerHTML = `
            <div class="import-placeholder">
                <span class="import-placeholder__icon">📁</span>
                <p>Sélectionnez un projet pour importer des fichiers.</p>
            </div>
        `;
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
                        Choisir un fichier
                    </button>
                </div>
            </div>

            <div class="import-card">
                <h4>📄 Uploader des PDFs (jusqu'à 20)</h4>
                <p>Ces PDFs seront liés au projet courant.</p>
                <div class="import-actions">
                    <input type="file" id="bulkPDFInput" accept=".pdf" multiple style="display: none;">
                    <button class="btn btn--primary" onclick="document.getElementById('bulkPDFInput').click()">
                        Choisir des PDFs
                    </button>
                </div>
            </div>

            <div class="import-card">
                <h4>🔍 Indexer les PDFs pour le Chat RAG</h4>
                <p>Permettra de poser des questions au corpus.</p>
                <div class="import-actions">
                    <button class="btn btn--primary" id="runIndexingBtn">
                        Lancer l'indexation
                    </button>
                </div>
            </div>

            <div class="import-card">
                <h4>🌐 Récupération automatique de PDFs</h4>
                <p>Recherche automatique via Unpaywall pour les articles avec DOI.</p>
                <div class="import-actions">
                    <button class="btn btn--secondary" onclick="showFetchOnlinePDFsModal()">
                        Configurer
                    </button>
                </div>
            </div>

            <div class="import-card">
                <h4>📝 Ajouter des articles manuellement</h4>
                <p>Saisissez des identifiants d'articles (PMID, DOI, ArXiv ID) séparés par des retours à la ligne.</p>
                <div class="import-actions">
                    <button class="btn btn--secondary" onclick="showAddManualArticlesModal()">
                        Ajouter des articles
                    </button>
                </div>
            </div>
        </div>
    `;
}

async function loadChatMessages() {
    if (!elements.chatContainer || !appState.currentProject?.id) return;

    try {
        const messages = await fetchAPI(`/projects/${appState.currentProject.id}/chat`);
        appState.chatMessages = Array.isArray(messages) ? messages : [];
        renderChatInterface(appState.chatMessages);
    } catch (e) {
        console.error('Erreur loadChatMessages:', e);
        elements.chatContainer.innerHTML = `
            <div class="chat-placeholder">
                <span class="chat-placeholder__icon">💬</span>
                <p>Erreur lors du chargement du chat.</p>
            </div>
        `;
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
                <div class="chat-status">RAG activé</div>
            </div>
            <div class="chat-messages" id="chatMessages">
                ${messages.length ? messagesHtml : `
                    <div class="chat-welcome">
                        <span class="chat-welcome__icon">💬</span>
                        <p>Posez vos questions sur le corpus de documents indexés.</p>
                    </div>
                `}
            </div>
            <div class="chat-input">
                <textarea id="chatInput" class="form-control" placeholder="Posez votre question..." rows="2"></textarea>
                <button class="btn btn--primary" onclick="sendChatMessage()">Envoyer</button>
            </div>
        </div>
    `;
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
    if (!appState.analysisProfiles?.length) {
        return '<p>Aucun profil disponible.</p>';
    }

    return `
        <div class="profiles-grid">
            ${appState.analysisProfiles.map(profile => `
                <div class="profile-card">
                    <h5>${escapeHtml(profile.name)}</h5>
                    <div class="profile-models">
                        <div class="model-item">
                            <span class="model-label">Préprocess:</span>
                            <span class="model-value">${escapeHtml(profile.preprocess_model)}</span>
                        </div>
                        <div class="model-item">
                            <span class="model-label">Extract:</span>
                            <span class="model-value">${escapeHtml(profile.extract_model)}</span>
                        </div>
                        <div class="model-item">
                            <span class="model-label">Synthèse:</span>
                            <span class="model-value">${escapeHtml(profile.synthesis_model)}</span>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderPrompts() {
    if (!appState.prompts?.length) {
        return '<p>Aucun prompt disponible.</p>';
    }

    return `
        <div class="prompts-list">
            ${appState.prompts.map(prompt => `
                <div class="prompt-item">
                    <div class="prompt-item__info">
                        <h5>${escapeHtml(prompt.name)}</h5>
                        <p>${escapeHtml(prompt.description || 'Aucune description')}</p>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderOllamaModels() {
    if (!appState.ollamaModels?.length) {
        return '<p>Aucun modèle installé</p>';
    }

    return `
        <div class="models-list">
            ${appState.ollamaModels.map(model => `
                <div class="model-item">
                    <div>
                        <div class="model-name">${escapeHtml(model.name)}</div>
                        <div class="model-size">${model.size ? (model.size / 1e9).toFixed(1) + ' GB' : 'Taille inconnue'}</div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderQueuesStatus() {
    if (!appState.queuesInfo?.length) {
        return '<p>Informations de queue non disponibles.</p>';
    }

    return `
        <div class="queue-status">
            ${appState.queuesInfo.map(queue => `
                <div class="queue-item">
                    <span class="queue-name">${escapeHtml(queue.name)}</span>
                    <span class="queue-count">${queue.size} tâches</span>
                </div>
            `).join('')}
        </div>
    `;
}

// ============================
// Modal management
// ============================

function showModal(title, content) {
    const modal = document.createElement('div');
    modal.className = 'modal modal--show';
    modal.innerHTML = `
        <div class="modal__content">
            <div class="modal__header">
                <h3>${title}</h3>
                <button class="modal__close">&times;</button>
            </div>
            <div class="modal__body">
                ${content}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event listeners pour fermer
    modal.querySelector('.modal__close').addEventListener('click', () => closeModal());
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

function closeModal() {
    const modal = document.querySelector('.modal');
    if (modal) {
        modal.remove();
    }
}

function showLoadingOverlay(show, message = 'Chargement...') {
    if (elements.loadingOverlay) {
        elements.loadingOverlay.classList.toggle('loading-overlay--show', show);
        const messageEl = elements.loadingOverlay.querySelector('.loading-overlay__message');
        if (messageEl) {
            messageEl.textContent = message;
        }
    }
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
        <div class="toast__icon">
            ${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}
        </div>
        <div class="toast__message">${escapeHtml(message)}</div>
        <button class="toast__close">&times;</button>
    `;
    
    if (elements.toastContainer) {
        elements.toastContainer.appendChild(toast);
    }
    
    // Auto-remove
    setTimeout(() => toast.remove(), 5000);
    
    // Manual close
    toast.querySelector('.toast__close').addEventListener('click', () => toast.remove());
}

// ============================
// Project actions
// ============================

function handleCreateProject() {
    const content = `
        <form onsubmit="handleCreateProjectSubmit(event)">
            <div class="form-group">
                <label class="form-label">Nom du projet</label>
                <input type="text" name="name" class="form-control" required>
            </div>
            <div class="form-group">
                <label class="form-label">Description (optionnelle)</label>
                <textarea name="description" class="form-control" rows="3"></textarea>
            </div>
            <div class="form-group">
                <label class="form-label">Mode d'analyse</label>
                <select name="mode" class="form-control">
                    <option value="screening">Screening (rapide)</option>
                    <option value="full_extraction">Extraction complète</option>
                </select>
            </div>
            <div class="modal__actions">
                <button type="button" class="btn btn--secondary" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn--primary">Créer</button>
            </div>
        </form>
    `;
    showModal('📋 Nouveau projet', content);
}

async function handleCreateProjectSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    
    try {
        const project = await fetchAPI('/projects', {
            method: 'POST',
            body: {
                name: formData.get('name'),
                description: formData.get('description'),
                mode: formData.get('mode')
            }
        });
        
        closeModal();
        await loadProjects();
        renderProjectList();
        showToast('Projet créé avec succès', 'success');
        
        // Auto-sélection du nouveau projet
        if (project?.id) {
            await selectProject(project.id);
        }
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    }
}

async function deleteProject(projectId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce projet ?')) return;
    
    try {
        showLoadingOverlay(true, 'Suppression du projet...');
        await fetchAPI(`/projects/${projectId}`, { method: 'DELETE' });
        
        // Si le projet supprimé était sélectionné, le désélectionner
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
            <input type="checkbox" id="db-${db}" name="databases" value="${db}" checked>
            <label for="db-${db}">${escapeHtml(db)}</label>
        </div>
    `).join('');

    const content = `
        <form onsubmit="handleMultiDatabaseSearch(event)">
            <div class="form-group">
                <label class="form-label">Requête de recherche</label>
                <input type="text" name="query" class="form-control" required 
                       placeholder="artificial intelligence AND healthcare">
            </div>
            <div class="form-group">
                <label class="form-label">Bases de données</label>
                <div class="checkbox-group">
                    ${databases}
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Résultats max par base</label>
                <input type="number" name="max_results" class="form-control" value="50" min="1" max="500">
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
                <select name="analysis_mode" class="form-control">
                    <option value="screening">Screening (rapide)</option>
                    <option value="full_extraction">Extraction complète</option>
                </select>
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
                    <option value="atn_scores">Scores ATN</option>
                    <option value="discussion">Génération de discussion</option>
                    <option value="knowledge_graph">Graphe de connaissances</option>
                    <option value="prisma_flow">Diagramme PRISMA</option>
                </select>
            </div>
            <div class="modal__actions">
                <button type="button" class="btn btn--secondary" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn--primary">Lancer</button>
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
        <form onsubmit="handleAddManualArticles(event)">
            <div class="form-group">
                <label class="form-label">Identifiants d'articles</label>
                <textarea name="articles" class="form-control" rows="10" required
                          placeholder="PMID:12345&#10;10.1000/xyz123&#10;arXiv:2301.00000&#10;..."></textarea>
                <div class="form-text">
                    Saisissez un identifiant par ligne : PMID, DOI, ArXiv ID, etc.
                </div>
            </div>
            <div class="form-group">
                <label class="checkbox-item">
                    <input type="checkbox" name="fetch_metadata" checked>
                    Récupérer automatiquement les métadonnées
                </label>
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
                <label class="form-label">Identifiants d'articles</label>
                <textarea name="articles" class="form-control" rows="8" required
                          placeholder="PMID:12345&#10;10.1000/xyz123&#10;..."></textarea>
            </div>
            <div class="modal__actions">
                <button type="button" class="btn btn--secondary" onclick="closeModal()">Annuler</button>
                <button type="submit" class="btn btn--primary">Rechercher des PDFs</button>
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
        showLoadingOverlay(true, 'Lancement de l\'indexation...');
        await fetchAPI(`/projects/${projectId}/index`, { method: 'POST' });
        showToast('Indexation lancée', 'success');
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    if (!input || !input.value.trim() || !appState.currentProject) return;

    const question = input.value.trim();
    input.value = '';

    try {
        showLoadingOverlay(true, 'Envoi de la question...');
        await fetchAPI(`/projects/${appState.currentProject.id}/chat`, {
            method: 'POST',
            body: { question }
        });
        showToast('Question envoyée', 'success');
        await loadChatMessages();
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

async function runAnalysis(type) {
    if (!appState.currentProject) {
        showToast('Sélectionnez un projet', 'warning');
        return;
    }

    try {
        showLoadingOverlay(true, `Lancement de l'analyse ${type}...`);
        await fetchAPI(`/projects/${appState.currentProject.id}/run-analysis`, {
            method: 'POST',
            body: { type }
        });
        showToast('Analyse lancée', 'success');
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

async function loadSettings() {
    if (!elements.settingsContainer) return;
    renderSettings();
}

async function loadValidationSection() {
    // Placeholder pour la validation
    const validationContainer = document.querySelector('[data-section="validation"]');
    if (validationContainer) {
        validationContainer.innerHTML = `
            <div class="validation-placeholder">
                <span class="validation-placeholder__icon">🔍</span>
                <h3>Validation Inter-Évaluateurs</h3>
                <p>Fonctionnalité en développement...</p>
            </div>
        `;
    }
}
