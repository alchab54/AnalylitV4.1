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

        searchForm.innerHTML = "
            <div class=\"thesis-search-header\">
                <h3>🔍 Recherche Bibliographique</h3>
                <p>Recherchez dans PubMed, CrossRef et d'autres bases pour votre thèse ATN</p>
            </div>
            
            <div class=\"search-input-group\">
                <input 
                    id=\"thesis-search-query\" 
                    type=\"text\" 
                    placeholder=\"alliance thérapeutique numérique, thérapie digitale, intelligence artificielle santé...\"
                    class=\"search-input\"
                    required
                >
                <button type=\"submit\" class=\"btn-primary search-btn\">
                    🔍 Lancer la recherche
                </button>
            </div>

            <div class=\"search-databases\">
                <label class=\"db-checkbox\">
                    <input type=\"checkbox\" name=\"databases\" value=\"pubmed\" checked>
                    <span class=\"db-name\">PubMed</span>
                    <span class=\"db-desc\">Base médicale principale</span>
                </label>
                <label class=\"db-checkbox\">
                    <input type=\"checkbox\" name=\"databases\" value=\"crossref\" checked>
                    <span class=\"db-name\">CrossRef</span>
                    <span class=\"db-desc\">DOI et journaux</span>
                </label>
                <label class=\"db-checkbox\">
                    <input type=\"checkbox\" name=\"databases\" value=\"semantic_scholar">
                    <span class=\"db-name\">Semantic Scholar</span>
                    <span class=\"db-desc\">IA et recherche</span>
                </label>
            </div>

            <div class=\"search-options-advanced\">
                <label>
                    <input type=\"number\" name=\"max_results\" value=\"100\" min=\"10\" max=\"500">
                    Résultats max par base
                </label>
            </div>
        ";

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
            container.innerHTML = " 
                <div class=\"search-status ${""} ${isError ? 'error' : 'loading'} ${""}">
                    ${""} ${isError ? '❌' : '⏳'} ${message}
                </div>
            ";
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
            container.innerHTML = "
                <div class=\"no-results\">
                    <h3>Aucun résultat trouvé</h3>
                    <p>Essayez avec d'autres mots-clés ou élargissez votre recherche</p>
                </div>
            ";
            return;
        }

        container.innerHTML = "
            <div class=\"search-results-header\">
                <h3>${this.searchResults.length} articles trouvés</h3>
                <button class=\"btn-export-results\" onclick=\"window.thesisWorkflow.exportSearchResults()\">
                    📊 Exporter résultats
                </button>
            </div>
            <div class=\"search-results-list\">
                ${this.searchResults.map(article => this.renderSearchResultItem(article)).join('')}
            </div>
        ";
    }

    renderSearchResultItem(article) {
        return "
            <div class=\"search-result-item\" data-id="${article.id}">
                <div class=\"result-header\">
                    <h4 class=\"result-title">${article.title || 'Titre non disponible'}</h4>
                    <div class=\"result-source">${article.database_source || 'Source inconnue'}</div>
                </div>
                <div class=\"result-meta\">
                    <span class=\"authors">${article.authors || 'Auteurs non spécifiés'}</span>
                    ${article.publication_date ? `<span class=\"year\">(${new Date(article.publication_date).getFullYear()})</span>` : ''}
                    ${article.journal ? `<span class=\"journal\">${article.journal}</span>` : ''}
                </div>
                ${article.abstract ? `<p class=\"result-abstract\">${article.abstract.substring(0, 200)}...</p>` : ''}
                <div class=\"result-actions\">
                    <button onclick=\"window.thesisWorkflow.addToValidation('${article.article_id}')" 
                            class=\"btn-add-validation\">
                        ✅ Ajouter à la validation
                    </button>
                    ${article.doi ? `<a href=\"https://doi.org/${article.doi}\" target=\"_blank\" class=\"btn-view-doi\">DOI</a>` : ''}
                </div>
            </div>
        ";
    }

    setupValidationInterface() {
        const validationContainer = document.getElementById('validationContainer');
        if (!validationContainer) return;

        validationContainer.innerHTML = "
            <div class=\"thesis-validation-header\">
                <h3>✅ Validation Inter-Évaluateurs</h3>
                <div class=\"validation-controls\">
                    <button onclick=\"window.thesisWorkflow.calculateKappa()\" class=\"btn-calculate-kappa\">
                        📊 Calculer Kappa Cohen
                    </button>
                    <button onclick=\"window.thesisWorkflow.exportValidations()\" class=\"btn-export-validations\">
                        📤 Exporter validations
                    </button>
                </div>
            </div>

            <div id=\"validation-stats\" class=\"validation-stats\">
                <!-- Stats injectées dynamiquement -->
            </div>

            <div class=\"validation-filters\">
                <button class=\"filter-btn active\" data-filter=\"all\">Tous</button>
                <button class=\"filter-btn\" data-filter=\"include\">Inclus</button>
                <button class=\"filter-btn\" data-filter=\"exclude\">Exclus</button>
                <button class=\"filter-btn\" data-filter=\"pending\">En attente</button>
            </div>

            <div id=\"validation-list\" class=\"validation-list\">
                <!-- Articles à valider -->
            </div>
        ";

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
            container.innerHTML = "
                <div class=\"no-validations\">
                    <h3>Aucun article à valider</h3>
                    <p>Lancez d'abord une recherche pour avoir des articles à valider</p>
                </div>
            ";
            return;
        }

        container.innerHTML = extractions.map(extraction => "
            <div class=\"validation-item status-${extraction.user_validation_status || 'pending'}" 
                 data-status="${extraction.user_validation_status || 'pending'}"
                 data-id="${extraction.id}">
                <div class=\"validation-header\">
                    <h4>${extraction.title || 'Titre non disponible'}</h4>
                    <div class=\"ai-score\">Score IA: ${(extraction.relevance_score * 10).toFixed(1)}/10</div>
                </div>
                
                <div class=\"validation-content\">
                    <p class=\"ai-justification\">
                        <strong>Justification IA :</strong> ${extraction.relevance_justification || 'Aucune justification'}
                    </p>
                    
                    <div class=\"validation-actions\">
                        <button onclick=\"window.thesisWorkflow.validateArticle('${extraction.id}', 'include')" 
                                class=\"btn-include ${extraction.user_validation_status === 'include' ? 'active' : ''}">
                            ✅ Inclure
                        </button>
                        <button onclick=\"window.thesisWorkflow.validateArticle('${extraction.id}', 'exclude')" 
                                class=\"btn-exclude ${extraction.user_validation_status === 'exclude' ? 'active' : ''}">
                            ❌ Exclure
                        </button>
                        <button onclick=\"window.thesisWorkflow.validateArticle('${extraction.id}', '')" 
                                class=\"btn-reset ${!extraction.user_validation_status ? 'active' : ''}">
                            ↺ Réinitialiser
                        </button>
                    </div>
                </div>
            </div>
        ").join('');
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
        container.innerHTML = "
            <div class=\"prisma-stats\">
                <div class=\"stat-card stat-total\">
                    <span class=\"stat-number">${stats.total}</span>
                    <span class=\"stat-label\">Total Articles</span>
                </div>
                <div class=\"stat-card stat-included\">
                    <span class=\"stat-number">${stats.included}</span>
                    <span class=\"stat-label\">Inclus</span>
                </div>
                <div class=\"stat-card stat-excluded\">
                    <span class=\"stat-number">${stats.excluded}</span>
                    <span class=\"stat-label\">Exclus</span>
                </div>
                <div class=\"stat-card stat-pending\">
                    <span class=\"stat-number">${stats.pending}</span>
                    <span class=\"stat-label\">En attente</span>
                </div>
                <div class=\"stat-card stat-progress\">
                    <span class=\"stat-number">${stats.total > 0 ? Math.round(((stats.included + stats.excluded) / stats.total) * 100) : 0}%</span>
                    <span class=\"stat-label\">Progression</span>
                </div>
            </div>
        ";
    }

    setupExportInterface() {
        const analysesContainer = document.getElementById('analysisContainer');
        if (!analysesContainer) return;

        // Ajouter section d'export en bas du container d'analyses
        const exportSection = document.createElement('div');
        exportSection.className = 'export-section';
        exportSection.innerHTML = "
            <h3>📊 Exports pour Thèse</h3>
            <p>Générez tous les éléments nécessaires pour votre manuscrit de thèse</p>
            
            <div class=\"export-buttons\">
                <button onclick=\"window.thesisWorkflow.exportPRISMAFlow()\" class=\"export-btn\">
                    📋 Diagramme PRISMA
                </button>
                <button onclick=\"window.thesisWorkflow.exportDataTable()\" class=\"export-btn\">
                    📊 Tableau de données
                </button>
                <button onclick=\"window.thesisWorkflow.exportBibliography()\" class=\"export-btn\">
                    📚 Bibliographie
                </button>
                <button onclick=\"window.thesisWorkflow.exportCompleteThesis()\" class=\"export-btn\">
                    📄 Export complet thèse
                </button>
                <button onclick=\"window.thesisWorkflow.generateThesisReport()\" class=\"export-btn\">
                    🎯 Rapport de thèse
                </button>
            </div>
        ";

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

        return prismaItems.map(item => "
            <div class=\"prisma-item\" data-item-id="${item.id}">
                <label class=\"prisma-label\">
                    <input type=\"checkbox\" class=\"prisma-checkbox\" data-item-id="${item.id}">
                    <span class=\"prisma-text">${item.text}</span>
                </label>
                <textarea class=\"prisma-notes\" placeholder=\"Notes et détails pour cet élément..."></textarea>
            </div>
        ").join('');
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
            `"${(article.title || '').replace(/