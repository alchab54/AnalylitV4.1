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
    projectPrismaChecklist: (id) => `/projects/${id}/prisma-checklist`,
    projectRunAnalysis: (id) => `/projects/${id}/run-analysis`,
    projectExportAnalyses: (id) => `/projects/${id}/export/analyses`,
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
    selectProjectToViewAnalyses: 'Sélectionnez un projet pour voir les analyses.',
    errorLoadingAnalyses: 'Erreur lors du chargement des analyses',
    savingPrisma: 'Sauvegarde PRISMA...',
    prismaSaved: 'Progression PRISMA sauvegardée.',
    prismaExportNotImplemented: 'Export PRISMA non implémenté.',
    atnAnalysisStarted: "Lancement de l'analyse ATN...",
    atnAnalysisJobStarted: (jobId) => `Analyse ATN lancée (Job ID: ${jobId})`,
    selectProjectFirst: 'Veuillez d\'abord sélectionner un projet.',
    startingAnalysis: (type) => `Lancement de la génération pour ${type}...`,
    unknownAnalysisType: "Type d'analyse inconnu.",
    analysisJobStarted: (type, jobId) => `La génération pour ${type} a été lancée (Job: ${jobId}).`,
    analysisStartedSimple: (type) => `La génération pour ${type} a été lancée.`,
    errorStartingAnalysis: "Erreur lors du lancement de l'analyse",
    advancedAnalysisModalTitle: 'Lancer une Analyse Avancée',
    startingMetaAnalysis: 'Lancement de la méta-analyse...', 
    metaAnalysisStarted: 'Méta-analyse lancée avec succès.',
    startingDescriptiveStats: 'Calcul des statistiques descriptives...', 
    descriptiveStatsStarted: 'Calcul des statistiques lancé.',
    selectProjectToExportAnalyses: 'Veuillez sélectionner un projet pour exporter les analyses.',
    preparingExport: "Préparation de l'exportation...",
    analysisExportStarted: "L'exportation des analyses a commencé.",
    errorExportingAnalyses: "Erreur d'exportation",
    // Settings
    errorLoadingPrompts: 'Erreur chargement prompts',
    loadingSettingsData: 'Chargement des données de configuration...', 
    settingsDataNotReady: "Les données des paramètres ne sont pas prêtes, le rendu est annulé.",
    noAnalysisProfileFound: 'Aucun profil d'analyse trouvé.',
    refreshingQueuesStatus: "Rafraîchissement du statut des files...",
    noPromptTemplateFound: 'Aucun modèle de prompt trouvé.',
    noOllamaModelFound: 'Aucun modèle Ollama trouvé',
    aceNotLoaded: "La bibliothèque Ace n'a pas pu être chargée.",
    aceRetry: "Ace non chargé. Nouvel essai dans 100ms.",
    aceInitError: (type) => `Impossible d'initialiser l'éditeur Ace pour ${type}.`,
    cannotDeleteDefaultProfile: "Impossible de supprimer le profil par défaut.",
    deleteThisProfile: "Supprimer ce profil",
    templateApplied: (name, type) => `Modèle '${name}' appliqué aux éditeurs '${type}'.`,
    cannotApplyTemplate: `Impossible de déterminer à quel éditeur ce modèle s'applique. Veuillez sélectionner un onglet.`,
    saving: 'Sauvegarde...', 
    profileSaved: (name) => `Profil '${name}' sauvegardé.`,
    errorSavingProfile: "Erreur lors de la sauvegarde du profil:",
    cannotDeleteProfile: "Impossible de supprimer ce profil (défaut ou non sélectionné).",
    confirmProfileDeleteTitle: 'Confirmer la suppression',
    confirmProfileDeleteBody: (name) => `Êtes-vous sûr de vouloir supprimer définitivement le profil "${name}" ?`,
    deleteButton: 'Supprimer',
    profileDeleted: (name) => `Profil "${name}" supprimé.`,
    errorDeletingProfile: "Erreur lors de la suppression du profil:",
    clearQueueTitle: 'Vider la file d\'attente',
    confirmClearQueueBody: (name) => `Êtes-vous sûr de vouloir vider la file "${name}" ? Toutes les tâches en attente seront perdues.`,
    clearButton: 'Vider',
    queueCleared: (name) => `La file "${name}" a été vidée.`,
    promptSaved: 'Modèle de prompt sauvegardé.',
    selectNotFound: "L'élément select 'available-models-select' est introuvable.",
    modelListNotFound: "Erreur : Impossible de trouver la liste des modèles.",
    modelDownloaded: (name) => `Modèle ${name} téléchargé avec succès`,
    unknownError: 'Erreur inconnue',
    downloadError: 'Erreur téléchargement',
    downloadingModel: (name) => `Téléchargement de ${name}...`,

    // Grids
    errorLoadingGrids: 'Erreur lors du chargement des grilles.',
    selectProjectToViewGrids: 'Sélectionnez un projet pour voir ses grilles.',
    noCustomGrids: 'Aucune grille personnalisée.',
    confirmDeleteGrid: 'Supprimer cette grille ?',
    gridDeleted: 'Grille supprimée.',
    editGridTitle: 'Modifier la Grille',
    createGridTitle: 'Créer une Nouvelle Grille',
    invalidJsonFile: 'Veuillez sélectionner un fichier .json valide.',
    gridImported: 'Grille importée avec succès.',
    gridNameAndFieldRequired: 'Le nom de la grille et au moins un champ sont requis.',
    gridSaved: (isUpdate) => `Grille ${isUpdate ? 'mise à jour' : 'créée'} avec succès.`,
    errorSavingGrid: 'Erreur lors de la sauvegarde de la grille',
};