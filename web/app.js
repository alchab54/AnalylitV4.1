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
    console.log('🚀 Démarrage de AnalyLit V4.1 Frontend...');
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
        await loadInitialData(); // Appelle le bloc de fonctions ci-dessus
        showSection('projects');
        renderProjectList();
        console.log('✅ Application initialisée avec succès');
    } catch (error) {
        console.error('❌ Erreur initialisation application:', error);
        showToast("Erreur lors de l'initialisation de l'application.", 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

async function loadProjects() {
    try {
        appState.projects = await fetchAPI('/projects');
        console.log(`📊 Projets chargés: ${appState.projects ? appState.projects.length : 0}`);
    } catch (error) {
        console.error('Erreur chargement projets:', error);
        appState.projects = []; // Assurer un état stable en cas d'échec
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
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    // Correction: Assure un HTML valide et simple
    toast.innerHTML = `<span class="toast__icon">${icons[type] || 'ℹ️'}</span><p>${escapeHtml(message)}</p>`;
    elements.toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('toast--show'), 10);
    setTimeout(() => {
        toast.classList.remove('toast--show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 4000);
}

function renderProjectList() {
  if (!elements.projectsList) return;

  // État vide
  if (!Array.isArray(appState.projects) || appState.projects.length === 0) {
    elements.projectsList.innerHTML = `
      <li class="empty-state">
        <p>Aucun projet. Créez-en un pour commencer.</p>
      </li>
    `;
    return;
  }

  // Rendu des projets
  const html = appState.projects.map(p => `
    <li class="project-item" data-project-id="${p.id}">
      <div class="project-card">
        <h4>${escapeHtml(p.name || 'Projet sans nom')}</h4>
        <p>${escapeHtml(p.description || 'Pas de description')}</p>
        <div class="project-meta">
          <span class="status-badge">${escapeHtml(p.status || 'pending')}</span>
          <span class="count">${Number(p.pmids_count || 0)} articles</span>
        </div>
      </div>
    </li>
  `).join('');

  elements.projectsList.innerHTML = html;

  // Sélection d’un projet au clic
  elements.projectsList.querySelectorAll('.project-item').forEach(li => {
    li.addEventListener('click', () => {
      const pid = li.getAttribute('data-project-id');
      selectProject(pid, true);
    });
  });
}

function showLoadingOverlay(show, text = 'Chargement...') {
  if (!elements.loadingOverlay) {
    console.warn('loadingOverlay introuvable dans le DOM');  // [web:1]
    return;  // [web:1]
  }
  // Tente de cibler un élément message si présent, sinon fallback
  const msgEl = elements.loadingOverlay.querySelector('[data-loading-message]') || elements.loadingOverlay.querySelector('p');  // [web:1]
  if (msgEl) {
    msgEl.textContent = text;  // [web:1]
  }
  // Supporte à la fois une classe utilitaire et le style inline
  if (elements.loadingOverlay.classList) {
    // Si votre CSS gère .loading-overlay--show (recommandé)
    elements.loadingOverlay.classList.toggle('loading-overlay--show', !!show);  // [web:1]
  }
  // Fallback inline (utile si la classe n’existe pas encore)
  elements.loadingOverlay.style.display = show ? 'flex' : 'none';  // [web:1]
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

// ================================================================
// === GESTION DE L'AFFICHAGE (LOGIQUE MANQUANTE)
// ================================================================
function normalizeSectionKey(key) {
  const map = {
    'projets': 'projects',
    'projet': 'projects',
    'projects': 'projects',
    'recherche': 'search',
    'search': 'search',
    'validation': 'validation',
    'analyses': 'analysis',
    'analyse': 'analysis',
    'analysis': 'analysis',
    'import': 'import',
    'importer': 'import',
    'chat': 'chat',
    'parametres': 'settings',
    'paramètres': 'settings',
    'settings': 'settings',
  };
  const k = String(key || '').trim().toLowerCase();
  return map[k] || k;
}

function showSection(sectionKey) {
  const key = normalizeSectionKey(sectionKey);
  console.log(`🔍 Affichage de la section: ${key}`);
  if (!elements.sections || elements.sections.length === 0) {
    console.warn('Aucun conteneur de section détecté (elements.sections vide).');
    return;
  }
  let found = false;
  elements.sections.forEach(sec => {
    if (!sec) return;
    const secKey = (sec.getAttribute('data-section') || sec.id || '').toLowerCase();
    const isTarget = secKey === key;
    if (sec.style) sec.style.display = isTarget ? 'block' : 'none';
    if (isTarget) found = true;
  });
  if (!found) {
    console.warn(`Section '${key}' introuvable (data-section ou id).`);
    const first = elements.sections;
    if (first && first.style) {
      first.style.display = 'block';
      appState.currentSection = (first.getAttribute('data-section') || first.id || 'unknown').toLowerCase();
    }
    return;
  }
  appState.currentSection = key;
}

function updateActiveNav(sectionId) {
    elements.navButtons.forEach(btn => {
        if (btn.getAttribute('data-section') === sectionId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

async function renderProjectArticlesList(projectId) {
  const container = document.getElementById('project-articles-list');
  if (!container) return;
  try {
    const [articles, pdfFiles] = await Promise.all([
      fetchAPI(`/projects/${projectId}/search-results?per_page=1000`),
      fetchAPI(`/projects/${projectId}/files`)
    ]);
    const pdfFilenames = new Set((pdfFiles || []).map(f => f.filename));
    if (!articles?.results || articles.results.length === 0) {
      container.innerHTML = `
        <p class="text-muted">Aucun article dans ce projet.</p>
        <p class="text-muted">Ajoutez des résultats via la recherche ou un import Zotero.</p>
      `;
      return;
    }
    const listHtml = articles.results.map(article => {
      const safeFilename = `${sanitize_filename(article.article_id || article.id || '')}.pdf`;
      const hasPdf = pdfFilenames.has(safeFilename);
      const pdfActionHtml = hasPdf
        ? `<a href="/api/projects/${projectId}/files/${encodeURIComponent(safeFilename)}" target="_blank" class="btn btn--sm btn--outline">Ouvrir PDF</a>`
        : `<span class="status status--warning">PDF manquant</span>`;
      return `
        <li class="article-row">
          <div class="article-main">
            <div class="article-title">${escapeHtml(article.title || '')}</div>
            <div class="article-meta">${escapeHtml(article.database_source || '')} • ${escapeHtml(article.article_id || '')}</div>
          </div>
          <div class="article-actions">
            ${pdfActionHtml}
          </div>
        </li>
      `;
    }).join('');
    container.innerHTML = `<ul class="article-list">${listHtml}</ul>`;
  } catch (error) {
    console.error('Erreur renderProjectArticlesList:', error);
    showToast("Erreur lors du chargement des articles du projet", 'error');
  } finally {
    // no-op
  }
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
	if (typeof renderImportSection === 'function') {
    renderImportSection(project);
  } else if (project?.id) {
    // Fallback minimal: afficher la liste des articles + état des PDFs
    if (typeof renderProjectArticlesList === 'function') {
      renderProjectArticlesList(project.id);
    }
  }
}

// ================================================================
// === CHARGEMENT DES DONNÉES INITIALES
// ================================================================

async function loadInitialData() {
    // Exécute tous les chargements en parallèle pour accélérer le démarrage
    await Promise.all([
        loadProjects(),
        loadAnalysisProfiles(),
        loadPrompts(), // Correction: s'assurer que cette fonction est appelée
        loadOllamaModels(),
        loadAvailableDatabases()
    ]);
}

async function loadAnalysisProfiles() {
    try {
        appState.analysisProfiles = await fetchAPI('/analysis-profiles');
    } catch (error) {
        console.error('Erreur chargement profils d\'analyse:', error);
        appState.analysisProfiles = [];
    }
}

async function loadPrompts() {
    try {
        appState.prompts = await fetchAPI('/prompts');
        if (!Array.isArray(appState.prompts)) {
            console.warn('Réponse inattendue pour /prompts, utilisation d’une liste vide.');
            appState.prompts = [];
        }
    } catch (error) {
        console.error('Erreur chargement des prompts:', error);
        appState.prompts = []; // Reset en cas d'erreur
    }
}

async function loadOllamaModels() {
  try {
    const data = await fetchAPI('/ollama/models');
    appState.ollamaModels = Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('Erreur chargement modèles Ollama:', err);
    appState.ollamaModels = [];
  }
}

async function loadAvailableDatabases() {
  try {
    appState.availableDatabases = await fetchAPI('/databases');
    if (!Array.isArray(appState.availableDatabases)) {
      console.warn('Réponse inattendue pour /databases, utilisation d’une liste vide.');
      appState.availableDatabases = [];
    }
  } catch (error) {
    console.error('Erreur chargement bases de données disponibles:', error);
    appState.availableDatabases = [];
  }
}

async function loadQueueStatus() {
  try {
    const data = await fetchAPI('/queues/info');
    appState.queueStatus = data;
  } catch (e) {
    console.error('Erreur chargement statut files:', e);
  }
}

// ================================================================
// === GESTION DES ÉVÉNEMENTS ET ÉCOUTEURS
// ================================================================

function setupEventListeners() {
  // Navigation principale (boutons avec data-section)
  if (elements.navButtons && elements.navButtons.forEach) {
    elements.navButtons.forEach(button => {
      button.addEventListener('click', () => {
        const sectionId = button.getAttribute('data-section');
        if (!sectionId) return;
        // Exiger un projet sélectionné pour les sections autres que projects/settings
        const needsProject = !['projects', 'settings'].includes(sectionId);
        if (needsProject && !appState.currentProject) {
          showToast("Veuillez d'abord sélectionner un projet.", 'warning');
          return;
        }
        showSection(sectionId);
      });
    });
  }

  // Bouton: ouvrir la modale de création de projet
  if (elements.createProjectBtn) {
    elements.createProjectBtn.addEventListener('click', () => {
      openModal('newProjectModal');
    });
  }

  // Formulaire: création de projet
  if (elements.newProjectForm) {
    elements.newProjectForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const formData = new FormData(elements.newProjectForm);
        const payload = {
          name: (formData.get('name') || '').toString().trim(),
          description: (formData.get('description') || '').toString().trim(),
          mode: (formData.get('mode') || 'screening').toString().trim(),
        };
        if (!payload.name) {
          showToast('Le nom du projet est requis.', 'warning');
          return;
        }
        showLoadingOverlay(true, 'Création du projet...');
        const newProject = await fetchAPI('/projects', { method: 'POST', body: payload });
        appState.projects = [newProject, ...appState.projects];
        renderProjectList();
        closeModal('newProjectModal');
        showToast('Projet créé avec succès', 'success');
        await selectProject(newProject.id);
      } catch (err) {
        console.error('Erreur création projet:', err);
        showToast(err.message || 'Erreur lors de la création du projet', 'error');
      } finally {
        showLoadingOverlay(false);
        elements.newProjectForm.reset();
      }
    });
  }

  // Formulaire: recherche multi-bases
  if (elements.multiSearchForm) {
    elements.multiSearchForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!appState.currentProject) {
        showToast('Sélectionner un projet avant de lancer une recherche.', 'warning');
        return;
      }
      try {
        const formData = new FormData(elements.multiSearchForm);
        const query = (formData.get('query') || '').toString().trim();
        const databases = Array.from(elements.multiSearchForm.querySelectorAll('input[name="databases"]:checked'))
          .map(cb => cb.value);
        const maxResults = parseInt(formData.get('max_results') || '50', 10);
        if (!query) {
          showToast('La requête de recherche est requise.', 'warning');
          return;
        }
        if (databases.length === 0) {
          showToast('Sélectionner au moins une base.', 'warning');
          return;
        }
        showLoadingOverlay(true, 'Recherche en cours...');
        await fetchAPI('/search', {
          method: 'POST',
          body: {
            project_id: appState.currentProject.id,
            query,
            databases,
            max_results_per_db: maxResults
          }
        });
        showToast('Recherche lancée.', 'success');
        // Recharger plus tard via notifications; on déclenche un rafraîchissement doux
        setTimeout(() => selectProject(appState.currentProject.id, true), 1200);
      } catch (err) {
        console.error('Erreur recherche:', err);
        showToast(err.message || 'Erreur lors de la recherche', 'error');
      } finally {
        showLoadingOverlay(false);
      }
    });
  }

  // Formulaire: lancer le pipeline d’analyse (screening/extraction)
  if (elements.runPipelineForm) {
    elements.runPipelineForm.addEventListener('submit', async (e) => {
      e.preventDefault();
	    if (!appState.currentProject) {
        showToast('Sélectionner un projet avant de lancer une analyse.', 'warning');
        return;
      }

      try {
        const formData = new FormData(elements.runPipelineForm);
        const profile = (formData.get('profile') || 'standard').toString();
        const analysis_mode = (formData.get('analysis_mode') || 'screening').toString();
        const custom_grid_id_raw = (formData.get('custom_grid_id') || '').toString().trim();

        // Récupère les articles sélectionnés (cohérent avec la sélection dans la liste des résultats)
        // Si appState.selectedSearchResults est vide, tenter un fallback sur les checkboxes du DOM
        let selectedArticles = Array.from(appState.selectedSearchResults || []);
        if (selectedArticles.length === 0) {
          const checkboxes = document.querySelectorAll('[data-result-id][data-select-checkbox]');
          selectedArticles = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.getAttribute('data-result-id'))
            .filter(Boolean);
        }

        if (selectedArticles.length === 0) {
          showToast('Sélectionner au moins un article dans les résultats.', 'warning');
          return;
        }

        showLoadingOverlay(true, 'Lancement de l’analyse...');

        // Appel API conforme au backend /api/projects/<project_id>/run (server_v4_complete.py)
        // Corps JSON: { articles: [], profile, analysis_mode, custom_grid_id? }
        await fetchAPI(`/projects/${appState.currentProject.id}/run`, {
          method: 'POST',
          body: {
            articles: selectedArticles,
            profile,
            analysis_mode,
            ...(custom_grid_id_raw ? { custom_grid_id: custom_grid_id_raw } : {})
          }
        });

        showToast('Analyse lancée.', 'success');

        // Naviguer intelligemment:
        // - Screening: aller à la validation pour suivre les scores/justifications
        // - Full extraction: rester sur projects (le panneau détail affiche la progression)
        if (analysis_mode === 'screening') {
          showSection('validation');
        } else {
          showSection('projects');
        }

        // Rafraîchir l’état du projet après un court délai pour refléter "processing"
        setTimeout(() => selectProject(appState.currentProject.id, true), 1200);
      } catch (err) {
        console.error('Erreur run pipeline:', err);
        showToast(err.message || 'Erreur lors du lancement de l’analyse', 'error');
      } finally {
        showLoadingOverlay(false);
      }
    });
  }

  // Import Zotero via fichier
  const zoteroFileInput = document.getElementById('zoteroFileInput');
  if (zoteroFileInput) {
    zoteroFileInput.addEventListener('change', handleZoteroFileUpload);
  }

  // Import Zotero via saisie manuelle (bouton)
  const zoteroManualBtn = document.getElementById('zoteroManualBtn');
  if (zoteroManualBtn) {
    zoteroManualBtn.addEventListener('click', async () => {
      if (!appState.currentProject) {
        showToast("Sélectionner un projet d'abord.", 'warning');
        return;
      }
      await handleImportZotero(appState.currentProject.id);
    });
  }

  // Récupération PDFs en ligne (Unpaywall)
  const fetchPdfOnlineBtn = document.getElementById('fetchPdfOnlineBtn');
  if (fetchPdfOnlineBtn) {
    fetchPdfOnlineBtn.addEventListener('click', async () => {
      if (!appState.currentProject) {
        showToast("Sélectionner un projet d'abord.", 'warning');
        return;
      }
      await handleFetchOnlinePdfs(appState.currentProject.id);
    });
  }

  // Indexation des PDFs
  const runIndexingBtn = document.getElementById('runIndexingBtn');
  if (runIndexingBtn) {
    runIndexingBtn.addEventListener('click', async () => {
      if (!appState.currentProject) {
        showToast("Sélectionner un projet d'abord.", 'warning');
        return;
      }
      await handleRunIndexing(appState.currentProject.id);
    });
  }

  // Upload PDF en masse
  const bulkPDFInput = document.getElementById('bulkPDFInput');
  if (bulkPDFInput) {
    // Le listener de change est installé via setupBulkPDFUpload, mais on s’assure qu’il est prêt
    setupBulkPDFUpload = setupBulkPDFUpload || function() {};
    setupBulkPDFUpload(appState.currentProject?.id || '');
  }

  // Chat: envoyer une question
  const chatForm = document.getElementById('chatForm');
  if (chatForm) {
    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const input = chatForm.querySelector('input[name="question"]');
        const question = (input?.value || '').trim();
        if (!question) return;
        if (!appState.currentProject) {
          showToast('Sélectionner un projet avant de poser une question.', 'warning');
          return;
        }
        showLoadingOverlay(true, 'Génération de réponse...');
        const resp = await fetchAPI(`/projects/${appState.currentProject.id}/chat`, {
          method: 'POST',
          body: { question }
        });
        // Ajoutez ici le rendu d’un nouveau message dans l’historique
        showToast('Réponse générée.', 'success');
        input.value = '';
      } catch (err) {
        console.error('Erreur chat:', err);
        showToast(err.message || 'Erreur lors du chat', 'error');
      } finally {
        showLoadingOverlay(false);
      }
    });
  }

  // Paramètres Zotero: sauvegarde
  const saveZoteroBtn = document.getElementById('saveZoteroBtn');
  if (saveZoteroBtn) {
    saveZoteroBtn.addEventListener('click', handleSaveZoteroSettings);
  }

  // Calcul Kappa (validation)
  const calculateKappaBtn = document.getElementById('calculateKappaBtn');
  if (calculateKappaBtn) {
    calculateKappaBtn.addEventListener('click', async () => {
      if (!appState.currentProject) {
        showToast('Sélectionner un projet.', 'warning');
        return;
      }
      await handleCalculateKappa(appState.currentProject.id);
    });
  }

  // Export validations (validation)
  const exportValidationsBtn = document.getElementById('exportValidationsBtn');
  if (exportValidationsBtn) {
    exportValidationsBtn.addEventListener('click', async () => {
      if (!appState.currentProject) {
        showToast('Sélectionner un projet.', 'warning');
        return;
      }
      await handleExportValidations(appState.currentProject.id);
    });
  }

  // Import validations (validation)
  const validationFileInput = document.getElementById('validationFileInput');
  if (validationFileInput) {
    validationFileInput.addEventListener('change', async (e) => {
      const file = e.target?.files?.[0];
      if (!file || !appState.currentProject) return;
      await handleImportValidations(file, appState.currentProject.id);
    });
  }

  // Pull d’un modèle Ollama (settings)
  const pullModelBtn = document.getElementById('pullModelBtn');
  if (pullModelBtn) {
    pullModelBtn.addEventListener('click', handlePullModel);
  }

  // Vider une file RQ (settings) — boutons avec data-queue-name
  document.querySelectorAll('[data-action="clear-queue"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const q = btn.getAttribute('data-queue-name');
      if (!q) return;
      await handleClearQueue(q);
    });
  });

  // Sélection d’articles dans les résultats (checkboxes dynamiques) — délégué au container
  if (elements.resultsContainer) {
    elements.resultsContainer.addEventListener('change', (e) => {
      const target = e.target;
      if (target && target.matches('input[type="checkbox"][data-article-id]')) {
        const aid = target.getAttribute('data-article-id');
        if (!aid) return;
        if (target.checked) {
          appState.selectedSearchResults.add(aid);
        } else {
          appState.selectedSearchResults.delete(aid);
        }
      }
    });
  }
}

function attachValidationFileInputListener() {
  const oldEl = document.getElementById('validationFileInput');
  if (!oldEl) return;
  const el = oldEl.cloneNode(true);
  oldEl.parentNode.replaceChild(el, oldEl);
  el.addEventListener('change', (e) => {
    const file = e.target?.files?.[0];  // ← CORRIGÉ
    if (!file || !appState.currentProject?.id) return;
    handleImportValidations(file, appState.currentProject.id);
  });
}




function attachZoteroFileInputListener() {
  const oldEl = document.getElementById('zoteroFileInput');
  if (!oldEl) return;
  const el = oldEl.cloneNode(true);
  oldEl.parentNode.replaceChild(el, oldEl);
  el.addEventListener('change', (e) => {
    if (typeof handleZoteroFileUpload === 'function') {
      handleZoteroFileUpload(e);
    }
  });
}

// ================================================================
// === GESTION DES PROJETS
// ================================================================

async function selectProject(projectId, forceRefresh = false) {
  try {
    if (!projectId) return;
    // Charger le projet courant
    const project = await fetchAPI(`/projects/${projectId}`);
    appState.currentProject = project;

    // Rejoindre la room WS pour ce projet
    if (appState.socket) {
      appState.socket.emit('join_room', { room: projectId });
    }

    // Charger en parallèle données du projet
    const [extractions, searchData, files] = await Promise.all([
      loadProjectExtractions(projectId),     // remplit appState.currentProjectExtractions
      loadProjectSearchResults(projectId),   // remplit appState.searchResults ou similaire
      loadProjectFiles(projectId),           // remplit la section fichiers
    ]);

    // Rendu du détail du projet
    renderProjectDetail(project);            // doit appeler renderValidationSection, renderImportSection, etc.

    // Rester sur la section "projects" pour stabilité UI
    showSection('projects');

  } catch (err) {
    console.error(`Erreur lors de la sélection du projet ${projectId}:`, err);
    showToast(`Erreur lors de la sélection du projet`, 'error');
    // Sécurité: rester sur la section projects en cas d'erreur
    showSection('projects');
  }
}

function renderProjectList() {
    if (!elements.projectsList) return;

    if (!Array.isArray(appState.projects) || appState.projects.length === 0) {
        elements.projectsList.innerHTML = `<li class="empty-state"><p>Aucun projet. Créez-en un pour commencer.</p></li>`;
        return;
    }

    const html = appState.projects.map(p => `
        <li class="project-item" data-project-id="${p.id}">
            <div class="project-card">
                <h4>${escapeHtml(p.name || 'Projet sans nom')}</h4>
                <p>${escapeHtml(p.description || 'Pas de description')}</p>
                <div class="project-meta">
                    <span class="status-badge">${escapeHtml(p.status || 'pending')}</span>
                    <span class="count">${Number(p.pmids_count || 0)} articles</span>
                </div>
            </div>
        </li>
    `).join('');

    elements.projectsList.innerHTML = html;

    elements.projectsList.querySelectorAll('.project-item').forEach(li => {
        li.addEventListener('click', () => {
            const pid = li.getAttribute('data-project-id');
            selectProject(pid);
        });
    });
}

function renderProjectDetail(project) {
    // Garde: conteneur principal ou projet manquant => retour à la liste
    if (!elements.projectDetailContent || !project) {
        showSection('projects'); // re-basculer vers la section Projets
        return;
    }

    // Mettre à jour le titre du projet dans le header (si présent)
    const projectTitleElement = document.getElementById('project-title-header');
    if (projectTitleElement) {
        projectTitleElement.textContent = project.name || 'Projet';
    }

    // Afficher le panneau de détails et masquer le placeholder
    if (elements.projectDetail) elements.projectDetail.style.display = 'block';
    if (elements.projectPlaceholder) elements.projectPlaceholder.style.display = 'none';

    // Masquer toutes les sous-sections du panneau principal
    const subsections = elements.projectDetailContent.querySelectorAll('.section');
    subsections.forEach(sec => sec.style.display = 'none');

    // Rendre les sections métiers pour ce projet (les fonctions doivent exister)
    // 1) Recherche & Résultats
    renderSearchSection(project);
    // 2) Validation inter-évaluateurs
    renderValidationSection(project);
    // 3) Analyses avancées (si nécessaire)
    if (typeof renderAnalysisSection === 'function') {
        renderAnalysisSection(project);
    }
    // 4) Import & Fichiers (si un renderer dédié existe)
    if (typeof renderImportSection === 'function') {
        renderImportSection(project);
    }
    // 5) Chat RAG (optionnel, si la section existe)
    if (typeof renderChatSection === 'function') {
        renderChatSection(project);
    }

    // Choisir une section par défaut à afficher si aucune section active n’est visible
    // Par convention: afficher la section "recherche" si présente
    const defaultSectionId = 'recherche';
    const defaultSectionEl = document.getElementById(defaultSectionId);
    if (defaultSectionEl) {
        defaultSectionEl.style.display = 'block';
        updateActiveNav(defaultSectionId);
    } else {
        // Sinon fallback vers 'projects' pour éviter un écran vide
        showSection('projects');
    }
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

async function renderSearchSection(project) {
  const container = document.getElementById('recherche');
  if (!container || !project) return; // garde [12]

  const dbOptions = (appState.availableDatabases || []).map(db => {
    const id = `db_${db}`;
    return `<label class="checkbox-item">
      <input type="checkbox" name="databases" value="${db}" id="${id}" checked />
      <span>${escapeHtml(db)}</span>
    </label>`;
  }).join(''); // options de bases [12]

  // Filtrage pagination (état local)
  const page = 1;
  const perPage = 50;

  container.innerHTML = `
    <div class="card">
      <h4>Recherche multi-bases</h4>
      <form id="multiSearchForm" class="form-grid">
        <div class="form-row">
          <label>Requête</label>
          <input type="text" id="searchQueryInput" name="query" placeholder="mots-clés, AND, OR..." required />
        </div>
        <div class="form-row">
          <label>Bases</label>
          <div class="checkbox-group">
            ${dbOptions || '<em>Aucune base disponible</em>'}
          </div>
        </div>
        <div class="form-row">
          <label>Max/résultats par base</label>
          <input type="number" id="maxPerDbInput" name="max_results_per_db" min="1" max="200" value="50" />
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn--primary">Lancer la recherche</button>
          <button type="button" id="reloadResultsBtn" class="btn">Recharger les résultats</button>
          <button type="button" id="showStatsBtn" class="btn">Statistiques</button>
        </div>
      </form>
    </div>

    <div class="card">
      <div class="project-actions-header">
        <h4>Résultats</h4>
        <div>
          <select id="analysisProfileSelect"></select>
          <select id="analysisModeSelect">
            <option value="screening">Screening IA</option>
            <option value="full_extraction">Extraction complète</option>
          </select>
          <button id="runPipelineBtn" class="btn btn--primary">Lancer l'analyse</button>
        </div>
      </div>
      <div id="resultsContainer"></div>
    </div>
  `; // squelette rendu [12]

  // Remplit les profils
  const profileSelect = container.querySelector('#analysisProfileSelect');
  profileSelect.innerHTML = (appState.analysisProfiles || []).map(p =>
    `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join(''); // profils depuis /analysis-profiles [12]

  // Gestion soumission recherche
  const form = container.querySelector('#multiSearchForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      showLoadingOverlay(true, 'Recherche en cours...');
      const query = container.querySelector('#searchQueryInput')?.value.trim();
      const maxPerDb = Number(container.querySelector('#maxPerDbInput')?.value || 50);
      const selectedDbs = Array.from(container.querySelectorAll('input[name="databases"]:checked'))
        .map(i => i.value);
      if (!query) return showToast('Veuillez saisir une requête', 'warning');

      await fetchAPI('/search', {
        method: 'POST',
        body: {
          project_id: project.id,
          query,
          databases: selectedDbs.length ? selectedDbs : ['pubmed'],
          max_results_per_db: maxPerDb
        }
      }); // POST /api/search lance la tâche RQ [12]

      showToast('Recherche lancée', 'success');
      await loadProjectSearchResults(project.id, page, perPage);
      renderSearchResultsTable(project, page, perPage);
    } catch (err) {
      console.error(err);
    } finally {
      showLoadingOverlay(false);
    }
  }); // handler POST /api/search [12]

  // Recharger les résultats
  container.querySelector('#reloadResultsBtn')?.addEventListener('click', async () => {
    await loadProjectSearchResults(project.id, page, perPage);
    renderSearchResultsTable(project, page, perPage);
  }); // GET /api/projects/:id/search-results [12]

  // Stats
  container.querySelector('#showStatsBtn')?.addEventListener('click', async () => {
    try {
      const stats = await fetchAPI(`/projects/${project.id}/search-stats`);
      const list = Object.entries(stats.results_by_database || {}).map(
        ([db, count]) => `- ${db}: ${count}`
      ).join('\n');
      showToast(`Total: ${stats.total_results}\n${list}`, 'info');
    } catch (e) {
      showToast("Erreur lors du chargement des stats", 'error');
    }
  }); // GET /api/projects/:id/search-stats [12]

  // Lancer pipeline
  container.querySelector('#runPipelineBtn')?.addEventListener('click', async () => {
    try {
      const selected = Array.from(appState.selectedSearchResults);
      if (selected.length === 0) return showToast('Sélectionner au moins 1 article', 'warning');
      const profile = profileSelect.value || 'standard';
      const mode = container.querySelector('#analysisModeSelect')?.value || 'screening';

      showLoadingOverlay(true, 'Lancement du pipeline...');
      await fetchAPI(`/projects/${project.id}/run`, {
        method: 'POST',
        body: {
          articles: selected,
          profile,
          analysis_mode: mode
        }
      }); // POST /api/projects/:id/run [12]
      showToast('Pipeline lancé', 'success');
    } catch (e) {
      showToast('Erreur lancement pipeline', 'error');
    } finally {
      showLoadingOverlay(false);
    }
  }); // POST /api/projects/:id/run [12]

  // Charger initialement
  await loadProjectSearchResults(project.id, page, perPage);
  renderSearchResultsTable(project, page, perPage);
} // fin renderSearchSection [12]

function renderSearchResultsTable(project, page = 1, perPage = 50) {
  const container = document.getElementById('resultsContainer');
  if (!container) return; // garde [12]
  const rows = appState.searchResults || [];
  const meta = appState.searchResultsMeta || {};

  const thead = `
    <thead>
      <tr>
        <th><input type="checkbox" id="selectAllResults"/></th>
        <th>Titre</th>
        <th>Auteurs</th>
        <th>Date</th>
        <th>Journal</th>
        <th>DOI</th>
        <th>Source</th>
      </tr>
    </thead>
  `; // colonnes clés [12]

  const tbody = `
    <tbody>
      ${rows.map(r => {
        const id = escapeHtml(r.article_id || r.id || '');
        const checked = appState.selectedSearchResults.has(id) ? 'checked' : '';
        return `
          <tr>
            <td><input type="checkbox" class="row-select" data-id="${id}" ${checked}/></td>
            <td>${escapeHtml(r.title || '')}</td>
            <td>${escapeHtml(r.authors || '')}</td>
            <td>${escapeHtml(r.publication_date || '')}</td>
            <td>${escapeHtml(r.journal || '')}</td>
            <td>${escapeHtml(r.doi || '')}</td>
            <td>${escapeHtml(r.database_source || '')}</td>
          </tr>
        `;
      }).join('')}
    </tbody>
  `; // lignes [12]

  const pager = `
    <div class="pagination">
      <button id="prevPageBtn" class="btn" ${meta.has_prev ? '' : 'disabled'}>Précédent</button>
      <span>Page ${meta.page} — ${meta.total} résultat(s)</span>
      <button id="nextPageBtn" class="btn" ${meta.has_next ? '' : 'disabled'}>Suivant</button>
    </div>
  `; // pagination [12]

  container.innerHTML = `
    <div class="table-responsive">
      <table class="table table--dense">
        ${thead}
        ${tbody}
      </table>
    </div>
    ${pager}
  `; // rendu final [12]

  // Sélection globale
  container.querySelector('#selectAllResults')?.addEventListener('change', (e) => {
    const checked = e.target.checked;
    container.querySelectorAll('.row-select').forEach(cb => {
      cb.checked = checked;
      const id = cb.getAttribute('data-id');
      if (checked) appState.selectedSearchResults.add(id);
      else appState.selectedSearchResults.delete(id);
    });
  }); // sélection multiple [12]

  // Sélection ligne
  container.querySelectorAll('.row-select').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const id = e.target.getAttribute('data-id');
      if (e.target.checked) appState.selectedSearchResults.add(id);
      else appState.selectedSearchResults.delete(id);
    });
  }); // toggle set [12]

  // Pagination
  container.querySelector('#prevPageBtn')?.addEventListener('click', async () => {
    if (!meta.has_prev) return;
    const newPage = Math.max(1, (meta.page || 1) - 1);
    await loadProjectSearchResults(project.id, newPage, meta.per_page || 50);
    renderSearchResultsTable(project, newPage, meta.per_page || 50);
  }); // page précédente [12]
  container.querySelector('#nextPageBtn')?.addEventListener('click', async () => {
    if (!meta.has_next) return;
    const newPage = (meta.page || 1) + 1;
    await loadProjectSearchResults(project.id, newPage, meta.per_page || 50);
    renderSearchResultsTable(project, newPage, meta.per_page || 50);
  }); // page suivante [12]
} // fin renderSearchResultsTable [12]

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

async function loadProjectSearchResults(projectId, page = 1, per_page = 50, database = null) {
  if (!projectId) {
    console.warn('loadProjectSearchResults appelé sans projectId');
    appState.searchResults = [];
    return;
  }
  const params = new URLSearchParams({ page, per_page });
  if (database) params.set('database', database);
  try {
    const resp = await fetchAPI(`/projects/${projectId}/search-results?${params.toString()}`);
    // Backend renvoie {results, total, page, per_page, has_next, has_prev}
    appState.searchResults = Array.isArray(resp?.results) ? resp.results : [];
    appState.searchPagination = {
      total: Number(resp?.total || 0),
      page: Number(resp?.page || page),
      per_page: Number(resp?.per_page || per_page),
      has_next: Boolean(resp?.has_next),
      has_prev: Boolean(resp?.has_prev),
      database_filter: database || null,
    };
  } catch (err) {
    console.error('Erreur chargement résultats de recherche:', err);
    appState.searchResults = [];
    appState.searchPagination = { total: 0, page: 1, per_page: 50, has_next: false, has_prev: false, database_filter: null };
  }
}

function renderSearchResults() {
    if (!elements.resultsContainer) return;
    if (appState.searchResults.length === 0) {
        elements.resultsContainer.innerHTML = '<div class="results-placeholder"><span class="results-placeholder__icon">🧐</span><p>Lancez une recherche pour voir les résultats ici.</p></div>';
        return;
    }
    // Un rendu de tableau simple pour l'exemple
    elements.resultsContainer.innerHTML = `
        <p>${appState.searchResults.length} résultats trouvés.</p>
        <table class="table">
            <thead><tr><th>Titre</th><th>Auteurs</th><th>Source</th></tr></thead>
            <tbody>
            ${appState.searchResults.map(r => `
                <tr>
                    <td>${escapeHtml(r.title)}</td>
                    <td>${escapeHtml(r.authors)}</td>
                    <td>${escapeHtml(r.database_source)}</td>
                </tr>
            `).join('')}
            </tbody>
        </table>
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
  e?.preventDefault?.();
  if (!appState.currentProject) {
    showToast('Aucun projet sélectionné', 'error');
    return;
  }
  // Récupérer sélection d’articles
  const selected = Array.from(appState.selectedSearchResults || []);
  if (selected.length === 0) {
    showToast('Sélectionnez au moins un article', 'warning');
    return;
  }
  // Choix du profil et mode (récupérer depuis formulaire si présent)
  const profileSelect = document.getElementById('pipelineProfileSelect');
  const modeSelect = document.getElementById('pipelineModeSelect');
  const gridSelect = document.getElementById('pipelineGridSelect');
  const profile = profileSelect?.value || 'standard';
  const analysis_mode = modeSelect?.value || 'screening';
  const custom_grid_id = gridSelect?.value || null;

  try {
    showLoadingOverlay(true, 'Lancement du pipeline...');
    const resp = await fetchAPI(`/projects/${appState.currentProject.id}/run`, {
      method: 'POST',
      body: {
        articles: selected,
        profile,
        analysis_mode,
        custom_grid_id,
      },
    });
    showToast('Pipeline démarré', 'success');
    // Revenir à la vue projets ou rester
    showSection('projects');
  } catch (err) {
    console.error('Erreur lancement pipeline:', err);
    showToast(err.message || 'Erreur lancement pipeline', 'error');
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
        console.error(`Erreur chargement extractions pour ${projectId}:`, error);
        appState.currentProjectExtractions = [];
    }
}


// ================================================================
// === VALIDATION INTER-ÉVALUATEURS
// ================================================================

async function renderValidationSection(project) {
  const container = document.getElementById('validation');
  if (!container || !project) return;

  // Charge/rafraîchit les extractions
  try {
    showLoadingOverlay(true, 'Chargement des extractions...');
    await loadProjectExtractions(project.id);
  } catch (e) {
    console.error(e);
    showToast('Erreur chargement des extractions', 'error');
  } finally {
    showLoadingOverlay(false);
  }

  const rows = appState.currentProjectExtractions || [];
  const isScreening = (project.analysis_mode || 'screening') === 'screening';

  const headerActions = `
    <div class="validation-actions">
      <div class="button-group">
        <button id="exportValidationsBtn" class="btn">Exporter (éval 1)</button>
        <label class="btn">
          Importer (éval 1)
          <input id="validationFileInput" type="file" accept=".csv" style="display:none" />
        </label>
        <button id="calcKappaBtn" class="btn btn--primary">Calculer Kappa</button>
      </div>
      <div class="kappa-result-display" style="display:${project.inter_rater_reliability ? 'block' : 'none'}">
        ${escapeHtml(project.inter_rater_reliability || '')}
      </div>
    </div>
  `;

  const thead = `
    <thead>
      <tr>
        <th>ID</th>
        <th>Titre</th>
        ${isScreening ? `
          <th>Score IA</th>
          <th>Décision IA</th>
          <th>Décision humaine</th>
        ` : `
          <th>Données extraites</th>
          <th>Actions</th>
        `}
      </tr>
    </thead>
  `;

  const tbody = `
    <tbody>
      ${rows.length === 0 ? '<tr><td colspan="5" class="empty-state">Aucune extraction à valider. Lancez une analyse.</td></tr>' : 
        rows.map(ex => {
        const pmid = escapeHtml(ex.pmid || '');
        const title = escapeHtml(ex.title || '');
        if (isScreening) {
          const score = typeof ex.relevance_score === 'number' ? ex.relevance_score.toFixed(1) : (ex.relevance_score || 'N/A');
          const aiDec = escapeHtml(ex.relevance_justification || '');
          const userDec = escapeHtml(ex.user_validation_status || '');
          return `
            <tr class="extraction-row ${userDec === 'include' ? 'extraction-row--included' : userDec === 'exclude' ? 'extraction-row--excluded' : ''}">
              <td>${pmid}</td>
              <td>${title}</td>
              <td>${score}</td>
              <td>${aiDec}</td>
              <td>
                <select class="human-decision" data-id="${pmid}">
                  <option value="">—</option>
                  <option value="include" ${userDec === 'include' ? 'selected' : ''}>Inclure</option>
                  <option value="exclude" ${userDec === 'exclude' ? 'selected' : ''}>Exclure</option>
                </select>
              </td>
            </tr>
          `;
        } else {
          // extraction détaillée
          let preview = '';
          try {
            const data = ex.extracted_data ? JSON.parse(ex.extracted_data) : null;
            if (data && typeof data === 'object') {
              const keys = Object.keys(data).slice(0, 3);
              preview = `<ul class="extraction-preview-list">${
                keys.map(k => `<li><strong>${escapeHtml(k)}:</strong> ${escapeHtml(String(data[k]).substring(0, 50))}...</li>`).join('')
              }</ul>`;
            } else {
              preview = `<em>Pas de données</em>`;
            }
          } catch {
            preview = `<em>JSON invalide</em>`;
          }
          return `
            <tr>
              <td>${pmid}</td>
              <td>${title}</td>
              <td>${preview}</td>
              <td class="actions-cell">
                <button class="btn btn--sm" data-action="details" data-id="${pmid}">Détails</button>
              </td>
            </tr>
          `;
        }
      }).join('')}
    </tbody>
  `;

  container.innerHTML = `
    <div class="card">
      <div class="card__header">
        <h4>Résultats à valider</h4>
        ${headerActions}
      </div>
      <div class="card__body">
        <div class="table-responsive">
          <table class="table table--dense">
            ${thead}
            ${tbody}
          </table>
        </div>
      </div>
    </div>
  `;

  // Actions top (export / import / kappa)
  container.querySelector('#exportValidationsBtn')?.addEventListener('click', () => {
    handleExportValidations(project.id);
  });
  
  const validationFileInput = container.querySelector('#validationFileInput');
  if (validationFileInput) {
    validationFileInput.addEventListener('change', async (e) => {
      // ===== CORRECTION ICI =====
      const file = e.target.files?.[0]; // Utilise ?.[0] au lieu de ?.;
      // ========================
      if (file) {
        await handleImportValidations(file, project.id);
      }
    });
  }
  
  container.querySelector('#calcKappaBtn')?.addEventListener('click', async () => {
    await handleCalculateKappa(project.id);
  });

  // Sauvegarde des décisions humaines inline
  container.querySelectorAll('.human-decision').forEach(sel => {
    sel.addEventListener('change', async (e) => {
      const choice = e.target.value;
      const pmid = e.target.getAttribute('data-id');
      try {
        await fetchAPI(`/projects/${project.id}/extractions/${pmid}/decision`, {
          method: 'PUT',
          body: { decision: choice }
        });
        showToast('Décision sauvegardée', 'success');
        // Optionnel : Mettre à jour visuellement la ligne
        const row = e.target.closest('tr');
        row.classList.remove('extraction-row--included', 'extraction-row--excluded');
        if(choice === 'include') row.classList.add('extraction-row--included');
        if(choice === 'exclude') row.classList.add('extraction-row--excluded');

      } catch(err) {
        showToast(`Erreur sauvegarde: ${err.message}`, 'error');
      }
    });
  });

  // Bouton Détails (extraction complète)
  container.querySelectorAll('[data-action="details"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const pmid = e.currentTarget.getAttribute('data-id');
      const extraction = (appState.currentProjectExtractions || []).find(x => String(x.pmid) === String(pmid));
      if (!extraction) {
        showToast('Détails non trouvés.', 'warning');
        return;
      }
      const modalBody = document.getElementById('extractionDetailBody');
      if (modalBody) modalBody.innerHTML = formatExtractionDetailsForModal(extraction);
      openModal('extractionDetailModal');
    });
  });
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
  const prompts = Array.isArray(appState.prompts) ? appState.prompts : [];
  const profiles = Array.isArray(appState.analysisProfiles) ? appState.analysisProfiles : [];
  const models = Array.isArray(appState.ollamaModels) ? appState.ollamaModels : [];

  const promptsHtml = prompts.length
    ? prompts.map(p => `
      <div class="prompt-item">
        <div class="prompt-item__info">
          <h5>${escapeHtml(p.name || '')}</h5>
          <p>${escapeHtml(p.description || '')}</p>
        </div>
      </div>`).join('')
    : `<p>Aucun prompt trouvé.</p>`;

  const profilesHtml = profiles.length
    ? profiles.map(pr => `
      <div class="profile-card">
        <h5>${escapeHtml(pr.name || '')}</h5>
        <div class="profile-models">
          <div class="model-item">
            <span class="model-label">Preprocess</span>
            <span class="model-value">${escapeHtml(pr.preprocess_model || '')}</span>
          </div>
          <div class="model-item">
            <span class="model-label">Extraction</span>
            <span class="model-value">${escapeHtml(pr.extract_model || '')}</span>
          </div>
          <div class="model-item">
            <span class="model-label">Synthèse</span>
            <span class="model-value">${escapeHtml(pr.synthesis_model || '')}</span>
          </div>
        </div>
      </div>`).join('')
    : `<p>Aucun profil trouvé.</p>`;

  const modelsHtml = models.length
    ? models.map(m => `
      <div class="model-item">
        <span class="model-name">${escapeHtml(m.name || '')}</span>
        <span class="model-size">${escapeHtml(m.size || '')}</span>
      </div>`).join('')
    : `<p>Aucun modèle local trouvé.</p>`;

  elements.settingsContainer.innerHTML = `
    <div class="settings-grid">
      <div class="settings-card">
        <div class="settings-card__header"><h4>Prompts</h4></div>
        <div class="settings-card__content">${promptsHtml}</div>
      </div>
      <div class="settings-card">
        <div class="settings-card__header"><h4>Profils d'analyse</h4></div>
        <div class="settings-card__content">${profilesHtml}</div>
      </div>
      <div class="settings-card">
        <div class="settings-card__header"><h4>Modèles Ollama</h4></div>
        <div class="settings-card__content">
          <div class="models-list">${modelsHtml}</div>
          <div class="settings-actions" style="margin-top:12px;">
            <input id="modelNameInput" placeholder="llama3.1:8b" />
            <button class="btn btn--primary" id="pullModelBtn">Télécharger</button>
          </div>
        </div>
      </div>
      <div class="settings-card">
        <div class="settings-card__header"><h4>Paramètres Zotero</h4></div>
        <div class="settings-card__content">
          <div class="form-row">
            <label>User ID</label>
            <input id="zoteroUserId" placeholder="Votre User ID" />
          </div>
          <div class="form-row">
            <label>API Key</label>
            <input id="zoteroApiKey" type="password" placeholder="Votre clé API Zotero" />
          </div>
          <button class="btn btn--primary" id="saveZoteroBtn">Enregistrer</button>
        </div>
      </div>
    </div>
  `;

  // Wiring
  document.getElementById('pullModelBtn')?.addEventListener('click', handlePullModel);
  document.getElementById('saveZoteroBtn')?.addEventListener('click', handleSaveZoteroSettings);

  // Charger valeurs Zotero
  loadZoteroSettings().catch(() => {});
}

// --- Chargements initiaux regroupés ---
async function loadInitialData() {
  await Promise.all([
    loadProjects(),
    loadAnalysisProfiles(),
    loadPrompts(),
    loadOllamaModels(),
    loadAvailableDatabases(),
  ]);
  // Après chargement, construire la page paramètres
  renderSettingsSection();
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
  const modal = document.getElementById(modalId);  // [web:1]
  if (!modal) {
    console.warn(`Modal ${modalId} introuvable`);  // [web:1]
    return;  // [web:1]
  }
  // Ajoute la classe d’ouverture si votre CSS la gère
  modal.classList.add('modal--show');  // [web:1]
  // Accessibilité basique
  modal.setAttribute('aria-hidden', 'false');  // [web:1]
  // Focus piégé minimal: place le focus à l’intérieur si possible
  const focusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');  // [web:1]
  if (focusable) {
    try { focusable.focus(); } catch (_) {}  // [web:1]
  }
}


function closeModal(modalId) {
  const modal = document.getElementById(modalId);  // [web:1]
  if (!modal) {
    console.warn(`Modal ${modalId} introuvable`);  // [web:1]
    return;  // [web:1]
  }
  modal.classList.remove('modal--show');  // [web:1]
  modal.setAttribute('aria-hidden', 'true');  // [web:1]
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

// Exposition contrôlée des handlers au scope global (évite ReferenceError)
window.handleZoteroFileUpload = typeof handleZoteroFileUpload === 'function' ? handleZoteroFileUpload : () => {};
window.handleImportValidations = typeof handleImportValidations === 'function' ? handleImportValidations : () => {};
window.handleExportValidations = typeof handleExportValidations === 'function' ? handleExportValidations : () => {};
window.handleCalculateKappa = typeof handleCalculateKappa === 'function' ? handleCalculateKappa : () => {};

window.handleRunIndexing = typeof handleRunIndexing === 'function' ? handleRunIndexing : () => {};
window.handleFetchOnlinePdfs = typeof handleFetchOnlinePdfs === 'function' ? handleFetchOnlinePdfs : () => {};
window.handleManualPDFUpload = typeof handleManualPDFUpload === 'function' ? handleManualPDFUpload : () => {};
window.handleImportZotero = typeof handleImportZotero === 'function' ? handleImportZotero : () => {};

window.handlePullModel = typeof handlePullModel === 'function' ? handlePullModel : () => {};
window.handleSaveZoteroSettings = typeof handleSaveZoteroSettings === 'function' ? handleSaveZoteroSettings : () => {};
window.handleClearQueue = typeof handleClearQueue === 'function' ? handleClearQueue : () => {};

window.sendChatMessage = typeof sendChatMessage === 'function' ? sendChatMessage : () => {};
window.clearChatHistory = typeof clearChatHistory === 'function' ? clearChatHistory : () => {};

window.openGridModal = typeof openGridModal === 'function' ? openGridModal : () => {};
window.handleDeleteGrid = typeof handleDeleteGrid === 'function' ? handleDeleteGrid : () => {};
window.openPromptModal = typeof openPromptModal === 'function' ? openPromptModal : () => {};
window.openProfileModal = typeof openProfileModal === 'function' ? openProfileModal : () => {};
window.handleDeleteProfile = typeof handleDeleteProfile === 'function' ? handleDeleteProfile : () => {};

window.runAdvancedAnalysis = typeof runAdvancedAnalysis === 'function' ? runAdvancedAnalysis : () => {};
window.viewAnalysisPlot = typeof viewAnalysisPlot === 'function' ? viewAnalysisPlot : () => {};

// Log de fin de chargement
console.log('✅ AnalyLit V4.1 Frontend - Chargement complet terminé');
