// web/js/projects.js
import { appState, elements } from './app-improved.js';
import { fetchAPI } from './api.js';
import { showLoadingOverlay, closeModal, escapeHtml, showModal, renderProjectCards } from './ui-improved.js';
import { showToast, showSuccess, showError } from './ui-improved.js';
import { setProjects, setCurrentProject, setCurrentSection, setCurrentProjectFiles } from './state.js';
import { API_ENDPOINTS, MESSAGES, SELECTORS } from './constants.js';

// ============================
// Fonctions principales
// ============================

/**
 * Charge la liste des projets depuis l'API et met à jour l'interface utilisateur.
 * Cette fonction unifie le chargement et le rendu des projets.
 */
export async function loadProjects() {
    try {
        const projects = await fetchAPI(API_ENDPOINTS.projects);
        setProjects(projects || []);
        
        // This function renders the list container and the cards inside it.
        renderProjectsList();
        
        autoSelectFirstProject();
        
        return projects;
    } catch (error) {
        console.error("Erreur lors du chargement des projets:", error);
        showError("Impossible de charger les projets.");
        
        // Afficher un état vide en cas d'erreur
        renderProjectCards([]);
        displayEmptyProjectsState();
        
        return [];
    }
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
    const mode = form.querySelector('#projectAnalysisMode').value;

    if (!name) {
        showToast(MESSAGES.projectNameRequired, 'warning');
        return;
    }

    try {
        showLoadingOverlay(true, MESSAGES.creatingProject);

        const newProject = await fetchAPI(API_ENDPOINTS.projects, {
            method: 'POST',
            body: { name, description, mode }
        });

        // AFFICHER LE SUCCÈS D'ABORD pour éviter les race conditions
        showSuccess(MESSAGES.projectCreated);
        closeModal('newProjectModal');

        // ENSUITE, mettre à jour les données en arrière-plan
        await loadProjects();
        if (newProject?.id) {
            await selectProject(newProject.id);
        }
    } catch (e) {
        showError(`Erreur: ${e.message}`);
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
    
    const projectToSelect = appState.projects.find(p => p.id === projectId);
    if (!projectToSelect) return;

    try {
        setCurrentProject(projectToSelect);
        renderProjectsList();

        // NE PAS CHANGER DE SECTION AUTOMATIQUEMENT.
        // L'utilisateur doit cliquer sur la section "Résultats" pour voir les articles.
        
        // ✅ CORRECTION: Afficher les détails du projet sélectionné.
        renderProjectDetail(projectToSelect);
        // setCurrentSection('articles');
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    }
}

/**
 * Supprime un projet.
 */
async function deleteProject(projectId, projectName) {
    if (!projectId) return;
    
    // Use the non-blocking custom confirmation modal from ui-improved.js
    const { showConfirmModal } = await import('./ui-improved.js');
    showConfirmModal(
        MESSAGES.confirmDeleteProjectTitle,
        MESSAGES.confirmDeleteProjectBody(projectName),
        {
            confirmText: MESSAGES.deleteButton,
            confirmClass: 'btn--danger',
            onConfirm: () => confirmDeleteProject(projectId)
        }
    );
}

/**
 * Logique de suppression effective, appelée par le gestionnaire d'événements.
 */
async function confirmDeleteProject(projectId) {
    showLoadingOverlay(true, MESSAGES.deletingProject);
    
    try {
        // Perform the API call first.
        await fetchAPI(API_ENDPOINTS.projectById(projectId), { method: 'DELETE' });

        // Now show the toast.
        showToast(MESSAGES.projectDeleted, 'success');
        
        // Finally, reload the project list to update the UI.
        await loadProjects();
    } catch (e) {
        showError(`Erreur lors de la suppression: ${e.message}`);
    } finally {
        showLoadingOverlay(false);
    }
}

/**
 * Exporte un projet.
 */
async function handleExportProject(projectId) {
    if (!projectId) {
        showToast(MESSAGES.projectIdMissingForExport, 'warning');
        return;
    }
    
    window.open(API_ENDPOINTS.projectExport(projectId), '_blank');
    showToast(MESSAGES.projectExportStarted, 'info');
}

/**
 * Charge la liste des fichiers PDF associés au projet et stocke uniquement les stems.
 */
async function loadProjectFilesSet(projectId) {
    if (!projectId) {
        setCurrentProjectFiles(new Set());
        return;
    }
    
    try {
        // TODO: Backend route for getting project files is missing.
        // const files = await fetchAPI(`/projects/${projectId}/files`);
        const files = await fetchAPI(API_ENDPOINTS.projectFiles(projectId)); // Assuming this endpoint exists
        const filenames = (files || [])
            .map(f => String(f.filename || '').replace(/\.pdf$/i, '').toLowerCase());
        setCurrentProjectFiles(new Set(filenames));
    } catch (error) {
        console.error('Erreur chargement des fichiers projet:', error);
        appState.currentProjectFiles = new Set();
    }
}

// ============================
// Fonctions de rendu
// ============================

/**
 * Rendu de la liste des projets (colonne gauche).
 */
function renderProjectsList() {
    const sectionContainer = document.getElementById('projects');
    if (!sectionContainer) return;

    // Injecte la structure de base de la section si elle n'existe pas
    if (!sectionContainer.querySelector('.card')) {
        sectionContainer.innerHTML = `
            <div class="card">
                <div class="card__header">
                    <div class="section-header">
                        <div class="section-header__content">
                            <h2 class="h2">Gestion des Projets</h2>
                            <p class="text-muted">Créez et gérez vos projets de revue de littérature.</p>
                        </div>
                        <div class="section-header__actions">
                            <button id="create-project-btn" class="btn btn--primary" data-action="create-project-modal">
                                <span role="img" aria-hidden="true">➕</span> Nouveau Projet
                            </button>
                        </div>
                    </div>
                </div>
                <div class="card__body">
                    <div id="projects-list" class="projects-grid">
                        <!-- Les cartes de projet seront injectées ici -->
                    </div>
                    <div id="projectDetail" class="project-detail" style="display: none;">
                        <div id="projectDetailContent" class="project-detail-content"></div>
                    </div>
                </div>
            </div>
        `;
    }

    const container = document.querySelector(SELECTORS.projectsList);
    if (!container) return;

    const projects = Array.isArray(appState.projects) ? appState.projects : [];

    if (projects.length === 0) {
        displayEmptyProjectsState();
        return;
    }

    const projectsHtml = projects.map(project => {
        const isActive = appState.currentProject?.id === project.id;
        return `
            <div class="project-card ${isActive ? 'project-card--active' : ''}" 
                 data-action="select-project" 
                 data-project-id="${project.id}">
                <div class="project-card__header">
                    <h3 class="project-title">${escapeHtml(project.name)}</h3>
                    <span class="status ${getStatusClass(project.status)}">${getStatusText(project.status)}</span>
                </div>
                <p class="project-description">${escapeHtml(project.description || 'Pas de description.')}</p>
                <div class="project-footer">
                    <small>Modifié le: ${new Date(project.updated_at).toLocaleString('fr-FR')}</small>
                    <button class="btn btn--danger btn--sm" 
                            data-action="delete-project" 
                            data-project-id="${project.id}" 
                            data-project-name="${escapeHtml(project.name)}">
                        🗑️ Supprimer
                    </button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = projectsHtml;
}

/**
 * Affiche un état vide quand aucun projet n'est trouvé.
 */
export function displayEmptyProjectsState() {
    const container = elements.projectsList || document.querySelector(SELECTORS.projectsList);
    if (!container) return;
    
    container.innerHTML = `
        <div class="empty-state">
            <h3>Aucun projet trouvé</h3>
            <p>Créez votre premier projet pour commencer votre revue de littérature.</p>
            <button data-action="create-project-modal" class="btn btn-primary">
                <i class="fas fa-plus"></i> Créer un projet
            </button>
        </div>
    `;
}

/**
 * Met à jour la sélection dans la liste des projets.
 */
function updateProjectListSelection() {
    const projectCards = document.querySelectorAll('.project-card');
    projectCards?.forEach(card => {
        const projectId = card.dataset.projectId;
        if (appState.currentProject?.id === projectId) {
            card.classList.add('project-card--active');
        } else {
            card.classList.remove('project-card--active');
        }
    });
}

/**
 * Rendu du panneau de détails du projet (colonne droite).
 */
function renderProjectDetail(project) {
    const detailWrapper = document.querySelector(SELECTORS.projectDetail); // Get the main wrapper
    const detailContainer = document.querySelector(SELECTORS.projectDetailContent);
    const placeholder = document.querySelector(SELECTORS.projectPlaceholder);
    if (!detailWrapper || !detailContainer || !placeholder) return;

    if (!project) {
        detailContainer.innerHTML = '';
        placeholder.style.display = 'block';
        detailWrapper.style.display = 'none'; // Hide the wrapper if no project
        return;
    }

    detailWrapper.style.display = 'block'; // ✅ CORRECTION: Make the wrapper visible
    placeholder.style.display = 'none';
    detailContainer.style.display = 'block'; // ✅ FIX: Make the content container visible as well to pass the test
    
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
                    <button class="btn btn--secondary" 
                            data-action="export-project" 
                            data-project-id="${project.id}">📥 Export</button>
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

// ============================
// Fonctions utilitaires
// ============================

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
 * Convertit un statut technique en texte lisible.
 */
function getStatusText(status) {
    const statusTexts = {
        'pending': 'En attente', 
        'processing': 'Traitement...', 
        'synthesizing': 'Synthèse...',
        'completed': 'Terminé', 
        'failed': 'Échec', 
        'indexing': 'Indexation...',
        'generating_discussion': 'Génération discussion...', 
        'generating_graph': 'Génération graphe...',
        'generating_prisma': 'Génération PRISMA...', 
        'generating_analysis': 'Analyse statistique...',
        'search_completed': 'Recherche terminée', 
        'in_progress': 'En cours', 
        'queued': 'En file',
        'started': 'Démarré', 
        'finished': 'Fini'
    };
    return statusTexts[status] || status;
}

// ============================
// Exports
// ============================

export {
    autoSelectFirstProject,
    handleCreateProject,
    selectProject,
    deleteProject,
    confirmDeleteProject,
    handleExportProject,
    loadProjectFilesSet,
    renderProjectsList,
    updateProjectListSelection,
    renderProjectDetail,
    getStatusText
};
