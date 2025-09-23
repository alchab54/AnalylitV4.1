import { appState, elements } from './app-improved.js';
import { fetchAPI } from './api.js';
import { setAnalysisResults } from './state.js';
import { showLoadingOverlay, escapeHtml, showModal, closeModal, openModal } from './ui-improved.js';
import { showToast } from './toast.js';
import { API_ENDPOINTS, MESSAGES, SELECTORS } from './constants.js';

export async function loadProjectAnalyses() {
    if (!appState.currentProject) {
        if (elements.analysisContainer) {
            elements.analysisContainer.innerHTML = `<p>${MESSAGES.selectProjectToViewAnalyses}</p>`;
        }
        return;
    }

    try {
        // TODO: Backend route for getting analyses is missing.
        // const analyses = await fetchAPI(`/projects/${appState.currentProject.id}/analyses`);
        // setAnalysisResults(analyses);
        renderAnalysesSection();
    } catch (e) {
        console.error('Erreur chargement analyses:', e);
        showToast(MESSAGES.errorLoadingAnalyses, 'error');
    }
}

export function renderAnalysesSection() {
    if (!elements.analysisContainer) return;
    const project = appState.currentProject;

    if (!project) {
        elements.analysisContainer.innerHTML = `<div class="empty-state"><p>${MESSAGES.selectProjectToViewAnalyses}</p></div>`;
        return;
    }

    const analysisResults = appState.analysisResults || {};

    // Déterminer si chaque analyse a été effectuée
    const hasAtnAnalysis = !!analysisResults.atn_metrics;
    const hasDiscussionDraft = !!analysisResults.discussion_draft;
    const hasKnowledgeGraph = !!analysisResults.knowledge_graph;

    elements.analysisContainer.innerHTML = `
        <div class="analysis-grid">
            <div class="analysis-card ${hasAtnAnalysis ? 'analysis-card--done' : ''}">
                <div class="analysis-card__header">
                    <span class="analysis-card__icon">🤝</span>
                    <h4>Analyse ATN Multipartite</h4>
                    ${hasAtnAnalysis ? '<span class="badge badge--success">Effectuée</span>' : ''}
                </div>
                <div class="analysis-card__body"><p class="analysis-card__description">Analyse spécialisée pour l alliance thérapeutique numérique, incluant les scores d empathie, types d IA, et conformité réglementaire.</p></div>
                <div class="analysis-card__footer">
                    ${hasAtnAnalysis
                        ? `<button class="btn btn--secondary" data-action="view-analysis-results" data-target-id="atn-results-card">Voir les résultats</button>`
                        : `<button class="btn btn--primary" data-action="run-atn-analysis">Lancer l Analyse ATN</button>`
                    }
                </div>
            </div>

            <div class="analysis-card ${hasDiscussionDraft ? 'analysis-card--done' : ''}">
                <div class="analysis-card__header">
                     <span class="analysis-card__icon">📝</span>
                    <h4>Discussion académique</h4>
                    ${hasDiscussionDraft ? '<span class="badge badge--success">Effectuée</span>' : ''}
                </div>
                <div class="analysis-card__body"><p class="analysis-card__description">Génère une section Discussion basée sur la synthèse.</p></div>
                <div class="analysis-card__footer">
                    ${hasDiscussionDraft
                        ? `<button class="btn btn--secondary" data-action="view-analysis-results" data-target-id="discussion-draft-card">Voir la Discussion</button>`
                        : `<button class="btn btn--primary" data-action="run-analysis" data-analysis-type="discussion">Générer la Discussion</button>`
                    }
                </div>
            </div>
             <div class="analysis-card ${hasKnowledgeGraph ? 'analysis-card--done' : ''}">
                <div class="analysis-card__header">
                    <span class="analysis-card__icon">🌐</span>
                    <h4>Graphe de connaissances</h4>
                    ${hasKnowledgeGraph ? '<span class="badge badge--success">Effectuée</span>' : ''}
                </div>
                <div class="analysis-card__body"><p class="analysis-card__description">Visualise les relations entre les concepts et les articles.</p></div>
                <div class="analysis-card__footer">
                    ${hasKnowledgeGraph
                        ? `<button class="btn btn--secondary" data-action="view-analysis-results" data-target-id="knowledge-graph-card">Voir le Graphe</button>`
                        : `<button class="btn btn--primary" data-action="run-analysis" data-analysis-type="knowledge_graph">Générer le Graphe</button>`
                    }
                </div>
            </div>
        </div>

        <div id="analysis-result-container" class="mt-24">
            </div>
    `;

    // AFFICHER LES RÉSULTATS ATN S'ILS EXISTENT DÉJÀ
    if (hasAtnAnalysis) {
        renderATNResults(analysisResults);
    }

    // Initialiser le graphe de connaissances s'il existe
    if (hasKnowledgeGraph && analysisResults.knowledge_graph) {
        // On attend un court instant pour s'assurer que le DOM est prêt
        setTimeout(() => initializeKnowledgeGraph(JSON.parse(analysisResults.knowledge_graph)), 100);
    }

    // AFFICHER LE BROUILLON DE DISCUSSION S'IL EXISTE
    if (hasDiscussionDraft) {
        const container = document.querySelector(SELECTORS.analysisResultContainer);
        container.innerHTML += renderDiscussionDraft(analysisResults.discussion_draft);
    }

    // AFFICHER LE DIAGRAMME PRISMA S'IL EXISTE
    if (analysisResults.prisma_flow_path) {
        const container = document.querySelector(SELECTORS.analysisResultContainer);
        container.innerHTML += renderPrismaFlow(analysisResults.prisma_flow_path);
    }
}


// NOUVELLE FONCTION : pour afficher les résultats de l analyse ATN
function renderATNResults(analysisData) {
    const container = document.querySelector(SELECTORS.analysisResultContainer);
    if (!container) return '';

    const metrics = analysisData.atn_metrics || {};
    const tech = analysisData.technology_analysis || {};
    const ethical = analysisData.ethical_regulatory || {};

    const empathyMetrics = metrics.empathy_analysis || {};
    const allianceMetrics = metrics.alliance_metrics || {};

    container.innerHTML += `
        <div class="card" id="atn-results-card">
            <div class="card__header"><h4>Résultats de l Analyse ATN</h4></div>
            <div class="card__body">
                <div class="atn-results">
                    <div class="metrics-section">
                        <h5>📊 Métriques d Empathie & Alliance</h5>
                        <div class="metrics-grid">
                            <div class="metric-card">
                                <h6>Empathie IA (Moy)</h6>
                                <div class="metric-value">${empathyMetrics.mean_ai_empathy?.toFixed(2) || 'N/A'}</div>
                            </div>
                            <div class="metric-card">
                                <h6>Empathie Humaine (Moy)</h6>
                                <div class="metric-value">${empathyMetrics.mean_human_empathy?.toFixed(2) || 'N/A'}</div>
                            </div>
                             <div class="metric-card">
                                <h6>Score WAI-SR (Moy)</h6>
                                <div class="metric-value">${allianceMetrics.mean_wai_sr?.toFixed(2) || 'N/A'}</div>
                            </div>
                        </div>
                    </div>
                    <div class="metrics-section">
                        <h5>🤖 Technologie Utilisée</h5>
                        <p><strong>Type d IA le plus courant :</strong> ${tech.most_common_ai_type || 'N/A'}</p>
                        </div>
                     <div class="metrics-section">
                        <h5>⚖️ Conformité Réglementaire</h5>
                         <p><strong>Mentions RGPD :</strong> ${ethical.gdpr_mentions || 0} études (${ethical.regulatory_compliance_rate?.toFixed(1) || 0}%)</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}


export function showPRISMAModal() {
    openModal('prismaModal');
    // La logique de rendu et de sauvegarde est déjà dans le HTML/core.js
}

export async function savePRISMAProgress() {
    const checklistContent = document.querySelector(SELECTORS.prismaChecklistContent);
    if (!checklistContent) return;

    const items = Array.from(checklistContent.querySelectorAll('.prisma-item')).map(itemEl => {
        const checkbox = itemEl.querySelector('input[type="checkbox"]');
        return {
            id: checkbox.dataset.itemId,
            checked: checkbox.checked,
            notes: itemEl.querySelector('textarea').value
        };
    });

    showLoadingOverlay(true, MESSAGES.savingPrisma);
    try {
        await fetchAPI(API_ENDPOINTS.projectPrismaChecklist(appState.currentProject.id), {
            method: 'POST',
            body: { checklist: { ...appState.prismaChecklist, items } }
        });
        showToast(MESSAGES.prismaSaved, 'success');
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

export function exportPRISMAReport() {
    showToast(MESSAGES.prismaExportNotImplemented, 'info');
}

export async function handleRunATNAnalysis() {
    const projectId = appState.currentProject?.id;
    if (!projectId) {
        showToast(MESSAGES.noProjectSelected, 'warning');
        return;
    }

    try {
        showLoadingOverlay(true, MESSAGES.atnAnalysisStarted);

        const response = await fetchAPI(API_ENDPOINTS.projectRunAnalysis(projectId), {
            method: 'POST',
            body: JSON.stringify({
                type: 'atnscores' // CORRECTION : type spécifique
            })
        });

        // CORRECTION : Utilise job_id
        if (response.job_id) {
            showToast(MESSAGES.atnAnalysisJobStarted(response.job_id), 'success');
        }
    } catch (error) {
        showToast(`Erreur : ${error.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

// MODIFICATION : runProjectAnalysis est maintenant déclenché par les boutons sur les cartes
export async function runProjectAnalysis(analysisType) {
    if (!appState.currentProject?.id) {
        showToast(MESSAGES.selectProjectFirst, 'warning');
        return;
    }

    // Mappage pour les messages affichés à l utilisateur
    const analysisNames = {
        discussion: 'le brouillon de discussion',
        knowledge_graph: 'le graphe de connaissances',
        prisma_flow: 'le diagramme PRISMA',
        atn_scores: "l analyse ATN"
    };

    // Trouver la carte correspondante pour afficher le spinner
    const card = document.querySelector(`[data-action="run-analysis"][data-analysis-type="${analysisType}"]`)?.closest('.analysis-card');
    if (card) {
        card.classList.add('analysis-card--loading');
    } else {
        showLoadingOverlay(true, MESSAGES.startingAnalysis(analysisNames[analysisType] || analysisType));
    }

    try {
        const projectId = appState.currentProject.id;
        const validTypes = ['discussion', 'knowledge_graph', 'prisma_flow', 'meta_analysis', 'descriptive_stats'];
        if (!validTypes.includes(analysisType)) {
            showToast(MESSAGES.unknownAnalysisType, 'error');
            if (card) card.classList.remove('analysis-card--loading');
            if (!card) showLoadingOverlay(false);
            return;
        }

        const response = await fetchAPI(API_ENDPOINTS.projectRunAnalysis(projectId), {
            method: 'POST',
            body: { type: analysisType }
        });

        const jobId = response.job_id;
        if (jobId) {
            showToast(MESSAGES.analysisJobStarted(analysisNames[analysisType], jobId), 'success');
        } else {
            showToast(MESSAGES.analysisStartedSimple(analysisNames[analysisType]), 'success');
        }
    } catch (e) {
        showToast(`${MESSAGES.errorStartingAnalysis}: ${e.message}`, 'error');
        // The loading state on the card should be removed by a websocket event later
        if (!card) showLoadingOverlay(false);
    }
}


export function showRunAnalysisModal() {
    const content = `
        <div class="analysis-options">
            <div class="analysis-option" data-action="run-analysis" data-analysis-type="discussion">
                <div class="analysis-icon">📝</div>
                <div class="analysis-details">
                    <h4>Brouillon de Discussion</h4>
                    <p>Génère une ébauche de la section discussion de votre article.</p>
                </div>
            </div>
            <div class="analysis-option" data-action="run-analysis" data-analysis-type="knowledge_graph">
                <div class="analysis-icon">🌐</div>
                <div class="analysis-details">
                    <h4>Graphe de Connaissances</h4>
                    <p>Visualise les relations entre les articles et les concepts clés.</p>
                </div>
            </div>
            <div class="analysis-option" data-action="run-analysis" data-analysis-type="prisma_flow">
                <div class="analysis-icon">🌊</div>
                <div class="analysis-details">
                    <h4>Diagramme PRISMA</h4>
                    <p>Génère le diagramme de flux de sélection des études.</p>
                </div>
            </div>
            <div class="analysis-option" data-action="run-analysis" data-analysis-type="meta_analysis">
                <div class="analysis-icon">📊</div>
                <div class="analysis-details">
                    <h4>Méta-analyse (scores)</h4>
                    <p>Analyse la distribution des scores de pertinence.</p>
                </div>
            </div>
             <div class="analysis-option" data-action="run-analysis" data-analysis-type="descriptive_stats">
                <div class="analysis-icon">📈</div>
                <div class="analysis-details">
                    <h4>Statistiques Descriptives</h4>
                    <p>Calcule les statistiques de base sur les données extraites.</p>
                </div>
            </div>
        </div>
    `;
    showModal(MESSAGES.advancedAnalysisModalTitle, content);
}

export function renderDiscussionDraft(draft) {
    if (!draft) return '';
    return `
        <div class="card" id="discussion-draft-card">
            <h4><i class="fas fa-file-alt"></i> Brouillon de la Discussion</h4>
            <div class="text-content">${escapeHtml(draft).replace(/\n/g, '<br>')}</div>
        </div>
    `;
}

export function renderKnowledgeGraph(graphData) {
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
        return `
            <div class="card" id="knowledge-graph-card">
                <h4><i class="fas fa-project-diagram"></i> Graphe de Connaissances</h4>
                <p class="text-muted">${MESSAGES.noDataForGraph}</p>
            </div>
        `;
    }
    return `
        <div class="card" id="knowledge-graph-card">
            <h4><i class="fas fa-project-diagram"></i> Graphe de Connaissances</h4> 
            <div id="knowledge-graph-container" class="knowledge-graph-container"></div>
            <p class="help-text">${MESSAGES.graphStats(graphData.nodes.length, graphData.edges.length)}</p>
        </div>
    `;
}

export function initializeKnowledgeGraph(data) {
    const container = document.querySelector(SELECTORS.knowledgeGraphContainer);
    if (!container || typeof vis === 'undefined') return;

    const nodes = new vis.DataSet(data.nodes);
    const edges = new vis.DataSet(data.edges);

    const graphData = { nodes, edges };
    const options = {
        nodes: {
            shape: 'box',
            margin: 10,
            widthConstraint: {
                maximum: 200
            },
            font: {
                color: '#fff' // Texte en blanc pour le mode sombre
            }
        },
        edges: {
            arrows: 'to',
            font: {
                align: 'horizontal',
                color: '#fff',
                strokeWidth: 2,
                strokeColor: '#222'
            }
        },
        physics: {
            forceAtlas2Based: {
                gravitationalConstant: -26,
                centralGravity: 0.005,
                springLength: 230,
                springConstant: 0.18
            },
            maxVelocity: 146,
            solver: 'forceAtlas2Based',
            timestep: 0.35,
            stabilization: { iterations: 150 }
        },
        layout: {
            hierarchical: false
        }
    };
    new vis.Network(container, graphData, options);
}

export function renderPrismaFlow(prismaPath) {
    if (!prismaPath) return '';
    // On ajoute un timestamp pour forcer le rechargement de l antimage
    const cacheBuster = new Date().getTime();
    return `
        <div class="card" id="prisma-flow-card">
            <h4><i class="fas fa-sitemap"></i> Diagramme de flux PRISMA</h4>
            <img src="${prismaPath}?v=${cacheBuster}" alt="Diagramme PRISMA" style="max-width:100%; height:auto; border-radius: var(--radius-base);"> 
        </div>
    `;
}

export function renderGenericAnalysisResult(title, analysis) {
    if (!analysis) return '';
     let content;
    if (typeof analysis === 'object' && analysis !== null) {
        content = `<pre class="code-block">${escapeHtml(JSON.stringify(analysis, null, 2))}</pre>`;
    } else {
        content = `<div class="text-content">${escapeHtml(analysis)}</div>`;
    }
    return `
        <div class="analysis-card">
            <h4><i class="fas fa-chart-bar"></i> ${title}</h4>
            ${content}
        </div>
    `;
}



export async function handleRunPrismaFlow(event) {
    if (!appState.currentProject?.id) return;
    const card = event.target.closest('.analysis-card');
    if (card) card.classList.add('analysis-card--loading');

    try {
        await fetchAPI(API_ENDPOINTS.projectRunAnalysis(appState.currentProject.id), { method: 'POST', body: { type: 'prisma_flow' } });
        showToast(MESSAGES.analysisStartedSimple('le diagramme PRISMA'), 'success');
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        if (card) card.classList.remove('analysis-card--loading');
    }
}

export async function handleRunMetaAnalysis() {
    if (!appState.currentProject?.id) return;
    showLoadingOverlay(true, MESSAGES.startingMetaAnalysis);
    try {
        await fetchAPI(API_ENDPOINTS.projectRunAnalysis(appState.currentProject.id), { method: 'POST', body: { type: 'meta_analysis' } });
        showToast(MESSAGES.metaAnalysisStarted, 'success');
        closeModal();
    } finally {
        showLoadingOverlay(false);
    }
}


export async function handleRunDescriptiveStats() {
    if (!appState.currentProject?.id) return;
    showLoadingOverlay(true, MESSAGES.startingDescriptiveStats);
    try {
        await fetchAPI(API_ENDPOINTS.projectRunAnalysis(appState.currentProject.id), { method: 'POST', body: { type: 'descriptive_stats' } });
        showToast(MESSAGES.descriptiveStatsStarted, 'success');
        closeModal();
    } finally {
        showLoadingOverlay(false);
    }
}

/**
 * Exporte les résultats d analyse (données brutes et graphiques).
 */
export async function exportAnalyses() {
    if (!appState.currentProject?.id) {
        showToast(MESSAGES.selectProjectToExportAnalyses, 'warning');
        return;
    }

    try {
        showLoadingOverlay(true, MESSAGES.preparingExport);
        // L URL pointe vers l endpoint backend qui génère le fichier ZIP
        const exportUrl = `/api${API_ENDPOINTS.projectExportAnalyses(appState.currentProject.id)}`;

        // Ouvre une nouvelle fenêtre pour déclencher le téléchargement du fichier
        window.open(exportUrl, '_blank');

        showToast(MESSAGES.analysisExportStarted, 'info');
    } catch (error) {
        console.error("Erreur lors de l exportation des analyses:", error);
        showToast(`${MESSAGES.errorExportingAnalyses} : ${error.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}