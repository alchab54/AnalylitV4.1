// Module d'analyses ATN spécialisées - Innovation AnalyLit v4.1
import { fetchAPI } from './api.js';
import { API_ENDPOINTS } from './constants.js';
import { appState } from './app-improved.js';

class ATNAnalyzer {
    constructor() {
        this.currentProject = null;
        this.atnFields = this.initializeATNFields();
        this.analysisResults = {};
        this.empathyMetrics = {};
        this.init();
    }

    initializeATNFields() {
        return {
            // Champs ATN identifiés dans votre backend
            foundational: [
                'alliance_therapeutique_numerique',
                'relation_patient_ia',
                'confiance_technologique',
                'personnalisation_therapeutic'
            ],
            empathy: [
                'empathie_ia_detectee',
                'empathie_humain_rapportee', 
                'comparaison_empathique',
                'resonance_emotionnelle'
            ],
            clinical: [
                'efficacite_clinique_atn',
                'adherence_therapeutique',
                'outcomes_patients',
                'mesures_satisfaction'
            ],
            technological: [
                'type_ia_utilise',
                'modalites_interaction',
                'frequence_utilisation',
                'plateformes_deployment'
            ],
            methodological: [
                'design_etude_atn',
                'duree_intervention',
                'population_cible',
                'criteres_inclusion_atn',
                'mesures_validees_atn'
            ],
            barriers: [
                'barrieres_adoption',
                'facilitateurs_usage',
                'acceptabilite_patients',
                'competences_numeriques_requises'
            ],
            ethical: [
                'considerations_ethiques',
                'protection_donnees',
                'consentement_eclaire',
                'transparence_algorithmes'
            ]
        };
    }

    init() {
        this.setupATNInterface();
        
        // Auto-load si projet sélectionné
        if (appState.currentProject) {
            this.loadProject(appState.currentProject);
        }
    }

    setupATNInterface() {
        const atnContainer = document.getElementById('atn-analysis-container');
        if (!atnContainer) {
            console.warn('Container ATN non trouvé');
            return;
        }

        atnContainer.innerHTML = `
            <div class="atn-header">
                <h2>🧠 Analyses ATN Spécialisées</h2>
                <p class="atn-subtitle">
                    Première plateforme mondiale dédiée à l'Alliance Thérapeutique Numérique
                </p>
            </div>

            <div class="atn-nav">
                <button class="atn-tab active" data-tab="extraction">📝 Extraction ATN</button>
                <button class="atn-tab" data-tab="empathy">💙 Empathie IA vs Humain</button>
                <button class="atn-tab" data-tab="analysis">📊 Analyses Multipartites</button>
                <button class="atn-tab" data-tab="reports">📄 Rapports ATN</button>
            </div>

            <div class="atn-content">
                <div id="atn-extraction" class="atn-panel active">
                    ${this.renderExtractionInterface()}
                </div>
                <div id="atn-empathy" class="atn-panel">
                    ${this.renderEmpathyInterface()}
                </div>
                <div id="atn-analysis" class="atn-panel">
                    ${this.renderAnalysisInterface()}
                </div>
                <div id="atn-reports" class="atn-panel">
                    ${this.renderReportsInterface()}
                </div>
            </div>
        `;

        // Event listeners pour navigation ATN
        atnContainer.querySelectorAll('.atn-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchATNTab(e.target.dataset.tab);
            });
        });

        this.attachATNEventListeners();
    }

    renderExtractionInterface() {
        return `
            <div class="atn-extraction-header">
                <h3>Extraction de Données ATN</h3>
                <div class="extraction-controls">
                    <button onclick="window.atnAnalyzer.loadATNArticles()" class="btn-primary">
                        🔄 Charger Articles
                    </button>
                    <button onclick="window.atnAnalyzer.launchATNExtraction()" class="btn-success">
                        🚀 Lancer Extraction ATN
                    </button>
                </div>
            </div>

            <div class="atn-progress" id="atn-extraction-progress">
                <div class="progress-info">Sélectionnez un projet pour commencer</div>
            </div>

            <div class="atn-fields-preview">
                <h4>Champs ATN à Extraire (29 champs uniques)</h4>
                <div class="fields-grid">
                    ${Object.entries(this.atnFields).map(([category, fields]) => `
                        <div class="field-category">
                            <h5>${this.getCategoryLabel(category)}</h5>
                            <div class="field-list">
                                ${fields.map(field => `
                                    <div class="field-item">
                                        <input type="checkbox" id="field-${field}" checked>
                                        <label for="field-${field}">${this.getFieldLabel(field)}</label>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div id="atn-articles-list" class="atn-articles-list">
                <!-- Articles avec extraction ATN -->
            </div>
        `;
    }

    renderEmpathyInterface() {
        return `
            <div class="empathy-dashboard">
                <h3>💙 Analyse Comparative Empathie IA vs Humain</h3>
                <p class="innovation-note">
                    <strong>Innovation AnalyLit :</strong> Première analyse automatisée des différences d'empathie
                    entre intelligence artificielle et thérapeutes humains dans les ATN.
                </p>

                <div class="empathy-controls">
                    <button onclick="window.atnAnalyzer.analyzeEmpathy()" class="btn-analyze-empathy">
                        🧠 Analyser Empathie
                    </button>
                    <button onclick="window.atnAnalyzer.compareEmpathyMethods()" class="btn-compare">
                        ⚖️ Comparer Méthodes
                    </button>
                    <button onclick="window.atnAnalyzer.exportEmpathyReport()" class="btn-export">
                        📊 Export Empathie
                    </button>
                </div>

                <div id="empathy-results" class="empathy-results">
                    <div class="empathy-placeholder">
                        <div class="placeholder-icon">🤖💙👨‍⚕️</div>
                        <h4>Analyse Empathie ATN</h4>
                        <p>Cette analyse unique compare quantitativement l'empathie perçue entre IA et humains dans les interventions ATN.</p>
                        <ul>
                            <li>✅ Détection automatique des marqueurs d'empathie</li>
                            <li>✅ Comparaison IA vs thérapeutes humains</li>
                            <li>✅ Scores de résonance émotionnelle</li>
                            <li>✅ Prédicteurs d'efficacité empathique</li>
                        </ul>
                    </div>
                </div>

                <div class="empathy-metrics" id="empathy-metrics">
                    <!-- Métriques injectées dynamiquement -->
                </div>
            </div>
        `;
    }

    renderAnalysisInterface() {
        return `
            <div class="multipartite-analysis">
                <h3>📊 Analyses ATN Multipartites</h3>
                
                <div class="analysis-types">
                    <div class="analysis-card">
                        <h4>🎯 Efficacité ATN</h4>
                        <p>Méta-analyse des outcomes cliniques avec facteurs ATN</p>
                        <button onclick="window.atnAnalyzer.runEfficacyAnalysis()" class="btn-run-analysis">
                            Lancer Analyse
                        </button>
                    </div>
                    
                    <div class="analysis-card">
                        <h4>🤝 Facteurs d'Alliance</h4>
                        <p>Identification des prédicteurs de l'alliance thérapeutique numérique</p>
                        <button onclick="window.atnAnalyzer.runAllianceAnalysis()" class="btn-run-analysis">
                            Lancer Analyse
                        </button>
                    </div>
                    
                    <div class="analysis-card">
                        <h4>💻 Modalités Technologiques</h4>
                        <p>Comparaison des plateformes et technologies ATN</p>
                        <button onclick="window.atnAnalyzer.runTechModalitiesAnalysis()" class="btn-run-analysis">
                            Lancer Analyse
                        </button>
                    </div>
                    
                    <div class="analysis-card">
                        <h4>🛡️ Barrières et Facilitateurs</h4>
                        <p>Analyse des obstacles à l'adoption ATN</p>
                        <button onclick="window.atnAnalyzer.runBarriersAnalysis()" class="btn-run-analysis">
                            Lancer Analyse
                        </button>
                    </div>
                </div>

                <div id="analysis-results-container" class="analysis-results-container">
                    <!-- Résultats d'analyses -->
                </div>
            </div>
        `;
    }

    renderReportsInterface() {
        return `
            <div class="atn-reports">
                <h3>📄 Rapports ATN Spécialisés</h3>
                
                <div class="report-templates">
                    <div class="template-card">
                        <h4>📋 Rapport ATN Complet</h4>
                        <p>Synthèse complète de tous les aspects ATN identifiés</p>
                        <button onclick="window.atnAnalyzer.generateCompleteATNReport()" class="btn-generate">
                            Générer Rapport
                        </button>
                    </div>
                    
                    <div class="template-card">
                        <h4>💙 Focus Empathie</h4>
                        <p>Rapport spécialisé sur les aspects empathiques IA vs humain</p>
                        <button onclick="window.atnAnalyzer.generateEmpathyReport()" class="btn-generate">
                            Générer Focus
                        </button>
                    </div>
                    
                    <div class="template-card">
                        <h4>📊 Données pour Publication</h4>
                        <p>Export formaté pour revues scientifiques ATN</p>
                        <button onclick="window.atnAnalyzer.exportPublicationData()" class="btn-generate">
                            Export Publication
                        </button>
                    </div>
                    
                    <div class="template-card">
                        <h4>🎯 Recommandations Cliniques</h4>
                        <p>Guide pratique basé sur les preuves ATN</p>
                        <button onclick="window.atnAnalyzer.generateClinicalGuidelines()" class="btn-generate">
                            Générer Guide
                        </button>
                    </div>
                </div>

                <div id="generated-reports" class="generated-reports">
                    <!-- Rapports générés -->
                </div>
            </div>
        `;
    }

    switchATNTab(tabId) {
        // Switch active tab
        document.querySelectorAll('.atn-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabId);
        });

        // Switch active panel
        document.querySelectorAll('.atn-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === `atn-${tabId}`);
        });
    }

    async loadATNArticles() {
        if (!appState.currentProject?.id) {
            alert('Sélectionnez d\'abord un projet');
            return;
        }

        try {
            this.updateExtractionProgress('Chargement des articles ATN...');

            const extractions = await fetchAPI(API_ENDPOINTS.projectExtractions(appState.currentProject.id));
            const includedArticles = extractions.filter(e => e.user_validation_status === 'include');

            if (includedArticles.length === 0) {
                this.updateExtractionProgress('Aucun article inclus trouvé. Validez d\'abord vos articles.');
                return;
            }

            this.renderATNArticlesList(includedArticles);
            this.updateExtractionProgress(`${includedArticles.length} articles inclus chargés et prêts pour extraction ATN`);

        } catch (error) {
            console.error('Erreur chargement articles ATN:', error);
            this.updateExtractionProgress(`Erreur: ${error.message}`, true);
        }
    }

    renderATNArticlesList(articles) {
        const container = document.getElementById('atn-articles-list');
        if (!container) return;

        container.innerHTML = `
            <div class="atn-articles-header">
                <h4>Articles Inclus pour Extraction ATN (${articles.length})</h4>
                <div class="bulk-atn-actions">
                    <button onclick="window.atnAnalyzer.selectAllATN()" class="btn-select-all">
                        ✅ Sélectionner Tous
                    </button>
                    <button onclick="window.atnAnalyzer.launchSelectedATN()" class="btn-launch-selected">
                        🚀 Extraire Sélectionnés
                    </button>
                </div>
            </div>
            
            <div class="atn-articles-grid">
                ${articles.map(article => this.renderATNArticleCard(article)).join('')}
            </div>
        `;
    }

    renderATNArticleCard(article) {
        const hasATNData = article.atn_data && Object.keys(article.atn_data).length > 0;
        
        return `
            <div class="atn-article-card ${hasATNData ? 'has-atn-data' : ''}" data-article-id="${article.id}">
                <div class="atn-card-header">
                    <input type="checkbox" class="atn-article-select" data-id="${article.id}">
                    <div class="atn-status">
                        ${hasATNData ? '✅ Données ATN' : '⏳ À Extraire'}
                    </div>
                </div>
                
                <h5 class="atn-article-title">${article.title || 'Titre non disponible'}</h5>
                
                <div class="atn-article-meta">
                    <span class="authors">${article.authors || 'Auteurs non spécifiés'}</span>
                    <span class="relevance-score">Score: ${(article.relevance_score * 10).toFixed(1)}/10</span>
                </div>

                ${hasATNData ? `
                    <div class="atn-preview">
                        <div class="atn-fields-found">
                            ${Object.keys(article.atn_data).length} champs ATN trouvés
                        </div>
                        <button onclick="window.atnAnalyzer.viewATNData('${article.id}')" class="btn-view-atn">
                            👁️ Voir Données ATN
                        </button>
                    </div>
                ` : `
                    <div class="atn-actions">
                        <button onclick="window.atnAnalyzer.extractSingleATN('${article.id}')" class="btn-extract-single">
                            🧠 Extraire ATN
                        </button>
                    </div>
                `}
            </div>
        `;
    }

    async launchATNExtraction() {
        if (!appState.currentProject?.id) {
            alert('Sélectionnez un projet');
            return;
        }

        const selectedFields = Array.from(document.querySelectorAll('.field-item input:checked'))
                                   .map(cb => cb.id.replace('field-', ''));

        if (selectedFields.length === 0) {
            alert('Sélectionnez au moins un champ ATN à extraire');
            return;
        }

        try {
            this.updateExtractionProgress('Lancement de l\'extraction ATN spécialisée...');

            const response = await fetchAPI(API_ENDPOINTS.projectRunAnalysis.replace('{project_id}', appState.currentProject.id), {
                method: 'POST',
                body: {
                    type: 'atn_specialized_extraction',
                    fields: selectedFields,
                    include_empathy_analysis: true
                }
            });

            if (response.task_id) {
                this.updateExtractionProgress(`Extraction ATN lancée (Task: ${response.task_id}). Analyse en cours...`);
                this.pollATNExtraction(response.task_id);
            }

        } catch (error) {
            console.error('Erreur extraction ATN:', error);
            this.updateExtractionProgress(`Erreur: ${error.message}`, true);
        }
    }

    async pollATNExtraction(taskId) {
        let attempts = 0;
        const maxAttempts = 60; // 2 minutes max

        const poll = async () => {
            try {
                // Vérifier le statut de la tâche (adapter selon votre API)
                const status = await fetchAPI(`/api/tasks/${taskId}/status`);
                
                if (status.state === 'SUCCESS') {
                    this.updateExtractionProgress('✅ Extraction ATN terminée avec succès !');
                    this.loadATNResults();
                } else if (status.state === 'FAILURE') {
                    this.updateExtractionProgress(`❌ Extraction échouée: ${status.info || 'Erreur inconnue'}`, true);
                } else if (attempts < maxAttempts) {
                    attempts++;
                    const progress = status.info?.progress || 0;
                    this.updateExtractionProgress(`🔄 Extraction en cours... ${progress}%`);
                    setTimeout(poll, 2000);
                } else {
                    this.updateExtractionProgress('⏰ Timeout - vérifiez les logs serveur', true);
                }

            } catch (error) {
                console.error('Erreur polling extraction ATN:', error);
                this.updateExtractionProgress(`Erreur polling: ${error.message}`, true);
            }
        };

        poll();
    }

    async analyzeEmpathy() {
        if (!appState.currentProject?.id) {
            alert('Sélectionnez un projet');
            return;
        }

        try {
            const container = document.getElementById('empathy-results');
            container.innerHTML = '<div class="analyzing">🧠 Analyse de l\'empathie en cours...</div>';

            const response = await fetchAPI(API_ENDPOINTS.projectRunAnalysis(appState.currentProject.id), {
                method: 'POST',
                body: {
                    type: 'empathy_comparative_analysis'
                }
            });

            if (response.task_id) {
                this.pollEmpathyAnalysis(response.task_id);
            }

        } catch (error) {
            console.error('Erreur analyse empathie:', error);
            const container = document.getElementById('empathy-results');
            container.innerHTML = `<div class="error">Erreur: ${error.message}</div>`;
        }
    }

    async pollEmpathyAnalysis(taskId) {
        // Similaire à pollATNExtraction mais pour l'empathie
        let attempts = 0;
        const maxAttempts = 30;

        const poll = async () => {
            try {
                const status = await fetchAPI(`/api/tasks/${taskId}/status`);
                
                if (status.state === 'SUCCESS') {
                    this.displayEmpathyResults(status.result);
                } else if (status.state === 'FAILURE') {
                    this.displayEmpathyError(status.info);
                } else if (attempts < maxAttempts) {
                    attempts++;
                    setTimeout(poll, 2000);
                }

            } catch (error) {
                this.displayEmpathyError(error.message);
            }
        };

        poll();
    }

    displayEmpathyResults(results) {
        const container = document.getElementById('empathy-results');
        if (!results || !container) return;

        container.innerHTML = `
            <div class="empathy-comparison">
                <h4>🤖💙👨‍⚕️ Comparaison Empathie IA vs Humain</h4>
                
                <div class="empathy-scores">
                    <div class="empathy-card ai-empathy">
                        <h5>🤖 Intelligence Artificielle</h5>
                        <div class="empathy-score">${(results.ai_empathy_score * 10).toFixed(1)}/10</div>
                        <div class="empathy-details">
                            <div>Cohérence: ${(results.ai_consistency * 100).toFixed(1)}%</div>
                            <div>Réactivité: ${(results.ai_responsiveness * 100).toFixed(1)}%</div>
                            <div>Personnalisation: ${(results.ai_personalization * 100).toFixed(1)}%</div>
                        </div>
                    </div>
                    
                    <div class="empathy-card human-empathy">
                        <h5>👨‍⚕️ Thérapeutes Humains</h5>
                        <div class="empathy-score">${(results.human_empathy_score * 10).toFixed(1)}/10</div>
                        <div class="empathy-details">
                            <div>Intuition: ${(results.human_intuition * 100).toFixed(1)}%</div>
                            <div>Flexibilité: ${(results.human_flexibility * 100).toFixed(1)}%</div>
                            <div>Connexion: ${(results.human_connection * 100).toFixed(1)}%</div>
                        </div>
                    </div>
                </div>

                <div class="empathy-insights">
                    <h5>📊 Insights Clés</h5>
                    <ul>
                        ${(results.insights || []).map(insight => `<li>${insight}</li>`).join('')}
                    </ul>
                </div>

                <div class="empathy-recommendations">
                    <h5>💡 Recommandations</h5>
                    <ul>
                        ${(results.recommendations || []).map(rec => `<li>${rec}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;

        // Mettre à jour les métriques
        this.updateEmpathyMetrics(results);
    }

    updateEmpathyMetrics(results) {
        const metricsContainer = document.getElementById('empathy-metrics');
        if (!metricsContainer) return;

        metricsContainer.innerHTML = `
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-label">Différentiel Empathique</div>
                    <div class="metric-value ${results.empathy_differential > 0 ? 'positive' : 'negative'}">
                        ${results.empathy_differential > 0 ? '+' : ''}${(results.empathy_differential * 100).toFixed(1)}%
                    </div>
                    <div class="metric-desc">IA vs Humain</div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-label">Prédicteur d'Efficacité</div>
                    <div class="metric-value">${(results.efficacy_predictor * 100).toFixed(1)}%</div>
                    <div class="metric-desc">Basé sur empathie</div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-label">Articles Analysés</div>
                    <div class="metric-value">${results.analyzed_articles || 0}</div>
                    <div class="metric-desc">Données empathie</div>
                </div>
            </div>
        `;

        this.empathyMetrics = results;
    }

    // Méthodes helper
    getCategoryLabel(category) {
        const labels = {
            foundational: '🏗️ Fondations ATN',
            empathy: '💙 Empathie',
            clinical: '🏥 Clinique',
            technological: '💻 Technologie',
            methodological: '🔬 Méthodologie',
            barriers: '🚧 Barrières',
            ethical: '⚖️ Éthique'
        };
        return labels[category] || category;
    }

    getFieldLabel(field) {
        const labels = {
            alliance_therapeutique_numerique: 'Alliance Thérapeutique Numérique',
            relation_patient_ia: 'Relation Patient-IA',
            confiance_technologique: 'Confiance Technologique',
            personnalisation_therapeutic: 'Personnalisation Thérapeutique',
            empathie_ia_detectee: 'Empathie IA Détectée',
            empathie_humain_rapportee: 'Empathie Humain Rapportée',
            comparaison_empathique: 'Comparaison Empathique',
            resonance_emotionnelle: 'Résonance Émotionnelle'
            // Ajoutez tous les autres champs...
        };
        return labels[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    updateExtractionProgress(message, isError = false) {
        const container = document.getElementById('atn-extraction-progress');
        if (container) {
            container.innerHTML = `
                <div class="progress-info ${isError ? 'error' : ''}">
                    ${isError ? '❌' : '⏳'} ${message}
                </div>
            `;
        }
    }

    attachATNEventListeners() {
        // Les event listeners sont attachés via onclick dans les templates
        // Ceci évite les problèmes de timing avec les éléments dynamiques
    }

    // Méthodes d'analyse avancées
    async runEfficacyAnalysis() { /* Implémentation à venir */ }
    async runAllianceAnalysis() { /* Implémentation à venir */ }
    async runTechModalitiesAnalysis() { /* Implémentation à venir */ }
    async runBarriersAnalysis() { /* Implémentation à venir */ }
    
    // Méthodes de génération de rapports
    async generateCompleteATNReport() { /* Implémentation à venir */ }
    async generateEmpathyReport() { /* Implémentation à venir */ }
    async exportPublicationData() { /* Implémentation à venir */ }
    async generateClinicalGuidelines() { /* Implémentation à venir */ }
}

// Initialiser le module ATN
document.addEventListener('DOMContentLoaded', () => {
    window.atnAnalyzer = new ATNAnalyzer();
});

export default ATNAnalyzer;
