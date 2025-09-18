import { appState, elements } from './app-improved.js';
import { fetchAPI } from './api.js';
import { setAnalysisResults } from './state.js';
import { showToast, showLoadingOverlay, escapeHtml, showModal, closeModal, openModal } from './ui-improved.js';

export async function loadProjectAnalyses() {
    if (!appState.currentProject) {
        if (elements.analysisContainer) {
            elements.analysisContainer.innerHTML = '<p>Sélectionnez un projet pour voir les analyses.</p>';
        }
        return;
    }
    
    try {
        const analyses = await fetchAPI(`/projects/${appState.currentProject.id}/analyses`);
        setAnalysisResults(analyses);
        renderAnalysesSection();
    } catch (e) {
        console.error('Erreur chargement analyses:', e);
        showToast('Erreur lors du chargement des analyses', 'error');
    }
}

export function renderAnalysesSection() {
    if (!elements.analysisContainer) return;
    const project = appState.currentProject;

    if (!project) {
        elements.analysisContainer.innerHTML = `<div class="empty-state"><p>Sélectionnez un projet pour voir les analyses.</p></div>`;
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
                <div class="analysis-card__body"><p class="analysis-card__description">Analyse spécialisée pour l'alliance thérapeutique numérique, incluant les scores d'empathie, types d'IA, et conformité réglementaire.</p></div>
                <div class="analysis-card__footer">
                    ${hasAtnAnalysis
                        ? `<button class="btn btn--secondary" data-action="view-analysis-results" data-target-id="atn-results-card">Voir les résultats</button>`
                        : `<button class="btn btn--primary" data-action="run-atn-analysis">Lancer l'Analyse ATN</button>`
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
                        : `<button class="btn btn--primary" data-action="run-discussion-draft">Générer la Discussion</button>`
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
                        : `<button class="btn btn--primary" data-action="run-knowledge-graph">Générer le Graphe</button>`
                    }
                </div>
            </div>
        </div>

        <div id="analysisResultContainer" class="mt-24">
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
        const container = document.getElementById('analysisResultContainer');
        container.innerHTML += renderDiscussionDraft(analysisResults.discussion_draft);
    }

    // AFFICHER LE DIAGRAMME PRISMA S'IL EXISTE
    if (analysisResults.prisma_flow_path) {
        const container = document.getElementById('analysisResultContainer');
        container.innerHTML += renderPrismaFlow(analysisResults.prisma_flow_path);
    }
}


// NOUVELLE FONCTION : pour afficher les résultats de l'analyse ATN
function renderATNResults(analysisData) {
    const container = document.getElementById('analysisResultContainer');
    if (!container) return '';

    const metrics = analysisData.atn_metrics || {};
    const tech = analysisData.technology_analysis || {};
    const ethical = analysisData.ethical_regulatory || {};

    const empathyMetrics = metrics.empathy_analysis || {};
    const allianceMetrics = metrics.alliance_metrics || {};

    container.innerHTML += `
        <div class="card" id="atn-results-card">
            <div class="card__header"><h4>Résultats de l'Analyse ATN</h4></div>
            <div class="card__body">
                <div class="atn-results">
                    <div class="metrics-section">
                        <h5>📊 Métriques d'Empathie & Alliance</h5>
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
                        <p><strong>Type d'IA le plus courant :</strong> ${tech.most_common_ai_type || 'N/A'}</p>
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
    const checklistContent = document.getElementById('prismaChecklistContent');
    if (!checklistContent) return;

    const items = Array.from(checklistContent.querySelectorAll('.prisma-item')).map(itemEl => {
        const checkbox = itemEl.querySelector('input[type="checkbox"]');
        return {
            id: checkbox.dataset.itemId,
            checked: checkbox.checked,
            notes: itemEl.querySelector('textarea').value
        };
    });

    showLoadingOverlay(true, 'Sauvegarde PRISMA...');
    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/prisma-checklist`, {
            method: 'POST',
            body: { checklist: { ...appState.prismaChecklist, items } }
        });
        showToast('Progression PRISMA sauvegardée.', 'success');
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

export function exportPRISMAReport() {
    showToast('Export PRISMA non implémenté.', 'info');
}

// NOUVELLE FONCTION : pour lancer l'analyse ATN
export async function handleRunATNAnalysis(event) {
    if (!appState.currentProject?.id) {
        showToast('Veuillez sélectionner un projet.', 'warning');
        return;
    }

    const card = event.target.closest('.analysis-card');
    if (card) {
        card.classList.add('analysis-card--loading');
    } else {
        showLoadingOverlay(true, "Lancement de l'analyse ATN...");
    }

    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/run-atn-analysis`, {
            method: 'POST'
        });
        showToast('Analyse ATN lancée. Les résultats apparaîtront une fois le calcul terminé.', 'success');
    } catch (e) {
        showToast(`Erreur : ${e.message}`, 'error');
        if (card) card.classList.remove('analysis-card--loading');
    } finally {
        // On ne retire pas le loading ici, on attend la notif WebSocket.
        // L'overlay global, s'il a été montré, doit être masqué.
        if (!card) showLoadingOverlay(false);
    }
}

// MODIFICATION : runProjectAnalysis est maintenant déclenché par les boutons sur les cartes
export async function runProjectAnalysis(analysisType) {
    if (!appState.currentProject?.id) {
        showToast('Veuillez d\'abord sélectionner un projet.', 'warning');
        return;
    }
    
    // Mappage pour les messages affichés à l'utilisateur
    const analysisNames = {
        discussion: 'le brouillon de discussion',
        knowledge_graph: 'le graphe de connaissances',
        prisma_flow: 'le diagramme PRISMA'
    };

    // Trouver la carte correspondante pour afficher le spinner
    const card = document.querySelector(`[data-action="run-${analysisType}"]`)?.closest('.analysis-card');
    if (card) {
        card.classList.add('analysis-card--loading');
    } else {
        showLoadingOverlay(true, `Lancement de la génération pour ${analysisNames[analysisType] || analysisType}...`);
    }

    try {
        
        // Note: L'endpoint varie en fonction de l'analyse
        let endpoint = '';
        switch(analysisType) {
            case 'discussion':
                endpoint = `/projects/${appState.currentProject.id}/run-discussion-draft`;
                break;
            case 'knowledge_graph':
                 endpoint = `/projects/${appState.currentProject.id}/run-knowledge-graph`;
                 break;
            case 'prisma_flow':
                endpoint = `/projects/${appState.currentProject.id}/run-prisma-flow`;
                break;
            default:
                showToast('Type d\'analyse inconnu.', 'error');
                return;
        }
        
        await fetchAPI(endpoint, { method: 'POST' });
        showToast(`La génération pour ${analysisNames[analysisType]} a été lancée.`, 'success');
    } catch (e) {
        showToast(`Erreur lors du lancement de l\'analyse: ${e.message}`, 'error');
        if (card) card.classList.remove('analysis-card--loading');
    } finally {
        // On ne retire pas le loading ici, on attend la notif WebSocket.
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
    showModal('Lancer une Analyse Avancée', content);
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
                <p class="text-muted">Aucune donnée pour le graphe. Lancez l'analyse pour le générer.</p>
            </div>
        `;
    }
    return `
        <div class="card" id="knowledge-graph-card">
            <h4><i class="fas fa-project-diagram"></i> Graphe de Connaissances</h4>
            <div id="knowledgeGraph" class="knowledge-graph-container"></div>
            <p class="help-text">${graphData.nodes.length} noeuds et ${graphData.edges.length} relations.</p>
        </div>
    `;
}

export function initializeKnowledgeGraph(data) {
    const container = document.getElementById('knowledgeGraph');
    if (!container || !vis) return;

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
    // On ajoute un timestamp pour forcer le rechargement de l\'image
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

export async function handleRunDiscussionDraft(event) {
    if (!appState.currentProject?.id) return;
    const card = event.target.closest('.analysis-card');
    if (card) card.classList.add('analysis-card--loading');

    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/run-discussion-draft`, { method: 'POST' });
        showToast('Tâche de génération lancée.', 'success');
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
        if (card) card.classList.remove('analysis-card--loading');
    }
}

export async function handleRunKnowledgeGraph(event) {
    if (!appState.currentProject?.id) return;
    const card = event.target.closest('.analysis-card');
    if (card) card.classList.add('analysis-card--loading');

    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/run-knowledge-graph`, { method: 'POST' });
        showToast('Génération du graphe de connaissances lancée.', 'success');
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
        if (card) card.classList.remove('analysis-card--loading');
    }
}

export async function handleRunPrismaFlow(event) {
    if (!appState.currentProject?.id) return;
    const card = event.target.closest('.analysis-card');
    if (card) card.classList.add('analysis-card--loading');

    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/run-prisma-flow`, { method: 'POST' });
        showToast('Génération du diagramme PRISMA lancée.', 'success');
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
        if (card) card.classList.remove('analysis-card--loading');
    }
}

export async function handleRunMetaAnalysis() {
    if (!appState.currentProject?.id) return;
    showLoadingOverlay(true, 'Lancement de la méta-analyse...');
    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/run-meta-analysis`, { method: 'POST' });
        showToast('Méta-analyse lancée avec succès.', 'success');
        closeModal();
    } finally {
        showLoadingOverlay(false);
    }
}


export async function handleRunDescriptiveStats() {
    if (!appState.currentProject?.id) return;
    showLoadingOverlay(true, 'Calcul des statistiques descriptives...');
    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/run-descriptive-stats`, { method: 'POST' });
        showToast('Calcul des statistiques lancé.', 'success');
        closeModal();
    } finally {
        showLoadingOverlay(false);
    }
}
