// web/js/constants.js

// Sélecteurs DOM centralisés
export const SELECTORS = {
    // General UI
    sections: '.section',
    navButtons: '.app-nav__button', // This was already correct
    connectionStatus: '[data-connection-status]',
    loadingOverlay: '#loadingOverlay',
    toastContainer: '#toastContainer',
    modalsContainer: '#modalsContainer',
    
    // Projets
    projectsList: '#projects-list',
    createProjectBtn: '#createProjectBtn',
    projectDetail: '#projectDetail', // This was already correct
    projectDetailContent: '#projectDetailContent',
    projectPlaceholder: '#projectPlaceholder',
    newProjectForm: '#newProjectForm', // This was already correct
    projectContainer: '#projectContainer', // Added missing constant

    // Articles / Résultats
    resultsContainer: '#resultsContainer',
    
    // Sections
    validationContainer: '#validationContainer',
    analysisContainer: '#analysisContainer',
    importContainer: '#importContainer',
    chatContainer: '#chatContainer',
    settingsContainer: '#settingsContainer',
    robContainer: '#robContainer',
    reportingContainer: '#reportingContainer',
    tasksContainer: '#tasksContainer',
    gridsContainer: '#gridsContainer',
    searchContainer: '#searchContainer',
    stakeholdersContainer: '#stakeholdersContainer',
    stakeholdersList: '#stakeholdersList',
    createStakeholderBtn: '#createStakeholderBtn',
    showCreateStakeholderModalBtn: '[data-action="show-create-stakeholder-modal"]', // Added missing constant
    newStakeholderForm: '#newStakeholderForm',

    // Paramètres
    settingsForm: '#profile-edit-form',

    // Analyses
    analysisResultContainer: '#analysis-result-container',
    knowledgeGraphContainer: '#knowledge-graph-container',

    // Reporting
    prismaChecklistContent: '#prisma-checklist-content',
};

// URLs API centralisées
export const API_ENDPOINTS = {
    // Projects
    projects: '/projects/',
    projectById: (id) => `/projects/${id}`,
    projectFiles: (id) => `/projects/${id}/files`,
    projectExport: (id) => `/projects/${id}/export`,
    projectExportThesis: (id) => `/projects/${id}/export/thesis`,
    projectIndexPdfs: (id) => `/projects/${id}/index-pdfs`, // Ajout du endpoint manquant
    projectImportZotero: (id) => `/projects/${id}/upload-zotero`, // ✅ CORRECTION: Endpoint manquant
    projectUploadPdfs: (id) => `/projects/${id}/upload-pdfs-bulk`, // ✅ CORRECTION: Endpoint manquant
    projectAddManualArticles: (id) => `/projects/${id}/add-manual-articles`, // ✅ CORRECTION: Endpoint manquant
    projectRun: (id) => `/projects/${id}/run`, // ✅ CORRECTION: Endpoint manquant pour le traitement par lot
    
    // Search
    search: '/search', // ✅ CORRECTION: L'API est sur /api/search, le préfixe est ajouté par fetchAPI
    projectSearchResults: (id) => `/projects/${id}/search-results`,
    
    // Articles
    projectArticles: (id) => `/projects/${id}/articles`,
    articlesBatchDelete: '/api/articles/batch-delete',
    
    // Validation
    projectExtractions: (id) => `/projects/${id}/extractions`,
    projectExtractionDecision: (projectId, extractionId) => `/projects/${projectId}/extractions/${extractionId}/decision`,
    projectScreeningDecisions: (id) => `/projects/${id}/screening-decisions`, // Ajout du endpoint manquant
    projectCalculateKappa: (id) => `/projects/${id}/calculate-kappa`,
    
    // Grids
    grids: (projectId) => `/projects/${projectId}/grids`,
    gridById: (projectId, gridId) => `/projects/${projectId}/grids/${gridId}`,
    gridsImport: (projectId) => `/projects/${projectId}/grids/import`, // Ajout du endpoint manquant
    
    // Analyses
    projectAnalyses: (id) => `/projects/${id}/analyses`,
    projectRunAnalysis: (id) => `/projects/${id}/run-analysis`,
    projectExportAnalyses: (id) => `/projects/${id}/export/analyses`,
    projectDeleteAnalysis: (projectId, analysisType) => `/projects/${projectId}/analyses/${analysisType}`,
    projectRunRobAnalysis: (id) => `/projects/${id}/run-rob-analysis`, // ✅ CORRECTION: Endpoint manquant
    projectPrismaChecklist: (id) => `/projects/${id}/prisma-checklist`, // ✅ CORRECTION: Endpoint manquant
    
    // Chat
    projectChatHistory: (id) => `/api/projects/${id}/chat-history`,
    projectChat: (id) => `/api/projects/${id}/chat`,

    // Settings
    analysisProfiles: '/api/analysis-profiles',
    analysisProfileById: (id) => `/api/analysis-profiles/${id}`,
    prompts: '/api/prompts',
    promptById: (id) => `/api/prompts/${id}`,
    ollamaModels: '/api/ollama/models',
    zoteroSettings: '/api/settings/zotero', // ✅ CORRECTION: Endpoint manquant
    ollamaPull: '/api/ollama/pull',
    databases: '/api/databases',
    
    // Queues
    queuesInfo: '/api/queues/info',
    queuesClear: '/api/queues/clear',

    // Tasks
    taskCancel: (id) => `/api/tasks/${id}/cancel`, // ✅ CORRECTION: Endpoint manquant
    taskRetry: (id) => `/api/tasks/${id}/retry`, // ✅ CORRECTION: Endpoint manquant
};

API_ENDPOINTS.tasksStatus = '/api/tasks/status';
API_ENDPOINTS.projectStakeholders = (projectId) => `/projects/${projectId}/stakeholders`;
API_ENDPOINTS.stakeholderById = (projectId, stakeholderId) => `/projects/${projectId}/stakeholders/${stakeholderId}`; // ✅ CORRECTION: Endpoint manquant
API_ENDPOINTS.projectStakeholderGroups = (projectId) => `/projects/${projectId}/stakeholder-groups`;
API_ENDPOINTS.stakeholderGroupById = (projectId, groupId) => `/projects/${projectId}/stakeholder-groups/${groupId}`;

// Messages d'état
export const MESSAGES = {
    // App
    appStart: '🚀 Démarrage de AnalyLit V4.1 Frontend (Version améliorée)...',
    firstRender: (sectionId) => `✅ Premier rendu de la section '${sectionId}' effectué.`,   
    missingDOMElement: 'Éléments DOM critiques manquants:',
    errorUI: "Erreur : éléments d'interface manquants",
    appInitialized: (time) => `✅ Application initialisée en ${time}ms`,
    initError: "❌ Erreur d'initialisation:",
    loadError: "Impossible de charger l'application. Rechargez la page.",
    initialDataLoaded: (time) => `📊 Données initiales chargées en ${time}ms`,
    initialDataError: 'Erreur chargement initial:',
    debugInterface: '🎯 Interface de debug disponible: window.AnalyLit',
    error: 'Erreur',
    unknownError: 'Erreur inconnue',
    appStateLog: 'État de lapplication:',
    loading: 'Chargement...', // Added missing constant
    
    // Projets
    projectCreated: 'Projet créé avec succès',
    projectDeleted: 'Projet supprimé',
    projectNameRequired: 'Le nom du projet est requis.',
    creatingProject: 'Création du projet...', 
    deletingProject: 'Suppression du projet...', 
    projectIdMissingForExport: "ID du projet manquant pour l'exportation.",
    projectExportStarted: "L'exportation du projet a commencé...",
    confirmDeleteProjectTitle: 'Confirmer la suppression',
    confirmDeleteBody: (type, name) => `Êtes-vous sûr de vouloir supprimer ${type} "<strong>${name}</strong>" ?`,
    noProjects: 'Aucun projet. Créez-en un pour commencer.',
    noProjectsFound: 'Aucun projet trouvé', // ✅ CORRECTION: Ajout du message manquant.
    
    // Stakeholders
    selectProjectToViewStakeholders: 'Sélectionnez un projet pour gérer les parties prenantes.',
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
    noArticles: 'Aucun résultat',

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
    analysisComplete: (type) => `Analyse ${type} terminée.`,
    refreshingAnalyses: 'Rafraîchissement des analyses...',
    advancedAnalysisModalTitle: 'Lancer une Analyse Avancée',
    startingMetaAnalysis: 'Lancement de la méta-analyse...', 
    metaAnalysisStarted: 'Méta-analyse lancée avec succès.',
    startingDescriptiveStats: 'Calcul des statistiques descriptives...', 
    descriptiveStatsStarted: 'Calcul des statistiques lancé.',
    selectProjectToExportAnalyses: 'Veuillez sélectionner un projet pour exporter les analyses.',
    preparingExport: "Préparation de l'exportation...",
    analysisExportStarted: "L'exportation des analyses a commencé.",
    errorExportingAnalyses: "Erreur d'exportation",
    noDataForGraph: 'Aucune donnée pour le graphe. Lancez l\'analyse pour le générer.',
    graphStats: (nodes, edges) => `${nodes} noeuds et ${edges} relations.`,

    // Settings
    errorLoadingPrompts: 'Erreur chargement prompts',
    loadingSettingsData: 'Chargement des données de configuration...', 
    settingsDataNotReady: "Les données des paramètres ne sont pas prêtes, le rendu est annulé.",
    noAnalysisProfileFound: 'Aucun profil d\'analyse trouvé.',
    refreshingQueuesStatus: "Rafraîchissement du statut des files...",
    noPromptTemplateFound: 'Aucun modèle de prompt trouvé.',
    cannotApplyTemplate: "Impossible d'appliquer le template ici.",
    noOllamaModelFound: 'Aucun modèle Ollama trouvé',
    aceNotLoaded: "La bibliothèque Ace n'a pas pu être chargée.",
    aceRetry: "Ace non chargé. Nouvel essai dans 100ms.",
    aceInitError: (type) => `Impossible d'initialiser l'éditeur Ace pour ${type}.`,
    cannotDeleteDefaultProfile: "Impossible de supprimer le profil par défaut.",
    deleteThisProfile: "Supprimer ce profil",
    templateApplied: (name, type) => `Modèle '${name}' appliqué aux éditeurs '${type}'.`,
    saving: 'Sauvegarde...', 
    profileSaved: (name) => `Profil '${name}' sauvegardé.`, 
    errorSavingProfile: "Erreur lors de la sauvegarde du profil:",
    cannotDeleteProfile: "Impossible de supprimer ce profil (défaut ou non sélectionné).",
    confirmProfileDeleteTitle: 'Confirmer la suppression',
    deleteButton: 'Supprimer',
    profileDeleted: (name) => `Profil "${name}" supprimé.`, 
    errorDeletingProfile: "Erreur lors de la suppression du profil:",
    clearQueueTitle: 'Vider la file d\'attente',
    confirmClearQueueBody: (name) => `Êtes-vous sûr de vouloir vider la file "${name}" ? Toutes les tâches en attente seront perdues.`, 
    clearButton: 'Vider',
    queueCleared: (name) => `La file "${name}" a été vidée.`, 
    promptSaved: 'Modèle de prompt sauvegardé.',
    taskCancelRequestSent: 'Demande d\'annulation de la tâche envoyée.', // ✅ CORRECTION: Message manquant
    taskCancelError: 'Erreur lors de l\'annulation de la tâche', // ✅ CORRECTION: Message manquant
    taskRetrySuccess: (taskId) => `La tâche ${taskId} a été relancée.`, // ✅ CORRECTION: Message manquant
    taskRetryError: 'Erreur lors de la nouvelle tentative de la tâche', // ✅ CORRECTION: Message manquant
    selectNotFound: "L'élément select 'available-models-select' est introuvable.",
    modelListNotFound: "Erreur : Impossible de trouver la liste des modèles.",
    modelDownloaded: (name) => `Modèle ${name} téléchargé avec succès`,
    downloadError: 'Erreur téléchargement',
    downloadingModel: (name) => `Téléchargement de ${name}...`,

    // Screening
    errorLoadingScreening: 'Erreur lors du chargement des décisions de screening',
    loadingScreening: 'Chargement des décisions de screening...',
    noArticlesToScreen: 'Aucun article à screener pour le moment.',
    selectProjectForScreening: 'Sélectionnez un projet pour commencer le screening.',
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

    // Import
    selectProjectForImport: 'Veuillez sélectionner un projet pour gérer les imports et les fichiers.',
    manualImportTitle: 'Import Manuel PMID/DOI',
    searchingFreePdfs: 'Recherche des PDFs gratuits...', 
    pdfSearchStarted: 'Recherche de PDFs lancée en arrière-plan.',
    generatingThesisExport: "Génération de l'export thèse...",
    startingIndexing: "Lancement de l'indexation...",
    indexingInProgress: 'Indexation en cours...', 
    indexingStarted: 'Indexation lancée en arrière-plan.',
    zoteroSyncNotImplemented: 'Synchronisation Zotero non implémentée dans cette version.',
    importingZoteroFile: 'Import du fichier Zotero...', 
    zoteroImportSuccess: (count) => `${count} références importées.`, 
    zoteroImportError: "Erreur lors de l'import Zotero",
    pmidImportFieldNotFound: "Erreur : le champ d'import de PMID n'a pas été trouvé.",
    atLeastOneIdRequired: 'Veuillez saisir au moins un identifiant.',
    importingIds: (count) => `Import de ${count} identifiant(s)...`,
    importStartedForIds: (count) => `Import lancé pour ${count} identifiant(s).`,
    importError: "l'import",
    zoteroCredentialsRequired: "L'ID utilisateur et la clé d'API Zotero sont requis.",
    zoteroCredentialsSaved: 'Identifiants Zotero sauvegardés avec succès.',
    pdfUploadLimit: 'Maximum 20 PDFs autorisés par upload.',
    uploadingPdfs: (count) => `Upload de ${count} PDF(s)...`,
    pdfsUploadedSuccess: (count) => `${count} PDFs uploadés`,
    uploadError: "l'upload",

    // Search
    selectProjectForSearch: 'Veuillez sélectionner un un projet pour commencer une recherche.',
    expertQueryRequired: 'Veuillez saisir au moins une requête en mode expert.',
    searchQueryRequired: 'Veuillez saisir une requête de recherche.',
    searching: 'Recherche en cours...', 
    searchStarted: 'Recherche lancée en arrière-plan. Les résultats apparaîtront progressivement.',
    searchComplete: (count) => `Recherche terminée (${count} résultats).`,
    newSearch: 'Nouvelle Recherche',

    // RoB
    selectProjectForRob: 'Sélectionnez un projet pour évaluer le risque de biais.',
    noArticlesForRob: "Aucun article dans ce projet. Lancez une recherche d'abord.",
    runRobAnalysis: "Lancer l'analyse RoB sur la sélection",
    noRobData: "Aucune évaluation de biais pour cet article. Lancez l'analyse.",
    robSaved: 'Évaluation RoB sauvegardée.',
    selectArticleForRob: "Veuillez sélectionner au moins un article pour l'analyse RoB.",
    startingRobAnalysis: (count) => `Lancement de l'analyse RoB pour ${count} article(s)...`,
    robAnalysisStarted: "Analyse du risque de biais lancée. Les résultats apparaîtront progressivement.",

    // Chat
    enterQuestion: 'Veuillez saisir une question',
    questionSent: 'Question envoyée. Réponse en cours...', 
    errorSendingQuestion: "Erreur lors de l'envoi de la question",
    selectProjectForIndexing: "Veuillez sélectionner un projet pour lancer l'indexation.",
    errorStartingIndexing: "Erreur lors du lancement de l'indexation",

    // Validation - AJOUT pour thèse
noProjectSelectedValidation: 'Aucun projet sélectionné',
selectProjectForValidation: 'Sélectionnez un projet pour commencer la validation.',
loadingValidations: 'Chargement des validations...',
validationSectionTitle: 'Validation Inter-Évaluateurs',
calculateKappaButton: 'Calculer Kappa Cohen',
activeEvaluator: 'Évaluateur actif',
evaluator1: 'Évaluateur 1',
evaluator2: 'Évaluateur 2',
included: 'Inclus',
excluded: 'Exclus', 
pending: 'En attente',
all: 'Tous',
justification: 'Justification IA :',
none: 'Aucune',
includeButton: 'Inclure',
excludeButton: 'Exclure',
resetButton: 'Réinitialiser',
titleUnavailable: 'Titre non disponible',
launchFullExtraction: 'Extraction Complète',
launchFullExtractionDescription: (count) => `Lancer l\'extraction complète sur ${count} article(s) inclus.`,
launchExtractionButton: 'Lancer l\'extraction',
validationErrorTitle: 'Erreur de Validation',
errorDisplayingValidation: 'Impossible d\'afficher les validations.',
decisionUpdated: 'Décision mise à jour',
validationError: 'Erreur de validation',
calculatingKappa: 'Calcul du Kappa en cours...',
selectProjectForKappa: 'Sélectionnez un projet pour calculer le Kappa.',
kappaCalculationStarted: (taskId) => `Calcul Kappa lancé (Task: ${taskId})`,
errorCalculatingKappa: (message) => `Erreur calcul Kappa: ${message}`,
errorApiKappa: (message) => `Erreur API Kappa: ${message}`,

// Tasks
errorFetchingTasks: 'Erreur lors de la récupération des tâches',
noTasksInProgress: 'Aucune tâche en cours.',

};

// Configuration de l'application
export const CONFIG = {
    API_BASE_URL: 'http://localhost:8080/api',
    WEBSOCKET_URL: '/',
    LOCAL_STORAGE_LAST_SECTION: 'analylit_last_section',
    LOCAL_STORAGE_THEME: 'analylit_theme', // Moved from config.js
};

// Messages pour le ThemeManager
export const THEME_MESSAGES = {
    themeToggleLabel: 'Basculer le thème',
    darkMode: 'Mode sombre',
    lightMode: 'Mode clair',
    themeLabel: 'Thème',
    themeAuto: 'Automatique',
};