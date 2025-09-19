// web/js/projects.js

import { fetchAPI } from './api.js';
import { setProjects } from './state.js';
import { showToast } from './ui-improved.js';

/**
 * Charge la liste des projets depuis le backend et met à jour l'état global.
 */
async function loadProjects() {
  try {
    // On s'assure que l'URL n'a pas de slash final
    const projects = await fetchAPI('/api/projects');
    setProjects(projects);
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
    } catch (error) {
      // Les erreurs sont déjà affichées par deleteProject, donc pas besoin de les gérer ici.
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
    // L'erreur est déjà notifiée par createProject, on ne fait rien de plus ici.
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

// Exportation unique et groupée de toutes les fonctions nécessaires
export {
  loadProjects,
  createProject,
  deleteProject,
  confirmDeleteProject,
  handleCreateProject,
  handleDeleteProject,
};