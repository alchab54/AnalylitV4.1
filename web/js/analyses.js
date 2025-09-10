import { appState, elements } from '../app.js';
import { fetchAPI } from './api.js';
import { showToast, showLoadingOverlay, escapeHtml } from './ui.js';

export async function loadProjectAnalyses() {
    if (!appState.currentProject) {
        if (elements.analysisContainer) {
            elements.analysisContainer.innerHTML = '<p>Sélectionnez un projet pour voir les analyses.</p>';
        }
        return;
    }
    
    try {
        const analyses = await fetchAPI(`/projects/${appState.currentProject.id}/analyses`);
        appState.analysisResults = analyses || {};
        renderAnalysesSection();
    } catch (e) {
        console.error('Erreur chargement analyses:', e);
        showToast('Erreur lors du chargement des analyses', 'error');
    }
}

export function exportAnalyses() {
    if (!appState.currentProject?.id) {
        showToast('Veuillez sélectionner un projet.', 'warning');
        return;
    }
    // Ouvre l'URL de l'endpoint d'export dans un nouvel onglet, ce qui déclenche le téléchargement
    window.open(`/api/projects/${appState.currentProject.id}/export-analyses`, '_blank');
    showToast('Export des analyses en cours de téléchargement...', 'info');
}

export function renderAnalysesSection() {
    if (!elements.analysisContainer) return;
    const analysis = appState.analysisResults || null;
    const project = appState.currentProject;
    const plotPath = project && project.analysis_plot_path || null;
    const knowledgeGraphData = project && project.knowledge_graph ? JSON.parse(project.knowledge_graph) : null;

    elements.analysisContainer.innerHTML = `
        <div class="card">
            <div class="card__header"><h4>📊 Analyses du projet</h4></div>
            <div class="card__body">
                <div id="knowledgeGraphContainer" style="width: 100%; height: 600px; border: 1px solid var(--color-border); border-radius: var(--radius-lg); margin-bottom: 24px;">
                    ${!knowledgeGraphData ? '<div class="empty-state"><p>Générez le graphe de connaissances pour le visualiser ici.</p></div>' : ''}
                </div>
                ${analysis ? `<pre class="code-block">${escapeHtml(JSON.stringify(analysis, null, 2))}</pre>` : `
                    <div class="empty-state">
                        <p>Aucune analyse disponible pour le moment.</p>
                    </div>`
                }
                ${plotPath ? `<img src="/api/projects/${appState.currentProject.id}/files/${plotPath.split('/').pop()}" alt="Graphique d'analyse" style="max-width:100%;height:auto;margin-top:16px;">` : ''}
            </div>
        </div>
    `;

    if (knowledgeGraphData && window.vis) {
        const container = document.getElementById('knowledgeGraphContainer');
        const options = {
            nodes: {
                shape: 'dot',
                size: 16,
                font: { size: 14, color: 'var(--color-text)' }
            },
            edges: {
                width: 2,
                color: { inherit: 'from' },
                arrows: { to: { enabled: true, scaleFactor: 0.5 } }
            },
            physics: {
                forceAtlas2Based: { gravitationalConstant: -26, centralGravity: 0.005, springLength: 230, springConstant: 0.18 },
                maxVelocity: 146,
                solver: 'forceAtlas2Based',
                timestep: 0.35,
            },
        };
        new vis.Network(container, knowledgeGraphData, options);
    }
}

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

    try {
        showLoadingOverlay(true, `Lancement de la génération pour ${analysisNames[analysisType] || analysisType}...`);
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
    } finally {
        showLoadingOverlay(false);
    }
}

export function renderDiscussionDraft(draft) {
    if (!draft) return '';
    return `
        <div class="analysis-card">
            <h4><i class="fas fa-file-alt"></i> Brouillon de la Discussion</h4>
            <div class="text-content">${escapeHtml(draft).replace(/\n/g, '<br>')}</div>
        </div>
    `;
}

export function renderKnowledgeGraph(graphData) {
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
         return `
            <div class="analysis-card">
                <h4><i class="fas fa-project-diagram"></i> Graphe de Connaissances</h4>
                <p class="status-message">Aucune donnée pour le graphe. Lancez l\'analyse pour le générer.</p>
            </div>
        `;
    }
    return `
        <div class="analysis-card">
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
        <div class="analysis-card">
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

export async function handleRunDiscussionDraft() {
    if (!appState.currentProject?.id) return;
    showLoadingOverlay(true, 'Génération du brouillon de discussion...');
    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/run-discussion-draft`, { method: 'POST' });
        showToast('Tâche de génération lancée.', 'success');
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

export async function handleRunKnowledgeGraph() {
    if (!appState.currentProject?.id) return;
    showLoadingOverlay(true, 'Génération du graphe...');
    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/run-knowledge-graph`, { method: 'POST' });
        showToast('Génération du graphe de connaissances lancée.', 'success');
    } finally {
        showLoadingOverlay(false);
    }
}

export async function handleRunPrismaFlow() {
    if (!appState.currentProject?.id) return;
    showLoadingOverlay(true, 'Génération du diagramme PRISMA...');
    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/run-prisma-flow`, { method: 'POST' });
        showToast('Génération du diagramme PRISMA lancée.', 'success');
    } finally {
        showLoadingOverlay(false);
    }
}

export async function handleRunMetaAnalysis() {
    if (!appState.currentProject?.id) return;
    showLoadingOverlay(true, 'Lancement de la méta-analyse...');
    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/run-meta-analysis`, { method: 'POST' });
        showToast('Méta-analyse lancée avec succès.', 'success');
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
    } finally {
        showLoadingOverlay(false);
    }
}
