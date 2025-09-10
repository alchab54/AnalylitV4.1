// web/js/core.js

import { loadProjects } from './projects.js';
import { handleCreateProject } from './projects.js';
import { renderProjectList } from './projects.js';
import { renderProjectDetail } from './projects.js';

// Assurez-vous que appState et elements sont accessibles globalement
// ou passés en paramètre si le scope est plus strict.
// Pour l'instant, nous supposons qu'ils sont globals comme dans app.js

/**
 * Initialise l'application au démarrage.
 */
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

/**
 * Configure les écouteurs d'événements globaux.
 */
function setupEventListeners() {
  // Navigation onglets
  elements.navButtons.forEach(btn => {
    btn.addEventListener('click', () => showSection(btn.dataset.section));
  });

  // Nouveau projet
  if (elements.createProjectBtn) {
    elements.createProjectBtn.addEventListener('click', () => openModal('newProjectModal'));
  }

  // Imports (handlers will be in import.js)
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

  // Notifications: remise à zéro
  const notifButtons = document.querySelectorAll('.notifications-btn, [data-notifications-toggle], .notification-indicator');
  if (notifButtons.length) {
    notifButtons.forEach(btn => btn.addEventListener('click', clearNotifications));
  }

  // Quand la fenêtre reprend le focus, on considère les notifications comme lues
  window.addEventListener('focus', () => {
    clearNotifications();
  });
}

/**
 * Charge les données initiales nécessaires au fonctionnement de l'application.
 */
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

/**
 * Charge les profils d'analyse depuis l'API.
 */
async function loadAnalysisProfiles() {
    appState.analysisProfiles = await fetchAPI('/profiles');
}

/**
 * Charge les prompts depuis l'API.
 */
async function loadPrompts() {
    appState.prompts = await fetchAPI('/prompts');
}

/**
 * Charge les modèles Ollama depuis l'API.
 */
async function loadOllamaModels() {
    appState.ollamaModels = await fetchAPI('/ollama/models');
}

/**
 * Charge les bases de données disponibles depuis l'API.
 */
async function loadAvailableDatabases() {
    appState.availableDatabases = await fetchAPI('/databases');
}

/**
 * Affiche une section spécifique de l'application.
 * @param {string} sectionId - L'ID de la section à afficher.
 */
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

/**
 * Rafraîchit la section actuellement affichée.
 */
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
            // loadValidationSection() will be handled by validation.js
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

/**
 * Initialise la connexion WebSocket.
 */
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

/**
 * Gère les notifications reçues via WebSocket.
 * @param {object} data - Les données de la notification.
 */
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

/**
 * Rafraîchit les données du projet courant.
 */
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
                loadValidationSection(); // Call from validation.js
                break;
            case 'grids':
                renderGridsSection(appState.currentProject);
                break;
            case 'rob':
                loadRobSection();
                break;
        }
    } catch (e) {
        console.error('Erreur refresh project data:', e);
    }
}

/**
 * Met à jour l'indicateur de notification.
 */
function updateNotificationIndicator() {
    const indicator = document.querySelector('.notification-indicator');
    if (indicator) {
        indicator.textContent = appState.unreadNotifications;
        indicator.style.display = appState.unreadNotifications > 0 ? 'block' : 'none';
    }
}

/**
 * Efface les notifications.
 */
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

/**
 * Met à jour le compteur de sélection d'articles.
 */
function updateSelectionCounter() {
    const counter = document.getElementById('selection-counter');
    if (counter) {
        counter.textContent = `${appState.selectedSearchResults.size} article(s) sélectionné(s)`;
    }
}

/**
 * Retourne la classe CSS appropriée pour le statut d'un projet.
 * @param {string} status - Le statut du projet.
 * @returns {string} - La classe CSS.
 */
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

// Exposer les fonctions au scope global
window.initializeApplication = initializeApplication;
window.setupEventListeners = setupEventListeners;
window.loadInitialData = loadInitialData;
window.showSection = showSection;
window.refreshCurrentSection = refreshCurrentSection;
window.initializeWebSocket = initializeWebSocket;
window.handleWebSocketNotification = handleWebSocketNotification;
window.refreshCurrentProjectData = refreshCurrentProjectData;
window.updateNotificationIndicator = updateNotificationIndicator;
window.clearNotifications = clearNotifications;
window.updateSelectionCounter = updateSelectionCounter;
window.getStatusClass = getStatusClass;
window.loadAnalysisProfiles = loadAnalysisProfiles;
window.loadPrompts = loadPrompts;
window.loadOllamaModels = loadOllamaModels;
window.loadAvailableDatabases = loadAvailableDatabases;

/**
 * Retourne la classe CSS appropriée pour le statut d'un projet.
 * @param {string} status - Le statut du projet.
 * @returns {string} - La classe CSS.
 */
export function getStatusClass(status) {
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
