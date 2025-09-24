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
