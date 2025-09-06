// ================================================================
// AnalyLit V4.1 - Application Frontend COMPLÈTE ET CORRIGÉE
// ================================================================

const appState = {
    currentProject: null,
    projects: [],
    searchResults: [],
    analysisProfiles: [],
    ollamaModels: [],
    prompts: [],
    currentProjectGrids: [],
    currentProjectExtractions: [],
    socketConnected: false,
    currentSection: 'projects',
    socket: null,
    availableDatabases: [],
    notifications: [],
    unreadNotifications: 0,
    selectedSearchResults: new Set()
};

let elements = {};

// ================================================================
// === INITIALISATION PRINCIPALE
// ================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Démarrage de AnalyLit V4.1 Frontend CORRIGÉ...');
    
    elements = {
        sections: document.querySelectorAll('.section'),
        navButtons: document.querySelectorAll('.app-nav__button'),
        connectionStatus: document.querySelector('[data-connection-status]'),
        projectsList: document.getElementById('projectsList'),
        createProjectBtn: document.getElementById('createProjectBtn'),
        projectDetail: document.getElementById('projectDetail'),
        projectDetailContent: document.getElementById('projectDetailContent'),
        projectPlaceholder: document.getElementById('projectPlaceholder'),
        searchResults: document.getElementById('searchResults'),
        resultsContainer: document.getElementById('resultsContainer'),
        validationContainer: document.getElementById('validationContainer'),
        analysisContainer: document.getElementById('analysisContainer'),
        importContainer: document.getElementById('importContainer'),
        chatContainer: document.getElementById('chatContainer'),
        settingsContainer: document.getElementById('settingsContainer'),
        newProjectForm: document.getElementById('newProjectForm'),
        multiSearchForm: document.getElementById('multiSearchForm'),
        runPipelineForm: document.getElementById('runPipelineForm'),
        gridForm: document.getElementById('gridForm'),
        promptForm: document.getElementById('promptForm'),
        profileForm: document.getElementById('profileForm'),
        loadingOverlay: document.getElementById('loadingOverlay'),
        toastContainer: document.getElementById('toastContainer'),
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
        attachValidationFileInputListener();
        console.log('✅ Application initialisée avec succès');
    } catch (error) {
        console.error('❌ Erreur initialisation application:', error);
        showToast("Erreur lors de l'initialisation", 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

// ================================================================
// === WEBSOCKET CORRIGÉ AVEC GARDE
// ================================================================

function initializeWebSocket() {
    try {
        if (typeof io !== 'function') {
            console.warn('Client Socket.IO indisponible (io non chargé).');
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
            if (elements.connectionStatus) elements.connectionStatus.textContent = '❌';
        });
        
        appState.socket.on('connect_error', (err) => {
            console.error('❌ Erreur de connexion WebSocket:', err.message);
            appState.socketConnected = false;
            if (elements.connectionStatus) elements.connectionStatus.textContent = '❌';
        });
        
        appState.socket.on('notification', (data) => {
            console.log('📢 Notification reçue:', data);
            handleWebSocketNotification(data);
        });
        
        appState.socket.on('room_joined', (data) => {
            console.log(`🏠 Rejoint la room du projet ${data.project_id}`);
        });
    } catch (e) {
        console.error("Socket.IO non disponible.", e);
        if (elements.connectionStatus) elements.connectionStatus.textContent = '❌';
    }
}

function handleWebSocketNotification(data) {
    showToast(data.message, data.type || 'info');
    appState.unreadNotifications++;
    updateNotificationIndicator();

    const { type, project_id } = data;
    switch (type) {
        case 'search_completed':
        case 'article_processed':
        case 'synthesis_completed':
        case 'analysis_completed':
        case 'pdf_upload_completed':
        case 'indexing_completed':
            if (project_id === appState.currentProject?.id) {
                selectProject(project_id, true);
            } else {
                loadProjects();
            }
            break;
        case 'kappa_calculated':
            showToast('Calcul du Kappa terminé !', 'success');
            if (project_id === appState.currentProject?.id && data.message) {
                displayKappaResult(data.message);
            }
            break;
        case 'analysis_failed':
            if (project_id === appState.currentProject?.id) {
                selectProject(project_id, true);
            }
            break;
    }
}

// ================================================================
// === FONCTIONS UTILITAIRES
// ================================================================

async function fetchAPI(endpoint, options = {}) {
    const url = `/api${endpoint}`;
    const headers = (options.body instanceof FormData) ? {} : {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };
    
    const config = { ...options, headers };
    
    if (options.body && !(options.body instanceof FormData) && typeof options.body !== 'string') {
        config.body = JSON.stringify(options.body);
    }

    try {
        const response = await fetch(url, config);
        if (!response.ok) {
            const data = await response.json().catch(() => ({ error: `Erreur HTTP ${response.status}` }));
            throw new Error(data.error || `Erreur ${response.status}`);
        }
        
        if (response.status === 204 || response.headers.get('Content-Length') === '0') return null;
        
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            return await response.json();
        }
        return await response.text();
    } catch (error) {
        console.error(`Erreur API pour ${endpoint}:`, error);
        showToast(error.message, 'error');
        throw error;
    }
}

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

function sanitize_filename(name) {
    if (!name) return 'unnamed_file';
    let s = String(name).replace(/[<>:"/\\|?*]/g, '_').trim();
    if (s.length > 200) s = s.slice(0, 200);
    return s || 'unnamed_file';
}

function showToast(message, type = 'info') {
    if (!elements.toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    
    const icons = {
        success: '✅',
        error: '❌', 
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    toast.innerHTML = `
        <div class="toast__icon">${icons[type] || icons.info}</div>
        <div class="toast__content">${escapeHtml(message)}</div>
        <button class="toast__close" onclick="this.parentElement.remove()">×</button>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => toast.remove(), 5000);
}

function showLoadingOverlay(show, message = 'Chargement...') {
    if (!elements.loadingOverlay) return;
    
    if (show) {
        elements.loadingOverlay.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <div class="loading-text">${escapeHtml(message)}</div>
            </div>
        `;
        elements.loadingOverlay.style.display = 'flex';
    } else {
        elements.loadingOverlay.style.display = 'none';
    }
}

function updateNotificationIndicator() {
    const indicator = document.getElementById('notificationIndicator');
    if (!indicator) return;
    
    if (appState.unreadNotifications > 0) {
        indicator.style.display = 'flex';
        const countEl = indicator.querySelector('.notification-indicator__count');
        if (countEl) countEl.textContent = appState.unreadNotifications;
    } else {
        indicator.style.display = 'none';
    }
}

// ================================================================
// === GESTION DES SECTIONS
// ================================================================

function showSection(sectionName) {
    appState.currentSection = sectionName;
    
    // Masquer toutes les sections
    elements.sections.forEach(section => section.classList.remove('section--active'));
    elements.navButtons.forEach(btn => btn.classList.remove('app-nav__button--active'));
    
    // Afficher la section demandée
    const targetSection = document.querySelector(`[data-section="${sectionName}"]`);
    if (targetSection) {
        targetSection.classList.add('section--active');
    }
    
    // Activer le bouton de navigation
    const targetButton = document.querySelector(`[data-section="${sectionName}"]`);
    if (targetButton) {
        targetButton.classList.add('app-nav__button--active');
    }
    
    // Rafraîchir le contenu si nécessaire
    refreshCurrentSection();
}

function refreshCurrentSection(project = appState.currentProject) {
    switch (appState.currentSection) {
        case 'projects':
            renderProjectsList();
            break;
        case 'recherche':
            renderSearchSection(project);
            break;
        case 'validation':
            renderValidationSection(project);
            break;
        case 'analyses':
            renderAnalysisSection(project);
            break;
        case 'import':
            // Eviter ReferenceError si la fonction n'existe pas encore
            if (typeof renderImportSection === 'function') {
                renderImportSection(project);
            } else {
                // Fallback utile
                if (project?.id && typeof renderProjectArticlesList === 'function') {
                    renderProjectArticlesList(project.id);
                }
            }
            break;
        case 'chat':
            renderChatSection(project);
            break;
        case 'settings':
            renderSettingsSection();
            break;
    }
}

// ================================================================
// === CHARGEMENT DES DONNÉES INITIALES
// ================================================================

async function loadInitialData() {
    await Promise.all([
        loadProjects(),
        loadAnalysisProfiles(), 
        loadOllamaModels(),
        loadPrompts(),
        loadAvailableDatabases()
    ]);
}

async function loadProjects() {
    try {
        appState.projects = await fetchAPI('/projects');
        renderProjectsList();
    } catch (error) {
        console.error('Erreur chargement projets:', error);
        appState.projects = [];
    }
}

async function loadAnalysisProfiles() {
    try {
        appState.analysisProfiles = await fetchAPI('/analysis-profiles');
    } catch (error) {
        console.error('Erreur chargement profils:', error);
        appState.analysisProfiles = [];
    }
}

async function loadOllamaModels() {
    try {
        appState.ollamaModels = await fetchAPI('/ollama/models');
    } catch (error) {
        console.error('Erreur chargement modèles Ollama:', error);
        appState.ollamaModels = [];
    }
}

async function loadPrompts() {
    try {
        appState.prompts = await fetchAPI('/prompts');
    } catch (error) {
        console.error('Erreur chargement prompts:', error);
        appState.prompts = [];
    }
}

async function loadAvailableDatabases() {
    try {
        appState.availableDatabases = await fetchAPI('/databases');
    } catch (error) {
        console.error('Erreur chargement bases:', error);
        appState.availableDatabases = [];
    }
}

// ================================================================
// === GESTION DES ÉVÉNEMENTS ET ÉCOUTEURS
// ================================================================

function setupEventListeners() {
    // Navigation
    elements.navButtons.forEach(button => button.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(e.currentTarget.getAttribute('data-section'));
    }));

    // Formulaires principaux
    elements.createProjectBtn?.addEventListener('click', () => openModal('newProjectModal'));
    elements.newProjectForm?.addEventListener('submit', handleCreateProject);
    elements.multiSearchForm?.addEventListener('submit', handleMultiSearch);
    elements.runPipelineForm?.addEventListener('submit', handleRunPipeline);
    elements.gridForm?.addEventListener('submit', handleSaveGrid);
    elements.promptForm?.addEventListener('submit', handleSavePrompt);
    elements.profileForm?.addEventListener('submit', handleSaveProfile);

    // Upload de fichiers
    const gridFileInput = document.getElementById('gridFileInput');
    if (gridFileInput) {
        gridFileInput.addEventListener('change', handleGridImport);
    }

    const zoteroFileInput = document.getElementById('zoteroFileInput');
    if (zoteroFileInput) {
        zoteroFileInput.addEventListener('change', handleZoteroFileUpload);
    }

    // Ajout dynamique de champs
    document.getElementById('addGridFieldBtn')?.addEventListener('click', () => addGridFieldInput());
    document.getElementById('pipelineSourceSelect')?.addEventListener('change', handlePipelineSourceChange);

    // Gestionnaire principal d'actions via data-action
    document.body.addEventListener('click', e => {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        
        const action = target.dataset.action;
        const { projectId, articleId, gridId, promptId, profileId, queueName, plotType, extractionId, decision } = target.dataset;

        // Cas spécial pour view-article-online
        if (action === 'view-article-online') {
            e.preventDefault();
            const url = target.href;
            if (url && url !== '#' && !url.endsWith('null')) {
                window.open(url, '_blank');
            } else {
                showToast("URL de l'article non disponible.", 'warning');
            }
            return;
        }

        // Toutes les autres actions
        const actions = {
            // Gestion projets
            selectProject: () => selectProject(projectId),
            deleteProject: () => handleDeleteProject(projectId),
            
            // Pipeline et analyses
            runPipeline: () => openRunPipelineModal(),
            runSynthesis: () => handleRunSynthesis(),
            exportProject: () => handleExportProject(projectId),
            
            // Résultats de recherche
            selectSearchResult: () => selectSearchResult(articleId),
            selectAllSearchResults: () => selectAllSearchResults(),
            'delete-selected-articles': () => handleDeleteSelectedArticles(),
            
            // Validation inter-évaluateurs
            validateExtraction: () => handleValidateExtraction(extractionId, decision),
            'export-validations': () => handleExportValidations(appState.currentProject?.id),
            'import-validations': () => document.getElementById('validationFileInput')?.click(),
            'calculate-kappa': () => handleCalculateKappa(appState.currentProject?.id),
            
            // Interface interactions
            toggleAbstract: () => {
                const row = target.closest('tr');
                const next = row?.nextElementSibling;
                if (next && next.classList.contains('abstract-row')) {
                    next.classList.toggle('hidden');
                }
            },
            viewExtractionDetails: () => openExtractionDetailModal(extractionId),
            
            // Analyses avancées
            'generate-discussion': () => runAdvancedAnalysis('generate-discussion', projectId),
            'generate-knowledge-graph': () => runAdvancedAnalysis('generate-knowledge-graph', projectId),
            'generate-prisma-flow': () => runAdvancedAnalysis('generate-prisma-flow', projectId),
            'run-meta-analysis': () => runAdvancedAnalysis('run-meta-analysis', projectId),
            'run-descriptive-stats': () => runAdvancedAnalysis('run-descriptive-stats', projectId),
            'run-atn-score': () => runAdvancedAnalysis('run-atn-score', projectId),
            viewAnalysisPlot: () => viewAnalysisPlot(projectId, plotType),
            
            // Import et fichiers
            'import-zotero-file': () => document.getElementById('zoteroFileInput')?.click(),
            'import-zotero-list': () => handleImportZotero(projectId),
            'fetch-online-pdfs': () => handleFetchOnlinePdfs(projectId),
            'run-indexing': () => handleRunIndexing(projectId),
            'upload-single-pdf': () => {
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = '.pdf';
                fileInput.style.display = 'none';
                fileInput.addEventListener('change', (e) => {
                    handleManualPDFUpload(target.dataset.articleId, e.target.files[0]);
                });
                document.body.appendChild(fileInput);
                fileInput.click();
                fileInput.remove();
            },
            
            // Chat
            sendChatMessage: () => sendChatMessage(),
            clearChatHistory: () => clearChatHistory(),
            
            // Grilles d'extraction
            'create-grid': () => openGridModal(),
            'edit-grid': () => openGridModal(gridId),
            'delete-grid': () => handleDeleteGrid(gridId),
            'import-grid': () => document.getElementById('gridFileInput')?.click(),
            removeGridField: () => target.closest('.form-group-dynamic')?.remove(),
            
            // Prompts et profils
            'edit-prompt': () => openPromptModal(promptId),
            'create-profile': () => openProfileModal(),
            'edit-profile': () => openProfileModal(profileId),
            'delete-profile': () => handleDeleteProfile(profileId),
            
            // Ollama et files
            pullModel: () => handlePullModel(),
            'refresh-queues': () => renderQueueStatus(),
            'clearQueue': (e) => {
                const qn = e?.target?.dataset?.queueName || e?.currentTarget?.dataset?.queueName;
                if (!qn) {
                    showToast("Nom de file introuvable.", 'warning');
                    return;
                }
                handleClearQueue(qn);
            },
            
            // Paramètres
            saveZoteroSettings: () => handleSaveZoteroSettings(),
        };

        if (actions[action]) {
            e.preventDefault();
            actions[action]();
        }
    });

    // Raccourcis clavier
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal--show');
            if (activeModal) closeModal(activeModal.id);
        }
    });

    // Gestion des modales
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal.id);
        });
        modal.querySelector('.modal__close')?.addEventListener('click', () => closeModal(modal.id));
    });
}

function attachValidationFileInputListener() {
    const validationFileInput = document.getElementById('validationFileInput');
    if (!validationFileInput) return;
    
    // Remplacer l'élément par un clone pour purger les anciens écouteurs
    const newValidationFileInput = validationFileInput.cloneNode(true);
    validationFileInput.parentNode.replaceChild(newValidationFileInput, validationFileInput);
    
    newValidationFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0 && appState.currentProject) {
            handleImportValidations(e.target.files[0], appState.currentProject.id);
        }
    });
}

// ================================================================
// === GESTION DES PROJETS
// ================================================================

async function selectProject(projectId, forceRefresh = false) {
    try {
        if (!forceRefresh && appState.currentProject?.id === projectId) {
            showSection('recherche');
            return;
        }

        showLoadingOverlay(true, 'Chargement du projet...');
        
        const project = await fetchAPI(`/projects/${projectId}`);
        appState.currentProject = project;
        
        // Rejoindre la room WebSocket
        if (appState.socketConnected && appState.socket) {
            appState.socket.emit('join_room', { room: projectId });
        }
        
        // Charger les données du projet
        await Promise.all([
            loadProjectSearchResults(projectId),
            loadProjectExtractions(projectId),
            loadProjectGrids(projectId),
            loadChatHistory(projectId)
        ]);
        
        renderProjectDetail(project);
        refreshCurrentSection(project);
        
        // Mise à jour UI
        document.querySelectorAll('.project-item').forEach(item => {
            item.classList.toggle('project-item--active', item.dataset.projectId === projectId);
        });
        
    } catch (error) {
        console.error('Erreur lors de la sélection du projet:', error);
        showToast('Erreur lors du chargement du projet', 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

function renderProjectsList() {
    if (!elements.projectsList) return;
    
    if (appState.projects.length === 0) {
        elements.projectsList.innerHTML = `
            <div class="empty-state">
                <p>Aucun projet disponible.</p>
                <button class="btn btn--primary" data-action="create-project">
                    Créer votre premier projet
                </button>
            </div>
        `;
        return;
    }
    
    elements.projectsList.innerHTML = appState.projects.map(project => `
        <div class="project-item ${project.id === appState.currentProject?.id ? 'project-item--active' : ''}" 
             data-project-id="${project.id}"
             data-action="selectProject" data-project-id="${project.id}">
            <div class="project-item__content">
                <h4 class="project-item__title">${escapeHtml(project.name)}</h4>
                <p class="project-item__meta">
                    ${project.pmids_count || 0} articles • 
                    ${new Date(project.updated_at || project.created_at).toLocaleDateString()}
                </p>
                ${project.status !== 'pending' ? `
                    <div class="project-item__status">
                        <span class="status status--${getStatusColor(project.status)}">${getStatusLabel(project.status)}</span>
                    </div>
                ` : ''}
            </div>
            <div class="project-item__actions">
                <button class="btn btn--sm btn--outline" 
                        data-action="deleteProject" data-project-id="${project.id}"
                        title="Supprimer le projet">
                    🗑️
                </button>
            </div>
        </div>
    `).join('');
}

function renderProjectDetail(project) {
    if (!elements.projectDetailContent) return;
    
    if (!project) {
        elements.projectDetailContent.innerHTML = `
            <div class="empty-state">
                <h3>Aucun projet sélectionné</h3>
                <p>Sélectionner un projet dans la liste de gauche.</p>
            </div>
        `;
        return;
    }
    
    const statusColor = getStatusColor(project.status);
    const statusLabel = getStatusLabel(project.status);
    
    elements.projectDetailContent.innerHTML = `
        <div class="project-header">
            <h2>${escapeHtml(project.name)}</h2>
            <span class="status status--${statusColor}">${statusLabel}</span>
        </div>
        
        <div class="project-meta">
            <div class="project-stat">
                <span class="project-stat__label">Articles</span>
                <span class="project-stat__value">${project.pmids_count || 0}</span>
            </div>
            <div class="project-stat">
                <span class="project-stat__label">Traités</span>
                <span class="project-stat__value">${project.processed_count || 0}</span>
            </div>
            ${project.total_processing_time ? `
                <div class="project-stat">
                    <span class="project-stat__label">Temps total</span>
                    <span class="project-stat__value">${Math.round(project.total_processing_time)}s</span>
                </div>
            ` : ''}
        </div>
        
        <div class="project-description">
            <h4>Description</h4>
            <p>${escapeHtml(project.description) || 'Aucune description.'}</p>
        </div>
        
        ${project.synthesis_result ? renderSynthesisResult(JSON.parse(project.synthesis_result)) : ''}
        ${project.discussion_draft ? renderDiscussion(project.discussion_draft) : ''}
        ${project.analysis_result ? renderAnalysisResult(JSON.parse(project.analysis_result)) : ''}
    `;
}

function renderSynthesisResult(synthesis) {
    return `
        <div class="synthesis-result">
            <h4>Synthèse générée</h4>
            <div class="synthesis-content">
                <div class="synthesis-section">
                    <h5>Évaluation de pertinence</h5>
                    <p>${escapeHtml(synthesis.relevance_evaluation || 'Non évaluée.')}</p>
                </div>
                <div class="synthesis-section">
                    <h5>Synthèse globale</h5>
                    <p>${escapeHtml(synthesis.synthesis_summary || synthesis.synthese_globale || 'Non disponible.')}</p>
                </div>
                ${synthesis.main_themes ? `
                    <div class="synthesis-section">
                        <h5>Thèmes principaux</h5>
                        <ul>
                            ${synthesis.main_themes.map(theme => `<li>${escapeHtml(theme)}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

function renderDiscussion(discussion) {
    return `
        <div class="discussion-result">
            <h4>Discussion académique</h4>
            <div class="discussion-content">
                ${escapeHtml(discussion).replace(/\n/g, '<br>')}
            </div>
        </div>
    `;
}

function renderAnalysisResult(analysisData) {
    if (analysisData.mean_score !== undefined) {
        // Méta-analyse
        return `
            <div class="analysis-result">
                <h4>Méta-analyse</h4>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <h5>Articles analysés</h5>
                        <div class="metric-value">${analysisData.n_articles}</div>
                    </div>
                    <div class="metric-card">
                        <h5>Score moyen de pertinence</h5>
                        <div class="metric-value">${analysisData.mean_score.toFixed(2)}</div>
                        <p class="metric-subtitle">IC 95%: [${analysisData.confidence_interval[0].toFixed(2)}, ${analysisData.confidence_interval[1].toFixed(2)}]</p>
                    </div>
                </div>
            </div>
        `;
    } else if (analysisData.total_articles_scored !== undefined) {
        // Score ATN
        return `
            <div class="analysis-result">
                <h4>Score ATN</h4>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <h5>Articles évalués</h5>
                        <div class="metric-value">${analysisData.total_articles_scored}</div>
                    </div>
                    <div class="metric-card">
                        <h5>Score ATN moyen</h5>
                        <div class="metric-value">${analysisData.mean_atn.toFixed(2)}</div>
                    </div>
                </div>
            </div>
        `;
    } else if (analysisData.total_articles !== undefined) {
        // Statistiques descriptives
        return `
            <div class="analysis-result">
                <h4>Statistiques descriptives</h4>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <h5>Total d'articles avec données extraites</h5>
                        <div class="metric-value">${analysisData.total_articles}</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    return '';
}

async function handleCreateProject(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const projectData = {
        name: formData.get('name'),
        description: formData.get('description'),
        mode: formData.get('mode') || 'screening'
    };
    
    if (!projectData.name.trim()) {
        showToast('Le nom du projet est requis', 'error');
        return;
    }
    
    try {
        showLoadingOverlay(true, 'Création du projet...');
        const newProject = await fetchAPI('/projects', {
            method: 'POST',
            body: projectData
        });
        
        await loadProjects();
        await selectProject(newProject.id);
        closeModal('newProjectModal');
        e.target.reset();
        showToast('Projet créé avec succès', 'success');
        
    } catch (error) {
        console.error('Erreur création projet:', error);
        showToast('Erreur lors de la création du projet', 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

async function handleDeleteProject(projectId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce projet ? Cette action est irréversible.')) {
        return;
    }
    
    try {
        showLoadingOverlay(true, 'Suppression du projet...');
        await fetchAPI(`/projects/${projectId}`, { method: 'DELETE' });
        
        if (appState.currentProject?.id === projectId) {
            appState.currentProject = null;
            renderProjectDetail(null);
        }
        
        await loadProjects();
        showToast('Projet supprimé avec succès', 'success');
        
    } catch (error) {
        console.error('Erreur suppression projet:', error);
        showToast('Erreur lors de la suppression du projet', 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

function getStatusColor(status) {
    const colorMap = {
        'pending': 'info',
        'searching': 'warning',
        'search_completed': 'success',
        'processing': 'warning',
        'completed': 'success',
        'synthesizing': 'warning',
        'failed': 'error',
        'search_failed': 'error'
    };
    return colorMap[status] || 'info';
}

function getStatusLabel(status) {
    const labelMap = {
        'pending': 'En attente',
        'searching': 'Recherche en cours',
        'search_completed': 'Recherche terminée',
        'processing': 'Analyse en cours',
        'completed': 'Terminé',
        'synthesizing': 'Synthèse en cours',
        'failed': 'Erreur',
        'search_failed': 'Erreur de recherche'
    };
    return labelMap[status] || status;
}

// ================================================================
// === RECHERCHE MULTI-BASES
// ================================================================

function renderSearchSection(project) {
    if (!elements.searchResults) return;
    
    if (!project) {
        elements.searchResults.innerHTML = `
            <div class="empty-state">
                <h3>Aucun projet sélectionné</h3>
                <p>Sélectionnez un projet pour effectuer des recherches.</p>
            </div>
        `;
        return;
    }
    
    elements.searchResults.innerHTML = `
        <div class="search-header">
            <h3>Recherche multi-bases</h3>
            <form id="multiSearchForm" class="multi-search-form">
                <div class="search-inputs">
                    <div class="form-group">
                        <label class="form-label">Requête de recherche</label>
                        <input type="text" name="query" class="form-control" 
                               placeholder="Ex: machine learning healthcare" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Bases de données</label>
                        <div class="databases-grid">
                            ${appState.availableDatabases.map(db => `
                                <label class="checkbox-item">
                                    <input type="checkbox" name="databases" value="${db.id}" 
                                           ${['pubmed'].includes(db.id) ? 'checked' : ''}>
                                    <span>${db.name}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Résultats par base (max)</label>
                        <select name="max_results" class="form-control">
                            <option value="25">25</option>
                            <option value="50" selected>50</option>
                            <option value="100">100</option>
                            <option value="200">200</option>
                        </select>
                    </div>
                </div>
                <button type="submit" class="btn btn--primary">Lancer la recherche</button>
            </form>
        </div>
        
        <div class="search-results-section">
            <h4>Résultats</h4>
            <div id="resultsContainer">
                ${appState.searchResults.length === 0 ? 
                    '<p class="text-muted">Lancez une recherche pour voir les résultats ici.</p>' : 
                    renderSearchResults()
                }
            </div>
        </div>
    `;
}

async function handleMultiSearch(e) {
    e.preventDefault();
    
    if (!appState.currentProject) {
        showToast('Aucun projet sélectionné', 'error');
        return;
    }
    
    const formData = new FormData(e.target);
    const query = formData.get('query');
    const databases = formData.getAll('databases');
    const maxResults = parseInt(formData.get('max_results'));
    
    if (!query.trim()) {
        showToast('La requête de recherche est requise', 'error');
        return;
    }
    
    if (databases.length === 0) {
        showToast('Sélectionnez au moins une base de données', 'error');
        return;
    }
    
    try {
        showLoadingOverlay(true, 'Lancement de la recherche...');
        
        const response = await fetchAPI('/search', {
            method: 'POST',
            body: {
                project_id: appState.currentProject.id,
                query: query,
                databases: databases,
                max_results_per_db: maxResults
            }
        });
        
        showToast(response.message, 'success');
        
        // Réinitialiser le formulaire et attendre les résultats
        e.target.reset();
        
    } catch (error) {
        console.error('Erreur lors de la recherche:', error);
        showToast('Erreur lors de la recherche', 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

async function loadProjectSearchResults(projectId, page = 1) {
    try {
        const response = await fetchAPI(`/projects/${projectId}/search-results?page=${page}&per_page=50`);
        appState.searchResults = response.results || [];
        appState.searchResultsPagination = {
            total: response.total,
            page: response.page,
            per_page: response.per_page,
            has_next: response.has_next,
            has_prev: response.has_prev
        };
        
        if (appState.currentSection === 'recherche') {
            renderSearchResults();
        }
    } catch (error) {
        console.error('Erreur chargement résultats:', error);
        appState.searchResults = [];
    }
}

function renderSearchResults() {
    if (!elements.resultsContainer) return;
    
    if (appState.searchResults.length === 0) {
        elements.resultsContainer.innerHTML = `
            <div class="empty-state">
                <p>Aucun résultat disponible.</p>
                <p class="text-muted">Lancez une recherche pour voir les résultats ici.</p>
            </div>
        `;
        return;
    }
    
    const selectedCount = appState.selectedSearchResults.size;
    
    elements.resultsContainer.innerHTML = `
        <div class="results-header">
            <div class="results-stats">
                <p>${appState.searchResults.length} résultats trouvés</p>
                ${selectedCount > 0 ? `<p class="selected-count">${selectedCount} sélectionnés</p>` : ''}
            </div>
            <div class="results-actions">
                <button class="btn btn--sm btn--outline" data-action="selectAllSearchResults">
                    ${selectedCount === appState.searchResults.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                </button>
                ${selectedCount > 0 ? `
                    <button class="btn btn--sm btn--outline" data-action="delete-selected-articles">
                        Supprimer (${selectedCount})
                    </button>
                    <button class="btn btn--sm btn--primary" data-action="runPipeline">
                        Analyser (${selectedCount})
                    </button>
                ` : ''}
            </div>
        </div>
        
        <div class="results-table-container">
            <table class="results-table">
                <thead>
                    <tr>
                        <th width="40">
                            <input type="checkbox" 
                                   ${selectedCount === appState.searchResults.length && selectedCount > 0 ? 'checked' : ''}
                                   data-action="selectAllSearchResults">
                        </th>
                        <th>Titre</th>
                        <th>Auteurs</th>
                        <th>Journal</th>
                        <th>Base</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${appState.searchResults.map(result => renderSearchResultRow(result)).join('')}
                </tbody>
            </table>
        </div>
        
        ${renderSearchPagination()}
    `;
}

function renderSearchResultRow(result) {
    const isSelected = appState.selectedSearchResults.has(result.article_id);
    const hasUrl = result.url && result.url !== 'null' && result.url !== '#';
    
    return `
        <tr class="result-row ${isSelected ? 'result-row--selected' : ''}">
            <td>
                <input type="checkbox" 
                       ${isSelected ? 'checked' : ''}
                       data-action="selectSearchResult" 
                       data-article-id="${result.article_id}">
            </td>
            <td class="title-cell">
                <div class="result-title" data-action="toggleAbstract">
                    ${escapeHtml(result.title)}
                </div>
                ${hasUrl ? `
                    <a href="${result.url}" 
                       data-action="view-article-online" 
                       class="external-link"
                       target="_blank"
                       title="Voir en ligne">🔗</a>
                ` : ''}
            </td>
            <td class="authors-cell">
                <div class="result-authors">${escapeHtml(result.authors || 'N/A')}</div>
            </td>
            <td class="journal-cell">
                <div class="result-journal">${escapeHtml(result.journal || 'N/A')}</div>
            </td>
            <td>
                <span class="database-badge database-badge--${result.database_source}">
                    ${escapeHtml(result.database_source)}
                </span>
            </td>
            <td class="actions-cell">
                <button class="btn btn--sm btn--outline" 
                        data-action="upload-single-pdf" 
                        data-article-id="${result.article_id}"
                        title="Upload PDF">
                    📄
                </button>
            </td>
        </tr>
        ${result.abstract ? `
            <tr class="abstract-row hidden">
                <td colspan="6">
                    <div class="abstract-content">
                        <strong>${escapeHtml(result.journal || 'Journal inconnu')}</strong>
                        <p>${escapeHtml(result.abstract.slice(0, 500))}${result.abstract.length > 500 ? '...' : ''}</p>
                    </div>
                </td>
            </tr>
        ` : ''}
    `;
}

function renderSearchPagination() {
    if (!appState.searchResultsPagination || appState.searchResultsPagination.total <= appState.searchResultsPagination.per_page) {
        return '';
    }
    
    const { page, has_prev, has_next } = appState.searchResultsPagination;
    
    return `
        <div class="pagination">
            <button class="btn btn--sm btn--outline" 
                    ${!has_prev ? 'disabled' : ''}
                    onclick="loadProjectSearchResults('${appState.currentProject.id}', ${page - 1})">
                Précédent
            </button>
            <span class="pagination-info">Page ${page}</span>
            <button class="btn btn--sm btn--outline" 
                    ${!has_next ? 'disabled' : ''}
                    onclick="loadProjectSearchResults('${appState.currentProject.id}', ${page + 1})">
                Suivant
            </button>
        </div>
    `;
}

function selectSearchResult(articleId) {
    if (appState.selectedSearchResults.has(articleId)) {
        appState.selectedSearchResults.delete(articleId);
    } else {
        appState.selectedSearchResults.add(articleId);
    }
    
    if (appState.currentSection === 'recherche') {
        renderSearchResults();
    }
}

function selectAllSearchResults() {
    const allSelected = appState.selectedSearchResults.size === appState.searchResults.length;
    
    if (allSelected) {
        appState.selectedSearchResults.clear();
    } else {
        appState.searchResults.forEach(result => {
            appState.selectedSearchResults.add(result.article_id);
        });
    }
    
    if (appState.currentSection === 'recherche') {
        renderSearchResults();
    }
}

async function handleDeleteSelectedArticles() {
    const selectedIds = Array.from(appState.selectedSearchResults);
    
    if (selectedIds.length === 0) {
        showToast('Aucun article sélectionné', 'warning');
        return;
    }
    
    if (!confirm(`Supprimer ${selectedIds.length} article(s) sélectionné(s) ?`)) {
        return;
    }
    
    try {
        showLoadingOverlay(true, 'Suppression...');
        
        // L'API backend devrait gérer la suppression multiple
        await fetchAPI(`/projects/${appState.currentProject.id}/articles/delete-multiple`, {
            method: 'POST',
            body: { article_ids: selectedIds }
        });
        
        appState.selectedSearchResults.clear();
        await loadProjectSearchResults(appState.currentProject.id);
        showToast(`${selectedIds.length} article(s) supprimé(s)`, 'success');
        
    } catch (error) {
        console.error('Erreur suppression articles:', error);
        showToast('Erreur lors de la suppression', 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

// ================================================================
// === PIPELINE D'ANALYSE
// ================================================================

function openRunPipelineModal() {
    const selectedIds = Array.from(appState.selectedSearchResults);
    
    if (selectedIds.length === 0) {
        showToast('Sélectionnez au moins un article pour lancer l\'analyse', 'warning');
        return;
    }
    
    // Peupler la modale avec les informations
    const modal = document.getElementById('runPipelineModal');
    if (modal) {
        const selectedCountEl = modal.querySelector('[data-selected-count]');
        if (selectedCountEl) {
            selectedCountEl.textContent = selectedIds.length;
        }
        
        // Peupler les profils
        const profileSelect = modal.querySelector('[name="profile"]');
        if (profileSelect) {
            profileSelect.innerHTML = appState.analysisProfiles.map(profile => 
                `<option value="${profile.id}">${escapeHtml(profile.name)}</option>`
            ).join('');
        }
        
        // Peupler les grilles (si mode extraction)
        const gridSelect = modal.querySelector('[name="custom_grid_id"]');
        if (gridSelect) {
            gridSelect.innerHTML = `
                <option value="">Grille par défaut</option>
                ${appState.currentProjectGrids.map(grid => 
                    `<option value="${grid.id}">${escapeHtml(grid.name)}</option>`
                ).join('')}
            `;
        }
        
        openModal('runPipelineModal');
    }
}

async function handleRunPipeline(e) {
    e.preventDefault();
    
    if (!appState.currentProject) {
        showToast('Aucun projet sélectionné', 'error');
        return;
    }
    
    const formData = new FormData(e.target);
    const selectedIds = Array.from(appState.selectedSearchResults);
    
    if (selectedIds.length === 0) {
        showToast('Aucun article sélectionné', 'error');
        return;
    }
    
    const pipelineData = {
        articles: selectedIds,
        profile: formData.get('profile') || 'standard',
        analysis_mode: formData.get('analysis_mode') || 'screening',
        custom_grid_id: formData.get('custom_grid_id') || null
    };
    
    try {
        showLoadingOverlay(true, 'Lancement de l\'analyse...');
        
        const response = await fetchAPI(`/projects/${appState.currentProject.id}/run`, {
            method: 'POST',
            body: pipelineData
        });
        
        closeModal('runPipelineModal');
        appState.selectedSearchResults.clear();
        showToast(`Analyse lancée pour ${selectedIds.length} articles`, 'success');
        
        // Actualiser le projet
        await selectProject(appState.currentProject.id, true);
        
    } catch (error) {
        console.error('Erreur lors du lancement du pipeline:', error);
        showToast('Erreur lors du lancement de l\'analyse', 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

function handlePipelineSourceChange(e) {
    const analysisMode = e.target.value;
    const gridSection = document.getElementById('pipelineGridSection');
    
    if (gridSection) {
        gridSection.style.display = analysisMode === 'full_extraction' ? 'block' : 'none';
    }
}

async function handleRunSynthesis() {
    if (!appState.currentProject) {
        showToast('Aucun projet sélectionné', 'error');
        return;
    }
    
    try {
        showLoadingOverlay(true, 'Lancement de la synthèse...');
        
        const response = await fetchAPI(`/projects/${appState.currentProject.id}/run-synthesis`, {
            method: 'POST',
            body: { profile: 'standard' }
        });
        
        showToast(response.message, 'success');
        
    } catch (error) {
        console.error('Erreur synthèse:', error);
        showToast('Erreur lors de la synthèse', 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

// ================================================================
// === EXTRACTIONS ET RÉSULTATS
// ================================================================

async function loadProjectExtractions(projectId) {
    try {
        appState.currentProjectExtractions = await fetchAPI(`/projects/${projectId}/extractions`);
    } catch (error) {
        console.error('Erreur chargement extractions:', error);
        appState.currentProjectExtractions = [];
    }
}

// ================================================================
// === VALIDATION INTER-ÉVALUATEURS
// ================================================================

function renderValidationSection(project) {
    if (!elements.validationContainer) return;
    
    if (!project) {
        elements.validationContainer.innerHTML = `
            <div class="empty-state">
                <h3>Sélectionnez un projet pour voir la section de validation.</h3>
            </div>
        `;
        return;
    }
    
    elements.validationContainer.innerHTML = `
        <div class="validation-header">
            <h3>Validation inter-évaluateurs</h3>
            <div class="validation-actions">
                <h4>Actions de Double Codage</h4>
                <div class="button-group">
                    <button class="btn btn--outline" data-action="export-validations">
                        Exporter CSV (Éval. 1)
                    </button>
                    <button class="btn btn--outline" data-action="import-validations">
                        Importer CSV (Éval. 2)
                    </button>
                    <button class="btn btn--primary" data-action="calculate-kappa">
                        Calculer Kappa
                    </button>
                </div>
                ${project.inter_rater_reliability ? `
                    <div class="kappa-result-display">
                        ${escapeHtml(project.inter_rater_reliability)}
                    </div>
                ` : ''}
            </div>
        </div>
        
        <div class="validation-results">
            <h4>Résultats à valider</h4>
            ${renderValidationTable()}
        </div>
        
        <input type="file" id="validationFileInput" accept=".csv" style="display: none;">
    `;
}

function renderValidationTable() {
    if (!appState.currentProjectExtractions || appState.currentProjectExtractions.length === 0) {
        return '<p class="text-muted">Aucune extraction à valider pour ce projet.</p>';
    }
    
    const isScreeningMode = appState.currentProject?.analysis_mode === 'screening';
    
    return `
        <table class="validation-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Titre</th>
                    ${isScreeningMode ? `
                        <th>Score IA</th>
                        <th>Décision IA</th>
                        <th>Décision humaine</th>
                    ` : `
                        <th>Données Extraites</th>
                        <th>Actions</th>
                    `}
                </tr>
            </thead>
            <tbody>
                ${appState.currentProjectExtractions.map(ext => renderValidationRow(ext, isScreeningMode)).join('')}
            </tbody>
        </table>
    `;
}

function renderValidationRow(extraction, isScreeningMode) {
    if (isScreeningMode) {
        const included = extraction.relevance_score >= 7;
        let validationStatus = '';
        
        try {
            const validations = JSON.parse(extraction.validations || '{}');
            if (validations.evaluator_1) {
                validationStatus = validations.evaluator_1 === 'include' ? 'Inclure' : 'Exclure';
            }
        } catch (e) {
            // Ignore les erreurs de parsing JSON
        }
        
        return `
            <tr class="extraction-row ${included ? 'extraction-row--included' : 'extraction-row--excluded'}">
                <td><code>${escapeHtml(extraction.pmid)}</code></td>
                <td class="title-cell">
                    <div class="extraction-title">${escapeHtml(extraction.title)}</div>
                </td>
                <td class="score-cell">
                    <span class="score-badge score-badge--${included ? 'high' : 'low'}">
                        ${extraction.relevance_score}
                    </span>
                </td>
                <td class="decision-cell">
                    <span class="decision-badge decision-badge--${included ? 'include' : 'exclude'}">
                        ${included ? 'Inclure' : 'Exclure'}
                    </span>
                </td>
                <td class="validation-cell">
                    ${validationStatus ? `
                        <span class="validation-badge">${validationStatus}</span>
                    ` : `
                        <div class="validation-buttons">
                            <button class="btn btn--sm btn--success" 
                                    data-action="validateExtraction" 
                                    data-extraction-id="${extraction.id}" 
                                    data-decision="include">
                                ✓ Inclure
                            </button>
                            <button class="btn btn--sm btn--outline" 
                                    data-action="validateExtraction" 
                                    data-extraction-id="${extraction.id}" 
                                    data-decision="exclude">
                                ✗ Exclure
                            </button>
                        </div>
                    `}
                </td>
            </tr>
        `;
    } else {
        // Mode extraction complète
        return `
            <tr class="extraction-row">
                <td><code>${escapeHtml(extraction.pmid)}</code></td>
                <td class="title-cell">
                    <div class="extraction-title">${escapeHtml(extraction.title)}</div>
                </td>
                <td class="extracted-data-cell">
                    ${renderExtractionPreview(extraction.extracted_data)}
                </td>
                <td class="actions-cell">
                    <button class="btn btn--sm btn--outline" 
                            data-action="viewExtractionDetails" 
                            data-extraction-id="${extraction.id}">
                        Voir détails
                    </button>
                </td>
            </tr>
        `;
    }
}

function renderExtractionPreview(extractedData) {
    if (!extractedData) return '<span class="text-muted">Aucune donnée</span>';
    
    try {
        const data = JSON.parse(extractedData);
        const keys = Object.keys(data).slice(0, 3);
        
        return `
            <ul class="extraction-preview-list">
                ${keys.map(key => `
                    <li><strong>${escapeHtml(key)}:</strong> ${escapeHtml(String(data[key]).slice(0, 50))}...</li>
                `).join('')}
                ${Object.keys(data).length > 3 ? '<li>...</li>' : ''}
            </ul>
        `;
    } catch (e) {
        return '<span class="text-muted">Données invalides</span>';
    }
}

async function handleValidateExtraction(extractionId, decision) {
    try {
        const response = await fetchAPI(`/projects/${appState.currentProject.id}/validate-extraction`, {
            method: 'POST',
            body: {
                extraction_id: extractionId,
                evaluator: 'evaluator_1',
                decision: decision
            }
        });
        
        await loadProjectExtractions(appState.currentProject.id);
        renderValidationSection(appState.currentProject);
        showToast('Validation enregistrée', 'success');
        
    } catch (error) {
        console.error('Erreur validation:', error);
        showToast('Erreur lors de la validation', 'error');
    }
}

function openExtractionDetailModal(extractionId) {
    const extraction = appState.currentProjectExtractions.find(ext => ext.id === extractionId);
    const container = document.querySelector('#extractionDetailModal .modal__body');
    
    if (!extraction || !container) {
        container.innerHTML = '<p>Détails non trouvés.</p>';
        openModal('extractionDetailModal');
        return;
    }
    
    container.innerHTML = formatExtractionDetailsForModal(extraction);
    openModal('extractionDetailModal');
}

function formatExtractionDetailsForModal(extraction) {
    let html = `
        <div class="extraction-detail-header">
            <h4>${escapeHtml(extraction.title)}</h4>
            <p><strong>ID:</strong> ${escapeHtml(extraction.pmid)}</p>
        </div>
    `;
    
    if (extraction.extracted_data) {
        try {
            const data = JSON.parse(extraction.extracted_data);
            html += '<div class="extraction-detail-content"><h5>Données extraites:</h5><ul class="extraction-details-list">';
            
            for (const [key, value] of Object.entries(data)) {
                html += `
                    <li>
                        <strong>${escapeHtml(key)}</strong>
                        <p>${escapeHtml(value)}</p>
                    </li>
                `;
            }
            
            html += '</ul></div>';
        } catch (e) {
            html += '<p>Erreur lors de l\'affichage des données extraites.</p>';
        }
    }
    
    html += '</div>';
    return html;
}

async function handleExportValidations(projectId) {
    if (!projectId) {
        showToast('Aucun projet sélectionné', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/projects/${projectId}/export-validations`);
        
        if (!response.ok) {
            throw new Error('Erreur lors de l\'export');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `validations_eval1_${projectId}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showToast('Export réussi', 'success');
        
    } catch (error) {
        console.error('Erreur export validations:', error);
        showToast('Erreur lors de l\'export', 'error');
    }
}

async function handleImportValidations(file, projectId) {
    if (!file || !projectId) return;
    
    try {
        showLoadingOverlay(true, 'Import des validations...');
        
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetchAPI(`/projects/${projectId}/import-validations`, {
            method: 'POST',
            body: formData
        });
        
        showToast(response.message, 'success');
        await loadProjectExtractions(projectId);
        renderValidationSection(appState.currentProject);
        
    } catch (error) {
        console.error('Erreur import validations:', error);
        showToast('Erreur lors de l\'import', 'error');
    } finally {
        showLoadingOverlay(false);
        
        // Nettoyer l'input file
        const validationFileInput = document.getElementById('validationFileInput');
        if (validationFileInput) validationFileInput.value = '';
    }
}

async function handleCalculateKappa(projectId) {
    if (!projectId) {
        showToast('Aucun projet sélectionné', 'error');
        return;
    }
    
    try {
        showLoadingOverlay(true, 'Calcul du Kappa...');
        
        const response = await fetchAPI(`/projects/${projectId}/calculate-kappa`, {
            method: 'POST'
        });
        
        showToast(response.message, 'success');
        
        // Actualiser le projet pour voir le résultat
        await selectProject(projectId, true);
        
    } catch (error) {
        console.error('Erreur calcul Kappa:', error);
        showToast('Erreur lors du calcul du Kappa', 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

function displayKappaResult(message) {
    const container = document.querySelector('.kappa-result-display');
    if (container) {
        container.textContent = message;
        container.style.display = 'block';
    }
}

// ================================================================
// === ANALYSES AVANCÉES
// ================================================================

function renderAnalysisSection(project) {
    if (!elements.analysisContainer) return;
    
    if (!project) {
        elements.analysisContainer.innerHTML = `
            <div class="empty-state">
                <p>Les résultats des analyses s'afficheront ici.</p>
            </div>
        `;
        return;
    }
    
    const analysisCards = [
        {
            id: 'generate-discussion',
            title: 'Discussion académique',
            description: 'Génère une section Discussion basée sur la synthèse',
            icon: '📝',
            available: !!project.synthesis_result
        },
        {
            id: 'generate-knowledge-graph',
            title: 'Graphe de connaissances',
            description: 'Visualise les relations entre concepts',
            icon: '🕸️',
            available: true
        },
        {
            id: 'generate-prisma-flow',
            title: 'Diagramme PRISMA',
            description: 'Génère un diagramme de flux PRISMA',
            icon: '📊',
            available: true
        },
        {
            id: 'run-meta-analysis',
            title: 'Méta-analyse',
            description: 'Analyse statistique des scores de pertinence',
            icon: '📈',
            available: true
        },
        {
            id: 'run-descriptive-stats',
            title: 'Statistiques descriptives',
            description: 'Analyse des données extraites',
            icon: '📋',
            available: !!project.analysis_mode === 'full_extraction'
        }
    ];
    
    elements.analysisContainer.innerHTML = `
        <div class="analysis-header">
            <h3>Analyses avancées</h3>
        </div>
        
        <div class="analysis-grid">
            ${analysisCards.map(card => {
                const actionButton = `
                    <button class="btn ${card.available ? 'btn--primary' : 'btn--outline'}" 
                            data-action="${card.id}" 
                            data-project-id="${project.id}"
                            ${!card.available ? 'disabled title="Analyse non disponible pour ce projet"' : ''}>
                        ${card.available ? 'Lancer' : 'Non disponible'}
                    </button>
                `;
                
                let resultHtml = '';
                
                // Afficher les résultats s'ils existent
                if (card.id === 'generate-discussion' && project.discussion_draft) {
                    resultHtml = `<div class="analysis-result-preview">Discussion générée</div>`;
                } else if (card.id === 'generate-knowledge-graph' && project.knowledge_graph) {
                    resultHtml = `<div class="analysis-result-preview">Graphe disponible</div>`;
                } else if (card.id === 'generate-prisma-flow' && project.prisma_flow_path) {
                    resultHtml = `<div class="analysis-result-preview">Diagramme généré</div>`;
                } else if ((card.id === 'run-meta-analysis' || card.id === 'run-descriptive-stats') && project.analysis_result) {
                    resultHtml = `
                        <div class="analysis-result-preview">
                            Résultats disponibles
                            <button class="btn btn--sm btn--outline" 
                                    data-action="viewAnalysisPlot" 
                                    data-project-id="${project.id}" 
                                    data-plot-type="${card.id}">
                                Voir graphique
                            </button>
                        </div>
                    `;
                }
                
                return `
                    <div class="analysis-card">
                        <div class="analysis-card__header">
                            <span class="analysis-card__icon">${card.icon}</span>
                            <h4>${card.title}</h4>
                        </div>
                        <p class="analysis-card__description">${card.description}</p>
                        ${resultHtml || actionButton}
                    </div>
                `;
            }).join('')}
        </div>
        
        ${project.analysis_result ? renderAnalysisResult(JSON.parse(project.analysis_result)) : `
            <div class="empty-state">
                <p>Lancez une analyse pour générer des résultats à afficher ici.</p>
            </div>
        `}
    `;
}

async function runAdvancedAnalysis(analysisType, projectId) {
    if (!projectId) {
        showToast('Aucun projet sélectionné', 'error');
        return;
    }
    
    const analysisLabels = {
        'generate-discussion': 'discussion',
        'generate-knowledge-graph': 'graphe de connaissances',
        'generate-prisma-flow': 'diagramme PRISMA',
        'run-meta-analysis': 'méta-analyse',
        'run-descriptive-stats': 'statistiques descriptives'
    };
    
    const label = analysisLabels[analysisType] || 'analyse';
    
    try {
        showLoadingOverlay(true, `Lancement de ${label}...`);
        
        const response = await fetchAPI(`/projects/${projectId}/${analysisType}`, {
            method: 'POST'
        });
        
        showToast(response.message, 'success');
        
    } catch (error) {
        console.error(`Erreur ${label}:`, error);
        showToast(`Erreur lors de ${label}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

async function viewAnalysisPlot(projectId, plotType) {
    try {
        // Ouvrir le graphique dans une nouvelle fenêtre ou modale
        const plotUrl = `/api/projects/${projectId}/files/meta_analysis_plot.png`;
        window.open(plotUrl, '_blank');
        
    } catch (error) {
        console.error('Erreur affichage graphique:', error);
        showToast('Erreur lors de l\'affichage du graphique', 'error');
    }
}

// ================================================================
// === IMPORT ET GESTION DES FICHIERS
// ================================================================

function renderImportSection(project) {
    if (!elements.importContainer) return;
    
    if (!project) {
        elements.importContainer.innerHTML = `
            <div class="empty-state">
                <p>Les options d'import s'afficheront ici.</p>
            </div>
        `;
        return;
    }
    
    elements.importContainer.innerHTML = `
        <div class="import-header">
            <h3>Import & Fichiers</h3>
        </div>
        
        <div class="import-sections">
            <div class="import-card">
                <h4>Import de PDFs</h4>
                <p>Importez les PDF des articles de votre projet.</p>
                <div class="upload-area" onclick="document.getElementById('bulkPDFInput').click()">
                    <div class="upload-area__content">
                        <div class="upload-area__icon">📁</div>
                        <div class="upload-area__text">
                            <strong>Glissez-déposez vos fichiers PDF ici</strong><br>
                            <span class="text-muted">Ou cliquez pour sélectionner (max 20 fichiers)</span>
                        </div>
                    </div>
                </div>
                <input type="file" id="bulkPDFInput" multiple accept=".pdf" style="display: none;">
            </div>
            
            <div class="import-card">
                <h4>Import Zotero (JSON)</h4>
                <p>Importer un export Zotero .json.</p>
                <div class="import-actions">
                    <button class="btn btn--outline" data-action="import-zotero-file">
                        Importer fichier JSON
                    </button>
                    <button class="btn btn--outline" data-action="import-zotero-list">
                        Import par liste d'IDs
                    </button>
                </div>
            </div>
            
            <div class="import-card">
                <h4>Récupération PDF en ligne</h4>
                <p>Recherche d'accès libre (Unpaywall).</p>
                <div class="import-actions">
                    <button class="btn btn--outline" data-action="fetch-online-pdfs">
                        Rechercher PDFs
                    </button>
                </div>
            </div>
            
            <div class="import-card">
                <h4>Indexation des PDFs</h4>
                <p>Nécessaire pour le RAG/Chat.</p>
                <div class="import-actions">
                    <button class="btn btn--primary" data-action="run-indexing">
                        Lancer l'indexation
                    </button>
                    ${project.indexed_at ? `
                        <small class="text-muted">
                            Dernière indexation: ${new Date(project.indexed_at).toLocaleString()}
                        </small>
                    ` : ''}
                </div>
            </div>
        </div>
        
        <div class="project-files-section">
            <h4>Fichiers du projet</h4>
            <div id="projectFilesList">
                <p class="text-muted">Chargement des fichiers...</p>
            </div>
        </div>
        
        <input type="file" id="zoteroFileInput" accept=".json" style="display: none;">
    `;
    
    // Charger la liste des fichiers
    loadProjectFiles(project.id);
    
    // Configurer l'upload de PDFs
    setupBulkPDFUpload(project.id);
}

async function loadProjectFiles(projectId) {
    try {
        const files = await fetchAPI(`/projects/${projectId}/files`);
        const container = document.getElementById('projectFilesList');
        
        if (!container) return;
        
        if (files.length === 0) {
            container.innerHTML = '<p class="text-muted">Aucun fichier dans ce projet.</p>';
            return;
        }
        
        container.innerHTML = `
            <div class="files-list">
                ${files.map(file => `
                    <div class="file-item">
                        <span class="file-item__icon">📄</span>
                        <span class="file-item__name">${escapeHtml(file.filename)}</span>
                        <div class="file-item__actions">
                            <a href="/api/projects/${projectId}/files/${file.filename}" 
                               target="_blank" 
                               class="btn btn--sm btn--outline">
                                Voir
                            </a>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
    } catch (error) {
        console.error('Erreur chargement fichiers:', error);
        const container = document.getElementById('projectFilesList');
        if (container) {
            container.innerHTML = '<p class="text-muted">Erreur lors du chargement des fichiers.</p>';
        }
    }
}

function setupBulkPDFUpload(projectId) {
    const fileInput = document.getElementById('bulkPDFInput');
    if (!fileInput) return;
    
    fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        
        if (files.length === 0) return;
        
        if (files.length > 20) {
            showToast('Maximum 20 fichiers autorisés', 'warning');
            return;
        }
        
        // Vérifier que tous les fichiers sont des PDFs
        const invalidFiles = files.filter(file => !file.name.toLowerCase().endsWith('.pdf'));
        if (invalidFiles.length > 0) {
            showToast('Seuls les fichiers PDF sont autorisés', 'error');
            return;
        }
        
        try {
            showLoadingOverlay(true, `Upload de ${files.length} fichier(s)...`);
            
            const formData = new FormData();
            files.forEach(file => formData.append('files', file));
            
            const response = await fetchAPI(`/projects/${projectId}/upload-pdfs-bulk`, {
                method: 'POST',
                body: formData
            });
            
            showToast(`${response.successful.length} fichier(s) uploadé(s) avec succès`, 'success');
            
            if (response.failed.length > 0) {
                console.warn('Échecs upload:', response.failed);
            }
            
            // Recharger la liste des fichiers
            await loadProjectFiles(projectId);
            
        } catch (error) {
            console.error('Erreur upload bulk:', error);
            showToast('Erreur lors de l\'upload', 'error');
        } finally {
            showLoadingOverlay(false);
            fileInput.value = ''; // Reset input
        }
    });
}

async function handleManualPDFUpload(articleId, file) {
    if (!file || !appState.currentProject) return;
    
    try {
        showLoadingOverlay(true, 'Upload du PDF...');
        
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetchAPI(`/projects/${appState.currentProject.id}/upload-pdf-for-article`, {
            method: 'POST',
            body: formData
        });
        
        showToast('PDF uploadé avec succès', 'success');
        
    } catch (error) {
        console.error('Erreur upload PDF:', error);
        showToast('Erreur lors de l\'upload du PDF', 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

async function handleImportZotero(projectId) {
    const articlesInput = prompt('Entrez les IDs des articles (séparés par des virgules ou nouvelles lignes):');
    
    if (!articlesInput || !articlesInput.trim()) {
        return;
    }
    
    // Parser les IDs
    const articleIds = articlesInput
        .split(/[,\n]/)
        .map(id => id.trim())
        .filter(id => id.length > 0);
    
    if (articleIds.length === 0) {
        showToast('Aucun ID valide fourni', 'warning');
        return;
    }
    
    try {
        showLoadingOverlay(true, `Import de ${articleIds.length} article(s)...`);
        
        const response = await fetchAPI(`/projects/${projectId}/import-zotero`, {
            method: 'POST',
            body: { articles: articleIds }
        });
        
        showToast(response.message, 'success');
        await selectProject(projectId, true);
        
    } catch (error) {
        console.error('Erreur import Zotero:', error);
        showToast('Erreur lors de l\'import Zotero', 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

async function handleZoteroFileUpload(e) {
    try {
        if (!appState.currentProject) {
            showToast("Veuillez sélectionner un projet avant d'importer.", 'warning');
            return;
        }
        
        const file = e.target?.files[0];
        if (!file) return;
        
        if (!file.name.toLowerCase().endsWith('.json')) {
            showToast("Veuillez sélectionner un fichier .json exporté depuis Zotero.", 'warning');
            e.target.value = '';
            return;
        }
        
        showLoadingOverlay(true, `Import Zotero (${file.name})...`);
        
        const formData = new FormData();
        formData.append('file', file);
        
        const projectId = appState.currentProject.id;
        const resp = await fetchAPI(`/projects/${projectId}/import-zotero-file`, {
            method: 'POST',
            body: formData
        });
        
        showToast(resp?.message || 'Import Zotero lancé.', 'success');
        await selectProject(projectId, true);
        
    } catch (err) {
        console.error('Erreur import Zotero:', err);
        showToast(err.message || "Erreur lors de l'import Zotero.", 'error');
    } finally {
        showLoadingOverlay(false);
        const zoteroFileInput = document.getElementById('zoteroFileInput');
        if (zoteroFileInput) zoteroFileInput.value = '';
    }
}

async function handleFetchOnlinePdfs(projectId) {
    const articlesInput = prompt('Entrez les IDs des articles pour lesquels chercher des PDFs (séparés par des virgules):');
    
    if (!articlesInput || !articlesInput.trim()) {
        return;
    }
    
    const articleIds = articlesInput
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0);
    
    if (articleIds.length === 0) {
        showToast('Aucun ID valide fourni', 'warning');
        return;
    }
    
    try {
        showLoadingOverlay(true, 'Recherche de PDFs en ligne...');
        
        const response = await fetchAPI(`/projects/${projectId}/fetch-online-pdfs`, {
            method: 'POST',
            body: { articles: articleIds }
        });
        
        showToast(response.message, 'success');
        
    } catch (error) {
        console.error('Erreur fetch PDFs:', error);
        showToast('Erreur lors de la recherche de PDFs', 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

async function handleRunIndexing(projectId) {
    try {
        showLoadingOverlay(true, 'Lancement de l\'indexation...');
        
        const response = await fetchAPI(`/projects/${projectId}/index`, {
            method: 'POST'
        });
        
        showToast(response.message, 'success');
        
    } catch (error) {
        console.error('Erreur indexation:', error);
        showToast('Erreur lors de l\'indexation', 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

// ================================================================
// === CHAT RAG
// ================================================================

function renderChatSection(project) {
    if (!elements.chatContainer) return;
    
    if (!project) {
        elements.chatContainer.innerHTML = `
            <div class="empty-state">
                <h3>Sélectionnez un projet pour discuter avec ses documents.</h3>
            </div>
        `;
        return;
    }
    
    elements.chatContainer.innerHTML = `
        <div class="chat-header">
            <h3>Chat avec les documents</h3>
            <button class="btn btn--outline btn--sm" data-action="clearChatHistory">
                Effacer l'historique
            </button>
        </div>
        
        <div class="chat-messages-container" id="chatMessagesContainer">
            ${renderChatMessages()}
        </div>
        
        <div class="chat-input-container">
            <div class="chat-input-wrapper">
                <textarea id="chatInput" 
                          class="form-control chat-input" 
                          placeholder="Posez une question sur vos documents..." 
                          rows="2"></textarea>
                <button class="btn btn--primary chat-send-btn" 
                        data-action="sendChatMessage"
                        id="chatSendBtn">
                    Envoyer
                </button>
            </div>
            ${!project.indexed_at ? `
                <div class="chat-warning">
                    <p class="text-warning">
                        ⚠️ Les PDFs doivent être indexés pour utiliser le chat. 
                        <a href="#" onclick="showSection('import')" class="link">Aller à l'indexation</a>
                    </p>
                </div>
            ` : ''}
        </div>
    `;
    
    // Configurer l'envoi par Enter
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });
    }
}

function renderChatMessages() {
    if (!appState.currentProjectChatHistory || appState.currentProjectChatHistory.length === 0) {
        return `
            <div class="empty-state">
                <p>Aucun message dans l'historique.</p>
                <p class="text-muted">Commencez une conversation en posant une question.</p>
            </div>
        `;
    }
    
    return appState.currentProjectChatHistory.map(message => `
        <div class="chat-message chat-message--${message.role}">
            <div class="chat-message__header">
                <span class="chat-message__role">${message.role === 'user' ? 'Vous' : 'Assistant IA'}</span>
                <span class="chat-message__time">${new Date(message.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="chat-message__content">
                ${escapeHtml(message.content).replace(/\n/g, '<br>')}
            </div>
            ${message.sources && message.sources.length > 0 ? `
                <div class="chat-message__sources">
                    <strong>Sources:</strong>
                    <ul>
                        ${JSON.parse(message.sources).map(source => `<li>${escapeHtml(source)}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
        </div>
    `).join('');
}

async function sendChatMessage() {
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('chatSendBtn');
    
    if (!chatInput || !appState.currentProject) return;
    
    const question = chatInput.value.trim();
    if (!question) {
        showToast('Veuillez saisir une question', 'warning');
        return;
    }
    
    // Désactiver l'interface pendant l'envoi
    chatInput.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
    
    try {
        // Ajouter le message utilisateur immédiatement
        if (!appState.currentProjectChatHistory) {
            appState.currentProjectChatHistory = [];
        }
        
        appState.currentProjectChatHistory.push({
            role: 'user',
            content: question,
            timestamp: new Date().toISOString()
        });
        
        updateChatDisplay();
        chatInput.value = '';
        
        showLoadingOverlay(true, 'Génération de la réponse...');
        
        const response = await fetchAPI(`/projects/${appState.currentProject.id}/chat`, {
            method: 'POST',
            body: {
                question: question,
                profile: 'standard'
            }
        });
        
        // Ajouter la réponse
        appState.currentProjectChatHistory.push({
            role: 'assistant',
            content: response.answer,
            sources: JSON.stringify(response.sources || []),
            timestamp: new Date().toISOString()
        });
        
        updateChatDisplay();
        
    } catch (error) {
        console.error('Erreur chat:', error);
        showToast('Erreur lors de l\'envoi du message', 'error');
        
        // Ajouter un message d'erreur
        if (appState.currentProjectChatHistory) {
            appState.currentProjectChatHistory.push({
                role: 'assistant',
                content: `Erreur: ${error.message}`,
                timestamp: new Date().toISOString()
            });
            updateChatDisplay();
        }
    } finally {
        showLoadingOverlay(false);
        chatInput.disabled = false;
        if (sendBtn) sendBtn.disabled = false;
        chatInput.focus();
    }
}

function updateChatDisplay() {
    const container = document.getElementById('chatMessagesContainer');
    if (container) {
        container.innerHTML = renderChatMessages();
        container.scrollTop = container.scrollHeight;
    }
}

async function loadChatHistory(projectId) {
    try {
        appState.currentProjectChatHistory = await fetchAPI(`/projects/${projectId}/chat/history`);
    } catch (error) {
        console.error('Erreur chargement historique chat:', error);
        appState.currentProjectChatHistory = [];
    }
}

async function clearChatHistory() {
    if (!appState.currentProject) return;
    
    if (!confirm('Êtes-vous sûr de vouloir effacer tout l\'historique de conversation ?')) {
        return;
    }
    
    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/chat/clear`, {
            method: 'POST'
        });
        
        appState.currentProjectChatHistory = [];
        updateChatDisplay();
        showToast('Historique effacé', 'success');
        
    } catch (error) {
        console.error('Erreur effacement historique:', error);
        showToast('Erreur lors de l\'effacement', 'error');
    }
}

// ================================================================
// === PARAMÈTRES ET CONFIGURATION
// ================================================================

function renderSettingsSection() {
    if (!elements.settingsContainer) return;
    
    elements.settingsContainer.innerHTML = `
        <div class="settings-header">
            <h3>Paramètres</h3>
        </div>
        
        <div class="settings-sections">
            <div class="settings-section">
                <h4>Configuration Zotero</h4>
                <p>Connectez votre compte Zotero pour importer automatiquement les PDF.</p>
                <div class="form-group">
                    <label class="form-label">User ID Zotero</label>
                    <input type="text" id="zoteroUserId" class="form-control" 
                           placeholder="Votre User ID Zotero">
                </div>
                <div class="form-group">
                    <label class="form-label">Clé API Zotero</label>
                    <input type="password" id="zoteroApiKey" class="form-control" 
                           placeholder="Votre clé API Zotero">
                </div>
                <button class="btn btn--primary" data-action="saveZoteroSettings">
                    Sauvegarder les paramètres Zotero
                </button>
            </div>
            
            <div class="settings-section">
                <h4>Gestion des Prompts</h4>
                <p>Modifiez les templates de prompts utilisés par l'IA.</p>
                <div id="promptsList">
                    ${renderPromptsList()}
                </div>
                <button class="btn btn--outline" data-action="edit-prompt">
                    Modifier un prompt
                </button>
            </div>
            
            <div class="settings-section">
                <h4>Profils d'Analyse</h4>
                <p>Gérez les ensembles de modèles IA pour chaque type d'analyse.</p>
                <div id="profilesList">
                    ${renderProfilesList()}
                </div>
                <button class="btn btn--primary" data-action="create-profile">
                    Créer un profil
                </button>
            </div>
            
            <div class="settings-section">
                <h4>Modèles Ollama</h4>
                <p>Gérez les modèles IA installés localement.</p>
                <div id="ollamaModelsList">
                    ${renderOllamaModelsList()}
                </div>
                <div class="ollama-actions">
                    <input type="text" id="modelNameInput" class="form-control" 
                           placeholder="Nom du modèle (ex: llama3.1:8b)">
                    <button class="btn btn--outline" data-action="pullModel">
                        Télécharger un modèle
                    </button>
                </div>
            </div>
            
            <div class="settings-section">
                <h4>Files de tâches</h4>
                <div id="queueStatus">
                    <p class="text-muted">Chargement du statut des files...</p>
                </div>
                <button class="btn btn--outline" data-action="refresh-queues">
                    Actualiser
                </button>
            </div>
        </div>
    `;
    
    // Charger les paramètres Zotero existants
    loadZoteroSettings();
    
    // Charger le statut des files
    renderQueueStatus();
}

function renderPromptsList() {
    if (!appState.prompts || appState.prompts.length === 0) {
        return '<p class="text-muted">Aucun prompt trouvé.</p>';
    }
    
    return `
        <div class="prompts-list">
            ${appState.prompts.map(prompt => `
                <div class="prompt-item">
                    <div class="prompt-item__content">
                        <h5>${escapeHtml(prompt.name)}</h5>
                        <p class="prompt-description">${escapeHtml(prompt.description)}</p>
                    </div>
                    <div class="prompt-item__actions">
                        <button class="btn btn--sm btn--outline" 
                                data-action="edit-prompt" 
                                data-prompt-id="${prompt.id}">
                            Modifier
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderProfilesList() {
    if (!appState.analysisProfiles || appState.analysisProfiles.length === 0) {
        return '<p class="text-muted">Aucun profil trouvé.</p>';
    }
    
    return `
        <div class="profiles-list">
            ${appState.analysisProfiles.map(profile => `
                <div class="profile-item">
                    <div class="profile-item__content">
                        <h5>${escapeHtml(profile.name)} ${!profile.is_custom ? '(Système)' : ''}</h5>
                        <div class="profile-models">
                            <span class="model-tag">Prétraitement: ${escapeHtml(profile.preprocess_model)}</span>
                            <span class="model-tag">Extraction: ${escapeHtml(profile.extract_model)}</span>
                            <span class="model-tag">Synthèse: ${escapeHtml(profile.synthesis_model)}</span>
                        </div>
                    </div>
                    <div class="profile-item__actions">
                        <button class="btn btn--sm btn--outline" 
                                data-action="edit-profile" 
                                data-profile-id="${profile.id}">
                            Modifier
                        </button>
                        ${profile.is_custom ? `
                            <button class="btn btn--sm btn--outline" 
                                    data-action="delete-profile" 
                                    data-profile-id="${profile.id}">
                                Supprimer
                            </button>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderOllamaModelsList() {
    if (!appState.ollamaModels || appState.ollamaModels.length === 0) {
        return '<p class="text-muted">Aucun modèle local trouvé.</p>';
    }
    
    return `
        <div class="models-list">
            ${appState.ollamaModels.map(model => `
                <div class="model-item">
                    <div class="model-item__content">
                        <h5>${escapeHtml(model.name)}</h5>
                        <p class="model-size">Taille: ${model.size || 'Inconnue'}</p>
                    </div>
                    <div class="model-item__actions">
                        <span class="status status--success">Installé</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

async function renderQueueStatus() {
    const container = document.getElementById('queueStatus');
    if (!container) return;
    
    try {
        const status = await fetchAPI('/queues/status');
        
        container.innerHTML = `
            <div class="queues-grid">
                ${Object.entries(status).map(([queueName, info]) => `
                    <div class="queue-item">
                        <div class="queue-item__header">
                            <h6>${queueName}</h6>
                            <span class="queue-count">${info.job_count || 0} tâches</span>
                        </div>
                        <div class="queue-item__actions">
                            <button class="btn btn--sm btn--outline" 
                                    data-action="clearQueue" 
                                    data-queue-name="${queueName}">
                                Vider
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
    } catch (error) {
        console.error('Erreur statut des files:', error);
        container.innerHTML = '<p class="text-muted">Erreur lors du chargement du statut des files.</p>';
    }
}

async function loadZoteroSettings() {
    try {
        const settings = await fetchAPI('/settings/zotero');
        
        const userIdInput = document.getElementById('zoteroUserId');
        const apiKeyInput = document.getElementById('zoteroApiKey');
        
        if (userIdInput) userIdInput.value = settings.userId || '';
        if (apiKeyInput) apiKeyInput.placeholder = settings.hasApiKey ? 'Clé API configurée' : 'Votre clé API Zotero';
        
    } catch (error) {
        console.error('Erreur chargement paramètres Zotero:', error);
    }
}

async function handleSaveZoteroSettings() {
    const userId = document.getElementById('zoteroUserId')?.value.trim();
    const apiKey = document.getElementById('zoteroApiKey')?.value.trim();
    
    if (!userId) {
        showToast('User ID Zotero requis', 'error');
        return;
    }
    
    try {
        await fetchAPI('/settings/zotero', {
            method: 'POST',
            body: { userId, apiKey }
        });
        
        showToast('Paramètres Zotero sauvegardés', 'success');
        
        // Vider le champ mot de passe
        const apiKeyInput = document.getElementById('zoteroApiKey');
        if (apiKeyInput) {
            apiKeyInput.value = '';
            apiKeyInput.placeholder = 'Clé API configurée';
        }
        
    } catch (error) {
        console.error('Erreur sauvegarde Zotero:', error);
        showToast('Erreur lors de la sauvegarde', 'error');
    }
}

async function handlePullModel() {
    const modelInput = document.getElementById('modelNameInput');
    const modelName = modelInput?.value.trim();
    
    if (!modelName) {
        showToast('Nom du modèle requis', 'error');
        return;
    }
    
    try {
        showLoadingOverlay(true, `Téléchargement du modèle ${modelName}...`);
        
        await fetchAPI('/ollama/pull', {
            method: 'POST',
            body: { model: modelName }
        });
        
        showToast(`Modèle ${modelName} téléchargé`, 'success');
        
        // Actualiser la liste des modèles
        await loadOllamaModels();
        renderSettingsSection();
        
        if (modelInput) modelInput.value = '';
        
    } catch (error) {
        console.error('Erreur téléchargement modèle:', error);
        showToast('Erreur lors du téléchargement', 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

async function handleClearQueue(queueName) {
    if (!confirm(`Vider la file ${queueName} ? Toutes les tâches en attente seront supprimées.`)) {
        return;
    }
    
    try {
        await fetchAPI(`/queues/${queueName}/clear`, { method: 'POST' });
        showToast(`File ${queueName} vidée`, 'success');
        await renderQueueStatus();
        
    } catch (error) {
        console.error('Erreur vidage file:', error);
        showToast('Erreur lors du vidage de la file', 'error');
    }
}

// ================================================================
// === GESTION DES GRILLES D'EXTRACTION
// ================================================================

async function loadProjectGrids(projectId) {
    try {
        appState.currentProjectGrids = await fetchAPI(`/projects/${projectId}/grids`);
    } catch (error) {
        console.error('Erreur chargement grilles:', error);
        appState.currentProjectGrids = [];
    }
}

function renderProjectGridsSection(project) {
    if (!project) {
        return `
            <div class="empty-state">
                <p>Sélectionnez un projet pour gérer ses grilles.</p>
            </div>
        `;
    }
    
    return `
        <div class="grids-header">
            <h4>Grilles d'extraction</h4>
            <p>Gérez les grilles personnalisées pour le projet <strong>${escapeHtml(project.name)}</strong>.</p>
            <div class="grids-actions">
                <button class="btn btn--primary" data-action="create-grid">
                    Créer une grille
                </button>
                <button class="btn btn--outline" data-action="import-grid">
                    Importer grille
                </button>
            </div>
        </div>
        
        <div class="grids-list">
            ${appState.currentProjectGrids.length === 0 ? 
                '<p class="text-muted">Aucune grille pour ce projet.</p>' : 
                renderGridsList()
            }
        </div>
        
        <input type="file" id="gridFileInput" accept=".json" style="display: none;">
    `;
}

function renderGridsList() {
    return appState.currentProjectGrids.map(grid => `
        <div class="grid-item">
            <div class="grid-item__content">
                <h5>${escapeHtml(grid.name)}</h5>
                <p class="grid-meta">${grid.fields.length} champs • ${new Date(grid.created_at).toLocaleDateString()}</p>
            </div>
            <div class="grid-item__actions">
                <button class="btn btn--sm btn--outline" 
                        data-action="edit-grid" 
                        data-grid-id="${grid.id}">
                    Modifier
                </button>
                <button class="btn btn--sm btn--outline" 
                        data-action="delete-grid" 
                        data-grid-id="${grid.id}">
                    Supprimer
                </button>
            </div>
        </div>
    `).join('');
}

function openGridModal(gridId = null) {
    const modal = document.getElementById('gridModal');
    if (!modal) return;
    
    const isEdit = !!gridId;
    const grid = isEdit ? appState.currentProjectGrids.find(g => g.id === gridId) : null;
    
    // Titre de la modale
    const titleEl = modal.querySelector('.modal__title');
    if (titleEl) {
        titleEl.textContent = isEdit ? 'Modifier la grille' : 'Créer une grille';
    }
    
    // Peupler les champs
    const nameInput = modal.querySelector('#gridName');
    const fieldsContainer = modal.querySelector('#gridFields');
    
    if (nameInput) {
        nameInput.value = grid?.name || '';
    }
    
    if (fieldsContainer) {
        fieldsContainer.innerHTML = '';
        
        if (grid?.fields && grid.fields.length > 0) {
            grid.fields.forEach(field => addGridFieldInput(field));
        } else {
            addGridFieldInput();
        }
    }
    
    // Stocker l'ID pour la sauvegarde
    modal.dataset.gridId = gridId || '';
    
    openModal('gridModal');
}

function addGridFieldInput(field = null) {
    const container = document.getElementById('gridFields');
    if (!container) return;
    
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'form-group-dynamic';
    fieldDiv.innerHTML = `
        <div class="grid-field-input">
            <input type="text" 
                   name="field_name" 
                   class="form-control" 
                   placeholder="Nom du champ" 
                   value="${escapeHtml(field?.name || '')}" 
                   required>
            <input type="text" 
                   name="field_description" 
                   class="form-control" 
                   placeholder="Description" 
                   value="${escapeHtml(field?.description || '')}">
            <button type="button" 
                    class="btn btn--outline btn--sm" 
                    data-action="removeGridField">
                Supprimer
            </button>
        </div>
    `;
    
    container.appendChild(fieldDiv);
}

async function handleSaveGrid(e) {
    e.preventDefault();
    
    if (!appState.currentProject) {
        showToast('Aucun projet sélectionné', 'error');
        return;
    }
    
    const modal = document.getElementById('gridModal');
    const gridId = modal?.dataset.gridId;
    const isEdit = !!gridId;
    
    const formData = new FormData(e.target);
    const gridName = formData.get('name');
    
    if (!gridName?.trim()) {
        showToast('Le nom de la grille est requis', 'error');
        return;
    }
    
    // Collecter les champs
    const fieldNames = formData.getAll('field_name');
    const fieldDescriptions = formData.getAll('field_description');
    
    if (fieldNames.length === 0) {
        showToast('Au moins un champ est requis', 'error');
        return;
    }
    
    const fields = fieldNames.map((name, index) => ({
        name: name.trim(),
        description: fieldDescriptions[index]?.trim() || ''
    })).filter(field => field.name);
    
    try {
        showLoadingOverlay(true, isEdit ? 'Modification...' : 'Création...');
        
        const url = isEdit ? 
            `/projects/${appState.currentProject.id}/grids/${gridId}` :
            `/projects/${appState.currentProject.id}/grids`;
        
        const method = isEdit ? 'PUT' : 'POST';
        
        await fetchAPI(url, {
            method,
            body: { name: gridName, fields }
        });
        
        closeModal('gridModal');
        e.target.reset();
        
        await loadProjectGrids(appState.currentProject.id);
        refreshCurrentSection();
        
        showToast(`Grille ${isEdit ? 'modifiée' : 'créée'} avec succès`, 'success');
        
    } catch (error) {
        console.error('Erreur sauvegarde grille:', error);
        showToast(`Erreur lors de la ${isEdit ? 'modification' : 'création'}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

async function handleDeleteGrid(gridId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette grille ?')) {
        return;
    }
    
    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/grids/${gridId}`, {
            method: 'DELETE'
        });
        
        await loadProjectGrids(appState.currentProject.id);
        refreshCurrentSection();
        showToast('Grille supprimée avec succès', 'success');
        
    } catch (error) {
        console.error('Erreur suppression grille:', error);
        showToast('Erreur lors de la suppression', 'error');
    }
}

async function handleGridImport(e) {
    const file = e.target.files[0];
    if (!file || !appState.currentProject) return;
    
    try {
        showLoadingOverlay(true, 'Import de la grille...');
        
        const formData = new FormData();
        formData.append('file', file);
        
        await fetchAPI(`/projects/${appState.currentProject.id}/grids/import`, {
            method: 'POST',
            body: formData
        });
        
        await loadProjectGrids(appState.currentProject.id);
        refreshCurrentSection();
        showToast('Grille importée avec succès', 'success');
        
    } catch (error) {
        console.error('Erreur import grille:', error);
        showToast('Erreur lors de l\'import', 'error');
    } finally {
        showLoadingOverlay(false);
        e.target.value = '';
    }
}

// ================================================================
// === GESTION DES MODALES
// ================================================================

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('modal--show');
        document.body.style.overflow = 'hidden';
        
        // Focus sur le premier input
        const firstInput = modal.querySelector('input, textarea, select');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('modal--show');
        document.body.style.overflow = '';
    }
}

// ================================================================
// === GESTION DES PROFILS ET PROMPTS (PLACEHOLDERS)
// ================================================================

function openPromptModal(promptId = null) {
    // Implémentation pour modifier les prompts
    showToast('Fonction de modification des prompts en cours de développement', 'info');
}

function openProfileModal(profileId = null) {
    // Implémentation pour créer/modifier les profils
    showToast('Fonction de gestion des profils en cours de développement', 'info');
}

async function handleSavePrompt(e) {
    e.preventDefault();
    showToast('Fonction de sauvegarde des prompts en cours de développement', 'info');
}

async function handleSaveProfile(e) {
    e.preventDefault();
    showToast('Fonction de sauvegarde des profils en cours de développement', 'info');
}

async function handleDeleteProfile(profileId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce profil ?')) {
        return;
    }
    
    try {
        await fetchAPI(`/analysis-profiles/${profileId}`, { method: 'DELETE' });
        await loadAnalysisProfiles();
        renderSettingsSection();
        showToast('Profil supprimé avec succès', 'success');
        
    } catch (error) {
        console.error('Erreur suppression profil:', error);
        showToast('Erreur lors de la suppression', 'error');
    }
}

// ================================================================
// === FONCTIONS UTILITAIRES FINALES
// ================================================================

async function handleExportProject(projectId) {
    try {
        showLoadingOverlay(true, 'Préparation de l\'export...');
        
        const response = await fetch(`/api/projects/${projectId}/export`);
        if (!response.ok) {
            throw new Error('Erreur lors de l\'export');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `project_${projectId}_export.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showToast('Export réussi', 'success');
        
    } catch (error) {
        console.error('Erreur export projet:', error);
        showToast('Erreur lors de l\'export', 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

// ================================================================
// === INITIALISATION FINALE
// ================================================================

// Exposer certaines fonctions globalement pour les événements inline HTML
window.openModal = openModal;
window.closeModal = closeModal;
window.showSection = showSection;
window.loadProjectSearchResults = loadProjectSearchResults;

// Log de fin de chargement
console.log('✅ AnalyLit V4.1 Frontend - Chargement complet terminé');
