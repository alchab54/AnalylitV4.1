Je constate que vos modifications précédentes n'ont pas été complètement appliquées sur GitHub. Le fichier `app-improved.js` n'a pas la correction de navigation que je vous avais donnée, et les nouveaux fichiers CSS ne sont pas présents. 

Voici les **corrections immédiates et prioritaires** pour rendre votre application complètement opérationnelle pour votre thèse :

## 🚨 CORRECTION IMMÉDIATE - Navigation Cassée

**1. Modifier `web/js/app-improved.js`** - Remplacez les lignes 78-82 :

```javascript
// ANCIEN CODE (lignes 78-82) :
        // Affichage de la section par défaut
        // await showSection('projects');  // ← CETTE LIGNE VIDE TOUT !
        // Laisser app-nav.js gérer l'affichage des sections
        console.log('🎯 Sections gérées par app-nav.js');

// NOUVEAU CODE :
        // Affichage de la section par défaut - CORRECTION CRITIQUE
        try {
            // Forcer l'affichage de la section projets au démarrage
            const projectsSection = document.getElementById('projects');
            const navButtons = document.querySelectorAll('.app-nav__button');
            
            if (projectsSection) {
                projectsSection.style.display = 'block';
                projectsSection.classList.add('active');
            }
            
            // Activer le bouton projets
            navButtons.forEach(btn => {
                if (btn.dataset.sectionId === 'projects') {
                    btn.classList.add('app-nav__button--active');
                }
            });
            
            console.log('🎯 Section projets activée par défaut');
        } catch (error) {
            console.error('Erreur initialisation section:', error);
        }
```

## 🎯 CORRECTIONS PRIORITAIRES POUR THÈSE

**2. Créer `web/css/thesis-essentials.css`** (fichier critique) :

```css
/* ================================
   STYLES ESSENTIELS POUR THÈSE
   ================================ */

/* Navigation forcée - CRITIQUE */
.app-nav {
    position: sticky !important;
    top: 0 !important;
    background: #ffffff !important;
    border-bottom: 2px solid #3b82f6 !important;
    z-index: 1000 !important;
    display: block !important;
    visibility: visible !important;
    min-height: 60px !important;
    width: 100% !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important;
}

.app-nav .container {
    display: flex !important;
    align-items: center !important;
    height: 60px !important;
    gap: 8px !important;
    overflow-x: auto !important;
    padding: 0 16px !important;
}

.app-nav__button {
    display: inline-flex !important;
    align-items: center !important;
    gap: 8px !important;
    padding: 12px 16px !important;
    background: #f3f4f6 !important;
    border: 1px solid #d1d5db !important;
    border-radius: 6px !important;
    font-size: 14px !important;
    font-weight: 600 !important;
    color: #374151 !important;
    cursor: pointer !important;
    min-width: 110px !important;
    white-space: nowrap !important;
    transition: all 0.2s ease !important;
}

.app-nav__button:hover {
    background: #e5e7eb !important;
    transform: translateY(-1px) !important;
}

.app-nav__button--active {
    background: #3b82f6 !important;
    color: #ffffff !important;
    border-color: #2563eb !important;
}

/* Sections visibles */
.app-section {
    display: none;
}

.app-section.active {
    display: block !important;
}

/* Cartes de projets pour thèse */
.project-card {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 20px;
    background: #ffffff;
    margin-bottom: 16px;
    transition: all 0.2s ease;
    cursor: pointer;
}

.project-card:hover {
    border-color: #3b82f6;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    transform: translateY(-2px);
}

.project-card--active {
    border-color: #3b82f6;
    background: #f0f9ff;
}

/* Interface de recherche pour thèse */
.search-form {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 24px;
    margin-bottom: 24px;
}

.search-input-group {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
}

.search-input {
    flex: 1;
    padding: 12px;
    border: 2px solid #e5e7eb;
    border-radius: 6px;
    font-size: 16px;
}

.search-input:focus {
    border-color: #3b82f6;
    outline: none;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Articles pour validation */
.article-card {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 16px;
    background: #ffffff;
    transition: border-color 0.2s ease;
}

.article-card.status-include {
    border-left: 4px solid #10b981;
    background: #f0fdf4;
}

.article-card.status-exclude {
    border-left: 4px solid #ef4444;
    background: #fef2f2;
}

.article-card.status-pending {
    border-left: 4px solid #f59e0b;
    background: #fffbeb;
}

.article-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
}

.btn-include {
    background: #10b981;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
}

.btn-exclude {
    background: #ef4444;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
}

.btn-reset {
    background: #6b7280;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
}

/* Exports pour thèse */
.export-section {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 20px;
    margin: 20px 0;
}

.export-buttons {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
}

.export-btn {
    background: #1e40af;
    color: white;
    border: none;
    padding: 12px 20px;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
}

.export-btn:hover {
    background: #1d4ed8;
    transform: translateY(-1px);
}

/* Statistiques PRISMA */
.prisma-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
}

.stat-card {
    text-align: center;
    padding: 16px;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
}

.stat-number {
    font-size: 24px;
    font-weight: 700;
    color: #1f2937;
    display: block;
}

.stat-label {
    font-size: 12px;
    color: #6b7280;
    text-transform: uppercase;
    font-weight: 600;
}
```

**3. Créer `web/js/thesis-workflow.js`** (gestionnaire de workflow thèse) :

```javascript
// Gestionnaire complet du workflow de thèse
import { fetchAPI } from './api.js';
import { API_ENDPOINTS } from './constants.js';
import { appState } from './app-improved.js';

class ThesisWorkflow {
    constructor() {
        this.currentProject = null;
        this.searchResults = [];
        this.validationStats = { included: 0, excluded: 0, pending: 0 };
        this.init();
    }

    init() {
        this.setupSearchInterface();
        this.setupValidationInterface();
        this.setupExportInterface();
        this.setupPRISMAInterface();
        this.loadCurrentProject();
    }

    async loadCurrentProject() {
        if (appState.currentProject) {
            this.currentProject = appState.currentProject;
            await this.refreshProjectData();
        }
    }

    async refreshProjectData() {
        if (!this.currentProject?.id) return;

        try {
            // Charger articles et validations
            const [articles, extractions] = await Promise.all([
                fetchAPI(API_ENDPOINTS.projectSearchResults(this.currentProject.id)),
                fetchAPI(API_ENDPOINTS.projectExtractions(this.currentProject.id))
            ]);

            this.searchResults = articles.results || [];
            this.updateValidationStats(extractions);
            this.renderValidationStats();

        } catch (error) {
            console.error('Erreur rechargement projet:', error);
        }
    }

    setupSearchInterface() {
        const searchForm = document.getElementById('search-form');
        if (!searchForm) return;

        searchForm.innerHTML = `
            <div class="thesis-search-header">
                <h3>🔍 Recherche Bibliographique</h3>
                <p>Recherchez dans PubMed, CrossRef et d'autres bases pour votre thèse ATN</p>
            </div>
            
            <div class="search-input-group">
                <input 
                    id="thesis-search-query" 
                    type="text" 
                    placeholder="alliance thérapeutique numérique, thérapie digitale, intelligence artificielle santé..."
                    class="search-input"
                    required
                >
                <button type="submit" class="btn-primary search-btn">
                    🔍 Lancer la recherche
                </button>
            </div>

            <div class="search-databases">
                <label class="db-checkbox">
                    <input type="checkbox" name="databases" value="pubmed" checked>
                    <span class="db-name">PubMed</span>
                    <span class="db-desc">Base médicale principale</span>
                </label>
                <label class="db-checkbox">
                    <input type="checkbox" name="databases" value="crossref" checked>
                    <span class="db-name">CrossRef</span>
                    <span class="db-desc">DOI et journaux</span>
                </label>
                <label class="db-checkbox">
                    <input type="checkbox" name="databases" value="semantic_scholar">
                    <span class="db-name">Semantic Scholar</span>
                    <span class="db-desc">IA et recherche</span>
                </label>
            </div>

            <div class="search-options-advanced">
                <label>
                    <input type="number" name="max_results" value="100" min="10" max="500">
                    Résultats max par base
                </label>
            </div>
        `;

        searchForm.addEventListener('submit', (e) => this.handleThesisSearch(e));
    }

    async handleThesisSearch(e) {
        e.preventDefault();
        
        if (!this.currentProject?.id) {
            alert('Sélectionnez d\'abord un projet');
            return;
        }

        const form = e.target;
        const query = form.querySelector('#thesis-search-query').value.trim();
        const databases = Array.from(form.querySelectorAll('input[name="databases"]:checked')).map(cb => cb.value);
        const maxResults = parseInt(form.querySelector('input[name="max_results"]').value);

        if (!query) {
            alert('Saisissez une requête de recherche');
            return;
        }

        if (databases.length === 0) {
            alert('Sélectionnez au moins une base de données');
            return;
        }

        try {
            this.showSearchProgress('Lancement de la recherche...');

            const response = await fetchAPI(API_ENDPOINTS.search, {
                method: 'POST',
                body: {
                    project_id: this.currentProject.id,
                    query: query,
                    databases: databases,
                    max_results_per_db: maxResults
                }
            });

            if (response.task_id) {
                this.showSearchProgress('Recherche en cours... Vérification des résultats...');
                this.pollSearchResults(response.task_id);
            }

        } catch (error) {
            console.error('Erreur recherche thèse:', error);
            this.showSearchProgress(`Erreur: ${error.message}`, true);
        }
    }

    showSearchProgress(message, isError = false) {
        const container = document.getElementById('search-results') || document.getElementById('searchContainer');
        if (container) {
            container.innerHTML = `
                <div class="search-status ${isError ? 'error' : 'loading'}">
                    ${isError ? '❌' : '⏳'} ${message}
                </div>
            `;
        }
    }

    async pollSearchResults(taskId) {
        let attempts = 0;
        const maxAttempts = 30;

        const poll = async () => {
            try {
                // Recharger les résultats du projet
                await this.refreshProjectData();
                
                if (this.searchResults.length > 0 || attempts > maxAttempts) {
                    this.displaySearchResults();
                } else {
                    attempts++;
                    setTimeout(poll, 2000);
                }
            } catch (error) {
                console.error('Erreur polling:', error);
                this.showSearchProgress(`Erreur polling: ${error.message}`, true);
            }
        };

        poll();
    }

    displaySearchResults() {
        const container = document.getElementById('search-results') || document.getElementById('searchContainer');
        if (!container) return;

        if (this.searchResults.length === 0) {
            container.innerHTML = `
                <div class="no-results">
                    <h3>Aucun résultat trouvé</h3>
                    <p>Essayez avec d'autres mots-clés ou élargissez votre recherche</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="search-results-header">
                <h3>${this.searchResults.length} articles trouvés</h3>
                <button class="btn-export-results" onclick="window.thesisWorkflow.exportSearchResults()">
                    📊 Exporter résultats
                </button>
            </div>
            <div class="search-results-list">
                ${this.searchResults.map(article => this.renderSearchResultItem(article)).join('')}
            </div>
        `;
    }

    renderSearchResultItem(article) {
        return `
            <div class="search-result-item" data-id="${article.id}">
                <div class="result-header">
                    <h4 class="result-title">${article.title || 'Titre non disponible'}</h4>
                    <div class="result-source">${article.database_source || 'Source inconnue'}</div>
                </div>
                <div class="result-meta">
                    <span class="authors">${article.authors || 'Auteurs non spécifiés'}</span>
                    ${article.publication_date ? `<span class="year">(${new Date(article.publication_date).getFullYear()})</span>` : ''}
                    ${article.journal ? `<span class="journal">${article.journal}</span>` : ''}
                </div>
                ${article.abstract ? `<p class="result-abstract">${article.abstract.substring(0, 200)}...</p>` : ''}
                <div class="result-actions">
                    <button onclick="window.thesisWorkflow.addToValidation('${article.article_id}')" 
                            class="btn-add-validation">
                        ✅ Ajouter à la validation
                    </button>
                    ${article.doi ? `<a href="https://doi.org/${article.doi}" target="_blank" class="btn-view-doi">DOI</a>` : ''}
                </div>
            </div>
        `;
    }

    setupValidationInterface() {
        const validationContainer = document.getElementById('validationContainer');
        if (!validationContainer) return;

        validationContainer.innerHTML = `
            <div class="thesis-validation-header">
                <h3>✅ Validation Inter-Évaluateurs</h3>
                <div class="validation-controls">
                    <button onclick="window.thesisWorkflow.calculateKappa()" class="btn-calculate-kappa">
                        📊 Calculer Kappa Cohen
                    </button>
                    <button onclick="window.thesisWorkflow.exportValidations()" class="btn-export-validations">
                        📤 Exporter validations
                    </button>
                </div>
            </div>

            <div id="validation-stats" class="validation-stats">
                <!-- Stats injectées dynamiquement -->
            </div>

            <div class="validation-filters">
                <button class="filter-btn active" data-filter="all">Tous</button>
                <button class="filter-btn" data-filter="include">Inclus</button>
                <button class="filter-btn" data-filter="exclude">Exclus</button>
                <button class="filter-btn" data-filter="pending">En attente</button>
            </div>

            <div id="validation-list" class="validation-list">
                <!-- Articles à valider -->
            </div>
        `;

        // Event listeners pour les filtres
        validationContainer.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                validationContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.filterValidationList(e.target.dataset.filter);
            });
        });
    }

    async loadValidationArticles() {
        if (!this.currentProject?.id) return;

        try {
            const extractions = await fetchAPI(API_ENDPOINTS.projectExtractions(this.currentProject.id));
            this.renderValidationList(extractions);
        } catch (error) {
            console.error('Erreur chargement validations:', error);
        }
    }

    renderValidationList(extractions) {
        const container = document.getElementById('validation-list');
        if (!container) return;

        if (extractions.length === 0) {
            container.innerHTML = `
                <div class="no-validations">
                    <h3>Aucun article à valider</h3>
                    <p>Lancez d'abord une recherche pour avoir des articles à valider</p>
                </div>
            `;
            return;
        }

        container.innerHTML = extractions.map(extraction => `
            <div class="validation-item status-${extraction.user_validation_status || 'pending'}" 
                 data-status="${extraction.user_validation_status || 'pending'}"
                 data-id="${extraction.id}">
                <div class="validation-header">
                    <h4>${extraction.title || 'Titre non disponible'}</h4>
                    <div class="ai-score">Score IA: ${(extraction.relevance_score * 10).toFixed(1)}/10</div>
                </div>
                
                <div class="validation-content">
                    <p class="ai-justification">
                        <strong>Justification IA :</strong> ${extraction.relevance_justification || 'Aucune justification'}
                    </p>
                    
                    <div class="validation-actions">
                        <button onclick="window.thesisWorkflow.validateArticle('${extraction.id}', 'include')" 
                                class="btn-include ${extraction.user_validation_status === 'include' ? 'active' : ''}">
                            ✅ Inclure
                        </button>
                        <button onclick="window.thesisWorkflow.validateArticle('${extraction.id}', 'exclude')" 
                                class="btn-exclude ${extraction.user_validation_status === 'exclude' ? 'active' : ''}">
                            ❌ Exclure
                        </button>
                        <button onclick="window.thesisWorkflow.validateArticle('${extraction.id}', '')" 
                                class="btn-reset ${!extraction.user_validation_status ? 'active' : ''}">
                            ↺ Réinitialiser
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async validateArticle(extractionId, decision) {
        try {
            await fetchAPI(API_ENDPOINTS.projectExtractionDecision(this.currentProject.id, extractionId), {
                method: 'PUT',
                body: {
                    decision: decision,
                    evaluator: 'evaluator1' // Adaptez selon vos besoins
                }
            });

            // Recharger les validations
            this.loadValidationArticles();
            this.refreshProjectData();

        } catch (error) {
            console.error('Erreur validation:', error);
            alert(`Erreur: ${error.message}`);
        }
    }

    updateValidationStats(extractions) {
        this.validationStats = {
            included: extractions.filter(e => e.user_validation_status === 'include').length,
            excluded: extractions.filter(e => e.user_validation_status === 'exclude').length,
            pending: extractions.filter(e => !e.user_validation_status).length,
            total: extractions.length
        };
    }

    renderValidationStats() {
        const container = document.getElementById('validation-stats');
        if (!container) return;

        const stats = this.validationStats;
        container.innerHTML = `
            <div class="prisma-stats">
                <div class="stat-card stat-total">
                    <span class="stat-number">${stats.total}</span>
                    <span class="stat-label">Total Articles</span>
                </div>
                <div class="stat-card stat-included">
                    <span class="stat-number">${stats.included}</span>
                    <span class="stat-label">Inclus</span>
                </div>
                <div class="stat-card stat-excluded">
                    <span class="stat-number">${stats.excluded}</span>
                    <span class="stat-label">Exclus</span>
                </div>
                <div class="stat-card stat-pending">
                    <span class="stat-number">${stats.pending}</span>
                    <span class="stat-label">En attente</span>
                </div>
                <div class="stat-card stat-progress">
                    <span class="stat-number">${stats.total > 0 ? Math.round(((stats.included + stats.excluded) / stats.total) * 100) : 0}%</span>
                    <span class="stat-label">Progression</span>
                </div>
            </div>
        `;
    }

    setupExportInterface() {
        const analysesContainer = document.getElementById('analysisContainer');
        if (!analysesContainer) return;

        // Ajouter section d'export en bas du container d'analyses
        const exportSection = document.createElement('div');
        exportSection.className = 'export-section';
        exportSection.innerHTML = `
            <h3>📊 Exports pour Thèse</h3>
            <p>Générez tous les éléments nécessaires pour votre manuscrit de thèse</p>
            
            <div class="export-buttons">
                <button onclick="window.thesisWorkflow.exportPRISMAFlow()" class="export-btn">
                    📋 Diagramme PRISMA
                </button>
                <button onclick="window.thesisWorkflow.exportDataTable()" class="export-btn">
                    📊 Tableau de données
                </button>
                <button onclick="window.thesisWorkflow.exportBibliography()" class="export-btn">
                    📚 Bibliographie
                </button>
                <button onclick="window.thesisWorkflow.exportCompleteThesis()" class="export-btn">
                    📄 Export complet thèse
                </button>
                <button onclick="window.thesisWorkflow.generateThesisReport()" class="export-btn">
                    🎯 Rapport de thèse
                </button>
            </div>
        `;

        analysesContainer.appendChild(exportSection);
    }

    setupPRISMAInterface() {
        const prismaModal = document.getElementById('prismaModal');
        if (!prismaModal) return;

        const prismaContent = prismaModal.querySelector('#prisma-checklist-content');
        if (prismaContent) {
            prismaContent.innerHTML = this.generatePRISMAChecklist();
        }
    }

    generatePRISMAChecklist() {
        const prismaItems = [
            { id: 'title', text: 'Titre identifie le rapport comme scoping review' },
            { id: 'abstract', text: 'Résumé structuré fourni' },
            { id: 'rationale', text: 'Rationale décrite' },
            { id: 'objectives', text: 'Objectifs fournis' },
            { id: 'protocol', text: 'Indication si protocole publié' },
            { id: 'eligibility', text: 'Critères d\'éligibilité spécifiés' },
            { id: 'sources', text: 'Sources d\'information décrites' },
            { id: 'search', text: 'Stratégie de recherche présentée' },
            { id: 'selection', text: 'Processus de sélection décrit' },
            { id: 'extraction', text: 'Processus d\'extraction décrit' },
            { id: 'data_items', text: 'Éléments de données listés' },
            { id: 'synthesis', text: 'Méthodes de synthèse décrites' },
            { id: 'results_selection', text: 'Résultats de sélection présentés' },
            { id: 'results_characteristics', text: 'Caractéristiques des sources présentées' },
            { id: 'results_findings', text: 'Résultats critiques présentés' },
            { id: 'discussion', text: 'Résumé des preuves fourni' },
            { id: 'limitations', text: 'Limitations discutées' },
            { id: 'conclusions', text: 'Conclusions générales fournies' },
            { id: 'funding', text: 'Sources de financement rapportées' }
        ];

        return prismaItems.map(item => `
            <div class="prisma-item" data-item-id="${item.id}">
                <label class="prisma-label">
                    <input type="checkbox" class="prisma-checkbox" data-item-id="${item.id}">
                    <span class="prisma-text">${item.text}</span>
                </label>
                <textarea class="prisma-notes" placeholder="Notes et détails pour cet élément..."></textarea>
            </div>
        `).join('');
    }

    // NOUVELLES FONCTIONS D'EXPORT POUR THÈSE

    async exportPRISMAFlow() {
        try {
            const response = await fetchAPI(API_ENDPOINTS.projectRunAnalysis(this.currentProject.id), {
                method: 'POST',
                body: { type: 'prisma_flow' }
            });
            
            alert(`Génération du diagramme PRISMA lancée (Task: ${response.task_id})`);
        } catch (error) {
            alert(`Erreur: ${error.message}`);
        }
    }

    async exportDataTable() {
        try {
            const extractions = await fetchAPI(API_ENDPOINTS.projectExtractions(this.currentProject.id));
            const includedArticles = extractions.filter(e => e.user_validation_status === 'include');
            
            if (includedArticles.length === 0) {
                alert('Aucun article inclus à exporter');
                return;
            }

            // Générer CSV
            const csv = this.generateCSV(includedArticles);
            this.downloadFile(csv, `tableau_donnees_${this.currentProject.name}.csv`, 'text/csv');
            
        } catch (error) {
            alert(`Erreur export: ${error.message}`);
        }
    }

    async exportBibliography() {
        try {
            const extractions = await fetchAPI(API_ENDPOINTS.projectExtractions(this.currentProject.id));
            const includedArticles = extractions.filter(e => e.user_validation_status === 'include');
            
            const bibliography = this.generateBibliography(includedArticles);
            this.downloadFile(bibliography, `bibliographie_${this.currentProject.name}.txt`, 'text/plain');
            
        } catch (error) {
            alert(`Erreur bibliographie: ${error.message}`);
        }
    }

    async exportCompleteThesis() {
        try {
            const url = API_ENDPOINTS.projectExportThesis(this.currentProject.id);
            window.open(url, '_blank');
        } catch (error) {
            alert(`Erreur export complet: ${error.message}`);
        }
    }

    async calculateKappa() {
        try {
            const response = await fetchAPI(API_ENDPOINTS.projectCalculateKappa(this.currentProject.id), {
                method: 'POST'
            });
            
            alert(`Calcul Kappa Cohen lancé (Task: ${response.task_id})`);
        } catch (error) {
            alert(`Erreur calcul Kappa: ${error.message}`);
        }
    }

    generateCSV(articles) {
        const headers = ['Titre', 'Auteurs', 'Année', 'Journal', 'DOI', 'Score_Relevance', 'Statut'];
        const rows = articles.map(article => [
            `"${(article.title || '').replace(/"/g, '""')}"`,
            `"${(article.authors || '').replace(/"/g, '""')}"`,
            article.publication_date ? new Date(article.publication_date).getFullYear() : '',
            `"${(article.journal || '').replace(/"/g, '""')}"`,
            article.doi || '',
            article.relevance_score || '',
            article.user_validation_status || 'pending'
        ]);

        return headers.join(',') + '\n' + rows.map(row => row.join(',')).join('\n');
    }

    generateBibliography(articles) {
        return articles.map((article, index) => {
            const year = article.publication_date ? new Date(article.publication_date).getFullYear() : 'n.d.';
            const authors = article.authors || 'Auteur inconnu';
            const title = article.title || 'Titre non disponible';
            const journal = article.journal || 'Journal non spécifié';
            
            return `${index + 1}. ${authors}. (${year}). ${title}. ${journal}.`;
        }).join('\n\n');
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    filterValidationList(filter) {
        const items = document.querySelectorAll('.validation-item');
        items.forEach(item => {
            const status = item.dataset.status;
            if (filter === 'all' || status === filter) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    }

    async generateThesisReport() {
        try {
            const stats = this.validationStats;
            const reportContent = `
# Rapport de Thèse - ${this.currentProject.name}

## Statistiques de Sélection

- **Total d'articles identifiés :** ${stats.total}
- **Articles inclus :** ${stats.included}
- **Articles exclus :** ${stats.excluded}
- **Articles en attente :** ${stats.pending}
- **Taux de progression :** ${stats.total > 0 ? Math.round(((stats.included + stats.excluded) / stats.total) * 100) : 0}%

## Méthodologie

Cette scoping review a été réalisée selon les guidelines PRISMA-ScR et JBI.

## Prochaines Étapes

1. Finaliser la validation des ${stats.pending} articles en attente
2. Lancer l'analyse ATN multipartite sur les ${stats.included} articles inclus
3. Générer le diagramme PRISMA final
4. Rédiger la section Discussion

---
Généré automatiquement par AnalyLit v4.1
Date: ${new Date().toLocaleDateString('fr-FR')}
            `;

            this.downloadFile(reportContent, `rapport_these_${this.currentProject.name}.md`, 'text/markdown');
        } catch (error) {
            alert(`Erreur génération rapport: ${error.message}`);
        }
    }
}

// Initialiser le workflow de thèse
document.addEventListener('DOMContentLoaded', () => {
    window.thesisWorkflow = new ThesisWorkflow();
});

export default ThesisWorkflow;
```

## Instructions d'Application Immédiate

**1. Appliquer la correction dans `web/js/app-improved.js`** (remplacer les lignes 78-82)

**2. Créer le fichier `web/css/thesis-essentials.css`** avec le CSS fourni

**3. Créer le fichier `web/js/thesis-workflow.js`** avec le JavaScript fourni

**4. Modifier `web/index.html`** - Ajouter dans `<head>` :
```html
<link rel="stylesheet" href="css/thesis-essentials.css">
```

Et avant `</body>` :
```html
<script type="module" src="js/thesis-workflow.js"></script>
```

**5. Modifier la section Recherche dans `web/index.html`** :
```html
<section id="search" class="app-section" style="display: none;">
    <div id="searchContainer">
        <form id="search-form">
            <!-- Contenu injecté par thesis-workflow.js -->
        </form>
        <div id="search-results"></div>
    </div>
</section>
```

## Résultat Attendu

Après ces corrections :
- ✅ **Navigation visible et fonctionnelle**
- ✅ **Recherche opérationnelle** avec interface thèse
- ✅ **Validation inter-évaluateurs** avec statistiques PRISMA
- ✅ **Exports automatisés** (CSV, bibliographie, rapport complet)
- ✅ **Interface optimisée** pour workflow de thèse

L'application sera immédiatement utilisable pour collecter, valider et exporter vos données de thèse ATN selon les standards PRISMA-ScR.
