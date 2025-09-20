/**
 * AnalyLit Connector - Popup Script
 * Gère l'interface utilisateur de l'extension
 */

class AnalyLitConnector {
    constructor() {
        this.config = {
            serverUrl: '',
            apiKey: '',
            lastProject: null
        };
        this.currentOperation = null;
        this.zoteroData = null;
        
        this.init();
    }

    async init() {
        console.log('🚀 Initialisation d\'AnalyLit Connector');
        
        await this.loadConfig();
        this.setupEventListeners();
        await this.checkConnection();
        
        // Si configuré, charger la section principale
        if (this.config.serverUrl) {
            await this.initializeMainSection();
        }
    }

    async loadConfig() {
        try {
            const result = await chrome.storage.sync.get(['analylit_config']);
            if (result.analylit_config) {
                this.config = { ...this.config, ...result.analylit_config };
                this.updateConfigUI();
            }
        } catch (error) {
            console.error('Erreur lors du chargement de la configuration:', error);
        }
    }

    async saveConfig() {
        try {
            await chrome.storage.sync.set({ analylit_config: this.config });
            this.showMessage('Configuration sauvegardée', 'success');
        } catch (error) {
            console.error('Erreur lors de la sauvegarde:', error);
            this.showMessage('Erreur lors de la sauvegarde', 'error');
        }
    }

    updateConfigUI() {
        document.getElementById('serverUrl').value = this.config.serverUrl || '';
        document.getElementById('apiKey').value = this.config.apiKey || '';
    }

    setupEventListeners() {
        // Configuration
        document.getElementById('saveConfig').addEventListener('click', () => this.handleSaveConfig());
        document.getElementById('testConnection').addEventListener('click', () => this.testConnection());
        
        // Actions principales
        document.getElementById('refreshProjects').addEventListener('click', () => this.loadProjects());
        document.getElementById('projectSelect').addEventListener('change', () => this.handleProjectChange());
        
        // Import actions
        document.getElementById('importCollection').addEventListener('click', () => this.importZoteroCollection());
        document.getElementById('importSelected').addEventListener('click', () => this.importSelectedItems());
        document.getElementById('importAll').addEventListener('click', () => this.importAllLibrary());
        
        // Export actions
        document.getElementById('exportResults').addEventListener('click', () => this.exportToZotero('results'));
        document.getElementById('exportBibliography').addEventListener('click', () => this.exportToZotero('bibliography'));
        
        // Utilitaires
        document.getElementById('openAnalyLit').addEventListener('click', () => this.openAnalyLit());
        document.getElementById('showHelp').addEventListener('click', () => this.showHelp());
        document.getElementById('cancelOperation').addEventListener('click', () => this.cancelCurrentOperation());
        
        // Overlay
        document.getElementById('overlayCancel').addEventListener('click', () => this.hideOverlay());
        document.getElementById('overlayConfirm').addEventListener('click', () => this.handleOverlayConfirm());
    }

    async handleSaveConfig() {
        const serverUrl = document.getElementById('serverUrl').value.trim();
        const apiKey = document.getElementById('apiKey').value.trim();

        if (!serverUrl) {
            this.showMessage('URL du serveur requise', 'error');
            return;
        }

        // Nettoyer l'URL
        const cleanUrl = serverUrl.replace(/\/+$/, '');
        
        this.config.serverUrl = cleanUrl;
        this.config.apiKey = apiKey;

        await this.saveConfig();
        await this.testConnection();
    }

    async testConnection() {
        const statusIndicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        
        statusIndicator.textContent = '⏳';
        statusText.textContent = 'Test de connexion...';

        try {
            const response = await this.makeRequest('/api/health');
            
            if (response.ok) {
                statusIndicator.textContent = '✅';
                statusText.textContent = 'Connecté';
                this.showMessage('Connexion réussie !', 'success');
                await this.initializeMainSection();
                return true;
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('Erreur de connexion:', error);
            statusIndicator.textContent = '❌';
            statusText.textContent = 'Déconnecté';
            this.showMessage('Connexion échouée: ' + error.message, 'error');
            return false;
        }
    }

    async checkConnection() {
        if (this.config.serverUrl) {
            await this.testConnection();
        }
    }

    async initializeMainSection() {
        document.getElementById('configSection').style.display = 'none';
        document.getElementById('mainSection').style.display = 'block';
        
        await this.loadProjects();
        await this.loadZoteroData();
        await this.loadSyncHistory();
    }

    async loadProjects() {
        const selectElement = document.getElementById('projectSelect');
        selectElement.innerHTML = '<option value="">Chargement...</option>';

        try {
            const response = await this.makeRequest('/api/projects');
            const projects = await response.json();

            selectElement.innerHTML = '<option value="">Sélectionner un projet</option>';
            
            projects.forEach(project => {
                const option = document.createElement('option');
                option.value = project.id;
                option.textContent = project.name;
                if (this.config.lastProject === project.id) {
                    option.selected = true;
                }
                selectElement.appendChild(option);
            });

            this.updateImportButtons();
        } catch (error) {
            console.error('Erreur lors du chargement des projets:', error);
            selectElement.innerHTML = '<option value="">Erreur de chargement</option>';
        }
    }

    async loadZoteroData() {
        try {
            // Communiquer avec le content script pour obtenir les données Zotero
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (tab.url.includes('zotero.org')) {
                const response = await chrome.tabs.sendMessage(tab.id, { action: 'getZoteroData' });
                if (response && response.success) {
                    this.zoteroData = response.data;
                    this.updateImportButtons();
                }
            }
        } catch (error) {
            console.error('Erreur lors du chargement des données Zotero:', error);
        }
    }

    updateImportButtons() {
        const hasProject = document.getElementById('projectSelect').value;
        const hasZoteroData = this.zoteroData && this.zoteroData.items;
        
        document.getElementById('importCollection').disabled = !hasProject || !hasZoteroData;
        document.getElementById('importSelected').disabled = !hasProject || !hasZoteroData;
        document.getElementById('importAll').disabled = !hasProject;
    }

    handleProjectChange() {
        const projectId = document.getElementById('projectSelect').value;
        this.config.lastProject = projectId;
        this.saveConfig();
        this.updateImportButtons();
    }

    async importZoteroCollection() {
        if (!this.zoteroData || !this.zoteroData.collection) {
            this.showMessage('Aucune collection active détectée', 'warning');
            return;
        }

        const confirmed = await this.showConfirmDialog(
            'Importer la collection',
            `Importer ${this.zoteroData.collection.itemCount} éléments de "${this.zoteroData.collection.name}" ?`
        );

        if (confirmed) {
            await this.performImport('collection', this.zoteroData.collection.items);
        }
    }

    async importSelectedItems() {
        if (!this.zoteroData || !this.zoteroData.selectedItems || this.zoteroData.selectedItems.length === 0) {
            this.showMessage('Aucun élément sélectionné dans Zotero', 'warning');
            return;
        }

        const confirmed = await this.showConfirmDialog(
            'Importer la sélection',
            `Importer ${this.zoteroData.selectedItems.length} élément(s) sélectionné(s) ?`
        );

        if (confirmed) {
            await this.performImport('selected', this.zoteroData.selectedItems);
        }
    }

    async importAllLibrary() {
        const confirmed = await this.showConfirmDialog(
            'Importer toute la bibliothèque',
            'Cette opération peut prendre du temps. Continuer ?'
        );

        if (confirmed) {
            // Obtenir tous les éléments via l'API Zotero
            await this.performImport('library', null);
        }
    }

    async performImport(type, items) {
        const projectId = document.getElementById('projectSelect').value;
        if (!projectId) {
            this.showMessage('Aucun projet sélectionné', 'error');
            return;
        }

        this.showProgress('Import en cours...', 0);

        try {
            let importData;
            
            if (type === 'library') {
                // Pour toute la bibliothèque, faire appel à l'API Zotero
                importData = await this.fetchFullLibrary();
            } else {
                importData = items;
            }

            const response = await this.makeRequest(`/api/projects/${projectId}/import-from-extension`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    items: importData,
                    importType: type
                })
            });

            if (response.ok) {
                const result = await response.json();
                this.showMessage(`Import réussi: ${result.imported} éléments importés`, 'success');
                this.addToSyncHistory('import', type, result.imported);
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('Erreur lors de l\'import:', error);
            this.showMessage('Erreur lors de l\'import: ' + error.message, 'error');
        } finally {
            this.hideProgress();
        }
    }

    async exportToZotero(exportType) {
        const projectId = document.getElementById('projectSelect').value;
        if (!projectId) {
            this.showMessage('Aucun projet sélectionné', 'error');
            return;
        }

        this.showProgress('Export en cours...', 0);

        try {
            const endpoint = exportType === 'results' ? 'export-validated-results' : 'export-bibliography';
            const response = await this.makeRequest(`/api/projects/${projectId}/${endpoint}`);

            if (response.ok) {
                const exportData = await response.json();
                
                // Créer un fichier de téléchargement
                const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
                    type: 'application/json' 
                });
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = `analylit-${exportType}-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                
                URL.revokeObjectURL(url);
                
                this.showMessage('Export téléchargé avec succès', 'success');
                this.addToSyncHistory('export', exportType, exportData.length || 1);
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('Erreur lors de l\'export:', error);
            this.showMessage('Erreur lors de l\'export: ' + error.message, 'error');
        } finally {
            this.hideProgress();
        }
    }

    async fetchFullLibrary() {
        // Cette fonction devrait communiquer avec le content script
        // pour obtenir toutes les données via l'API Zotero Web
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'getFullLibrary' });
            
            if (response && response.success) {
                return response.data;
            } else {
                throw new Error('Impossible d\'obtenir les données de la bibliothèque');
            }
        } catch (error) {
            console.error('Erreur lors de la récupération de la bibliothèque:', error);
            throw error;
        }
    }

    async makeRequest(endpoint, options = {}) {
        const url = `${this.config.serverUrl}${endpoint}`;
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (this.config.apiKey) {
            defaultOptions.headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        }

        const finalOptions = { ...defaultOptions, ...options };
        
        return fetch(url, finalOptions);
    }

    showProgress(message, percent) {
        document.getElementById('statusBar').style.display = 'flex';
        document.getElementById('progressText').textContent = message;
        document.getElementById('progressFill').style.width = `${percent}%`;
        
        // Désactiver les boutons pendant l'opération
        this.setButtonsEnabled(false);
    }

    hideProgress() {
        document.getElementById('statusBar').style.display = 'none';
        this.setButtonsEnabled(true);
    }

    setButtonsEnabled(enabled) {
        const buttons = document.querySelectorAll('button:not(#cancelOperation)');
        buttons.forEach(btn => {
            btn.disabled = !enabled;
        });
    }

    showMessage(message, type = 'info') {
        // Utiliser les notifications du navigateur
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'AnalyLit Connector',
            message: message
        });
        
        console.log(`[${type.toUpperCase()}] ${message}`);
    }

    async showConfirmDialog(title, message) {
        return new Promise((resolve) => {
            document.getElementById('overlayTitle').textContent = title;
            document.getElementById('overlayMessage').textContent = message;
            document.getElementById('overlayIcon').textContent = '❓';
            document.getElementById('overlay').style.display = 'flex';
            
            this.confirmResolve = resolve;
        });
    }

    hideOverlay() {
        document.getElementById('overlay').style.display = 'none';
        if (this.confirmResolve) {
            this.confirmResolve(false);
            this.confirmResolve = null;
        }
    }

    handleOverlayConfirm() {
        document.getElementById('overlay').style.display = 'none';
        if (this.confirmResolve) {
            this.confirmResolve(true);
            this.confirmResolve = null;
        }
    }

    cancelCurrentOperation() {
        if (this.currentOperation) {
            this.currentOperation.abort();
            this.currentOperation = null;
        }
        this.hideProgress();
        this.showMessage('Opération annulée', 'info');
    }

    openAnalyLit() {
        if (this.config.serverUrl) {
            chrome.tabs.create({ url: this.config.serverUrl });
        }
    }

    showHelp() {
        chrome.tabs.create({ 
            url: 'https://github.com/analylit/extension-help' 
        });
    }

    addToSyncHistory(action, type, count) {
        const historyList = document.getElementById('syncHistoryList');
        const timestamp = new Date().toLocaleString('fr-FR');
        
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.innerHTML = `
            <div class="history-main">
                <span class="history-action">${action === 'import' ? '📥' : '📤'} ${this.getActionText(action, type)}</span>
                <span class="history-count">${count} éléments</span>
            </div>
            <div class="history-time">${timestamp}</div>
        `;
        
        // Supprimer le message vide
        const emptyState = historyList.querySelector('.empty-state');
        if (emptyState) emptyState.remove();
        
        historyList.insertBefore(historyItem, historyList.firstChild);
        
        // Garder seulement les 5 derniers
        while (historyList.children.length > 5) {
            historyList.removeChild(historyList.lastChild);
        }
    }

    getActionText(action, type) {
        const actions = {
            'import': {
                'collection': 'Import collection',
                'selected': 'Import sélection',
                'library': 'Import bibliothèque'
            },
            'export': {
                'results': 'Export résultats',
                'bibliography': 'Export bibliographie'
            }
        };
        
        return actions[action]?.[type] || `${action} ${type}`;
    }

    async loadSyncHistory() {
        try {
            const result = await chrome.storage.local.get(['sync_history']);
            const history = result.sync_history || [];
            
            const historyList = document.getElementById('syncHistoryList');
            
            if (history.length === 0) {
                historyList.innerHTML = '<p class="empty-state">Aucune synchronisation récente</p>';
                return;
            }
            
            historyList.innerHTML = '';
            history.slice(0, 5).forEach(item => {
                const historyElement = document.createElement('div');
                historyElement.className = 'history-item';
                historyElement.innerHTML = `
                    <div class="history-main">
                        <span class="history-action">${item.action === 'import' ? '📥' : '📤'} ${item.description}</span>
                        <span class="history-count">${item.count} éléments</span>
                    </div>
                    <div class="history-time">${new Date(item.timestamp).toLocaleString('fr-FR')}</div>
                `;
                historyList.appendChild(historyElement);
            });
        } catch (error) {
            console.error('Erreur lors du chargement de l\'historique:', error);
        }
    }
}

// Initialiser l'extension quand le DOM est chargé
document.addEventListener('DOMContentLoaded', () => {
    new AnalyLitConnector();
});