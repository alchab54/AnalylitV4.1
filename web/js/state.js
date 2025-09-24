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
    taskProgress: new Map()
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
 * Ajoute une grille au projet actuel
 * @param {Object} grid - Nouvelle grille à ajouter
 */
export function addCurrentProjectGrid(grid) {
    if (appState.currentProject) {
        if (!appState.currentProject.grids) {
            appState.currentProject.grids = [];
        }
        appState.currentProject.grids.push(grid);
        console.log(`📋 Grille ajoutée au projet: ${appState.currentProject.name}`, grid);
    }
}

/**
 * Supprime une grille du projet actuel
 * @param {string|number} gridId - ID de la grille à supprimer
 */
export function removeCurrentProjectGrid(gridId) {
    if (appState.currentProject && appState.currentProject.grids) {
        const index = appState.currentProject.grids.findIndex(g => g.id === gridId);
        if (index !== -1) {
            const removed = appState.currentProject.grids.splice(index, 1)[0];
            console.log(`📋 Grille supprimée du projet: ${appState.currentProject.name}`, removed);
        }
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

// ============================
// Initialisation automatique
// ============================

// Charger les paramètres au démarrage
loadSettings();

// Interface de debug globale
if (typeof window !== 'undefined') {
    window.AnalyLitState = {
        appState,
        initializeState,
        setConnectionStatus,
        addBackgroundTask,
        updateTaskProgress,
        removeBackgroundTask,
        updateSettings,
        loadSettings,
        addNotification,
        markNotificationAsRead,
        setCurrentProject,
        clearState,
        getStateDebugInfo,
        setCurrentProjectGrids,
        addCurrentProjectGrid,
        removeCurrentProjectGrid,
        setCurrentProjectArticles,
        setCurrentProjectAnalyses,
        getCurrentProjectGrids,
        getCurrentProjectArticles,
        getCurrentProjectAnalyses
    };
    
    console.log('🔍 Interface de debug disponible: window.AnalyLitState');
}

// Export par défaut
export default appState;
