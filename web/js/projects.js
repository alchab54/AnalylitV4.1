// web/js/projects.js

import { fetchAPI } from './api.js';
import { setProjects } from './state.js';
import { showToast } from './ui.js';

/**
 * Charge la liste des projets depuis le backend et met à jour l'état global.
 */
export async function loadProjects() {
  try {
    const projects = await fetchAPI('/api/projects');
    setProjects(projects);
  } catch (error) {
    console.error('Erreur lors du chargement des projets :', error);
    showToast('Erreur : impossible de charger les projets.', 'error');
  }
}

/**
 * Crée un nouveau projet côté backend.
 * @param {Object} projectData { name: string, description: string, ... }
 */
export async function createProject(projectData) {
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
    throw error;
  }
}

/**
 * Supprime un projet côté backend.
 * @param {number|string} projectId 
 */
export async function deleteProject(projectId) {
  try {
    await fetchAPI(`/api/projects/${projectId}`, { method: 'DELETE' });
    showToast('Projet supprimé avec succès.', 'success');
  } catch (error) {
    console.error('Erreur lors de la suppression du projet :', error);
    showToast('Erreur : impossible de supprimer le projet.', 'error');
    throw error;
  }
}

/**
 * Demande confirmation et supprime un projet, puis recharge la liste.
 * @param {number|string} projectId 
 */
export async function confirmDeleteProject(projectId) {
  /* eslint-disable no-alert */
  if (window.confirm('Voulez-vous vraiment supprimer ce projet ?')) {
    await deleteProject(projectId);
    await loadProjects();
  }
}

/**
 * Gère la création d'un projet depuis un formulaire UI.
 * @param {Event} event 
 */
export async function handleCreateProject(event) {
  event.preventDefault();
  const form = event.currentTarget.closest('form');
  const formData = new FormData(form);
  const projectData = {
    name: formData.get('projectName'),
    description: formData.get('projectDescription'),
    // ajouter d'autres champs si nécessaire
  };
  try {
    await createProject(projectData);
    form.reset();
    await loadProjects();
  } catch {
    // erreurs gérées dans createProject
  }
}

/**
 * Gère la suppression déclenchée depuis l'UI (data-action="delete-project").
 * @param {Event} event 
 */
export function handleDeleteProject(event) {
  const projectId = event.currentTarget.dataset.projectId;
  confirmDeleteProject(projectId);
}

// Exports pour core.js
export {
  loadProjects,
  createProject,
  deleteProject,
  confirmDeleteProject,
  handleCreateProject,
  handleDeleteProject,
};
