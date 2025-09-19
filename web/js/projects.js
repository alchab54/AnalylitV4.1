// web/js/projects.js

import { fetchAPI } from './api.js';
// CORRIGÉ: Ajout des imports pour l'état et les éléments UI
import { setProjects, setCurrentProject } from './state.js'; // <-- 'appState' retiré d'ici
import { showToast } from './ui-improved.js';
import { elements, appState } from './app-improved.js'; // <-- 'appState' ajouté ici

/**
 * Charge la liste des projets depuis le backend et met à jour l'état global.
 */
async function loadProjects() {
  try {
    const projects = await fetchAPI('/api/projects');
    setProjects(projects); // Met à jour l'état (l'UI est mise à jour par un listener)
  } catch (error) {
    console.error('Erreur lors du chargement des projets :', error);
    showToast('Erreur : impossible de charger les projets.', 'error');
  }
}

/**
 * Crée un nouveau projet côté backend.
 * @param {Object} projectData - Données du projet { name, description }.
 */
async function createProject(projectData) {
  try {
    const newProject = await fetchAPI('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projectData),
    });
    showToast('Projet créé avec succès.', 'success');
    return newProject;
  } catch (error) {
    console.error('Erreur lors de la création du projet :', error);
    showToast('Erreur : impossible de créer le projet.', 'error');
    throw error; // Permet de bloquer la suite (ex: reset du form) si la création échoue
  }
}

/**
 * Supprime un projet côté backend.
 * @param {number|string} projectId - L'ID du projet à supprimer.
 */
async function deleteProject(projectId) {
  try {
    await fetchAPI(`/api/projects/${projectId}`, { method: 'DELETE' });
    showToast('Projet supprimé avec succès.', 'success');
  } catch (error) {
    console.error('Erreur lors de la suppression du projet :', error);
    showToast('Erreur : impossible de supprimer le projet.', 'error');
    throw error; // Propage l'erreur pour la gestion dans la fonction appelante
  }
}

/**
 * Demande une confirmation à l'utilisateur avant de lancer la suppression.
 * @param {number|string} projectId - L'ID du projet.
 */
async function confirmDeleteProject(projectId) {
  /* eslint-disable no-alert */
  if (window.confirm('Voulez-vous vraiment supprimer ce projet ?')) {
    try {
      await deleteProject(projectId);
      await loadProjects(); // Recharge la liste des projets pour refléter la suppression
      if (appState.currentProject && appState.currentProject.id.toString() === projectId) {
        setCurrentProject(null); // Désélectionne le projet s'il était actif
      }
    } catch (error) {
      // Les erreurs sont déjà affichées par deleteProject
    }
  }
}

/**
 * Gère la soumission du formulaire de création de projet.
 * @param {Event} event - L'événement de soumission du formulaire.
 */
async function handleCreateProject(event) {
  event.preventDefault();
  const form = event.currentTarget.closest('form');
  if (!form) return;

  const formData = new FormData(form);
  const projectData = {
    name: formData.get('projectName'),
    description: formData.get('projectDescription'),
  };

  try {
    await createProject(projectData);
    form.reset();
    await loadProjects(); // Met à jour la liste des projets avec le nouveau
  } catch (error) {
    // L'erreur est déjà notifiée par createProject
  }
}

/**
 * Gère le clic sur le bouton de suppression d'un projet.
 * @param {Event} event - L'événement du clic.
 */
function handleDeleteProject(event) {
  const projectId = event.currentTarget.dataset.projectId;
  if (projectId) {
    confirmDeleteProject(projectId);
  }
}


// --- FONCTIONS MANQUANTES AJOUTÉES CI-DESSOUS ---

/**
 * Sélectionne un projet, le charge et le définit comme projet courant.
 * @param {string} projectId
 */
async function selectProject(projectId) {
    if (!projectId) {
        setCurrentProject(null);
        return;
    }
    
    // Si on clique sur le projet déjà chargé
    if (appState.currentProject && appState.currentProject.id.toString() === projectId) {
        return;
    }

    try {
        showToast('Chargement du projet...', 'info');
        const project = await fetchAPI(`/api/projects/${projectId}`);
        setCurrentProject(project);
        // L'UI est mise à jour par le listener de state ou par refreshCurrentSection
        // qui sera appelé par le gestionnaire d'événements dans core.js
    } catch (error) {
        console.error('Erreur lors de la sélection du projet :', error);
        showToast(`Erreur : impossible de charger le projet ${projectId}.`, 'error');
        setCurrentProject(null);
    }
}

/**
 * Gère l'exportation d'un projet.
 * @param {string} projectId - L'ID du projet à exporter.
 */
async function handleExportProject(projectId) {
  if (!projectId) {
    showToast('Aucun projet sélectionné pour l\'export.', 'error');
    return;
  }
  showToast('Début de l\'exportation du projet...', 'info');
  try {
    // Utilise fetch natif pour gérer une réponse blob (fichier)
    // Cela suppose que votre API est sur le même domaine ou gère les CORS
    const res = await fetch(`/api/projects/${projectId}/export`, {
        method: 'GET',
        // Ajoutez ici les en-têtes d'authentification si nécessaire (ex: cookies)
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(errorData.message || `Erreur ${res.status}`);
    }

    const blob = await res.blob();
    
    // Extrait le nom du fichier depuis l'en-tête
    const contentDisposition = res.headers.get('content-disposition');
    let filename = `project_${projectId}_export.zip`; // Nom par défaut
    if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+?)"?$/);
        if (filenameMatch && filenameMatch.length === 2)
            filename = filenameMatch[1];
    }

    // Crée un lien temporaire pour déclencher le téléchargement
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
    
    showToast('Exportation du projet terminée.', 'success');
    
  } catch (error) {
    console.error('Erreur lors de l\'exportation du projet :', error);
    showToast(`Erreur d'exportation : ${error.message}`, 'error');
  }
}

/**
 * Affiche les détails d'un projet dans l'interface (utilisé par la section "projects").
 * @param {object} project - L'objet projet.
 */
function renderProjectDetail(project) {
    const container = elements.projectDetailContainer; // Assurez-vous que 'elements.projectDetailContainer' est défini dans app-improved.js
    if (!container) return;

    if (!project) {
        container.innerHTML = '<p class="text-secondary">Aucun projet sélectionné.</p>';
        return;
    }

    // C'est un exemple de rendu. Adaptez-le à votre structure HTML.
    container.innerHTML = `
        <h3 class="project-detail__title">${project.name}</h3>
        <p class="project-detail__description">${project.description || 'Pas de description.'}</p>
        <div class="project-detail__meta">
            <span><strong>Articles :</strong> ${project.article_count || 0}</span>
            <span><strong>Dernière modification :</strong> ${new Date(project.updated_at).toLocaleString()}</span>
        </div>
    `;
}

// --- FIN DES FONCTIONS AJOUTÉES ---


// Exportation unique et groupée (CORRIGÉE)
export {
  loadProjects,
  createProject,
  deleteProject,
  confirmDeleteProject,
  handleCreateProject,
  handleDeleteProject,
  
  // CORRIGÉ: Ajout des exports manquants
  selectProject,
  handleExportProject,
  renderProjectDetail
};