// web/js/projects.js
import { fetchAPI } from './api.js';
import { showToast, showLoadingOverlay, closeModal } from './ui.js';
import { escapeHtml } from './ui.js'; // Import escapeHtml
import { getStatusClass } from './core.js'; // Import getStatusClass and showSection
import { renderProjectSynthesis } from './projects.js'; // Import renderProjectSynthesis

export async function loadProjects() {
    // Assuming appState is globally available
    appState.projects = await fetchAPI('/projects');
}

export async function handleCreateProject(event) {
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

// Placeholder for selectProject - will be implemented fully later
export async function selectProject(projectId) {
    console.log(`Selecting project: ${projectId}`);
    // Actual implementation will be moved here from app.js
}

export function renderProjectList() {
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
            <div class="project-item project-list-item ${isActive ? 'project-list-item--active' : ''}" 
                 data-project-id="${project.id}">
                <div class="project-list-item-info">
                    <div class="project-list-item-name">${escapeHtml(project.name)}</div>
                    <div class="project-list-item-status">
                        <span class="status-badge ${statusClass}">${escapeHtml(project.status || 'pending')}</span>
                    </div>
                </div>
                <button class="btn btn--danger btn--sm project-delete-btn" data-project-id="${project.id}" title="Supprimer le projet">
                    ×
                </button>
            </div>
        `;
    }).join('');

    elements.projectsList.innerHTML = projectsHtml;
}

export function renderProjectSynthesis(synthesisResult, projectDescription) {
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

export function renderProjectDetail(project) {
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
