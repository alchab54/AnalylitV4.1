// web/js/state.js
/**
 * État global de l'application AnalyLit
 * Gestion centralisée des données et de l'état
 */

// ============================
// État principal de l'application
// ============================

export const appState = {
    // Données des projets
    projects: [],
    currentProject: null,
    projectToDelete: null,

    // Gestion des fichiers
    currentProjectFiles: new Set(),
    uploadProgress: {},

    // État de l'interface utilisateur
    currentSection: 'projects',
    isLoading: false,
    loadingMessage: '',

    // WebSocket et connexions
    socket: null,
    connectionStatus: 'disconnected', // 'connected', 'connecting', 'disconnected'

    // Données des analyses
    analysisResults: null,
    analysisProfiles: [],
    stakeholders: [], // Added
    stakeholderGroups: [], // Added
    prompts: [], // Added
    ollamaModels: [], // Added
    selectedProfileId: null, // Added
    availableDatabases: [], // Added

    // Paramètres et configuration
    settings: {
        theme: 'light',
        language: 'fr',
        compactMode: false,
        notificationsEnabled: true
    },

    // Cache des données
    cache: {
        articles: new Map(),
        searchResults: new Map(),
        lastUpdate: null
    },

    // État des notifications
    notifications: [],
    toasts: [],

    // Gestion des tâches en arrière-plan
    backgroundTasks: new Map(),
    taskProgress: new Map(),
    queuesInfo: null,

    // Données spécifiques à une section
    searchResults: [],
    currentProjectExtractions: [],
    currentValidations: [],
    chatMessages: [], // Added
    screeningDecisions: [], // Added
    notifications: [], // Added
    activeEvaluator: 'evaluator1', // Added default evaluator
};

// ============================
// Fonctions utilitaires pour l'état
// ============================

/**
 * Initialise l'état de l'application avec des valeurs par défaut
 */
export function initializeState() {
    console.log('🔧 Initialisation de l\'état de l\'application');
    
    // Réinitialiser les collections
    appState.projects = [];
    appState.currentProject = null;
    appState.currentProjectFiles = new Set();
    
    // État initial de l'interface
    appState.currentSection = 'projects';
    appState.isLoading = false;
    
    // Réinitialiser les caches
    appState.cache.articles.clear();
    appState.cache.searchResults.clear();
    appState.cache.lastUpdate = Date.now();
    
    console.log('✅ État initialisé');
}

/**
 * Met à jour l'état de connexion
 * @param {string} status - 'connected', 'connecting', 'disconnected'
 */
export function setConnectionStatus(status) {
    if (appState.connectionStatus !== status) {
        appState.connectionStatus = status;
        console.log(`🔗 Statut de connexion: ${status}`);
        
        // Émettre un événement personnalisé
        window.dispatchEvent(new CustomEvent('connection-status-changed', {
            detail: { status }
        }));
    }
}

/**
 * Ajoute une tâche de fond au suivi
 * @param {string} taskId - Identifiant unique de la tâche
 * @param {Object} taskInfo - Informations sur la tâche
 */
export function addBackgroundTask(taskId, taskInfo) {
    appState.backgroundTasks.set(taskId, {
        id: taskId,
        status: 'pending',
        progress: 0,
        startTime: Date.now(),
        ...taskInfo
    });
    
    console.log(`⏳ Tâche ajoutée: ${taskId}`);
}

/**
 * Met à jour le progrès d'une tâche
 * @param {string} taskId - Identifiant de la tâche
 * @param {number} progress - Progrès (0-100)
 * @param {string} status - Statut de la tâche
 */
export function updateTaskProgress(taskId, progress, status = 'running') {
    if (appState.backgroundTasks.has(taskId)) {
        const task = appState.backgroundTasks.get(taskId);
        task.progress = progress;
        task.status = status;
        task.lastUpdate = Date.now();
        
        appState.taskProgress.set(taskId, progress);
        
        // Émettre un événement de mise à jour
        window.dispatchEvent(new CustomEvent('task-progress-updated', {
            detail: { taskId, progress, status }
        }));
    }
}

/**
 * Supprime une tâche terminée
 * @param {string} taskId - Identifiant de la tâche
 */
export function removeBackgroundTask(taskId) {
    if (appState.backgroundTasks.has(taskId)) {
        appState.backgroundTasks.delete(taskId);
        appState.taskProgress.delete(taskId);
        console.log(`✅ Tâche supprimée: ${taskId}`);
    }
}

/**
 * Met à jour les paramètres utilisateur
 * @param {Object} newSettings - Nouveaux paramètres
 */
export function updateSettings(newSettings) {
    appState.settings = { ...appState.settings, ...newSettings };
    
    // Sauvegarder dans localStorage
    try {
        localStorage.setItem('analylit-settings', JSON.stringify(appState.settings));
    } catch (error) {
        console.warn('Impossible de sauvegarder les paramètres:', error);
    }
    
    console.log('⚙️ Paramètres mis à jour:', newSettings);
}

/**
 * Charge les paramètres depuis localStorage
 */
export function loadSettings() {
    try {
        const saved = localStorage.getItem('analylit-settings');
        if (saved) {
            const settings = JSON.parse(saved);
            appState.settings = { ...appState.settings, ...settings };
            console.log('⚙️ Paramètres chargés depuis localStorage');
        }
    } catch (error) {
        console.warn('Impossible de charger les paramètres:', error);
    }
}

/**
 * Ajoute une notification à l'état
 * @param {Object} notification - Données de la notification
 */
export function addNotification(notification) {
    const notif = {
        id: Date.now() + Math.random(),
        timestamp: Date.now(),
        read: false,
        ...notification
    };
    
    appState.notifications.unshift(notif);
    
    // Limiter le nombre de notifications
    if (appState.notifications.length > 50) {
        appState.notifications = appState.notifications.slice(0, 50);
    }
    
    return notif;
}

/**
 * Marque une notification comme lue
 * @param {string|number} notificationId - ID de la notification
 */
export function markNotificationAsRead(notificationId) {
    const notification = appState.notifications.find(n => n.id === notificationId);
    if (notification) {
        notification.read = true;
    }
}

/**
 * Met à jour la liste des projets
 * @param {Array} projects - La nouvelle liste de projets
 */
export function setProjects(projects) {
    appState.projects = projects || [];
    console.log(`📁 Liste des projets mise à jour: ${projects.length} projets`);

    // Émettre un événement pour que l'UI puisse réagir
    window.dispatchEvent(new CustomEvent('projects-updated', {
        detail: { projects }
    }));
}

/**
 * Met à jour le projet actuel
 * @param {Object} project - Données du projet
 */
export function setCurrentProject(project) {
    appState.currentProject = project;
    
    if (project) {
        console.log(`📁 Projet sélectionné: ${project.name} (ID: ${project.id})`);
        
        // Émettre un événement de changement de projet
        window.dispatchEvent(new CustomEvent('current-project-changed', {
            detail: { project }
        }));
    }
}

/**
 * Met à jour la liste des groupes de parties prenantes
 * @param {Array} groups - La nouvelle liste de groupes de parties prenantes
 */
export function setStakeholderGroups(groups) {
    appState.stakeholderGroups = groups || [];
    console.log(`👥 Groupes de parties prenantes mis à jour: ${groups.length} groupes`);

    // Émettre un événement
    window.dispatchEvent(new CustomEvent('stakeholder-groups-updated', {
        detail: { groups }
    }));
}

/**
 * Met à jour les fichiers du projet actuel (Set de noms de fichiers)
 * @param {Set<string>} filesSet - Le Set des noms de fichiers du projet
 */
export function setCurrentProjectFiles(filesSet) {
    appState.currentProjectFiles = filesSet || new Set();
    console.log(`📄 Fichiers du projet mis à jour: ${filesSet.size} fichiers`);

    // Émettre un événement
    window.dispatchEvent(new CustomEvent('project-files-updated', {
        detail: { files: Array.from(filesSet) }
    }));
}

/**
 * Nettoie l'état (utilisé lors de la déconnexion ou reset)
 */
export function clearState() {
    console.log('🧹 Nettoyage de l\'état...');
    
    // Nettoyer les données sensibles
    appState.projects = [];
    appState.currentProject = null;
    appState.analysisResults = null;
    
    // Nettoyer les caches
    appState.cache.articles.clear();
    appState.cache.searchResults.clear();
    
    // Fermer les connexions
    if (appState.socket) {
        appState.socket.close();
        appState.socket = null;
    }
    
    appState.connectionStatus = 'disconnected';
    
    console.log('✅ État nettoyé');
}

/**
 * Obtient un résumé de l'état pour le debugging
 */
export function getStateDebugInfo() {
    return {
        projectsCount: appState.projects.length,
        currentProjectId: appState.currentProject?.id || null,
        currentSection: appState.currentSection,
        connectionStatus: appState.connectionStatus,
        backgroundTasksCount: appState.backgroundTasks.size,
        cacheSize: {
            articles: appState.cache.articles.size,
            searchResults: appState.cache.searchResults.size
        },
        notificationsCount: appState.notifications.length
    };
}

// web/js/state.js - À ajouter avant les exports finaux

/**
 * Met à jour les grilles du projet actuel
 * @param {Array} grids - Nouvelles grilles du projet
 */
export function setCurrentProjectGrids(grids) {
    if (appState.currentProject) {
        appState.currentProject.grids = grids || [];
        console.log(`📋 Grilles mises à jour pour le projet: ${appState.currentProject.name}`, grids);
        
        // Émettre un événement de changement
        window.dispatchEvent(new CustomEvent('project-grids-updated', {
            detail: { project: appState.currentProject, grids }
        }));
    }
}

/**
 * Met à jour les articles du projet actuel
 * @param {Array} articles - Nouveaux articles du projet
 */
export function setCurrentProjectArticles(articles) {
    if (appState.currentProject) {
        appState.currentProject.articles = articles || [];
        console.log(`📄 Articles mis à jour pour le projet: ${appState.currentProject.name}`, articles.length);
    }
}

/**
 * Met à jour les analyses du projet actuel
 * @param {Array} analyses - Nouvelles analyses du projet
 */
export function setCurrentProjectAnalyses(analyses) {
    if (appState.currentProject) {
        appState.currentProject.analyses = analyses || [];
        console.log(`📊 Analyses mises à jour pour le projet: ${appState.currentProject.name}`, analyses.length);
    }
}

/**
 * Met à jour les profils d'analyse dans l'état
 * @param {Array} profiles - La nouvelle liste de profils
 */
export function setAnalysisProfiles(profiles) {
    appState.analysisProfiles = profiles || [];
    console.log(`👤 Profils d'analyse mis à jour: ${profiles.length} profils`);

    // Émettre un événement pour que l'UI puisse réagir
    window.dispatchEvent(new CustomEvent('analysis-profiles-updated', {
        detail: { profiles }
    }));
}

/**
 * Met à jour la liste des prompts (modèles)
 * @param {Array} prompts - La nouvelle liste de prompts
 */
export function setPrompts(prompts) {
    appState.prompts = prompts || [];
    console.log(`💬 Prompts mis à jour: ${prompts.length} prompts`);

    // Émettre un événement
    window.dispatchEvent(new CustomEvent('prompts-updated', {
        detail: { prompts }
    }));
}

/**
 * Met à jour la liste des modèles Ollama
 * @param {Array} models - La nouvelle liste de modèles Ollama
 */
export function setOllamaModels(models) {
    appState.ollamaModels = models || [];
    console.log(`🧠 Modèles Ollama mis à jour: ${models.length} modèles`);

    // Émettre un événement
    window.dispatchEvent(new CustomEvent('ollama-models-updated', {
        detail: { models }
    }));
}

/**
 * Définit l'ID du profil d'analyse actuellement sélectionné
 * @param {string|null} profileId - L'ID du profil sélectionné
 */
export function setSelectedProfileId(profileId) {
    appState.selectedProfileId = profileId;
    console.log(`👤 Profil sélectionné: ${profileId || 'aucun'}`);

    // Émettre un événement
    window.dispatchEvent(new CustomEvent('selected-profile-changed', {
        detail: { profileId }
    }));
}


/**
 * Obtient les grilles du projet actuel
 * @returns {Array} Grilles du projet actuel ou tableau vide
 */
export function getCurrentProjectGrids() {
    return appState.currentProject?.grids || [];
}

/**
 * Obtient les articles du projet actuel
 * @returns {Array} Articles du projet actuel ou tableau vide
 */
export function getCurrentProjectArticles() {
    return appState.currentProject?.articles || [];
}

/**
 * Obtient les analyses du projet actuel
 * @returns {Array} Analyses du projet actuel ou tableau vide
 */
export function getCurrentProjectAnalyses() {
    return appState.currentProject?.analyses || [];
}

/**
 * Met à jour les extractions du projet actuel
 * @param {Array} extractions - Nouvelles extractions du projet
 */
export function setCurrentProjectExtractions(extractions) {
    appState.currentProjectExtractions = extractions || [];
    console.log(`📋 Extractions mises à jour pour le projet: ${appState.currentProject?.name}`, extractions.length);

    window.dispatchEvent(new CustomEvent('project-extractions-updated', {
        detail: { extractions }
    }));
}

/**
 * Met à jour les messages du chat
 * @param {Array} messages - Les nouveaux messages du chat
 */
export function setChatMessages(messages) {
    appState.chatMessages = messages || [];
    console.log(`💬 Messages de chat mis à jour: ${messages.length} messages`);

    // Émettre un événement
    window.dispatchEvent(new CustomEvent('chat-messages-updated', {
        detail: { messages }
    }));
}

/**
 * Définit l'évaluateur actif pour la validation
 * @param {string} evaluator - L'ID de l'évaluateur actif ('evaluator1' ou 'evaluator2')
 */
export function setActiveEvaluator(evaluator) {
    if (appState.activeEvaluator !== evaluator) {
        appState.activeEvaluator = evaluator;
        console.log(`🧑‍💻 Évaluateur actif défini sur: ${evaluator}`);

        // Émettre un événement
        window.dispatchEvent(new CustomEvent('active-evaluator-changed', {
            detail: { evaluator }
        }));
    }
}

/**
 * Met à jour les décisions de screening
 * @param {Array} decisions - Les nouvelles décisions de screening
 */
export function setScreeningDecisions(decisions) {
    appState.screeningDecisions = decisions || [];
    console.log(`🔍 Décisions de screening mises à jour: ${decisions.length} décisions`);

    // Émettre un événement
    window.dispatchEvent(new CustomEvent('screening-decisions-updated', {
        detail: { decisions }
    }));
}

/**
 * Met à jour la liste des notifications
 * @param {Array} notifications - La nouvelle liste de notifications
 */
export function setNotifications(notifications) {
    appState.notifications = notifications || [];
    console.log(`🔔 Notifications mises à jour: ${notifications.length} notifications`);

    window.dispatchEvent(new CustomEvent('notifications-updated', {
        detail: { notifications }
    }));
}

export function setUnreadNotificationsCount(count) {
    appState.unreadNotifications = count;
}

// ============================
// Initialisation automatique
// ============================

// Export par défaut
export default appState;

// Ajoutez ces fonctions à la fin de votre fichier web/js/state.js

/**
 * Gère la sélection d'articles pour validation
 */
export const selectedArticles = new Set();

/**
 * Ajoute un article à la sélection
 * @param {string|number} articleId - ID de l'article
 */
export function addSelectedArticle(articleId) {
    selectedArticles.add(articleId);
    console.log(`📄 Article ajouté à la sélection: ${articleId}`);
    
    // Émettre un événement
    window.dispatchEvent(new CustomEvent('articles-selection-changed', {
        detail: { selectedIds: Array.from(selectedArticles) }
    }));
}

/**
 * Retire un article de la sélection
 * @param {string|number} articleId - ID de l'article
 */
export function removeSelectedArticle(articleId) {
    selectedArticles.delete(articleId);
    console.log(`📄 Article retiré de la sélection: ${articleId}`);
    
    // Émettre un événement
    window.dispatchEvent(new CustomEvent('articles-selection-changed', {
        detail: { selectedIds: Array.from(selectedArticles) }
    }));
}

/**
 * Vide la sélection d'articles
 */
export function clearSelectedArticles() {
    selectedArticles.clear();
    console.log('🗑️ Sélection d\'articles vidée');
    
    // Émettre un événement
    window.dispatchEvent(new CustomEvent('articles-selection-changed', {
        detail: { selectedIds: [] }
    }));
}

/**
 * Vérifie si un article est sélectionné
 * @param {string|number} articleId - ID de l'article
 * @returns {boolean}
 */
export function isArticleSelected(articleId) {
    return selectedArticles.has(articleId);
}

/**
 * Obtient tous les articles sélectionnés
 * @returns {Array} IDs des articles sélectionnés
 */
export function getSelectedArticles() {
    return Array.from(selectedArticles);
}

/**
 * Sélectionne ou désélectionne tous les articles
 * @param {Array} articleIds - IDs de tous les articles
 * @param {boolean} select - true pour sélectionner, false pour désélectionner
 */
export function toggleAllArticles(articleIds, select = true) {
    if (select) {
        articleIds.forEach(id => selectedArticles.add(id));
        console.log(`📄 ${articleIds.length} articles sélectionnés`);
    } else {
        selectedArticles.clear();
        console.log('📄 Tous les articles désélectionnés');
    }
    
    // Émettre un événement
    window.dispatchEvent(new CustomEvent('articles-selection-changed', {
        detail: { selectedIds: Array.from(selectedArticles) }
    }));
}

/**
 * Met à jour les résultats de recherche dans l'état
 * @param {Array} results - Résultats de la recherche
 * @param {string} searchQuery - Requête de recherche
 */
export function setSearchResults(results, searchQuery = '') {
    appState.searchResults = results || [];
    appState.lastSearchQuery = searchQuery;
    appState.cache.searchResults.set(searchQuery, {
        results,
        timestamp: Date.now()
    });
    
    console.log(`🔍 ${results.length} résultats de recherche mis à jour`);
    
    // Émettre un événement
    window.dispatchEvent(new CustomEvent('search-results-updated', {
        detail: { results, query: searchQuery }
    }));
}

/**
 * Filtre les résultats de recherche
 * @param {Object} filters - Filtres à appliquer
 */
export function filterSearchResults(filters) {
    const { status, dateRange, authors, keywords } = filters || {};
    
    if (!appState.searchResults) return [];
    
    let filtered = [...appState.searchResults];
    
    if (status && status !== 'all') {
        filtered = filtered.filter(article => article.status === status);
    }
    
    if (dateRange && dateRange.start && dateRange.end) {
        filtered = filtered.filter(article => {
            const articleDate = new Date(article.published_date || article.date);
            return articleDate >= new Date(dateRange.start) && 
                   articleDate <= new Date(dateRange.end);
        });
    }
    
    if (authors && authors.length > 0) {
        filtered = filtered.filter(article => 
            authors.some(author => 
                article.authors?.some(a => 
                    a.toLowerCase().includes(author.toLowerCase())
                )
            )
        );
    }
    
    if (keywords && keywords.length > 0) {
        filtered = filtered.filter(article =>
            keywords.some(keyword =>
                article.title?.toLowerCase().includes(keyword.toLowerCase()) ||
                article.abstract?.toLowerCase().includes(keyword.toLowerCase())
            )
        );
    }
    
    console.log(`🎯 ${filtered.length} résultats après filtrage`);
    return filtered;
}

/**
 * Met à jour l'état de chargement global
 * @param {boolean} loading - État de chargement
 * @param {string} message - Message de chargement
 */
export function setLoadingState(loading, message = '') {
    appState.isLoading = loading;
    appState.loadingMessage = message;
    
    console.log(`⏳ État de chargement: ${loading ? 'ACTIF' : 'INACTIF'} - ${message}`);
    
    // Émettre un événement
    window.dispatchEvent(new CustomEvent('loading-state-changed', {
        detail: { loading, message }
    }));
}

/**
 * Met à jour la section active
 * @param {string} sectionId - ID de la nouvelle section active
 */
export function setCurrentSection(sectionId) {
    if (appState.currentSection !== sectionId) {
        const previousSection = appState.currentSection;
        appState.currentSection = sectionId;
        
        console.log(`🔄 Section changée: ${previousSection} → ${sectionId}`);
        
        // Émettre un événement
        window.dispatchEvent(new CustomEvent('section-changed', {
            detail: { 
                previousSection, 
                currentSection: sectionId 
            }
        }));
    }
}

/**
 * Met à jour les résultats d'analyse dans l'état
 * @param {Object} results - Résultats de l'analyse
 */
export function setAnalysisResults(results) {
    appState.analysisResults = results || null;
    console.log(`📊 Résultats d'analyse mis à jour`, results);
    
    // Émettre un événement
    window.dispatchEvent(new CustomEvent('analysis-results-updated', {
        detail: { results }
    }));
}

/**
 * Met à jour le statut des files d'attente (queues)
 * @param {Object} status - Le nouvel objet de statut des files
 */
export function setQueuesStatus(status) {
    appState.queuesInfo = status || { queues: [] };
    console.log(`🔄 Statut des files d'attente mis à jour.`);

    // Émettre un événement pour que l'UI puisse réagir
    window.dispatchEvent(new CustomEvent('queues-status-updated', {
        detail: { status: appState.queuesInfo }
    }));
}

/**
 * Met à jour les données de validation pour la section de validation.
 * @param {Array} validations - Les données de validation (généralement des extractions).
 */
export function setCurrentValidations(validations) {
    appState.currentValidations = validations || [];
    console.log(`✅ Données de validation mises à jour: ${validations.length} éléments`);

    // Émettre un événement pour que l'UI puisse réagir si nécessaire
    window.dispatchEvent(new CustomEvent('validations-updated', {
        detail: { validations }
    }));
}

// ============================
// Initialisation et Debug
// ============================

// Charger les paramètres au démarrage
loadSettings();

// Ajouter toutes ces nouvelles fonctions à l'interface de debug
if (typeof window !== 'undefined') {
    window.AnalyLitState = {
        // Core state
        appState,
        initializeState,
        clearState,
        getStateDebugInfo,

        // Project specific data
        setProjects,
        setCurrentProject,
        setCurrentProjectGrids,
        setCurrentProjectArticles,
        setCurrentProjectAnalyses,
        setCurrentProjectExtractions,
        setStakeholders, // Added
        setStakeholderGroups, // Added
        getCurrentProjectGrids,
        
        // Articles selection
        selectedArticles,
        addSelectedArticle,
        removeSelectedArticle,
        clearSelectedArticles,
        isArticleSelected,
        getSelectedArticles,
        toggleAllArticles,
        
        // Search and filtering
        setSearchResults,
        filterSearchResults,
        setAnalysisResults,
        
        // UI state
        setLoadingState,
        setCurrentSection,
        setConnectionStatus,
        setAnalysisProfiles,
        setCurrentValidations,
        setPrompts,
        setOllamaModels,
        setSelectedProfileId,
        setAvailableDatabases,
        setChatMessages,
        setActiveEvaluator,
        setScreeningDecisions,
        setQueuesStatus,
        
        // Debug helpers
        debugSelectedArticles: () => console.log('Articles sélectionnés:', Array.from(selectedArticles)),
        debugSearchResults: () => console.log('Résultats de recherche:', appState.searchResults),
        debugCurrentState: () => console.log('État complet:', appState)
    };

    console.log('🔍 Interface de debug disponible: window.AnalyLitState');
}
