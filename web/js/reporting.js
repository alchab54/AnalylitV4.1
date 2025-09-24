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


// Export final
export { 
    exportSummaryTableExcel,
    generateBibliography,
    generateSummaryTable
};

if (typeof window !== 'undefined') {
    window.exportSummaryTableExcel = exportSummaryTableExcel;
    window.generateSummaryTable = generateSummaryTable;
}
