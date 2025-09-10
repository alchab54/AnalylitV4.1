// ================================================================
// AnalyLit V4.1 - Application Frontend (Version finale consolidée)
// ================================================================

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

async function initializeApplication() {
    showLoadingOverlay(true, 'Initialisation...');
    try {
        initializeWebSocket();
        await loadInitialData();
        showSection('projects');
        console.log('✅ Application initialisée avec succès');
    } catch (error) {
        console.error('❌ Erreur initialisation application:', error);
        showToast("Erreur lors de l'initialisation de l'application.", 'error');
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
    elements.createProjectBtn.addEventListener('click', () => openModal('newProjectModal'));
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
      handleRunIndexing();
    });
  }
  if (elements.importZoteroPdfsBtn) {
    elements.importZoteroPdfsBtn.addEventListener('click', handleImportZoteroPdfs);
  }

  // Gestion centralisée des clics (fermeture des modales)
  document.body.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal') || e.target.classList.contains('modal__close')) {
      const modal = e.target.closest('.modal');
      if (modal) closeModal(modal.id);
    }
  });
  
  document.body.addEventListener('click', event => {
        if (event.target.id === 'runFullExtractionBtn') {
            showRunExtractionModal();
        }
    });

  // Centralisation de la gestion des clics pour les actions dynamiques (délégation)
  document.body.addEventListener('click', (e) => {
    // Clic sur "Voir détails" d'un article
    const viewDetailsButton = e.target.closest('.view-details-btn');
    if (viewDetailsButton) {
      const articleId = viewDetailsButton.dataset.articleId;
      if (articleId) viewArticleDetails(articleId);
      return;
    }

    // Clic sur une checkbox d'article
    const articleCheckbox = e.target.closest('.article-checkbox');
    if (articleCheckbox) {
      const articleId = articleCheckbox.dataset.articleId;
      if (articleId) {
        toggleArticleSelection(articleId, articleCheckbox.checked);
      }
      return;
    }

    if (e.target.id === 'runFullExtractionBtn') {
        showRunExtractionModal();
    }
  });

  // Uploads PDF manuels
  const manualPDFInput = document.getElementById('manualPDFInput');
  if (manualPDFInput) {
    manualPDFInput.addEventListener('change', handleManualPDFUpload);
  }

  // Formulaires de modale
  const gridForm = document.getElementById('gridForm');
  if (gridForm) {
    gridForm.addEventListener('submit', handleGridFormSubmit);
  }
  const manualArticleForm = document.getElementById('manualArticleForm');
  if (manualArticleForm) {
    manualArticleForm.addEventListener('submit', handleAddManualArticles);
  }
  const newProjectForm = document.getElementById('newProjectForm');
  if (newProjectForm) {
    newProjectForm.addEventListener('submit', handleCreateProject);
  }

  // ============================ 
  // Notifications: remise à zéro
  // ============================ 
  // Cible plusieurs sélecteurs possibles pour la “cloche”/bouton
  const notifButtons = document.querySelectorAll('.notifications-btn, [data-notifications-toggle], .notification-indicator');
  if (notifButtons.length) {
    notifButtons.forEach(btn => btn.addEventListener('click', clearNotifications));
  }

  // Quand la fenêtre reprend le focus, on considère les notifications comme lues
  window.addEventListener('focus', () => {
    clearNotifications();
  });
}

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

async function handleCreateProject(event) {
    event.preventDefault();
    const form = event.target;
    const name = form.elements.name.value;
    const description = form.elements.description.value;
    const mode = form.elements.mode.value;

    if (!name) {
        showToast('Le nom du projet est requis.', 'warning');
        return;
    }

    try {
        showLoadingOverlay(true, 'Création du projet...');
        closeModal('newProjectModal');

        const newProject = await fetchAPI('/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description, mode })
        });

        await loadProjects();
        selectProject(newProject.id);
        showToast('Projet créé avec succès!', 'success');
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}
async function loadInitialData() {
    await Promise.all([
        loadProjects(),
        loadAnalysisProfiles(),
        loadPrompts(),
        loadOllamaModels(),
        loadAvailableDatabases(),
    ]);
    renderProjectList();
}

// --- Fonctions de chargement des données (manquantes) ---


async function loadProjects() {
    appState.projects = await fetchAPI('/projects');
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


function sanitizeForFilename(name) {
  // Miroir du backend: remplace <>:"/\|?* par _ et met en minuscules
  return String(name || '').replace(/[<>:"/\\|?*]/g, '_').trim().toLowerCase();
}

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

function hasPdfForArticle(articleId) {
  if (!appState.currentProjectFiles) return false;
  const stem = sanitizeForFilename(articleId);
  return appState.currentProjectFiles.has(stem);
}

function renderProjectList() {
    if (!elements.projectsList) return;

    const projects = Array.isArray(appState.projects) ? appState.projects : [];

    if (projects.length === 0) {
        elements.projectsList.innerHTML = `
            <div class="empty-state">
                <p>Aucun projet trouvé.</p>
                <p>Créez un projet pour commencer votre revue de littérature.</p>
            </div>
        `;
        return;
    }

    const projectsHtml = projects.map(project => {
        const isActive = appState.currentProject && appState.currentProject.id === project.id;
        const statusClass = getStatusClass(project.status);
        
        return `
            <div class="project-list-item ${isActive ? 'project-list-item--active' : ''}" 
                 onclick="selectProject('${project.id}')">
                <div class="project-list-item-info">
                    <div class="project-list-item-name">${escapeHtml(project.name)}</div>
                    <div class="project-list-item-status">
                        <span class="status-badge ${statusClass}">${escapeHtml(project.status || 'pending')}</span>
                    </div>
                </div>
                <button class="btn btn--danger btn--sm" 
                        onclick="event.stopPropagation(); deleteProject('${project.id}')"
                        title="Supprimer le projet">
                    ×
                </button>
            </div>
        `;
    }).join('');

    elements.projectsList.innerHTML = projectsHtml;
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

function renderProjectSynthesis(synthesisResult, projectDescription) {
    if (!synthesisResult) {
        return `<div class="synthesis-placeholder"><p>Aucune synthèse disponible. Lancez une analyse pour en générer une.</p></div>`;
    }
    try {
        const synthesis = JSON.parse(synthesisResult);
        return `
            <div class="synthesis-result">
                <h4>Synthèse du projet</h4>
                <p>${escapeHtml(synthesis.synthesis_summary || 'Synthèse non disponible.')}</p>
            </div>`;
    } catch (e) {
        return `<div class="synthesis-placeholder"><p>Erreur lors de l'affichage de la synthèse.</p></div>`;
    }
}
function renderProjectDetail(project) {
    if (!project || !elements.projectDetailContent) return;

    const synthesis = renderProjectSynthesis(project.synthesis_result, project.description);
    
    elements.projectDetailContent.innerHTML = `
        <div class="project-detail">
            <div class="project-header">
                <h2>${escapeHtml(project.name)}</h2>
                <span class="status ${getStatusClass(project.status)}">${project.status}</span>
            </div>
            
            <div class="project-description">
                <p>${escapeHtml(project.description || 'Aucune description')}</p>
            </div>
            
            <div class="project-stats">
                <div class="stat-item">
                    <span class="stat-label">Articles trouvés</span>
                    <span class="stat-value">${project.pmids_count || 0}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Articles traités</span>
                    <span class="stat-value">${project.processed_count || 0}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Temps total</span>
                    <span class="stat-value">${Math.round(project.total_processing_time || 0)}s</span>
                </div>
            </div>
            
            ${synthesis}
            
            <div class="project-actions">
                <button class="btn btn--primary" onclick="showSearchModal()">🔍 Rechercher articles</button>
                <button class="btn btn--secondary" onclick="showSection('results')">📄 Voir résultats</button>
            </div>
        </div>
    `;
}
async function loadSearchResults() {
  showLoadingOverlay(true, 'Chargement des résultats...');
  if (!appState.currentProject?.id) {
    elements.resultsContainer.innerHTML = `
      <div class="card"><div class="card__body">
        Sélectionnez un projet pour voir les résultats.
      </div></div>`;
    showLoadingOverlay(false);
    return;
  }

  try {
    const [searchResults, extractions] = await Promise.all([
      fetchAPI(`/projects/${appState.currentProject.id}/results`),
      fetchAPI(`/projects/${appState.currentProject.id}/extractions`)
    ]);

    appState.searchResults = searchResults || [];
    appState.currentProjectExtractions = extractions || [];
    
    // La fonction de rendu est appelée ici, après le chargement des données.
    renderSearchResultsTable();
  } catch (e) {
    elements.resultsContainer.innerHTML = '<p>Erreur lors du chargement des résultats.</p>';
    console.error('Erreur loadSearchResults:', e);
  } finally {
    showLoadingOverlay(false);
  }
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

function toggleAbstractRow(articleId) {
    const abstractRow = document.getElementById(`abstract-${articleId}`);
    if (abstractRow) {
        abstractRow.classList.toggle('hidden');
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
async function loadChatMessages() {
    if (!elements.chatContainer) return; 
    
    if (!appState.currentProject || !appState.currentProject.id) {
        elements.chatContainer.innerHTML = `
            <div class="empty-state">
                <p>Sélectionnez un projet pour accéder au chat.</p>
            </div>
        `;
        return;
    }

    try {
        const messages = await fetchAPI(`/projects/${appState.currentProject.id}/chat-messages`);
        appState.chatMessages = Array.isArray(messages) ? messages : [];
        renderChatInterface(appState.chatMessages);
    } catch (e) {
        console.error('Erreur chargement chat:', e);
        elements.chatContainer.innerHTML = `
            <div class="error-state">
                <p>Erreur lors du chargement du chat.</p>
            </div>
        `;
    }
}

function renderChatInterface(messages = []) {
    if (!elements.chatContainer) return;

    const messagesHtml = messages.map(msg => `
        <div class="chat-message chat-message--${msg.role}">
            <div class="chat-message-content">
                ${escapeHtml(msg.content)}
            </div>
            <div class="chat-message-meta">
                ${new Date(msg.timestamp).toLocaleString()}
            </div>
        </div>
    `).join('');

    elements.chatContainer.innerHTML = `
        <div class="chat-interface">
            <div class="chat-messages">
                ${messagesHtml || '<p class="empty-state">Aucun message pour le moment.</p>'}
            </div>
            <div class="chat-input-container">
                <textarea 
                    id="chatInput" 
                    placeholder="Posez votre question..." 
                    class="chat-input-field">
                </textarea>
                <button 
                    class="btn btn--primary" 
                    onclick="handleSendChatMessage()">
                    Envoyer
                </button>
            </div>
        </div>
    `;
}

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

async function loadRobSection() {
    if (!elements.robContainer) return;

    if (!appState.currentProject?.id) {
        elements.robContainer.innerHTML = `<div class="empty-state"><p>Sélectionnez un projet pour évaluer le risque de biais.</p></div>`;
        return;
    }

    // On se base sur les articles déjà chargés dans `searchResults`
    const articles = appState.searchResults || [];
    if (articles.length === 0) {
        elements.robContainer.innerHTML = `<div class="empty-state"><p>Aucun article dans ce projet. Lancez une recherche d'abord.</p></div>`;
        return;
    }

    const articlesHtml = articles.map(article => `
        <div class="rob-article-card" id="rob-card-${article.article_id}">
            <div class="rob-article-header">
                <input type="checkbox" class="article-select-checkbox" value="${escapeHtml(article.article_id)}" onchange="toggleArticleSelection('${escapeHtml(article.article_id)}', this.checked)">
                <h4 class="rob-article-title">${escapeHtml(article.title)}</h4>
                <button class="btn btn--sm btn--outline" onclick="fetchAndDisplayRob('${article.article_id}')">Voir/Éditer</button>
            </div>
            <div class="rob-assessment-summary" id="rob-summary-${article.article_id}">
                <!-- Le résumé de l'évaluation sera chargé ici -->
            </div>
        </div>
    `).join('');

    elements.robContainer.innerHTML = `<div class="rob-list">${articlesHtml}</div>`;
}

async function loadProjectAnalyses() {
    if (!appState.currentProject) {
        if (elements.analysisContainer) {
            elements.analysisContainer.innerHTML = '<p>Sélectionnez un projet pour voir les analyses.</p>';
        }
        return;
    }
    
    try {
        const analyses = await fetchAPI(`/projects/${appState.currentProject.id}/analyses`);
        appState.analysisResults = analyses || {};
        renderAnalysesSection();
    } catch (e) {
        console.error('Erreur chargement analyses:', e);
        showToast('Erreur lors du chargement des analyses', 'error');
    }
}

function exportAnalyses() {
    if (!appState.currentProject?.id) {
        showToast('Veuillez sélectionner un projet.', 'warning');
        return;
    }
    // Ouvre l'URL de l'endpoint d'export dans un nouvel onglet, ce qui déclenche le téléchargement
    window.open(`/api/projects/${appState.currentProject.id}/export-analyses`, '_blank');
    showToast('Export des analyses en cours de téléchargement...', 'info');
}

function renderAnalysesSection() {
    if (!elements.analysisContainer) return;

    const analyses = appState.analysisResults || {};
    const projectId = appState.currentProject?.id;

    // 1. Section pour lancer les analyses
    const analysisLauncherHtml = `
        <div class="card">
             <div class="card__header">
                <h3>Actions</h3>
                <button class="btn btn--secondary btn--sm" onclick="exportAnalyses()">Exporter les analyses (ZIP)</button>
            </div>
        </div>
        <div class="card card--collapsible card--collapsible--collapsed">
            <div class="card__header"><h3>Lancer une nouvelle analyse</h3></div>
            <div class="card__content analysis-options">
                <div class="analysis-option" onclick="runProjectAnalysis('discussion')">
                    <div class="analysis-icon">💬</div>
                    <div class="analysis-details">
                        <h4>Brouillon de Discussion</h4>
                        <p>Génère une synthèse narrative des conclusions et limitations des études incluses.</p>
                    </div>
                </div>
                <div class="analysis-option" onclick="runProjectAnalysis('knowledge_graph')">
                    <div class="analysis-icon">🕸️</div>
                    <div class="analysis-details">
                        <h4>Graphe de Connaissances</h4>
                        <p>Identifie et visualise les relations entre les articles (thèmes, auteurs, etc.).</p>
                    </div>
                </div>
                <div class="analysis-option" onclick="runProjectAnalysis('prisma_flow')">
                    <div class="analysis-icon">📊</div>
                    <div class="analysis-details">
                        <h4>Diagramme de flux PRISMA</h4>
                        <p>Crée un diagramme de flux PRISMA basé sur les étapes de la revue.</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    // 2. Brouillon de discussion
    const discussionHtml = analyses.discussion_draft ? `
        <div class="card">
            <div class="card__header"><h3>Brouillon de Discussion</h3></div>
            <div class="card__content formatted-text">
                ${escapeHtml(analyses.discussion_draft).replace(/\n/g, '<br>')}
            </div>
        </div>
    ` : '';

    // 3. Graphe de connaissances
    let graphHtml = analyses.knowledge_graph ? `
        <div class="card">
            <div class="card__header"><h3>Graphe de Connaissances</h3></div>
            <div class="card__content">
                <div id="knowledgeGraphContainer" class="knowledge-graph-container"></div>
            </div>
        </div>
    ` : '';
    
    // 4. Diagramme PRISMA
    const prismaHtml = analyses.prisma_flow_path ? `
        <div class="card">
            <div class="card__header"><h3>Diagramme de flux PRISMA</h3></div>
            <div class="card__content">
                <img src="${analyses.prisma_flow_path}?v=${new Date().getTime()}" alt="Diagramme PRISMA" class="prisma-image">
            </div>
        </div>
    ` : '';

    // Assemblage final
    elements.analysisContainer.innerHTML = `
        ${analysisLauncherHtml}
        <div class="layout-grid">
            ${discussionHtml ? `<div class="grid-column">${discussionHtml}</div>` : ''}
            ${(graphHtml || prismaHtml) ? `<div class="grid-column">${graphHtml}${prismaHtml}</div>` : ''}
        </div>
    `;

    // Initialiser le graphe si les données existent
    if (analyses.knowledge_graph && typeof vis !== 'undefined') {
        initializeKnowledgeGraph(analyses.knowledge_graph);
    }
}

// Fonction pour lancer une analyse (doit aussi être présente)
async function runProjectAnalysis(analysisType) {
    if (!appState.currentProject?.id) {
        showToast('Veuillez d\'abord sélectionner un projet.', 'warning');
        return;
    }
    
    // Mappage pour les messages affichés à l'utilisateur
    const analysisNames = {
        discussion: 'le brouillon de discussion',
        knowledge_graph: 'le graphe de connaissances',
        prisma_flow: 'le diagramme PRISMA'
    };

    try {
        showLoadingOverlay(true, `Lancement de la génération pour ${analysisNames[analysisType] || analysisType}...`);
        // Note: L'endpoint varie en fonction de l'analyse
        let endpoint = '';
        switch(analysisType) {
            case 'discussion':
                endpoint = `/projects/${appState.currentProject.id}/run-discussion-draft`;
                break;
            case 'knowledge_graph':
                 endpoint = `/projects/${appState.currentProject.id}/run-knowledge-graph`;
                 break;
            case 'prisma_flow':
                endpoint = `/projects/${appState.currentProject.id}/run-prisma-flow`;
                break;
            default:
                showToast('Type d\'analyse inconnu.', 'error');
                return;
        }
        
        await fetchAPI(endpoint, { method: 'POST' });
        showToast(`La génération pour ${analysisNames[analysisType]} a été lancée.`, 'success');
    } catch (e) {
        showToast(`Erreur lors du lancement de l\'analyse: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
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

function updateSelectionCounter() {
    const counter = document.getElementById('selection-counter');
    if (counter) {
        counter.textContent = `${appState.selectedSearchResults.size} article(s) sélectionné(s)`;
    }
}

async function handleDeleteSelectedArticles() {
    const selectedIds = Array.from(appState.selectedSearchResults);
    if (selectedIds.length === 0) {
        showToast('Aucun article sélectionné.', 'warning');
        return;
    }
    if (!confirm(`Êtes-vous sûr de vouloir supprimer définitivement ${selectedIds.length} article(s) ?`)) {
        return;
    }
    showLoadingOverlay(true, 'Suppression en cours...');
    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/articles`, {
            method: 'DELETE',
            body: { article_ids: selectedIds }
        });
        
        appState.searchResults = appState.searchResults.filter(a => !selectedIds.includes(a.article_id));
        appState.currentProjectExtractions = appState.currentProjectExtractions.filter(e => !selectedIds.includes(e.pmid));
        appState.selectedSearchResults.clear();
        
        showToast('Articles supprimés avec succès.', 'success');
        renderSearchResultsTable();
    } catch (error) {
        showToast(`Erreur : ${error.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

// Fonctions pour le workflow d'extraction complète
function showRunExtractionModal() {
    const includedArticles = appState.currentValidations.filter(e => e.user_validation_status === 'include');
    if (includedArticles.length === 0) {
        showToast("Aucun article n'a été validé comme 'Inclus'.", 'warning');
        return;
    }

    if (appState.currentProjectGrids.length === 0) {
        showToast("Aucune grille d'extraction n'a été créée ou importée pour ce projet.", 'error');
        showSection('grids'); // Redirige l'utilisateur pour créer une grille
        return;
    }

    const modalContent = `
        <p>Vous êtes sur le point de lancer une extraction complète sur les <strong>${includedArticles.length} article(s)</strong> que vous avez inclus.</p>
        <div class="form-group">
            <label for="extractionGridSelect" class="form-label">Choisir une grille d'extraction :</label>
            <select id="extractionGridSelect" class="form-control">
                ${appState.currentProjectGrids.map(grid => `<option value="${grid.id}">${escapeHtml(grid.name)}</option>`).join('')}
            </select>
        </div>
         <div class="form-group">
            <label for="extractionProfileSelect" class="form-label">Choisir un profil d'analyse :</label>
            <select id="extractionProfileSelect" class="form-control">
                ${appState.analysisProfiles.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
            </select>
        </div>
    `;
    showModal('Lancer l\'extraction complète', modalContent, 'startFullExtraction()');
}

async function startFullExtraction() {
    const gridId = document.getElementById('extractionGridSelect').value;
    const profileId = document.getElementById('extractionProfileSelect').value;
    const includedArticlesIds = appState.currentValidations
        .filter(e => e.user_validation_status === 'include')
        .map(e => e.pmid);

    if (!gridId) {
        showToast("Veuillez sélectionner une grille.", "warning");
        return;
    }

    closeModal();
    showLoadingOverlay(true, 'Lancement de l\'extraction...');
    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/run`, {
            method: 'POST',
            body: {
                articles: includedArticlesIds,
                profile: profileId,
                analysis_mode: 'full_extraction',
                custom_grid_id: gridId
            }
        });
        showToast('Tâche d\'extraction lancée avec succès.', 'success');
    } catch (error) {
        showToast(`Erreur lors du lancement de l'extraction: ${error.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

function toggleArticleSelection(articleId, checked) {
    if (checked) {
        appState.selectedSearchResults.add(articleId);
    } else {
        appState.selectedSearchResults.delete(articleId);
    }
    updateSelectionCounter();
}

// CORRECTION : Ajout de la fonction manquante viewArticleDetails
function viewArticleDetails(articleId) {
  if (!articleId) {
    showToast('ID article manquant', 'error');
    return;
  }

  // Chercher l'article dans les résultats de recherche
  const article = appState.searchResults.find(r => r.article_id === articleId);
  const extraction = appState.currentProjectExtractions.find(e => e.pmid === articleId);

  if (!article) {
    showToast('Article non trouvé', 'error');
    return;
  }

  // Créer le contenu de la modale avec les détails
  const modalContent = `
    <div class="article-details">
      <h3>${escapeHtml(article.title || 'Titre non disponible')}</h3>
      
      <div class="article-meta">
        <p><strong>Auteurs:</strong> ${escapeHtml(article.authors || 'Non spécifiés')}</p>
        <p><strong>Journal:</strong> ${escapeHtml(article.journal || 'Non spécifié')}</p>
        <p><strong>Date:</strong> ${escapeHtml(article.publication_date || 'Non spécifiée')}</p>
        <p><strong>DOI:</strong> ${article.doi ? `<a href="https://doi.org/${article.doi}" target="_blank">${article.doi}</a>` : 'Non disponible'}</p>
        <p><strong>Source:</strong> ${escapeHtml(article.database_source || 'Inconnue')}</p>
      </div>

      ${article.abstract ? `
        <div class="article-abstract">
          <h4>Résumé</h4>
          <p>${escapeHtml(article.abstract)}</p>
        </div>
      ` : ''}

      ${extraction ? `
        <div class="article-extraction">
          <h4>Évaluation IA</h4>
          <p><strong>Score de pertinence:</strong> ${extraction.relevance_score || 'N/A'}/10</p>
          <p><strong>Justification:</strong> ${escapeHtml(extraction.relevance_justification || 'Aucune')}</p>
          
          ${extraction.extracted_data ? `
            <h4>Données extraites</h4>
            <pre class="extraction-data">${escapeHtml(JSON.stringify(JSON.parse(extraction.extracted_data), null, 2))}</pre>
          ` : ''}
        </div>
      ` : ''}

      <div class="article-actions">
        ${article.url ? `<a href="${article.url}" target="_blank" class="btn btn--secondary btn--sm">Voir sur ${article.database_source}</a>` : ''}
      </div>
    </div>
  `;

  // Créer et afficher la modale
  const modal = document.createElement('div');
  modal.className = 'modal modal--show';
  modal.innerHTML = `
    <div class="modal__content modal__content--large">
      <div class="modal__header">
        <h3>Détails de l'article</h3>
        <button type="button" class="modal__close" onclick="closeModal()">&times;</button>
      </div>
      <div class="modal__body">
        ${modalContent}
      </div>
    </div>
  `;

  // Ajouter la modale au DOM
  document.body.appendChild(modal);

  // Gestion de fermeture par clic sur le fond
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.classList.contains('modal__close')) {
      document.body.removeChild(modal);
    }
  });
}

function renderSearchResultsTable() {
  if (!elements.resultsContainer) return;

  const project = appState.currentProject;
  const results = Array.isArray(appState.searchResults) ? appState.searchResults : [];
  const extractions = Array.isArray(appState.currentProjectExtractions) ? appState.currentProjectExtractions : [];

  // CORRECTION: Unification de la logique de chargement des fichiers PDF
  if (!appState.currentProjectFiles) {
    if (project?.id) {
      loadProjectFilesSet().then(renderSearchResultsTable); // Relance le rendu après chargement
    }
    elements.resultsContainer.innerHTML = `
      <div class="card"><div class="card__body">
        Chargement des fichiers PDF du projet...
      </div></div>`;
    return;
  }

  if (!project?.id) {
    elements.resultsContainer.innerHTML = `
      <div class="card"><div class="card__body">
        Sélectionnez un projet pour voir les résultats.
      </div></div>`;
    return;
  }

  if (results.length === 0) {
    elements.resultsContainer.innerHTML = `
      <div class="card">
        <div class="card__body text-center">
          <h4>Aucun résultat</h4>
          <p>Lancez une recherche pour voir les articles trouvés.</p>
        </div>
      </div>`;
    return;
  }

  // CORRECTION: Indexation unifiée des extractions par article_id
  // Utilisation de Object.fromEntries pour une syntaxe plus concise
  const extractionById = Object.fromEntries(extractions.map(e => [e.pmid, e]));

  // Version tableau compact et responsive
  const rows = results.map(article => {
    const ex = extractionById[article.article_id] || {};
    const score = ex.relevance_score ?? '';
    const justification = ex.relevance_justification || '';

    const pdfExists = hasPdfForArticle(article.article_id);
    const pdfBadge = pdfExists
      ? `<span class="badge badge--success">PDF</span>`
      : `<span class="badge badge--secondary">Aucun</span>`;

    // Tronquer le titre si trop long
    const titleDisplay = (article.title || 'Titre non disponible').length > 80 
      ? (article.title || 'Titre non disponible').substring(0, 80) + '...' 
      : (article.title || 'Titre non disponible');

    // Tronquer les auteurs
    const authorsDisplay = (article.authors || '').length > 40
      ? (article.authors || '').substring(0, 40) + '...' 
      : (article.authors || '');

    // CORRECTION: Affichage du score avec couleurs et justification
    const scoreDisplay = (score !== undefined && score !== null)
      ? `<span class="score-badge ${score >= 7 ? 'score--high' : score >= 4 ? 'score--medium' : 'score--low'}">${score}/10</span>`
      : '<span class="badge badge--secondary">Pas analysé</span>';

    return `
      <tr class="article-row" data-article-id="${escapeHtml(article.article_id)}">
        <td class="select-cell"><input type="checkbox" class="article-checkbox" data-article-id="${escapeHtml(article.article_id)}" ${appState.selectedSearchResults.has(article.article_id) ? 'checked' : ''}></td>
        <td class="article-main">
          <div class="article-title" title="${escapeHtml(article.title || '')}">${escapeHtml(titleDisplay)}</div>
          <div class="article-meta">
            <span class="article-id">ID: ${escapeHtml(article.article_id)}</span>
            ${article.journal ? `• <span class="article-journal">${escapeHtml(article.journal)}</span>` : ''}
            ${article.publication_date ? `• <span class="article-year">${escapeHtml(article.publication_date)}</span>` : ''}
          </div>
          <div class="article-authors" title="${escapeHtml(article.authors || '')}">${escapeHtml(authorsDisplay)}</div>
        </td>
        <td class="source-cell">
          <span class="source-badge source--${escapeHtml((article.database_source || 'unknown').toLowerCase())}">${escapeHtml((article.database_source || '').toUpperCase())}</span>
        </td>
        <td class="pdf-cell">${pdfBadge}</td>
        <td class="score-cell">
          ${scoreDisplay}
          ${justification ? `<div class="score-justification" title="${escapeHtml(justification)}">${escapeHtml(justification.length > 50 ? justification.substring(0, 50) + '...' : justification)}</div>` : ''}
        </td>
        <td class="actions-cell">
          <button class="btn btn--sm btn--outline view-details-btn" data-article-id="${escapeHtml(article.article_id)}">
            👁️
          </button>
          ${article.url ? `<a href="${escapeHtml(article.url)}" target="_blank" class="btn btn--sm btn--outline">🔗</a>` : ''}
        </td>
      </tr>`;
  }).join('');

  elements.resultsContainer.innerHTML = `
    <div class="card">
      <div class="card__header">
        <h3>Résultats (${results.length} articles)</h3>
        <div class="results-actions">
          <button class="btn btn--primary btn--sm" onclick="showSearchModal()">🔍 Nouvelle recherche</button>
          <button class="btn btn--secondary btn--sm" onclick="selectAllArticles()">Tout sélectionner</button>
          <button class="btn btn--accent btn--sm" id="batchProcessBtn" onclick="showBatchProcessModal()">Traiter la sélection (<span id="selectionCounter">0</span>)</button>
        </div>
      </div>
      <div class="card__body">
        <div class="table-container">
          <table class="table table--compact">
            <thead>
              <tr>
                <th class="col-select">Sél.</th>
                <th class="col-main">Article & Métadonnées</th>
                <th class="col-source">Source</th>
                <th class="col-pdf">PDF</th>
                <th class="col-score">Score IA</th>
                <th class="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </div>`;
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


async function fetchAndDisplayRob(articleId) {
    const summaryContainer = document.getElementById(`rob-summary-${articleId}`);
    if (!summaryContainer) return;

    try {
        summaryContainer.innerHTML = `<div class="loading-spinner"></div>`;
        const robData = await fetchAPI(`/projects/${appState.currentProject.id}/risk-of-bias?article_id=${articleId}`);

        if (Object.keys(robData).length === 0) {
            summaryContainer.innerHTML = `<p class="text-secondary">Aucune ÃƒÂ©valuation de biais pour cet article. Lancez l'analyse.</p>`;
            return;
        }

        summaryContainer.innerHTML = `
            <div class="rob-details">
                <div class="rob-domain">
                    <strong>Randomisation:</strong>
                    <span class="status status--${getBiasClass(robData.domain_1_bias)}">${robData.domain_1_bias || 'N/A'}</span>
                    <p class="rob-justification">${escapeHtml(robData.domain_1_justification)}</p>
                </div>
                <div class="rob-domain">
                    <strong>DonnÃƒÂ©es manquantes:</strong>
                    <span class="status status--${getBiasClass(robData.domain_2_bias)}">${robData.domain_2_bias || 'N/A'}</span>
                    <p class="rob-justification">${escapeHtml(robData.domain_2_justification)}</p>
                </div>
                <div class="rob-domain rob-overall">
                    <strong>Ãƒâ€°valuation globale:</strong>
                    <span class="status status--${getBiasClass(robData.overall_bias)}">${robData.overall_bias || 'N/A'}</span>
                    <p class="rob-justification">${escapeHtml(robData.overall_justification)}</p>
                </div>
            </div>
        `;

    } catch (e) {
        summaryContainer.innerHTML = `<p class="error">Erreur: ${e.message}</p>`;
    }
}

function getBiasClass(bias) {
    if (!bias) return 'info';
    const biasLower = bias.toLowerCase();
    if (biasLower.includes('low')) return 'success';
    if (biasLower.includes('some concerns')) return 'warning';
    if (biasLower.includes('high')) return 'error';
    return 'info';
}

async function handleRunRobAnalysis() {
    if (!appState.currentProject) return;
    const selectedIds = Array.from(appState.selectedSearchResults);
    if (selectedIds.length === 0) {
        showToast("Veuillez sélectionner au moins un article pour l'analyse RoB.", 'warning');
        return;
    }
    showLoadingOverlay(true, `Lancement de l'analyse RoB pour ${selectedIds.length} article(s)...`);
    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/run-rob-analysis`, {
            method: 'POST',
            body: { article_ids: selectedIds }
        });
        showToast("Analyse du risque de biais lancée. Les résultats apparaîtront progressivement.", 'success');
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

function getRobDomainFromKey(key) {
    const domainMap = {
        'domain_1_bias': 'Biais dans le processus de randomisation',
        'domain_2_bias': 'Biais dus aux écarts par rapport aux interventions prévues',
        // Ajoutez d'autres domaines ici si nécessaire
        'overall_bias': 'Biais global'
    };
    return domainMap[key] || key.replace(/_/g, ' ');
}

function showRunAnalysisModal() {
    const selectedCount = appState.selectedSearchResults.size;
    if (selectedCount === 0) {
        showToast("Veuillez sélectionner au moins un article.", "warning");
        return;
    }
    openModal('bulkActionsModal');
    // Mettre à jour le contenu de la modale immédiatement
    const modalContent = document.querySelector('#bulkActionsModal .modal__body');
    if(modalContent) {
        modalContent.innerHTML = `
            <p>Vous êtes sur le point de lancer un traitement par lot sur ${selectedCount} article(s).</p>
            <div class="form-group">
                <label for="bulkAnalysisProfile">Veuillez choisir un profil d'analyse:</label>
                <select id="bulkAnalysisProfile" class="form-control">
                    ${appState.analysisProfiles.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                </select>
            </div>
        `;
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

// ============================ 
// Analyses Section
// ============================ 

function renderDiscussionDraft(draft) {
    if (!draft) return '';
    return `
        <div class="analysis-card">
            <h4><i class="fas fa-file-alt"></i> Brouillon de la Discussion</h4>
            <div class="text-content">${escapeHtml(draft).replace(/\n/g, '<br>')}</div>
        </div>
    `;
}

function renderKnowledgeGraph(graphData) {
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
         return `
            <div class="analysis-card">
                <h4><i class="fas fa-project-diagram"></i> Graphe de Connaissances</h4>
                <p class="status-message">Aucune donnée pour le graphe. Lancez l'analyse pour le générer.</p>
            </div>
        `;
    }
    return `
        <div class="analysis-card">
            <h4><i class="fas fa-project-diagram"></i> Graphe de Connaissances</h4>
            <div id="knowledgeGraph" class="knowledge-graph-container"></div>
            <p class="help-text">${graphData.nodes.length} noeuds et ${graphData.edges.length} relations.</p>
        </div>
    `;
}

function renderPrismaFlow(prismaPath) {
    if (!prismaPath) return '';
    // On ajoute un timestamp pour forcer le rechargement de l'image
    const cacheBuster = new Date().getTime();
    return `
        <div class="analysis-card">
            <h4><i class="fas fa-sitemap"></i> Diagramme de flux PRISMA</h4>
            <img src="${prismaPath}?v=${cacheBuster}" alt="Diagramme PRISMA" style="max-width:100%; height:auto; border-radius: var(--radius-base);">
        </div>
    `;
}

function renderGenericAnalysisResult(title, analysis) {
    if (!analysis) return '';
     let content;
    if (typeof analysis === 'object' && analysis !== null) {
        content = `<pre class="code-block">${escapeHtml(JSON.stringify(analysis, null, 2))}</pre>`;
    } else {
        content = `<div class="text-content">${escapeHtml(analysis)}</div>`;
    }
    return `
        <div class="analysis-card">
            <h4><i class="fas fa-chart-bar"></i> ${title}</h4>
            ${content}
        </div>
    `;
}

function initializeKnowledgeGraph(data) {
    const container = document.getElementById('knowledgeGraph');
    if (!container || !vis) return;

    const nodes = new vis.DataSet(data.nodes);
    const edges = new vis.DataSet(data.edges);

    const graphData = { nodes, edges };
    const options = {
        nodes: {
            shape: 'box',
            margin: 10,
            widthConstraint: {
                maximum: 200
            },
            font: {
                color: '#fff' // Texte en blanc pour le mode sombre
            }
        },
        edges: {
            arrows: 'to',
            font: {
                align: 'horizontal',
                color: '#fff',
                strokeWidth: 2,
                strokeColor: '#222'
            }
        },
        physics: {
            forceAtlas2Based: {
                gravitationalConstant: -26,
                centralGravity: 0.005,
                springLength: 230,
                springConstant: 0.18
            },
            maxVelocity: 146,
            solver: 'forceAtlas2Based',
            timestep: 0.35,
            stabilization: { iterations: 150 }
        },
        layout: {
            hierarchical: false
        }
    };
    new vis.Network(container, graphData, options);
}

async function handleRunDiscussionDraft() {
    if (!appState.currentProject?.id) return;
    showLoadingOverlay(true, 'Génération du brouillon de discussion...');
    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/run-discussion-draft`, { method: 'POST' });
        showToast('Tâche de génération lancée.', 'success');
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

async function handleRunKnowledgeGraph() {
    if (!appState.currentProject?.id) return;
    showLoadingOverlay(true, 'Génération du graphe...');
    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/run-knowledge-graph`, { method: 'POST' });
        showToast('Génération du graphe de connaissances lancée.', 'success');
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

async function handleRunPrismaFlow() {
    if (!appState.currentProject?.id) return;
    showLoadingOverlay(true, 'Génération du diagramme PRISMA...');
    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/run-prisma-flow`, { method: 'POST' });
        showToast('Génération du diagramme PRISMA lancée.', 'success');
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}



async function handleRunMetaAnalysis() {
    if (!appState.currentProject?.id) return;
    showLoadingOverlay(true, 'Lancement de la méta-analyse...');
    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/run-meta-analysis`, { method: 'POST' });
        showToast('Méta-analyse lancée avec succès.', 'success');
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

async function handleRunDescriptiveStats() {
    if (!appState.currentProject?.id) return;
    showLoadingOverlay(true, 'Calcul des statistiques descriptives...');
    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/run-descriptive-stats`, { method: 'POST' });
        showToast('Calcul des statistiques lancé.', 'success');
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

// ============================ 
// Settings Section
// ============================ 
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                project_id: appState.currentProject.id,
                query,
                databases: selectedDatabases,
                max_results_per_db: maxResults
            })
        });
        
        showToast('Recherche lancée', 'success');
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

async function selectAnalysisType(analysisType) { // CORRECTION : Nom de fonction unifié
    try {
        showLoadingOverlay(true, 'Lancement de l\'analyse...');
        closeModal();

        await fetchAPI(`/projects/${appState.currentProject.id}/run-analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: analysisType })
        });

        showToast(`Analyse ${analysisType} lancée`, 'success');

    } catch (e) {
        console.error('Erreur lancement analyse:', e);
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

// Formulaire: ajout manuel d’articles
async function handleAddManualArticles(event) {
    event.preventDefault();

    if (!appState.currentProject?.id) {
        showToast('Sélectionnez d’abord un projet.', 'warning');
        return;
    }

    const form = event.target;
    const textarea = form.querySelector('textarea[name="manual_ids"]') || form.querySelector('textarea');
    const raw = textarea ? textarea.value.trim() : '';

    // CORRECTION : on accepte un champ texte multi-lignes et on l’envoie sous "identifiers"
    if (!raw) {
        showToast('Ajoutez au moins un identifiant (PMID, DOI, arXiv).', 'warning');
        return;
    }

    try {
        showLoadingOverlay(true, 'Ajout manuel en cours...');
        const res = await fetchAPI(`/projects/${appState.currentProject.id}/add-manual-articles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifiers: raw })
        });

        await loadSearchResults();
        showToast(`${res.added || 0} article(s) ajouté(s).`, 'success');
        // Optionnel : vider le champ
        if (textarea) textarea.value = '';
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

async function handleFetchOnlinePdfs() {
    if (!appState.currentProject) return;
    const selectedIds = Array.from(appState.selectedSearchResults);
    if (selectedIds.length === 0) {
        showToast("Veuillez d'abord sélectionner des articles dans la section 'Recherche'.", 'warning');
        return;
    }
    showLoadingOverlay(true, `Recherche de ${selectedIds.length} PDF(s) en ligne...`);
    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/fetch-online-pdfs`, {
            method: 'POST',
            body: { articles: selectedIds }
        });
        showToast('Recherche de PDFs lancée en arrière-plan. Les notifications indiqueront les succès.', 'success');
    } catch (error) {
        showToast(`Erreur : ${error.message}`, 'error');
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

async function handleImportZoteroPdfs() {
    if (!appState.currentProject?.id) {
        showToast('Veuillez sélectionner un projet.', 'warning');
        return;
    }
    
    if (appState.searchResults.length === 0) {
        showToast("Aucun article dans ce projet à synchroniser avec Zotero.", 'info');
        return;
    }

    const articleIds = appState.searchResults.map(r => r.article_id);
    
    showLoadingOverlay(true, 'Lancement de la récupération des PDFs via Zotero...');
    try {
        const response = await fetchAPI(`/projects/${appState.currentProject.id}/import-zotero`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ articles: articleIds })
        });
        showToast(response.message || 'Récupération des PDFs depuis Zotero lancée.', 'success');
    } catch (e) {
        showToast(`Erreur : ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}


function renderAnalysisSection(project) {
    if (!elements.analysisContainer) return;
    const analysis = project && project.analysis_result || null;
    const plotPath = project && project.analysis_plot_path || null;
    const knowledgeGraphData = project && project.knowledge_graph ? JSON.parse(project.knowledge_graph) : null;

    elements.analysisContainer.innerHTML = `
        <div class="card">
            <div class="card__header"><h4>📊 Analyses du projet</h4></div>
            <div class="card__body">
                <div id="knowledgeGraphContainer" style="width: 100%; height: 600px; border: 1px solid var(--color-border); border-radius: var(--radius-lg); margin-bottom: 24px;">
                    ${!knowledgeGraphData ? '<div class="empty-state"><p>Générez le graphe de connaissances pour le visualiser ici.</p></div>' : ''}
                </div>
                ${analysis ? `<pre class="code-block">${escapeHtml(JSON.stringify(analysis, null, 2))}</pre>` : `
                    <div class="empty-state">
                        <p>Aucune analyse disponible pour le moment.</p>
                    </div>`
                }
                ${plotPath ? `<img src="/api/projects/${appState.currentProject.id}/files/${plotPath.split('/').pop()}" alt="Graphique d'analyse" class="analysis-plot" style="max-width:100%;height:auto;margin-top:16px;">` : ''}
            </div>
        </div>
    `;

    if (knowledgeGraphData && window.vis) {
        const container = document.getElementById('knowledgeGraphContainer');
        const options = {
            nodes: {
                shape: 'dot',
                size: 16,
                font: { size: 14, color: 'var(--color-text)' }
            },
            edges: {
                width: 2,
                color: { inherit: 'from' },
                arrows: { to: { enabled: true, scaleFactor: 0.5 } }
            },
            physics: {
                forceAtlas2Based: { gravitationalConstant: -26, centralGravity: 0.005, springLength: 230, springConstant: 0.18 },
                maxVelocity: 146,
                solver: 'forceAtlas2Based',
                timestep: 0.35,
            },
        };
        new vis.Network(container, knowledgeGraphData, options);
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





function selectAllArticles() {
	const checkboxes = document.querySelectorAll('.article-checkbox');
	const allChecked = Array.from(checkboxes).every(cb => cb.checked);
	
	checkboxes.forEach(cb => {
		cb.checked = !allChecked; // Inverse la sélection
        toggleArticleSelection(cb.dataset.articleId, !allChecked);
	});
}

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

function showAddManualArticlesModal() {
    openModal('addManualArticlesModal');
}

window.showAddManualArticlesModal = showAddManualArticlesModal;

// Exposer certaines fonctions globalement pour les événements inline HTML

// Exposition contrôlée des handlers au scope global (évite ReferenceError)
window.handleZoteroFileUpload = typeof handleZoteroFileUpload === 'function' ? handleZoteroFileUpload : () => {};
window.handleImportValidations = typeof handleImportValidations === 'function' ? handleImportValidations : (e) => { e.preventDefault(); console.warn("handleImportValidations non implémenté ou mal référencé."); };
window.handleBulkPDFUpload = typeof handleBulkPDFUpload === 'function' ? handleBulkPDFUpload : () => {};
window.showSearchModal = typeof showSearchModal === 'function' ? showSearchModal : () => {};
window.deleteProject = typeof deleteProject === 'function' ? deleteProject : () => {};
window.selectProject = typeof selectProject === 'function' ? selectProject : () => {};

window.exportValidations = typeof exportValidations === 'function' ? exportValidations : () => {};
window.calculateKappa = typeof calculateKappa === 'function' ? calculateKappa : () => {};

window.handleRunIndexing = typeof handleRunIndexing === 'function' ? handleRunIndexing : () => {};
window.handleFetchOnlinePDFs = typeof handleFetchOnlinePDFs === 'function' ? handleFetchOnlinePDFs : () => {};
window.handleManualPDFUpload = typeof handleManualPDFUpload === 'function' ? handleManualPDFUpload : (e) => { e.preventDefault(); console.warn("handleManualPDFUpload non implémenté ou mal référencé."); };
window.handleImportZotero = typeof handleImportZotero === 'function' ? handleImportZotero : () => {};
window.handlePullModel = typeof handlePullModel === 'function' ? handlePullModel : () => {};
window.handleSaveZoteroSettings = typeof handleSaveZoteroSettings === 'function' ? handleSaveZoteroSettings : () => {};
window.handleSendChatMessage = typeof handleSendChatMessage === 'function' ? handleSendChatMessage : () => {};
window.handleAddManualArticles = typeof handleAddManualArticles === 'function' ? handleAddManualArticles : () => {};

window.openGridModal = typeof openGridModal === 'function' ? openGridModal : () => {};
window.handleDeleteGrid = typeof handleDeleteGrid === 'function' ? handleDeleteGrid : () => {};
window.openPromptModal = typeof openPromptModal === 'function' ? openPromptModal : () => {};
window.editPrompt = typeof editPrompt === 'function' ? editPrompt : () => {};
window.openProfileModal = typeof openProfileModal === 'function' ? openProfileModal : () => {};
window.fetchAndDisplayRob = typeof fetchAndDisplayRob === 'function' ? fetchAndDisplayRob : () => {};
window.deleteProfile = typeof deleteProfile === 'function' ? deleteProfile : () => {};
window.selectAnalysisType = typeof selectAnalysisType === 'function' ? selectAnalysisType : () => {};

window.showPRISMAModal = showPRISMAModal;
window.togglePRISMAItem = togglePRISMAItem;
window.savePRISMAProgress = savePRISMAProgress;
window.exportPRISMAReport = exportPRISMAReport;

window.runAdvancedAnalysis = typeof runAdvancedAnalysis === 'function' ? runAdvancedAnalysis : () => {};
window.viewAnalysisPlot = typeof viewAnalysisPlot === 'function' ? viewAnalysisPlot : () => {};

window.exportAnalyses = exportAnalyses;
// Log de fin de chargement
window.handleRunRobAnalysis = handleRunRobAnalysis;
window.exportForThesis = exportForThesis;
window.showStakeholderManagement = showStakeholderManagement;
window.addStakeholderGroup = addStakeholderGroup;

console.log('✅ AnalyLit V4.1 Frontend - Chargement complet terminé');

function showBatchProcessModal() {
    const selectedCount = appState.selectedSearchResults.size;
    if (selectedCount === 0) {
        showToast('Veuillez sélectionner au moins un article.', 'warning');
        return;
    }

    const content = `
        <p>Vous êtes sur le point de lancer un traitement par lot sur ${selectedCount} article(s).</p>
        <p>Veuillez choisir un profil d'analyse:</p>
        <select id="batch-analysis-profile" class="form-control">
            ${appState.analysisProfiles.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
        </select>
        <div class="modal__actions">
            <button type="button" class="btn btn--secondary" onclick="closeModal('genericModal')">Annuler</button>
            <button type="button" class="btn btn--primary" onclick="startBatchProcessing()">Lancer</button>
        </div>
    `;
    showModal('Traitement par lot', content);
}

function startBatchProcessing() {
    const selectedIds = Array.from(appState.selectedSearchResults);
    const profileId = document.getElementById('batch-analysis-profile').value;
    
    try {
        showLoadingOverlay(true, 'Lancement du traitement par lot...');
        closeModal('genericModal');
        
        fetchAPI(`/projects/${appState.currentProject.id}/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                articles: selectedIds,
                profile: profileId,
                analysis_mode: 'screening'
            })
        });
        
        showToast('Traitement par lot lancé.', 'success');
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

window.showBatchProcessModal = showBatchProcessModal;
window.startBatchProcessing = startBatchProcessing;
window.showRunExtractionModal = showRunExtractionModal;
window.startFullExtraction = startFullExtraction;
window.handleFetchOnlinePdfs = handleFetchOnlinePdfs;
window.handleRunRobAnalysis = handleRunRobAnalysis;
window.toggleSelectAll = toggleSelectAll;
window.handleDeleteSelectedArticles = handleDeleteSelectedArticles;