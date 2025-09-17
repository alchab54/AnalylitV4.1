/**
 * AnalyLit Connector - Service Worker
 * Gère la logique en arrière-plan de l'extension
 */

class BackgroundService {
    constructor() {
        this.isInstalled = false;
        this.serverUrl = '';
        this.apiKey = '';
        
        this.init();
    }

    init() {
        console.log('🔧 Service Worker AnalyLit Connector démarré');
        
        // Écouter l'installation de l'extension
        chrome.runtime.onInstalled.addListener((details) => {
            this.handleInstalled(details);
        });

        // Écouter les messages des content scripts et popup
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true; // Indique qu'on répondra de manière asynchrone
        });

        // Écouter les changements d'onglets
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            this.handleTabUpdated(tabId, changeInfo, tab);
        });

        // Écouter les clics sur l'icône de l'extension
        chrome.action.onClicked.addListener((tab) => {
            this.handleActionClicked(tab);
        });

        // Charger la configuration
        this.loadConfig();
    }

    async handleInstalled(details) {
        console.log('📦 Extension installée:', details.reason);
        
        if (details.reason === 'install') {
            // Première installation
            await this.showWelcomeNotification();
            await this.openWelcomePage();
        } else if (details.reason === 'update') {
            // Mise à jour
            await this.showUpdateNotification();
        }
        
        this.isInstalled = true;
    }

    async showWelcomeNotification() {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'AnalyLit Connector installé !',
            message: 'Connectez votre Zotero à AnalyLit pour une synchronisation facile.'
        });
    }

    async showUpdateNotification() {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'AnalyLit Connector mis à jour',
            message: 'Nouvelle version installée avec succès.'
        });
    }

    async openWelcomePage() {
        chrome.tabs.create({
            url: chrome.runtime.getURL('welcome.html')
        });
    }

    async loadConfig() {
        try {
            const result = await chrome.storage.sync.get(['analylit_config']);
            if (result.analylit_config) {
                this.serverUrl = result.analylit_config.serverUrl || '';
                this.apiKey = result.analylit_config.apiKey || '';
            }
        } catch (error) {
            console.error('Erreur lors du chargement de la configuration:', error);
        }
    }

    async handleMessage(request, sender, sendResponse) {
        try {
            console.log('📩 Message reçu:', request.action);
            
            switch (request.action) {
                case 'openPopup':
                    await this.openPopup();
                    sendResponse({ success: true });
                    break;
                    
                case 'openPopupForExport':
                    await this.openPopupForExport(request.items);
                    sendResponse({ success: true });
                    break;
                    
                case 'viewItemInAnalyLit':
                    await this.viewItemInAnalyLit(request.item);
                    sendResponse({ success: true });
                    break;
                    
                case 'importToAnalyLit':
                    const importResult = await this.importToAnalyLit(request.projectId, request.items);
                    sendResponse({ success: true, result: importResult });
                    break;
                    
                case 'exportFromAnalyLit':
                    const exportResult = await this.exportFromAnalyLit(request.projectId, request.exportType);
                    sendResponse({ success: true, result: exportResult });
                    break;
                    
                case 'testConnection':
                    const connectionResult = await this.testAnalyLitConnection(request.serverUrl, request.apiKey);
                    sendResponse({ success: true, result: connectionResult });
                    break;
                    
                case 'getProjects':
                    const projects = await this.getAnalyLitProjects();
                    sendResponse({ success: true, projects: projects });
                    break;
                    
                case 'updateConfig':
                    await this.updateConfig(request.config);
                    sendResponse({ success: true });
                    break;
                    
                default:
                    sendResponse({ success: false, error: 'Action inconnue' });
            }
        } catch (error) {
            console.error('Erreur dans handleMessage:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    async handleTabUpdated(tabId, changeInfo, tab) {
        // Détecter quand l'utilisateur va sur Zotero
        if (changeInfo.status === 'complete' && tab.url) {
            if (tab.url.includes('zotero.org') && this.isZoteroLibraryPage(tab.url)) {
                await this.handleZoteroPageLoaded(tabId, tab);
            }
        }
    }

    isZoteroLibraryPage(url) {
        return url.includes('zotero.org') && 
               (url.includes('/library') || url.includes('/groups'));
    }

    async handleZoteroPageLoaded(tabId, tab) {
        try {
            // Injecter notre script si pas déjà fait
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['zotero-inject.js']
            });
            
            // Notifier l'utilisateur si c'est sa première visite
            const isFirstVisit = await this.isFirstZoteroVisit();
            if (isFirstVisit) {
                await this.showZoteroWelcome(tabId);
            }
            
        } catch (error) {
            console.error('Erreur lors de l\'injection du script:', error);
        }
    }

    async isFirstZoteroVisit() {
        const result = await chrome.storage.local.get(['zotero_first_visit']);
        if (!result.zotero_first_visit) {
            await chrome.storage.local.set({ zotero_first_visit: Date.now() });
            return true;
        }
        return false;
    }

    async showZoteroWelcome(tabId) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'AnalyLit détecté sur Zotero !',
            message: 'Cliquez sur l\'icône de l\'extension pour synchroniser vos références.'
        });
    }

    async handleActionClicked(tab) {
        // Ouvrir le popup de l'extension
        // Note: avec Manifest V3, les popups sont gérés automatiquement
        // Cette méthode est appelée si pas de popup défini
        console.log('🔘 Icône cliquée sur l\'onglet:', tab.url);
    }

    async openPopup() {
        // Créer un nouvel onglet avec le popup en grand format
        chrome.tabs.create({
            url: chrome.runtime.getURL('popup.html'),
            active: true
        });
    }

    async openPopupForExport(items) {
        // Stocker temporairement les éléments à exporter
        await chrome.storage.local.set({
            pending_export: {
                items: items,
                timestamp: Date.now()
            }
        });
        
        await this.openPopup();
    }

    async viewItemInAnalyLit(item) {
        if (this.serverUrl) {
            // Ouvrir AnalyLit avec une recherche de l'élément
            const searchUrl = `${this.serverUrl}/search?q=${encodeURIComponent(item.title)}`;
            chrome.tabs.create({ url: searchUrl });
        } else {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: 'Configuration requise',
                message: 'Veuillez configurer l\'URL de votre serveur AnalyLit.'
            });
        }
    }

    async importToAnalyLit(projectId, items) {
        if (!this.serverUrl) {
            throw new Error('URL du serveur non configurée');
        }

        try {
            const response = await fetch(`${this.serverUrl}/api/projects/${projectId}/import-zotero`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
                },
                body: JSON.stringify({
                    items: items,
                    source: 'zotero_extension',
                    timestamp: new Date().toISOString()
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            
            // Enregistrer dans l'historique
            await this.saveToHistory('import', 'zotero', result.imported || items.length);
            
            // Notification de succès
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: 'Import réussi',
                message: `${result.imported || items.length} éléments importés dans AnalyLit`
            });
            
            return result;
            
        } catch (error) {
            console.error('Erreur lors de l\'import:', error);
            
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: 'Erreur d\'import',
                message: error.message
            });
            
            throw error;
        }
    }

    async exportFromAnalyLit(projectId, exportType) {
        if (!this.serverUrl) {
            throw new Error('URL du serveur non configurée');
        }

        try {
            const endpoint = exportType === 'results' ? 'export-validated-results' : 'export-bibliography';
            const response = await fetch(`${this.serverUrl}/api/projects/${projectId}/${endpoint}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const exportData = await response.json();
            
            // Enregistrer dans l'historique
            await this.saveToHistory('export', exportType, exportData.length || 1);
            
            // Notification de succès
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: 'Export réussi',
                message: `${exportData.length || 1} éléments exportés depuis AnalyLit`
            });
            
            return exportData;
            
        } catch (error) {
            console.error('Erreur lors de l\'export:', error);
            
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: 'Erreur d\'export',
                message: error.message
            });
            
            throw error;
        }
    }

    async testAnalyLitConnection(serverUrl, apiKey) {
        try {
            const response = await fetch(`${serverUrl}/api/health`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...(apiKey && { 'Authorization': `Bearer ${apiKey}` })
                }
            });

            const isConnected = response.ok;
            
            if (isConnected) {
                // Mettre à jour la configuration
                this.serverUrl = serverUrl;
                this.apiKey = apiKey;
            }
            
            return {
                connected: isConnected,
                status: response.status,
                message: isConnected ? 'Connexion réussie' : `Erreur HTTP ${response.status}`
            };
            
        } catch (error) {
            console.error('Erreur de test de connexion:', error);
            return {
                connected: false,
                status: 0,
                message: error.message
            };
        }
    }

    async getAnalyLitProjects() {
        if (!this.serverUrl) {
            throw new Error('URL du serveur non configurée');
        }

        try {
            const response = await fetch(`${this.serverUrl}/api/projects`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const projects = await response.json();
            return projects;
            
        } catch (error) {
            console.error('Erreur lors de la récupération des projets:', error);
            throw error;
        }
    }

    async updateConfig(config) {
        this.serverUrl = config.serverUrl || '';
        this.apiKey = config.apiKey || '';
        
        await chrome.storage.sync.set({
            analylit_config: config
        });
    }

    async saveToHistory(action, type, count) {
        try {
            const result = await chrome.storage.local.get(['sync_history']);
            const history = result.sync_history || [];
            
            const newEntry = {
                action: action,
                type: type,
                count: count,
                timestamp: Date.now(),
                description: this.getHistoryDescription(action, type)
            };
            
            history.unshift(newEntry);
            
            // Garder seulement les 50 dernières entrées
            if (history.length > 50) {
                history.splice(50);
            }
            
            await chrome.storage.local.set({ sync_history: history });
            
        } catch (error) {
            console.error('Erreur lors de la sauvegarde de l\'historique:', error);
        }
    }

    getHistoryDescription(action, type) {
        const descriptions = {
            'import': {
                'zotero': 'Import depuis Zotero',
                'collection': 'Import collection',
                'selected': 'Import sélection',
                'library': 'Import bibliothèque'
            },
            'export': {
                'results': 'Export résultats validés',
                'bibliography': 'Export bibliographie',
                'zotero': 'Export vers Zotero'
            }
        };
        
        return descriptions[action]?.[type] || `${action} ${type}`;
    }

    // Nettoyage périodique des données temporaires
    async performCleanup() {
        try {
            const result = await chrome.storage.local.get(['pending_export', 'sync_history']);
            
            // Nettoyer les exports en attente (plus de 1 heure)
            if (result.pending_export) {
                const oneHourAgo = Date.now() - (60 * 60 * 1000);
                if (result.pending_export.timestamp < oneHourAgo) {
                    await chrome.storage.local.remove('pending_export');
                }
            }
            
            // Nettoyer l'historique (plus de 30 jours)
            if (result.sync_history) {
                const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
                const cleanHistory = result.sync_history.filter(entry => entry.timestamp > thirtyDaysAgo);
                
                if (cleanHistory.length !== result.sync_history.length) {
                    await chrome.storage.local.set({ sync_history: cleanHistory });
                }
            }
            
        } catch (error) {
            console.error('Erreur lors du nettoyage:', error);
        }
    }
}

// Initialiser le service en arrière-plan
const backgroundService = new BackgroundService();

// Nettoyage périodique (tous les jours)
setInterval(() => {
    backgroundService.performCleanup();
}, 24 * 60 * 60 * 1000);

console.log('🚀 AnalyLit Connector Service Worker prêt');