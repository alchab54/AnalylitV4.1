// web/js/constants.js

// Sélecteurs DOM centralisés
export const SELECTORS = {
    // Projets
    projectsList: '#projectsList',
    projectContainer: '.projects-container',
    createProjectBtn: '#createProjectBtn',
    
    // Articles
    resultsContainer: '#resultsContainer',
    selectedArticles: '.article-checkbox:checked',
    
    // Analyses
    analysisContainer: '#analysisContainer',
    analysisProgress: '#analysis-progress',
    analysisResults: '#analysis-results',
    
    // Paramètres
    settingsContainer: '#settingsContainer',
    settingsForm: '#profile-edit-form',
    ollamaModels: '#ollama-models-select',
    
    // Interface
    sidebar: '#sidebar',
    mainContent: '#main-content',
    loadingSpinner: '#loading-spinner',
    toastContainer: '#toastContainer'
};

// URLs API centralisées
export const API_ENDPOINTS = {
    // Projects
    projects: '/projects',
    projectById: (id) => `/projects/${id}`,
    projectExport: (id) => `/projects/${id}/export`,
    
    // Grids
    grids: (projectId) => `/projects/${projectId}/grids`,
    gridById: (projectId, gridId) => `/projects/${projectId}/grids/${gridId}`,

    // Articles
    articlesBatchDelete: '/articles/batch-delete',
    projectSearchResults: (id) => `/projects/${id}/search-results`,
    
    // Analyses
    projectExtractions: (id) => `/projects/${id}/extractions`,
    projectRun: (id) => `/projects/${id}/run`,
    
    // Settings
    analysisProfiles: '/analysis-profiles',
    analysisProfileById: (id) => `/analysis-profiles/${id}`,
    prompts: '/prompts',
    promptById: (id) => `/prompts/${id}`,
    ollamaModels: '/settings/models',
    
    // Queues
    queuesInfo: '/queues/info',
    queuesClear: '/queues/clear',

    // Databases
    databases: '/databases',
};

// Messages d'état
export const MESSAGES = {
    loading: 'Chargement en cours...', 
    // Projets
    projectCreated: 'Projet créé avec succès',
    projectDeleted: 'Projet supprimé',
    projectNameRequired: 'Le nom du projet est requis.',
    creatingProject: 'Création du projet...', 
    deletingProject: 'Suppression du projet...', 
    projectIdMissingForExport: "ID du projet manquant pour l'exportation.",
    projectExportStarted: "L'exportation du projet a commencé...",
    confirmDeleteProjectTitle: 'Confirmer la suppression',
    confirmDeleteProjectBody: (name) => `Êtes-vous sûr de vouloir supprimer le projet "<strong>${name}</strong>" ?`,
    // Articles
    loadingResults: 'Chargement des résultats...', 
    noProjectSelected: 'Aucun projet sélectionné',
    selectProjectToViewResults: 'Sélectionnez un projet pour voir les résultats de recherche.',
    errorLoadingResults: 'Erreur de chargement des résultats.',
    articleNotFound: 'Article introuvable',
    articleDetailsTitle: "Détails de l'article",
    noArticleSelected: 'Aucun article sélectionné',
    confirmDeleteArticles: (count) => `Supprimer ${count} article(s) sélectionné(s) ?`,
    deleteStarted: (jobId) => `Suppression lancée (Job ID: ${jobId})`,
    batchProcessModalTitle: 'Lancer le Screening par Lot',
    screeningStarted: (count) => `Lancement du screening pour ${count} article(s)...`,
    screeningTaskStarted: 'Tâche de screening lancée en arrière-plan.',
    noArticleToExtract: "Aucun article n'a été marqué comme 'Inclus' pour l'extraction.",
    fullExtractionModalTitle: 'Extraction Complète',
    noGridSelectedForExtraction: "Veuillez sélectionner une grille d'extraction",
    extractionStarted: (count) => `Lancement de l'extraction pour ${count} article(s)...`,
    extractionTaskStarted: 'Extraction complète lancée en arrière-plan.',
    noProjects: 'Aucun projet trouvé. Créez-en un pour commencer !',
    noArticles: 'Aucun article dans ce projet.',
    // Analyses
    analysisStarted: 'Analyse lancée avec succès',
};