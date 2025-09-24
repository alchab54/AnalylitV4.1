// web/js/reporting.js

import { API_ENDPOINTS, SELECTORS, MESSAGES } from './constants.js';
import { fetchAPI } from './api.js';
import { showToast, showError } from './toast.js';
import { appState } from './app-improved.js';

const reportingModule = (() => {
    let currentProjectId = null;

    const getReportingContainer = () => document.querySelector(SELECTORS.reportingContainer);
    const getGenerateBibliographyBtn = () => document.querySelector('#generateBibliographyBtn');
    const getGenerateSummaryTableBtn = () => document.querySelector('#generateSummaryTableBtn');
    const getExportExcelBtn = () => document.querySelector('#exportExcelBtn');

    const init = () => {
        console.log('Reporting module initialized.');
        document.addEventListener('projectSelected', handleProjectSelected);

        const bibBtn = getGenerateBibliographyBtn();
        if (bibBtn) {
            bibBtn.addEventListener('click', handleGenerateBibliography);
        }

        const summaryBtn = getGenerateSummaryTableBtn();
        if (summaryBtn) {
            summaryBtn.addEventListener('click', handleGenerateSummaryTable);
        }

        const excelBtn = getExportExcelBtn();
        if (excelBtn) {
            excelBtn.addEventListener('click', handleExportExcel);
        }
    };

    const handleProjectSelected = (event) => {
        currentProjectId = event.detail.projectId;
        if (currentProjectId) {
            getReportingContainer().classList.remove('hidden');
            // Potentially load existing reports or enable buttons
        } else {
            getReportingContainer().classList.add('hidden');
        }
    };

    const handleGenerateBibliography = async () => {
        if (!currentProjectId) {
            showError(MESSAGES.selectProjectFirst);
            return;
        }
        try {
            const response = await fetchAPI(API_ENDPOINTS.reportBibliography(currentProjectId));
            showToast(response.message || 'Génération de la bibliographie lancée.', 'info');
            // Further logic to poll for task status or display result
        } catch (error) {
            showError('Erreur lors du lancement de la génération de la bibliographie.');
            console.error('Error generating bibliography:', error);
        }
    };

    const handleGenerateSummaryTable = async () => {
        if (!currentProjectId) {
            showError(MESSAGES.selectProjectFirst);
            return;
        }
        try {
            const response = await fetchAPI(API_ENDPOINTS.reportSummaryTable(currentProjectId));
            showToast(response.message || 'Génération du tableau de synthèse lancée.', 'info');
            // Further logic to poll for task status or display result
        } catch (error) {
            showError('Erreur lors du lancement de la génération du tableau de synthèse.');
            console.error('Error generating summary table:', error);
        }
    };

    const handleExportExcel = async () => {
        if (!currentProjectId) {
            showError(MESSAGES.selectProjectFirst);
            return;
        }
        try {
            const response = await fetchAPI(API_ENDPOINTS.reportExcelExport(currentProjectId));
            showToast(response.message || 'Export Excel lancé.', 'info');
            // Further logic to poll for task status or trigger download
        } catch (error) {
            showError('Erreur lors du lancement de l\'export Excel.');
            console.error('Error exporting Excel:', error);
        }
    };

    return {
        init,
    };
})();

export default reportingModule;

// === Export manquant : exportSummaryTableExcel ===
function exportSummaryTableExcel(data, filename = 'summary_table.xlsx') {
    console.log('Exporting summary table to Excel:', filename);
    
    try {
        if (typeof XLSX !== 'undefined') {
            // Export Excel avec librairie XLSX
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Summary");
            XLSX.writeFile(wb, filename);
            
            if (typeof showToast === 'function') {
                showToast('Fichier Excel exporté avec succès', 'success');
            }
        } else {
            // Fallback JSON
            const jsonStr = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename.replace('.xlsx', '.json');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            if (typeof showToast === 'function') {
                showToast('Données exportées en JSON', 'info');
            }
        }
        return { success: true };
    } catch (error) {
        console.error('Erreur export Excel:', error);
        if (typeof showToast === 'function') {
            showToast('Erreur lors de l\'export', 'error');
        }
        return { success: false, error: error.message };
    }
}

function generateBibliography(articles, style = 'apa') {
    console.log('Generating bibliography:', articles?.length || 0, 'articles');
    
    if (!Array.isArray(articles)) return [];

    return articles.map((article, index) => {
        const authors = article.authors || 'Unknown Author';
        const title = article.title || 'Untitled';
        const journal = article.journal || 'Unknown Journal';
        const year = article.year || article.publication_date || 'n.d.';
        
        return {
            id: article.id || index + 1,
            citation: `${authors} (${year}). ${title}. ${journal}.`,
            raw: article
        };
    });
}

// === Export manquant : generateSummaryTable ===
function generateSummaryTable(data, options = {}) {
    console.log('Generating summary table for', data?.length || 0, 'items');
    
    if (!Array.isArray(data)) {
        console.warn('generateSummaryTable: data should be an array');
        return { headers: [], rows: [], total: 0 };
    }
    
    try {
        // Configuration par défaut
        const config = {
            includeStats: options.includeStats !== false,
            groupBy: options.groupBy || null,
            sortBy: options.sortBy || 'title',
            maxRows: options.maxRows || 1000,
            ...options
        };
        
        // Génération des en-têtes
        const headers = [
            'ID', 'Titre', 'Auteurs', 'Journal', 
            'Année', 'Type', 'Statut'
        ];
        
        if (config.includeStats) {
            headers.push('Score', 'Citations');
        }
        
        // Génération des lignes
        const rows = data.slice(0, config.maxRows).map((item, index) => {
            const row = [
                item.id || index + 1,
                item.title || 'Sans titre',
                item.authors || 'Auteur inconnu',
                item.journal || 'Journal inconnu',
                item.year || item.publication_date || 'N/A',
                item.type || 'Article',
                item.status || 'Non évalué'
            ];
            
            if (config.includeStats) {
                row.push(item.score || 0);
                row.push(item.citations || 0);
            }
            
            return row;
        });
        
        // Statistiques
        const summary = {
            headers,
            rows,
            total: data.length,
            displayed: rows.length,
            truncated: data.length > config.maxRows
        };
        
        console.log('Summary table generated:', summary.displayed, 'rows displayed,', summary.total, 'total items');
        return summary;
        
    } catch (error) {
        console.error('Erreur génération tableau résumé:', error);
        return { 
            headers: ['Erreur'], 
            rows: [['Erreur lors de la génération du tableau']], 
            total: 0,
            error: error.message 
        };
    }
}

// === Export manquant : renderReportingSection ===
function renderReportingSection(containerId, projectId = null) {
    console.log('Rendering reporting section for project:', projectId);
    
    const container = document.getElementById(containerId) || document.querySelector(containerId);
    if (!container) {
        console.error('Container not found:', containerId);
        return false;
    }
    
    try {
        // Template HTML pour la section reporting
        const reportingHTML = `
            <div class="reporting-section">
                <div class="reporting-header mb-4">
                    <h3><i class="fas fa-chart-bar"></i> Rapports et Exports</h3>
                    <p class="text-muted">Générez des rapports et exportez vos données d'analyse</p>
                </div>
                
                <div class="reporting-actions">
                    <div class="row g-3">
                        <div class="col-md-4">
                            <div class="card h-100 border-0 shadow-sm">
                                <div class="card-body text-center">
                                    <div class="mb-3">
                                        <i class="fas fa-book fa-2x text-primary"></i>
                                    </div>
                                    <h5 class="card-title">Bibliographie</h5>
                                    <p class="card-text text-muted small">
                                        Générer la bibliographie complète au format APA
                                    </p>
                                    <button id="generateBibliographyBtn" 
                                            class="btn btn-outline-primary btn-sm" 
                                            ${!projectId ? 'disabled title="Sélectionnez un projet"' : ''}>
                                        <i class="fas fa-file-alt me-1"></i> Générer
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <div class="col-md-4">
                            <div class="card h-100 border-0 shadow-sm">
                                <div class="card-body text-center">
                                    <div class="mb-3">
                                        <i class="fas fa-table fa-2x text-info"></i>
                                    </div>
                                    <h5 class="card-title">Tableau de synthèse</h5>
                                    <p class="card-text text-muted small">
                                        Créer un tableau récapitulatif des articles
                                    </p>
                                    <button id="generateSummaryTableBtn" 
                                            class="btn btn-outline-info btn-sm" 
                                            ${!projectId ? 'disabled title="Sélectionnez un projet"' : ''}>
                                        <i class="fas fa-th-list me-1"></i> Générer
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <div class="col-md-4">
                            <div class="card h-100 border-0 shadow-sm">
                                <div class="card-body text-center">
                                    <div class="mb-3">
                                        <i class="fas fa-file-excel fa-2x text-success"></i>
                                    </div>
                                    <h5 class="card-title">Export Excel</h5>
                                    <p class="card-text text-muted small">
                                        Exporter toutes les données au format Excel
                                    </p>
                                    <button id="exportExcelBtn" 
                                            class="btn btn-outline-success btn-sm" 
                                            ${!projectId ? 'disabled title="Sélectionnez un projet"' : ''}>
                                        <i class="fas fa-download me-1"></i> Exporter
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="reporting-results mt-4">
                    <div id="reportingOutput" class="d-none">
                        <div class="alert alert-info">
                            <h6><i class="fas fa-info-circle me-2"></i>Résultats</h6>
                            <div id="reportingContent">Les résultats apparaîtront ici...</div>
                        </div>
                    </div>
                </div>
                
                <div class="reporting-help mt-3">
                    <div class="alert alert-light border-0">
                        <small class="text-muted">
                            <i class="fas fa-lightbulb me-1"></i>
                            <strong>Astuce :</strong> Sélectionnez d'abord un projet pour activer les fonctions de reporting.
                        </small>
                    </div>
                </div>
            </div>
        `;
        
        // Injecter le HTML
        container.innerHTML = reportingHTML;
        
        // Réinitialiser les événements du module reporting
        if (typeof reportingModule !== 'undefined' && reportingModule.init) {
            setTimeout(() => reportingModule.init(), 100);
        }
        
        console.log('Reporting section rendered successfully for container:', containerId);
        return true;
        
    } catch (error) {
        console.error('Erreur lors du rendu de la section reporting:', error);
        container.innerHTML = `
            <div class="alert alert-danger">
                <h4><i class="fas fa-exclamation-triangle me-2"></i>Erreur de chargement</h4>
                <p class="mb-1">Impossible de charger la section reporting.</p>
                <small>Détails : ${error.message}</small>
                <hr>
                <button class="btn btn-sm btn-outline-danger" onclick="location.reload()">
                    <i class="fas fa-redo me-1"></i> Rafraîchir la page
                </button>
            </div>
        `;
        return false;
    }
}

// Export final
export { 
    exportSummaryTableExcel,
    generateBibliography,
    generateSummaryTable,
    renderReportingSection
};


if (typeof window !== 'undefined') {
    window.exportSummaryTableExcel = exportSummaryTableExcel;
    window.generateSummaryTable = generateSummaryTable;
    window.renderReportingSection = renderReportingSection;
}

