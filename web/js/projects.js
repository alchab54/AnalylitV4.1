// web/js/projects.js

import { appState, elements } from './app-improved.js';
import { fetchAPI } from './api.js';
import { showToast, showLoadingOverlay, closeModal, escapeHtml, showModal } from './ui-improved.js';

// Fonctions utilitaires locales ou importées d'autres modules si nécessaire

/**
 * Charge la liste des projets et déclenche le rendu de la liste.
 */
async function loadProjects() {
  const oldProjectIds = new Set((appState.projects || []).map(p => p.id));
  const projects = await fetchAPI('/projects/');
  appState.projects = projects || [];

  const newProjectIds = new Set(appState.projects.map(p => p.id));

  if (oldProjectIds.size !== newProjectIds.size || ![...oldProjectIds].every(id => newProjectIds.has(id))) {
    renderProjectsList();
  }
  autoSelectFirstProject();
}

/**
 * Sélectionne automatiquement le premier projet si aucun n'est encore sélectionné.
 */
async function autoSelectFirstProject() {
  if (appState.projects.length > 0 && !appState.currentProject) {
    const firstProject = appState.projects[0];
    console.log('Sélection automatique du premier projet:', firstProject.id);
    await selectProject(firstProject.id);
  }
}

/**
 * Crée un projet.
 */
async function handleCreateProject(event) {
  event.preventDefault();
  const form = event.target;
  const name = form.querySelector('#projectName').value.trim();
  const description = form.querySelector('#projectDescription').value.trim();
  const mode = form.querySelector('#analysisMode').value;

  if (!name) {
    showToast('Le nom du projet est requis.', 'warning');
    return;
  }

  try {
    showLoadingOverlay(true, 'Création du projet...');

    const newProject = await fetchAPI('/projects', {
      method: 'POST',
      body: { name, description, mode }
    });

    await loadProjects();
    if (newProject?.id) {
      await selectProject(newProject.id);
    }
    showToast('Projet créé avec succès!', 'success');
    closeModal('newProjectModal');
  } catch (e) {
    showToast(`Erreur: ${e.message}`, 'error');
  } finally {
    showLoadingOverlay(false, '');
  }
}

/**
 * Sélectionne un projet, rejoint la room Socket.IO correspondante,
 * charge les fichiers PDF liés, et rafraîchit la section active.
 */
async function selectProject(projectId) {
  if (!projectId) return;
  try {
    appState.currentProject = appState.projects.find(p => p.id === projectId);
    renderProjectsList();

    // Rejoindre la room WebSocket du projet
    if (appState.socket) {
      appState.socket.emit('join_room', { room: projectId });
    }
    // La logique de rafraîchissement est gérée par le gestionnaire de navigation principal
    document.querySelector('.app-nav__button[data-section-id="results"]').click();
  } catch (e) {
    showToast(`Erreur: ${e.message}`, 'error');
  }
}

/**
 * Supprime un projet.
 */
function deleteProject(projectId, projectName) {
  if (!projectId) return;
  appState.projectToDelete = { id: projectId, name: projectName };
  const modalContent = `
    <p>Êtes-vous sûr de vouloir supprimer le projet "<strong>${escapeHtml(projectName)}</strong>" ?</p>
    <p>Cette action est irréversible.</p>
    <div class="modal-actions">
      <button class="btn btn--secondary" data-action="close-modal">Annuler</button>
      <button class="btn btn--danger" data-action="confirm-delete-project">Supprimer</button>
    </div>
  `;
  showModal('Confirmer la suppression', modalContent);
}

/**
 * Logique de suppression effective, appelée par le gestionnaire d'événements.
 */
async function confirmDeleteProject(projectId) {
    showLoadingOverlay(true, 'Suppression du projet...');
    closeModal(); // Ferme la modale de confirmation
    try {
        await fetchAPI(`/projects/${projectId}`, { method: 'DELETE' });
        showToast('Projet supprimé.', 'success');
        
        // Mettre à jour l'état localement pour une UI plus réactive
        appState.projects = appState.projects.filter(p => p.id !== projectId);

        if (appState.currentProject?.id === projectId) {
            appState.currentProject = null;
        }
        renderProjectsList();
        renderProjectDetail(appState.currentProject);
    } catch (e) {
        showToast(`Erreur lors de la suppression: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

/**
 * Exporte un projet.
 */
async function handleExportProject(projectId) {
  if (!projectId) {
    showToast("ID du projet manquant pour l'exportation.", 'warning');
    return;
  }
  window.open(`/api/projects/${projectId}/export`, '_blank');
  showToast("L'exportation du projet a commencé...", 'info');
}

/**
 * Charge la liste des fichiers PDF associés au projet et stocke uniquement les stems.
 */
async function loadProjectFilesSet(projectId) {
    if (!projectId) {
        appState.currentProjectFiles = new Set();
        return;
    }
  try {
    // TODO: Backend route for getting project files is missing.
    // const files = await fetchAPI(`/projects/${projectId}/files`);
    const filenames = (files || [])
      .map(f => String(f.filename || '').replace(/\.pdf$/i, '').toLowerCase());
    appState.currentProjectFiles = new Set(filenames);
  } catch (error) {
    console.error('Erreur chargement des fichiers projet:', error);
    appState.currentProjectFiles = new Set();
  }
}

/**
 * Rendu de la liste des projets (colonne gauche).
 */
function renderProjectsList() {
  const container = elements.projectsList;
  if (!container) return;

  const projects = Array.isArray(appState.projects) ? appState.projects : [];

  if (projects.length === 0) {
    container.innerHTML = '<div class="placeholder">Aucun projet. Créez-en un pour commencer.</div>';
    return;
  }

  const projectsHtml = projects.map(project => {
    const isActive = appState.currentProject?.id === project.id;
    return `
      <div class="project-card ${isActive ? 'project-card--active' : ''}" data-action="select-project" data-project-id="${project.id}">
        <div class="project-card__header">
            <h3 class="project-title">${escapeHtml(project.name)}</h3>
            <span class="status ${getStatusClass(project.status)}">${getStatusText(project.status)}</span>
        </div>
        <p class="project-description">${escapeHtml(project.description || 'Pas de description.')}</p>
        <div class="project-footer">
            <small>Modifié le: ${new Date(project.updated_at).toLocaleString('fr-FR')}</small>
            <button class="btn btn--danger btn--sm" data-action="delete-project" data-project-id="${project.id}" data-project-name="${escapeHtml(project.name)}">
                🗑️ Supprimer
            </button>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = projectsHtml;
}

function updateProjectListSelection() {
  const projectCards = document.querySelectorAll('.project-card');
  projectCards?.forEach(card => {
    const projectId = card.dataset.projectId;
    if (appState.currentProject?.id === projectId) {
      card.classList.add('project-card--active'); // Assurez-vous que cette classe existe dans votre CSS
    } else {
      card.classList.remove('project-card--active');
    }
  });
}

/**
 * Renvoie une classe de badge status compatible avec le CSS.
 */
function getStatusClass(status) {
  switch (status) {
    case 'completed':
    case 'search_completed':
      return 'status--success';
    case 'in_progress':
      return 'status--warning';
    case 'pending':
      return 'status--info';
    case 'error':
      return 'status--error';
    default:
      return 'status--secondary';
  }
}

/**
 * Rendu du panneau de détails du projet (colonne droite).
 */
function renderProjectDetail(project) {
  const detailContainer = elements.projectDetailContent;
  const placeholder = elements.projectPlaceholder;
  if (!detailContainer || !placeholder) return;

  if (!project) {
    detailContainer.innerHTML = '';
    placeholder.style.display = 'block';
    return;
  }

  placeholder.style.display = 'none';
  
  // Métriques
  const articlesCount = Number(project.article_count || 0);
  const pdfCount = appState.currentProjectFiles?.size || 0;
  const isIndexed = Boolean(project.indexed_at);
  const synthesis = appState.analysisResults?.synthesis_result;
  const discussion = appState.analysisResults?.discussion_draft;
  const graph = appState.analysisResults?.knowledge_graph;

  try {
    detailContainer.innerHTML = `
      <div class="section-header">
        <div class="section-header__content">
          <h2>${escapeHtml(project.name)}</h2>
          <p>${escapeHtml(project.description || 'Aucune description')}</p>
        </div>
        <div class="section-header__actions">
          <button class="btn btn--secondary" data-action="export-project" data-project-id="${project.id}">📥 Export</button>
        </div>
      </div>

      <div class="metrics-grid project-dashboard">
        <div class="metric-card">
          <h5 class="metric-value">${articlesCount}</h5>
          <p>Articles</p>
        </div>
        <div class="metric-card">
          <h5 class="metric-value">${pdfCount}</h5>
          <p>PDFs Trouvés</p>
        </div>
        <div class="metric-card">
          <h5 class="metric-value">${isIndexed ? '✅' : '❌'}</h5>
          <p>Indexé (RAG)</p>
        </div>
        <div class="metric-card">
          <h5 class="metric-value">${synthesis ? '✅' : '⏳'}</h5>
          <p>Synthèse</p>
        </div>
        <div class="metric-card">
          <h5 class="metric-value">${discussion ? '✅' : '⏳'}</h5>
          <p>Discussion</p>
        </div>
        <div class="metric-card">
          <h5 class="metric-value">${graph ? '✅' : '⏳'}</h5>
          <p>Graphe</p>
        </div>
      </div>
    `;
  } catch (e) {
    console.error('Erreur renderProjectDetail:', e);
    detailContainer.innerHTML = `
      <div class="placeholder error">
        <p>Erreur lors de l'affichage de la synthèse.</p>
      </div>
    `;
  }
}

function getStatusText(status) {
    const statusTexts = {
        'pending': 'En attente', 'processing': 'Traitement...', 'synthesizing': 'Synthèse...',
        'completed': 'Terminé', 'failed': 'Échec', 'indexing': 'Indexation...',
        'generating_discussion': 'Génération discussion...', 'generating_graph': 'Génération graphe...',
        'generating_prisma': 'Génération PRISMA...', 'generating_analysis': 'Analyse statistique...',
        'search_completed': 'Recherche terminée', 'in_progress': 'En cours', 'queued': 'En file',
        'started': 'Démarré', 'finished': 'Fini'
    };
    return statusTexts[status] || status;
}

// --- CORRECTION : Bloc d'exportation unifié ---
export {
    loadProjects,
    autoSelectFirstProject,
    handleCreateProject,
    selectProject,
    deleteProject,
    confirmDeleteProject,
    handleExportProject,
    loadProjectFilesSet, // <- La fonction est maintenant exportée d'ici
    renderProjectsList,
    updateProjectListSelection,
    renderProjectDetail,
    getStatusText
};