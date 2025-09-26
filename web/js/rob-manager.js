// Gestionnaire complet Risk of Bias selon Cochrane
import { fetchAPI } from './api.js';
import { API_ENDPOINTS } from './constants.js';
import { appState } from './app-improved.js';

class RiskOfBiasManager {
    constructor() {
        this.currentProject = null;
        this.robDomains = this.initializeCochraneDomains();
        this.currentArticles = [];
        this.robAssessments = {};
        this.init();
    }

    initializeCochraneDomains() {
        return {
            random_sequence_generation: {
                label: 'Génération de la séquence aléatoire',
                description: 'Méthode utilisée pour générer la séquence d\'allocation',
                criteria: {
                    low: 'Méthode appropriée de génération de séquence aléatoire',
                    high: 'Méthode non aléatoire utilisée',
                    unclear: 'Information insuffisante'
                }
            },
            allocation_concealment: {
                label: 'Dissimulation de l\'allocation',
                description: 'Méthode utilisée pour dissimuler la séquence d\'allocation',
                criteria: {
                    low: 'Méthode appropriée de dissimulation',
                    high: 'Dissimulation inadéquate ou absence de dissimulation',
                    unclear: 'Information insuffisante'
                }
            },
            blinding_participants: {
                label: 'Aveuglement des participants et personnel',
                description: 'Mesures prises pour aveugler participants et personnel',
                criteria: {
                    low: 'Aveuglement adéquat',
                    high: 'Absence d\'aveuglement ou aveuglement inadéquat',
                    unclear: 'Information insuffisante'
                }
            },
            blinding_outcome: {
                label: 'Aveuglement de l\'évaluation des résultats',
                description: 'Mesures prises pour aveugler l\'évaluation des résultats',
                criteria: {
                    low: 'Aveuglement adéquat de l\'évaluation',
                    high: 'Évaluation non aveuglée ou inadéquate',
                    unclear: 'Information insuffisante'
                }
            },
            incomplete_outcome_data: {
                label: 'Données de résultats incomplètes',
                description: 'Exhaustivité des données de résultats',
                criteria: {
                    low: 'Données de résultats complètes',
                    high: 'Données manquantes importantes',
                    unclear: 'Information insuffisante'
                }
            },
            selective_reporting: {
                label: 'Rapport sélectif',
                description: 'Possibilité de rapport sélectif des résultats',
                criteria: {
                    low: 'Protocole disponible, tous résultats rapportés',
                    high: 'Rapport sélectif évident',
                    unclear: 'Information insuffisante'
                }
            },
            other_bias: {
                label: 'Autres biais',
                description: 'Autres sources potentielles de biais',
                criteria: {
                    low: 'Étude semble exempte d\'autres sources de biais',
                    high: 'Autres sources importantes de biais',
                    unclear: 'Information insuffisante'
                }
            }
        };
    }

    init() {
        this.setupRoBInterface();
        
        if (appState.currentProject) {
            this.loadRoBArticles();
        }
    }

    setupRoBInterface() {
        const robContainer = document.getElementById('robContainer');
        if (!robContainer) {
            console.warn('Container RoB non trouvé');
            return;
        }

        robContainer.innerHTML = `
            <div class="rob-header">
                <h2>⚖️ Évaluation du Risque de Biais</h2>
                <p class="rob-subtitle">
                    Évaluation selon les critères Cochrane Risk of Bias Tool
                </p>
            </div>

            <div class="rob-navigation">
                <button class="rob-tab active" data-tab="assessment">📝 Évaluation</button>
                <button class="rob-tab" data-tab="summary">📊 Synthèse</button>
                <button class="rob-tab" data-tab="visualization">📈 Visualisation</button>
                <button class="rob-tab" data-tab="export">📄 Export</button>
            </div>

            <div class="rob-content">
                <div id="rob-assessment" class="rob-panel active">
                    ${this.renderAssessmentInterface()}
                </div>
                
                <div id="rob-summary" class="rob-panel">
                    ${this.renderSummaryInterface()}
                </div>
                
                <div id="rob-visualization" class="rob-panel">
                    ${this.renderVisualizationInterface()}
                </div>
                
                <div id="rob-export" class="rob-panel">
                    ${this.renderExportInterface()}
                </div>
            </div>
        `;

        this.attachRoBEventListeners();
    }

    renderAssessmentInterface() {
        return `
            <div class="rob-assessment-header">
                <div class="assessment-controls">
                    <button onclick="window.robManager.loadRoBArticles()" class="btn-load-articles">
                        🔄 Charger Articles
                    </button>
                    <button onclick="window.robManager.runAutoRoB()" class="btn-auto-rob">
                        🤖 Évaluation IA
                    </button>
                    <button onclick="window.robManager.saveAllAssessments()" class="btn-save-all">
                        💾 Sauvegarder Tout
                    </button>
                </div>
            </div>

            <div id="rob-articles-selector" class="rob-articles-selector">
                <!-- Sélecteur d'articles -->
            </div>

            <div id="rob-assessment-form" class="rob-assessment-form">
                <!-- Formulaire d'évaluation -->
            </div>
        `;
    }

    renderSummaryInterface() {
        return `
            <div class="rob-summary-header">
                <h3>Synthèse des Évaluations RoB</h3>
                <div class="summary-controls">
                    <button onclick="window.robManager.generateSummaryTable()" class="btn-generate-summary">
                        📊 Générer Tableau
                    </button>
                    <button onclick="window.robManager.calculateAgreement()" class="btn-calculate-agreement">
                        🎯 Accord Inter-Évaluateurs
                    </button>
                </div>
            </div>

            <div class="rob-summary-stats" id="rob-summary-stats">
                <!-- Statistiques synthèse -->
            </div>

            <div class="rob-summary-table" id="rob-summary-table">
                <!-- Tableau de synthèse -->
            </div>
        `;
    }

    renderVisualizationInterface() {
        return `
            <div class="rob-visualization-header">
                <h3>Visualisations Risk of Bias</h3>
                <div class="viz-controls">
                    <button onclick="window.robManager.generateTrafficLights()" class="btn-traffic-lights">
                        🚦 Traffic Light Plot
                    </button>
                    <button onclick="window.robManager.generateSummaryPlot()" class="btn-summary-plot">
                        📊 Summary Plot
                    </button>
                    <button onclick="window.robManager.generateHeatmap()" class="btn-heatmap">
                        🌡️ Heatmap
                    </button>
                </div>
            </div>

            <div class="rob-visualizations" id="rob-visualizations">
                <!-- Visualisations générées -->
            </div>
        `;
    }

    renderExportInterface() {
        return `
            <div class="rob-export-header">
                <h3>Export Risk of Bias</h3>
            </div>

            <div class="rob-export-options">
                <div class="export-card">
                    <h4>📊 Données Brutes</h4>
                    <p>Export CSV des évaluations RoB</p>
                    <button onclick="window.robManager.exportRawData()" class="btn-export">
                        Exporter CSV
                    </button>
                </div>
                
                <div class="export-card">
                    <h4>📈 Figures Publication</h4>
                    <p>Graphiques haute résolution pour publication</p>
                    <button onclick="window.robManager.exportFigures()" class="btn-export">
                        Exporter Figures
                    </button>
                </div>
                
                <div class="export-card">
                    <h4>📄 Rapport RoB</h4>
                    <p>Rapport complet formaté</p>
                    <button onclick="window.robManager.exportReport()" class="btn-export">
                        Exporter Rapport
                    </button>
                </div>
                
                <div class="export-card">
                    <h4>🌐 RevMan Compatible</h4>
                    <p>Format compatible Cochrane RevMan</p>
                    <button onclick="window.robManager.exportRevMan()" class="btn-export">
                        Exporter RevMan
                    </button>
                </div>
            </div>
        `;
    }

    async loadRoBArticles() {
        if (!appState.currentProject?.id) {
            alert('Sélectionnez un projet');
            return;
        }

        try {
            const extractions = await fetchAPI(API_ENDPOINTS.projectExtractions(appState.currentProject.id));
            const includedArticles = extractions.filter(e => e.user_validation_status === 'include');

            if (includedArticles.length === 0) {
                alert('Aucun article inclus. Validez d\'abord vos articles.');
                return;
            }

            this.currentArticles = includedArticles;
            this.renderArticlesSelector(includedArticles);

        } catch (error) {
            console.error('Erreur chargement articles RoB:', error);
            alert(`Erreur: ${error.message}`);
        }
    }

    renderArticlesSelector(articles) {
        const container = document.getElementById('rob-articles-selector');
        if (!container) return;

        container.innerHTML = `
            <div class="articles-selector-header">
                <h4>Articles à Évaluer (${articles.length})</h4>
            </div>
            
            <div class="articles-list">
                ${articles.map(article => `
                    <div class="article-item ${this.hasRoBAssessment(article.id) ? 'has-rob' : ''}" 
                         data-article-id="${article.id}">
                        <div class="article-info">
                            <div class="article-title">${article.title || 'Titre non disponible'}</div>
                            <div class="article-meta">${article.authors || ''}</div>
                        </div>
                        <div class="rob-status">
                            ${this.hasRoBAssessment(article.id) ? '✅ Évalué' : '⏳ À évaluer'}
                        </div>
                        <button onclick="window.robManager.assessArticle('${article.id}')" class="btn-assess">
                            ${this.hasRoBAssessment(article.id) ? 'Modifier' : 'Évaluer'}
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    }

    assessArticle(articleId) {
        const article = this.currentArticles.find(a => a.id === articleId);
        if (!article) return;

        this.renderAssessmentForm(article);
    }

    renderAssessmentForm(article) {
        const container = document.getElementById('rob-assessment-form');
        if (!container) return;

        const existingAssessment = this.robAssessments[article.id] || {};

        container.innerHTML = `
            <div class="assessment-form-header">
                <h4>Évaluation RoB: ${article.title}</h4>
                <div class="assessment-info">
                    <span class="authors">${article.authors || ''}</span>
                    <span class="journal">${article.journal || ''}</span>
                </div>
            </div>

            <form id="rob-form-${article.id}" class="rob-form" data-article-id="${article.id}">
                ${Object.entries(this.robDomains).map(([domainKey, domain]) => `
                    <div class="rob-domain">
                        <div class="domain-header">
                            <h5>${domain.label}</h5>
                            <p class="domain-description">${domain.description}</p>
                        </div>
                        
                        <div class="risk-assessment">
                            <div class="risk-options">
                                ${Object.entries(domain.criteria).map(([risk, criteria]) => `
                                    <label class="risk-option risk-${risk}">
                                        <input type="radio" 
                                               name="${domainKey}" 
                                               value="${risk}"
                                               ${existingAssessment[domainKey] === risk ? 'checked' : ''}>
                                        <span class="risk-indicator"></span>
                                        <span class="risk-label">${this.getRiskLabel(risk)}</span>
                                        <span class="risk-criteria">${criteria}</span>
                                    </label>
                                `).join('')}
                            </div>
                            
                            <div class="domain-notes">
                                <textarea 
                                    name="${domainKey}_notes" 
                                    placeholder="Justification et notes pour ce domaine..."
                                    class="form-control"
                                >${existingAssessment[`${domainKey}_notes`] || ''}</textarea>
                            </div>
                        </div>
                    </div>
                `).join('')}
                
                <div class="assessment-actions">
                    <button type="button" onclick="window.robManager.saveAssessment('${article.id}')" class="btn-save">
                        💾 Sauvegarder
                    </button>
                    <button type="button" onclick="window.robManager.clearAssessment('${article.id}')" class="btn-clear">
                        🗑️ Effacer
                    </button>
                    <button type="button" onclick="window.robManager.nextArticle('${article.id}')" class="btn-next">
                        ➡️ Suivant
                    </button>
                </div>
            </form>
        `;
    }

    async saveAssessment(articleId) {
        const form = document.getElementById(`rob-form-${articleId}`);
        if (!form) return;

        const formData = new FormData(form);
        const assessment = {};
        
        // Collecter toutes les données du formulaire
        for (let [key, value] of formData.entries()) {
            assessment[key] = value;
        }

        try {
            // Sauvegarder localement
            this.robAssessments[articleId] = assessment;

            // Sauvegarder sur serveur
            await fetchAPI(`/projects/${appState.currentProject.id}/articles/${articleId}/rob`, {
                method: 'POST',
                body: {
                    rob_assessment: assessment,
                    article_id: articleId
                }
            });

            alert('Évaluation RoB sauvegardée');
            this.renderArticlesSelector(this.currentArticles);

        } catch (error) {
            console.error('Erreur sauvegarde RoB:', error);
            alert(`Erreur: ${error.message}`);
        }
    }

    async runAutoRoB() {
        if (!appState.currentProject?.id) {
            alert('Sélectionnez un projet');
            return;
        }

        const selectedArticles = Array.from(document.querySelectorAll('.article-item:not(.has-rob) .article-item'))
                                      .slice(0, 5); // Limiter à 5 pour demo

        if (selectedArticles.length === 0) {
            alert('Aucun article nécessite d\'évaluation automatique');
            return;
        }

        try {
            const response = await fetchAPI(API_ENDPOINTS.projectRunRobAnalysis(appState.currentProject.id), {
                method: 'POST',
                body: {
                    article_ids: selectedArticles.map(el => el.dataset.articleId),
                    auto_assessment: true
                }
            });

            if (response.task_id) {
                alert(`Évaluation RoB automatique lancée (Task: ${response.task_id})`);
                this.pollRoBAnalysis(response.task_id);
            }

        } catch (error) {
            console.error('Erreur évaluation auto RoB:', error);
            alert(`Erreur: ${error.message}`);
        }
    }

    async generateTrafficLights() {
        if (Object.keys(this.robAssessments).length === 0) {
            alert('Aucune évaluation RoB disponible');
            return;
        }

        try {
            const response = await fetchAPI('/api/rob/generate-traffic-lights', {
                method: 'POST',
                body: {
                    project_id: appState.currentProject.id,
                    assessments: this.robAssessments
                }
            });

            this.displayVisualization(response.chart_url, 'Traffic Light Plot');

        } catch (error) {
            console.error('Erreur génération traffic lights:', error);
            alert(`Erreur: ${error.message}`);
        }
    }

    displayVisualization(chartUrl, title) {
        const container = document.getElementById('rob-visualizations');
        if (!container) return;

        container.innerHTML += `
            <div class="rob-chart">
                <h4>${title}</h4>
                <img src="${chartUrl}" alt="${title}" class="rob-chart-image">
                <div class="chart-actions">
                    <a href="${chartUrl}" download class="btn-download">📥 Télécharger</a>
                </div>
            </div>
        `;
    }

    getRiskLabel(risk) {
        const labels = {
            low: 'Faible risque',
            high: 'Risque élevé',
            unclear: 'Risque incertain'
        };
        return labels[risk] || risk;
    }

    hasRoBAssessment(articleId) {
        return this.robAssessments[articleId] && 
               Object.keys(this.robAssessments[articleId]).length > 0;
    }

    switchRoBTab(tabId) {
        document.querySelectorAll('.rob-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabId);
        });

        document.querySelectorAll('.rob-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === `rob-${tabId}`);
        });
    }

    attachRoBEventListeners() {
        document.querySelectorAll('.rob-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchRoBTab(e.target.dataset.tab);
            });
        });
    }

    // Méthodes à implémenter
    async pollRoBAnalysis(taskId) { /* Implémentation polling */ }
    async generateSummaryTable() { /* Génération tableau synthèse */ }
    async calculateAgreement() { /* Calcul accord inter-évaluateurs */ }
    async generateSummaryPlot() { /* Graphique synthèse */ }
    async generateHeatmap() { /* Heatmap RoB */ }
    async exportRawData() { /* Export CSV */ }
    async exportFigures() { /* Export figures */ }
    async exportReport() { /* Export rapport */ }
    async exportRevMan() { /* Export RevMan */ }
    async saveAllAssessments() { /* Sauvegarde batch */ }
    clearAssessment(articleId) { /* Effacer évaluation */ }
    nextArticle(articleId) { /* Article suivant */ }
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    window.robManager = new RiskOfBiasManager();
});

export default RiskOfBiasManager;