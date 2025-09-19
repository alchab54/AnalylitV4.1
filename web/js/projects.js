// web/js/projects.js

import { fetchAPI } from './api.js';
import { setProjects } from './state.js';
import { showToast } from './ui.js';

/**
 * Charge la liste des projets depuis le backend et met à jour l'état global.
 */
export async function loadProjects() {
  try {
    const projects = await fetchAPI('/projects');
    setProjects(projects);
  } catch (error) {
    console.error('Erreur lors du chargement des projets :', error);
    showToast('Erreur : impossible de charger les projets.', 'error');
    // Relance potentielle ou gestion additionnelle ici
  }
}
