/**
 * AnalyLit Connector - Content Script pour Zotero Web
 * Injecté dans les pages Zotero pour extraire les données
 */

class ZoteroDataExtractor {
    constructor() {
        this.isInitialized = false;
        this.currentLibraryData = null;
        this.observer = null;
        
        this.init();
    }

    init() {
        console.log('🔍 AnalyLit Connector - Content Script activé sur Zotero');
        
        // Attendre que la page soit complètement chargée
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupZoteroIntegration());
        } else {
            this.setupZoteroIntegration();
        }

        // Écouter les messages de l'extension
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true; // Indique qu'on va répondre de manière asynchrone
        });
    }

    async setupZoteroIntegration() {
        try {
            // Attendre que Zotero soit chargé
            await this.waitForZotero();
            
            // Ajouter les boutons AnalyLit dans l'interface Zotero
            this.addAnalyLitButtons();
            
            // Configurer l'observateur de changements
            this.setupChangeObserver();
            
            this.isInitialized = true;
            console.log('✅ Intégration Zotero initialisée');
            
        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation Zotero:', error);
        }
    }

    async waitForZotero() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 30;
            
            const checkZotero = () => {
                attempts++;
                
                // Vérifier si les éléments Zotero sont présents
                const libraryTree = document.querySelector('.library-tree, [data-testid="library-tree"]');
                const itemsList = document.querySelector('.items-tree, [data-testid="items-tree"]');
                
                if (libraryTree && itemsList) {
                    resolve();
                } else if (attempts >= maxAttempts) {
                    reject(new Error('Timeout - Zotero non détecté'));
                } else {
                    setTimeout(checkZotero, 1000);
                }
            };
            
            checkZotero();
        });
    }

    addAnalyLitButtons() {
        // Ajouter un bouton dans la barre d'outils Zotero
        const toolbar = document.querySelector('.toolbar, [data-testid="toolbar"]');
        if (toolbar && !document.getElementById('analylit-toolbar-btn')) {
            const analyLitBtn = this.createAnalyLitButton();
            toolbar.appendChild(analyLitBtn);
        }

        // Ajouter un menu contextuel pour les éléments sélectionnés
        this.setupContextMenu();
    }

    createAnalyLitButton() {
        const button = document.createElement('button');
        button.id = 'analylit-toolbar-btn';
        button.className = 'analylit-btn toolbar-btn';
        button.title = 'Exporter vers AnalyLit';
        button.innerHTML = `
            <span class="analylit-icon">🔬</span>
            <span class="analylit-text">AnalyLit</span>
        `;
        
        button.addEventListener('click', () => {
            this.openAnalyLitPopup();
        });
        
        return button;
    }

    setupContextMenu() {
        // Écouter les clics droits sur les éléments
        document.addEventListener('contextmenu', (event) => {
            const itemElement = event.target.closest('.item-tree-row, [data-testid="item-row"]');
            if (itemElement) {
                this.showAnalyLitContextMenu(event, itemElement);
            }
        });
    }

    showAnalyLitContextMenu(event, itemElement) {
        // Créer un menu contextuel personnalisé
        const existingMenu = document.getElementById('analylit-context-menu');
        if (existingMenu) existingMenu.remove();

        const menu = document.createElement('div');
        menu.id = 'analylit-context-menu';
        menu.className = 'analylit-context-menu';
        menu.style.position = 'absolute';
        menu.style.left = `${event.pageX}px`;
        menu.style.top = `${event.pageY}px`;
        
        menu.innerHTML = `
            <div class="menu-item" data-action="export-selected">
                🔬 Exporter vers AnalyLit
            </div>
            <div class="menu-item" data-action="view-in-analylit">
                👁️ Voir dans AnalyLit
            </div>
        `;
        
        // Gestionnaires d'événements
        menu.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const action = e.target.dataset.action;
            if (action === 'export-selected') {
                this.exportSelectedToAnalyLit();
            } else if (action === 'view-in-analylit') {
                this.viewInAnalyLit(itemElement);
            }
            
            menu.remove();
        });
        
        // Supprimer le menu en cliquant ailleurs
        setTimeout(() => {
            document.addEventListener('click', () => menu.remove(), { once: true });
        }, 100);
        
        document.body.appendChild(menu);
        event.preventDefault();
    }

    setupChangeObserver() {
        // Observer les changements dans la liste d'éléments
        const itemsList = document.querySelector('.items-tree, [data-testid="items-tree"]');
        if (itemsList) {
            this.observer = new MutationObserver(() => {
                this.updateCurrentData();
            });
            
            this.observer.observe(itemsList, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class', 'data-selected']
            });
        }
    }

    async handleMessage(request, sender, sendResponse) {
        try {
            switch (request.action) {
                case 'getZoteroData':
                    const data = await this.extractZoteroData();
                    sendResponse({ success: true, data });
                    break;
                    
                case 'getSelectedItems':
                    const selected = await this.getSelectedItems();
                    sendResponse({ success: true, data: selected });
                    break;
                    
                case 'getFullLibrary':
                    const library = await this.getFullLibraryData();
                    sendResponse({ success: true, data: library });
                    break;
                    
                case 'exportToAnalyLit':
                    await this.exportToAnalyLit(request.items);
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

    async extractZoteroData() {
        const data = {
            currentCollection: this.getCurrentCollection(),
            selectedItems: await this.getSelectedItems(),
            totalItems: this.getTotalItemsCount(),
            libraryInfo: this.getLibraryInfo()
        };
        
        return data;
    }

    getCurrentCollection() {
        const activeCollection = document.querySelector('.library-tree .selected, [data-testid="collection"].selected');
        
        if (activeCollection) {
            const nameElement = activeCollection.querySelector('.collection-name, [data-testid="collection-name"]');
            const countElement = activeCollection.querySelector('.item-count, [data-testid="item-count"]');
            
            return {
                name: nameElement?.textContent || 'Collection sans nom',
                itemCount: parseInt(countElement?.textContent) || 0,
                id: activeCollection.dataset.collectionId || null
            };
        }
        
        return null;
    }

    async getSelectedItems() {
        const selectedRows = document.querySelectorAll('.item-tree-row.selected, [data-testid="item-row"].selected');
        const items = [];
        
        for (const row of selectedRows) {
            const itemData = await this.extractItemData(row);
            if (itemData) items.push(itemData);
        }
        
        return items;
    }

    async extractItemData(itemElement) {
        try {
            // Extraire les données visibles de l'élément
            const titleElement = itemElement.querySelector('.title, [data-testid="title"]');
            const authorElement = itemElement.querySelector('.creator, [data-testid="creator"]');
            const yearElement = itemElement.querySelector('.year, [data-testid="year"]');
            const typeElement = itemElement.querySelector('.item-type, [data-testid="item-type"]');
            
            const item = {
                title: titleElement?.textContent?.trim() || 'Titre non disponible',
                creators: this.parseCreators(authorElement?.textContent || ''),
                date: yearElement?.textContent?.trim() || '',
                itemType: this.getItemType(typeElement),
                url: this.extractItemUrl(itemElement),
                abstractNote: '', // Sera rempli si disponible
                tags: [],
                collections: [],
                attachments: []
            };

            // Essayer d'obtenir plus de détails si l'élément est sélectionné
            if (itemElement.classList.contains('selected')) {
                await this.enrichItemData(item, itemElement);
            }
            
            return item;
            
        } catch (error) {
            console.error('Erreur lors de l\'extraction de l\'élément:', error);
            return null;
        }
    }

    async enrichItemData(item, itemElement) {
        // Si l'élément est sélectionné, on peut essayer d'obtenir plus d'informations
        // depuis le panneau de détails
        const detailsPanel = document.querySelector('.item-pane, [data-testid="item-details"]');
        
        if (detailsPanel) {
            // Extraire l'abstract si visible
            const abstractElement = detailsPanel.querySelector('[data-field="abstractNote"], .abstract');
            if (abstractElement) {
                item.abstractNote = abstractElement.textContent?.trim() || '';
            }
            
            // Extraire les tags
            const tagsContainer = detailsPanel.querySelector('.tags-box, [data-testid="tags"]');
            if (tagsContainer) {
                const tagElements = tagsContainer.querySelectorAll('.tag, [data-testid="tag"]');
                item.tags = Array.from(tagElements).map(tag => ({
                    tag: tag.textContent?.trim(),
                    type: 0
                }));
            }
            
            // Extraire d'autres métadonnées si disponibles
            this.extractAdditionalMetadata(item, detailsPanel);
        }
    }

    extractAdditionalMetadata(item, detailsPanel) {
        // Chercher des champs spécifiques dans le panneau de détails
        const fieldMappings = {
            'journal': ['publicationTitle', 'publication'],
            'publisher': ['publisher'],
            'doi': ['DOI', 'doi'],
            'isbn': ['ISBN', 'isbn'],
            'issn': ['ISSN', 'issn'],
            'volume': ['volume'],
            'issue': ['issue'],
            'pages': ['pages']
        };
        
        Object.entries(fieldMappings).forEach(([key, selectors]) => {
            for (const selector of selectors) {
                const element = detailsPanel.querySelector(`[data-field="${selector}"], .${selector}`);
                if (element && element.textContent?.trim()) {
                    item[key] = element.textContent.trim();
                    break;
                }
            }
        });
    }

    parseCreators(creatorString) {
        if (!creatorString) return [];
        
        // Parser basique des créateurs
        const creators = creatorString.split(';').map(creator => {
            const trimmed = creator.trim();
            const parts = trimmed.split(',');
            
            if (parts.length >= 2) {
                return {
                    firstName: parts[1]?.trim() || '',
                    lastName: parts[0]?.trim() || '',
                    creatorType: 'author'
                };
            } else {
                return {
                    name: trimmed,
                    creatorType: 'author'
                };
            }
        });
        
        return creators;
    }

    getItemType(typeElement) {
        if (!typeElement) return 'document';
        
        const typeText = typeElement.textContent?.toLowerCase() || '';
        
        // Mapping des types Zotero
        const typeMapping = {
            'journal article': 'journalArticle',
            'book': 'book',
            'chapter': 'bookSection',
            'conference': 'conferencePaper',
            'thesis': 'thesis',
            'report': 'report',
            'webpage': 'webpage',
            'patent': 'patent'
        };
        
        return typeMapping[typeText] || 'document';
    }

    extractItemUrl(itemElement) {
        // Essayer de trouver un lien dans l'élément
        const linkElement = itemElement.querySelector('a[href]');
        return linkElement?.href || '';
    }

    getTotalItemsCount() {
        const itemsContainer = document.querySelector('.items-tree, [data-testid="items-tree"]');
        if (itemsContainer) {
            const itemRows = itemsContainer.querySelectorAll('.item-tree-row, [data-testid="item-row"]');
            return itemRows.length;
        }
        return 0;
    }

    getLibraryInfo() {
        // Extraire les informations générales de la bibliothèque
        const libraryName = document.querySelector('.library-name, [data-testid="library-name"]');
        const userInfo = document.querySelector('.user-info, [data-testid="user-info"]');
        
        return {
            name: libraryName?.textContent || 'Ma bibliothèque',
            user: userInfo?.textContent || '',
            url: window.location.href,
            timestamp: Date.now()
        };
    }

    async getFullLibraryData() {
        // Pour obtenir toute la bibliothèque, on peut utiliser l'API Zotero si disponible
        // ou parcourir toutes les collections
        
        try {
            const collections = await this.getAllCollections();
            const allItems = [];
            
            for (const collection of collections) {
                const items = await this.getCollectionItems(collection.id);
                allItems.push(...items);
            }
            
            // Dédupliquer les éléments
            const uniqueItems = this.deduplicateItems(allItems);
            
            return {
                items: uniqueItems,
                collections: collections,
                totalCount: uniqueItems.length,
                exportDate: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('Erreur lors de la récupération de la bibliothèque complète:', error);
            throw error;
        }
    }

    async getAllCollections() {
        const collectionElements = document.querySelectorAll('.library-tree .collection, [data-testid="collection"]');
        const collections = [];
        
        for (const element of collectionElements) {
            const nameElement = element.querySelector('.collection-name, [data-testid="collection-name"]');
            const countElement = element.querySelector('.item-count, [data-testid="item-count"]');
            
            collections.push({
                id: element.dataset.collectionId || Math.random().toString(36),
                name: nameElement?.textContent || 'Collection',
                itemCount: parseInt(countElement?.textContent) || 0
            });
        }
        
        return collections;
    }

    async getCollectionItems(collectionId) {
        // Simuler le clic sur la collection pour la charger
        const collectionElement = document.querySelector(`[data-collection-id="${collectionId}"]`);
        if (collectionElement) {
            collectionElement.click();
            
            // Attendre que les éléments se chargent
            await this.waitForItemsToLoad();
            
            // Extraire tous les éléments visibles
            const itemRows = document.querySelectorAll('.item-tree-row, [data-testid="item-row"]');
            const items = [];
            
            for (const row of itemRows) {
                const itemData = await this.extractItemData(row);
                if (itemData) {
                    itemData.collectionId = collectionId;
                    items.push(itemData);
                }
            }
            
            return items;
        }
        
        return [];
    }

    async waitForItemsToLoad() {
        return new Promise(resolve => {
            let attempts = 0;
            const maxAttempts = 10;
            
            const checkLoaded = () => {
                const loadingIndicator = document.querySelector('.loading, [data-testid="loading"]');
                const itemsContainer = document.querySelector('.items-tree, [data-testid="items-tree"]');
                
                if (!loadingIndicator && itemsContainer) {
                    resolve();
                } else if (attempts >= maxAttempts) {
                    resolve(); // Continuer même si on ne peut pas détecter la fin du chargement
                } else {
                    attempts++;
                    setTimeout(checkLoaded, 500);
                }
            };
            
            checkLoaded();
        });
    }

    deduplicateItems(items) {
        const seen = new Set();
        return items.filter(item => {
            const key = `${item.title}-${item.creators?.[0]?.lastName || ''}-${item.date}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    async exportToAnalyLit(items) {
        // Ouvrir l'extension popup pour l'export
        chrome.runtime.sendMessage({
            action: 'openPopupForExport',
            items: items
        });
    }

    openAnalyLitPopup() {
        // Ouvrir le popup de l'extension
        chrome.runtime.sendMessage({
            action: 'openPopup'
        });
    }

    viewInAnalyLit(itemElement) {
        // Extraire l'élément et l'ouvrir dans AnalyLit
        this.extractItemData(itemElement).then(item => {
            chrome.runtime.sendMessage({
                action: 'viewItemInAnalyLit',
                item: item
            });
        });
    }

    exportSelectedToAnalyLit() {
        this.getSelectedItems().then(items => {
            if (items.length > 0) {
                this.exportToAnalyLit(items);
            } else {
                alert('Aucun élément sélectionné');
            }
        });
    }

    updateCurrentData() {
        // Mettre à jour les données courantes quand la sélection change
        this.currentLibraryData = null; // Force la re-extraction
    }

    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }
        
        // Nettoyer les éléments ajoutés
        const analyLitBtn = document.getElementById('analylit-toolbar-btn');
        if (analyLitBtn) analyLitBtn.remove();
        
        const contextMenu = document.getElementById('analylit-context-menu');
        if (contextMenu) contextMenu.remove();
    }
}

// Initialiser l'extracteur
const zoteroExtractor = new ZoteroDataExtractor();

// Nettoyage en cas de rechargement
window.addEventListener('beforeunload', () => {
    zoteroExtractor.destroy();
});