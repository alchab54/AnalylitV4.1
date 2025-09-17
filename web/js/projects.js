// web/js/projects.js

import { appState, elements } from '../app.js';
import { fetchAPI } from './api.js';
import { showToast, showLoadingOverlay, closeModal, escapeHtml, showModal } from './ui-improved.js';
import { getStatusClass } from './core.js';
import { setProjects, setCurrentProject } from './state.js';
import { refreshCurrentSection } from './core.js';

/**
 * Charge la liste des projets et déclenche le rendu de la liste.
 */
export async function loadProjects() {
  const oldProjectIds = new Set((appState.projects || []).map(p => p.id));
  const projects = await fetchAPI('/projects');
  const newProjects = projects || [];
  setProjects(newProjects);

  const newProjectIds = new Set(newProjects.map(p => p.id));

  if (oldProjectIds.size !== newProjectIds.size || ![...oldProjectIds].every(id => newProjectIds.has(id))) {
    renderProjectList();
  }
}

/**
 * Sélectionne automatiquement le premier projet si aucun n'est encore sélectionné.
 */
export async function autoSelectFirstProject() {
  if (appState.projects.length > 0 && !appState.currentProject) {
    const firstProject = appState.projects[0];
    console.log('Sélection automatique du premier projet:', firstProject.id);
    await selectProject(firstProject.id);
  }
}

/**
 * Crée un projet.
 */
export async function handleCreateProject(event) {
  console.log('Event received by handleCreateProject:', event);
  // event.preventDefault() is now handled by the core submit listener
  const form = event.target; // On a 'submit' event, event.target is the form element
  const name = form.elements['name'].value.trim();
  const description = form.elements['description'].value || '';
  const mode = form.elements['mode'].value || 'standard';

  if (!name) {
    showToast('Le nom du projet est requis.', 'warning');
    return;
  }

  try {
    showLoadingOverlay(true, 'Création du projet...');
    closeModal('newProjectModal');

    const newProject = await fetchAPI('/projects', {
      method: 'POST',
      body: { name, description, mode }
    });

    await loadProjects();
    if (newProject?.id) {
      await selectProject(newProject.id);
    }
    showToast('Projet créé avec succès!', 'success');
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
export async function selectProject(projectId) {
  if (!projectId) return;
  try {
    const project = await fetchAPI(`/projects/${projectId}`);
    setCurrentProject(project);

    // Rejoindre la room WebSocket du projet
    if (appState.socket) {
      appState.socket.emit('join_room', { room: projectId });
    }

    await loadProjectFilesSet(projectId);
    refreshCurrentSection();
  } catch (e) {
    showToast(`Erreur: ${e.message}`, 'error');
  }
}

/**
 * Supprime un projet.
 */
export async function handleDeleteProject(target) {
  const projectId = target.dataset.projectId;
  const projectName = target.dataset.projectName || 'ce projet';
  if (!projectId) return;

  // CORRECTION : Utilisation d'une confirmation simple et directe.
  const confirmationMessage = `Êtes-vous sûr de vouloir supprimer définitivement le projet "${escapeHtml(projectName)}"?\n\nCette action est irréversible.`;
  
  if (confirm(confirmationMessage)) {
    // Si l'utilisateur confirme, on appelle directement la fonction de suppression.
    await confirmDeleteProject(projectId);
  }
}

/**
 * Logique de suppression effective, appelée par le gestionnaire d'événements.
 */
export async function confirmDeleteProject(projectId) {
    showLoadingOverlay(true, 'Suppression du projet...');
    try {
        await fetchAPI(`/projects/${projectId}`, { method: 'DELETE' });
        showToast('Projet supprimé.', 'success');
        
        // Mettre à jour l'état localement pour une UI plus réactive
        const updatedProjects = appState.projects.filter(p => p.id !== projectId);
        setProjects(updatedProjects);

        if (appState.currentProject?.id === projectId) {
            setCurrentProject(null);
            renderProjectDetail(null);
        }
        closeModal('genericModal');
    } catch (e) {
        // Amélioration du message d'erreur
        showToast(`Erreur lors de la suppression: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

/**
 * Exporte un projet.
 */
export async function handleExportProject(projectId) {
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
export async function loadProjectFilesSet(projectId) {
  if (!projectId) {
    appState.currentProjectFiles = new Set();
    return;
  }
  try {
    const files = await fetchAPI(`/projects/${projectId}/files`);
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
export function renderProjectList() {
  if (!elements.projectsList || !elements.projectPlaceholder || !elements.projectDetail) return;

  const projects = Array.isArray(appState.projects) ? appState.projects : [];

  if (projects.length === 0) {
    elements.projectsList.innerHTML = '';
    elements.projectPlaceholder.style.display = 'block';
    elements.projectDetail.style.display = 'none';
    return;
  }

  elements.projectPlaceholder.style.display = 'none';
  elements.projectDetail.style.display = 'block';

  const projectsHtml = projects.map(project => {
    const isActive = appState.currentProject?.id === project.id;
    return `
      <li class="project-list__item ${isActive ? 'project-list__item--active' : ''}" data-action="select-project" data-project-id="${project.id}">
        <div class="project-list__item-info">
            <div class="project-list__item-name">${escapeHtml(project.name)}</div>
            <div class="status-badge ${getStatusBadgeClass(project.status)}">${escapeHtml(project.status || 'pending')}</div>
        </div>
        <button class="btn btn--icon btn--sm btn--danger" data-action="delete-project" data-project-id="${project.id}" data-project-name="${escapeHtml(project.name)}" title="Supprimer">
            🗑️
        </button>
      </li>
    `;
  }).join('');

  elements.projectsList.innerHTML = projectsHtml;
}

export function updateProjectListSelection() {
  const projectCards = document.querySelectorAll('.project-card');
  projectCards.forEach(card => {
    const projectId = card.dataset.projectId;
    if (appState.currentProject?.id === projectId) {
      card.classList.add('project-card--active');
    } else {
      card.classList.remove('project-card--active');
    }
  });
}

/**
 * Renvoie une classe de badge status compatible avec le CSS.
 */
function getStatusBadgeClass(status) {
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
export function renderProjectDetail(project) {
  if (!elements.projectDetail || !elements.projectDetailContent || !elements.projectPlaceholder) return;

  if (!project) {
    elements.projectDetailContent.innerHTML = '';
    elements.projectDetail.style.display = 'none';
    elements.projectPlaceholder.style.display = 'block';
    return;
  }

  elements.projectDetail.style.display = 'block';
  elements.projectPlaceholder.style.display = 'none';

  // Métriques
  const articlesCount = Number(project.article_count || 0);
  const pdfCount = appState.currentProjectFiles?.size || 0;
  const isIndexed = Boolean(project.indexed_at);
  const synthesis = appState.analysisResults?.synthesis_result;
  const discussion = appState.analysisResults?.discussion_draft;
  const graph = appState.analysisResults?.knowledge_graph;

  try {
    elements.projectDetailContent.innerHTML = `
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
    elements.projectDetailContent.innerHTML = `
      <div class="placeholder error">
        <p>Erreur lors de l'affichage de la synthèse.</p>
      </div>
    `;
  }
}
