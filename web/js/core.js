// web/js/core.js
import { loadSearchResults } from './articles.js';

export function getStatusClass(status) {
    const s = (status || 'pending').toLowerCase();
    if (s.includes('completed') || s.includes('finished')) return 'status--success';
    if (s.includes('error') || s.includes('failed')) return 'status--error';
    if (s.includes('processing') || s.includes('running') || s.includes('searching')) return 'status--warning';
    if (s.includes('pending')) return 'status--info';
    return 'status--secondary';
}


export async function initializeApplication() {
    showLoadingOverlay(true, 'Chargement initial des données...');
    try {
        await loadInitialData();
        await loadProjects(); // Assurez-vous que loadProjects est bien appelée
        renderProjectList();
        initializeWebSocket();
        // Initialisation des gestionnaires d'événements pour les modales
        document.getElementById('newProjectForm').addEventListener('submit', handleCreateProject);
        document.getElementById('createProjectBtn').addEventListener('click', () => showModal('newProjectModal'));
        document.getElementById('runFullExtractionBtn').addEventListener('click', showRunExtractionModal);
        document.getElementById('manualArticleForm').addEventListener('submit', handleAddManualArticles);
        document.getElementById('multiDbSearchBtn').addEventListener('click', handleMultiDatabaseSearch);
        document.getElementById('multiDbSearchForm').addEventListener('submit', handleMultiDatabaseSearch); // Pour la soumission par Entrée
        document.getElementById('zoteroFileInput').addEventListener('change', handleZoteroFileUpload);
        document.getElementById('bulkPDFInput').addEventListener('change', handleBulkPDFUpload);
        document.getElementById('runIndexingBtn').addEventListener('click', handleRunIndexing);
        document.getElementById('importZoteroPdfsBtn').addEventListener('click', handleImportZoteroPdfs);
        
        // Gestionnaires d'événements pour la navigation
        elements.navButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                showSection(e.target.dataset.section);
            });
        });

        // Gestionnaire pour le bouton de suppression d'articles sélectionnés
        const deleteSelectedBtn = document.getElementById('deleteSelectedArticlesBtn');
        if (deleteSelectedBtn) {
            deleteSelectedBtn.addEventListener('click', handleDeleteSelectedArticles);
        }

        // Gestionnaire pour le bouton de traitement par lot
        const batchProcessBtn = document.getElementById('batchProcessBtn');
        if (batchProcessBtn) {
            batchProcessBtn.addEventListener('click', showBatchProcessModal);
        }

        // Gestionnaire pour le bouton de lancement de l'analyse RoB
        const runRobAnalysisBtn = document.getElementById('runRobAnalysisBtn');
        if (runRobAnalysisBtn) {
            runRobAnalysisBtn.addEventListener('click', handleRunRobAnalysis);
        }

        // Gestionnaire pour le bouton de lancement de l'analyse ATN
        const runATNAnalysisBtn = document.getElementById('runATNAnalysisBtn');
        if (runATNAnalysisBtn) {
            runATNAnalysisBtn.addEventListener('click', runATNAnalysis);
        }

        // Gestionnaire pour le bouton de gestion des parties prenantes
        const manageStakeholdersBtn = document.getElementById('manageStakeholdersBtn');
        if (manageStakeholdersBtn) {
            manageStakeholdersBtn.addEventListener('click', showStakeholderManagement);
        }

        // Gestionnaire pour le bouton d'export des analyses
        const exportAnalysesBtn = document.getElementById('exportAnalysesBtn');
        if (exportAnalysesBtn) {
            exportAnalysesBtn.addEventListener('click', exportAnalyses);
        }

        // Gestionnaire pour le bouton de calcul du Kappa
        const calculateKappaBtn = document.getElementById('calculateKappaBtn');
        if (calculateKappaBtn) {
            calculateKappaBtn.addEventListener('click', calculateKappa);
        }

        // Gestionnaire pour le bouton d'export du rapport PRISMA
        const exportPRISMAReportBtn = document.getElementById('exportPRISMAReportBtn');
        if (exportPRISMAReportBtn) {
            exportPRISMAReportBtn.addEventListener('click', exportPRISMAReport);
        }

        // Gestionnaire pour le bouton d'export pour la thèse
        const exportForThesisBtn = document.getElementById('exportForThesisBtn');
        if (exportForThesisBtn) {
            exportForThesisBtn.addEventListener('click', exportForThesis);
        }

        // Gestionnaire pour le bouton de création de profil
        const createProfileBtn = document.getElementById('createProfileBtn');
        if (createProfileBtn) {
            createProfileBtn.addEventListener('click', showCreateProfileModal);
        }

        // Gestionnaire pour le bouton de téléchargement de modèle Ollama
        const pullModelBtn = document.getElementById('pullModelBtn');
        if (pullModelBtn) {
            pullModelBtn.addEventListener('click', showPullModelModal);
        }

        // Gestionnaire pour le bouton de sauvegarde du prompt
        const savePromptBtn = document.getElementById('savePromptBtn');
        if (savePromptBtn) {
            savePromptBtn.addEventListener('click', handleEditPrompt);
        }

        // Gestionnaire pour le bouton de création de grille
        const createGridBtn = document.getElementById('createGridBtn');
        if (createGridBtn) {
            createGridBtn.addEventListener('click', () => openGridModal('create'));
        }

        // Gestionnaire pour le bouton de soumission de grille
        const gridForm = document.getElementById('gridForm');
        if (gridForm) {
            gridForm.addEventListener('submit', handleGridFormSubmit);
        }

        // Gestionnaire pour le bouton d'ajout manuel d'articles
        const addManualArticlesBtn = document.getElementById('addManualArticlesBtn');
        if (addManualArticlesBtn) {
            addManualArticlesBtn.addEventListener('click', showAddManualArticlesModal);
        }

        // Gestionnaire pour le bouton de recherche multi-bases
        const multiDbSearchBtn = document.getElementById('multiDbSearchBtn');
        if (multiDbSearchBtn) {
            multiDbSearchBtn.addEventListener('click', handleMultiDatabaseSearch);
        }

        // Gestionnaire pour le bouton de lancement de l'analyse avancée
        const runAdvancedAnalysisBtn = document.getElementById('runAdvancedAnalysisBtn');
        if (runAdvancedAnalysisBtn) {
            runAdvancedAnalysisBtn.addEventListener('click', showRunAnalysisModal);
        }

        // Gestionnaire pour le bouton de validation manuelle
        const validateArticleBtn = document.getElementById('validateArticleBtn');
        if (validateArticleBtn) {
            validateArticleBtn.addEventListener('click', validateArticle);
        }

        // Gestionnaire pour le bouton de toggle abstract
        const toggleAbstractBtn = document.getElementById('toggleAbstractBtn');
        if (toggleAbstractBtn) {
            toggleAbstractBtn.addEventListener('click', toggleAbstractRow);
        }

        // Gestionnaire pour le bouton de sélection de tous les articles
        const selectAllArticlesBtn = document.getElementById('selectAllArticlesBtn');
        if (selectAllArticlesBtn) {
            selectAllArticlesBtn.addEventListener('click', selectAllArticles);
        }

        // Gestionnaire pour le bouton de suppression des articles sélectionnés
        const deleteSelectedArticlesBtn = document.getElementById('deleteSelectedArticlesBtn');
        if (deleteSelectedArticlesBtn) {
            deleteSelectedArticlesBtn.addEventListener('click', handleDeleteSelectedArticles);
        }

        // Gestionnaire pour le bouton de traitement par lot
        const batchProcessModalBtn = document.getElementById('batchProcessModalBtn');
        if (batchProcessModalBtn) {
            batchProcessModalBtn.addEventListener('click', showBatchProcessModal);
        }

        // Gestionnaire pour le bouton de lancement du traitement par lot
        const startBatchProcessingBtn = document.getElementById('startBatchProcessingBtn');
        if (startBatchProcessingBtn) {
            startBatchProcessingBtn.addEventListener('click', startBatchProcessing);
        }

        // Gestionnaire pour le bouton de lancement de l'extraction complète
        const showRunExtractionModalBtn = document.getElementById('showRunExtractionModalBtn');
        if (showRunExtractionModalBtn) {
            showRunExtractionModalBtn.addEventListener('click', showRunExtractionModal);
        }

        // Gestionnaire pour le bouton de lancement de l'extraction complète
        const startFullExtractionBtn = document.getElementById('startFullExtractionBtn');
        if (startFullExtractionBtn) {
            startFullExtractionBtn.addEventListener('click', startFullExtraction);
        }

        // Gestionnaire pour le bouton de récupération des PDFs en ligne
        const fetchOnlinePdfsBtn = document.getElementById('fetchOnlinePdfsBtn');
        if (fetchOnlinePdfsBtn) {
            fetchOnlinePdfsBtn.addEventListener('click', handleFetchOnlinePdfs);
        }

        // Gestionnaire pour le bouton de lancement de l'analyse RoB
        const handleRunRobAnalysisBtn = document.getElementById('handleRunRobAnalysisBtn');
        if (handleRunRobAnalysisBtn) {
            handleRunRobAnalysisBtn.addEventListener('click', handleRunRobAnalysis);
        }

        // Gestionnaire pour le bouton de toggle select all
        const toggleSelectAllBtn = document.getElementById('toggleSelectAllBtn');
        if (toggleSelectAllBtn) {
            toggleSelectAllBtn.addEventListener('click', toggleSelectAll);
        }

        // Gestionnaire pour le bouton de suppression des articles sélectionnés
        const handleDeleteSelectedArticlesBtn = document.getElementById('handleDeleteSelectedArticlesBtn');
        if (handleDeleteSelectedArticlesBtn) {
            handleDeleteSelectedArticlesBtn.addEventListener('click', handleDeleteSelectedArticles);
        }

        // Gestionnaire pour le bouton de lancement de l'analyse ATN
        const runATNAnalysisBtn2 = document.getElementById('runATNAnalysisBtn');
        if (runATNAnalysisBtn2) {
            runATNAnalysisBtn2.addEventListener('click', runATNAnalysis);
        }

        // Gestionnaire pour le bouton de gestion des parties prenantes
        const manageStakeholdersBtn2 = document.getElementById('manageStakeholdersBtn');
        if (manageStakeholdersBtn2) {
            manageStakeholdersBtn2.addEventListener('click', showStakeholderManagement);
        }

        // Gestionnaire pour le bouton d'export des analyses
        const exportAnalysesBtn2 = document.getElementById('exportAnalysesBtn');
        if (exportAnalysesBtn2) {
            exportAnalysesBtn2.addEventListener('click', exportAnalyses);
        }

        // Gestionnaire pour le bouton de calcul du Kappa
        const calculateKappaBtn2 = document.getElementById('calculateKappaBtn');
        if (calculateKappaBtn2) {
            calculateKappaBtn2.addEventListener('click', calculateKappa);
        }

        // Gestionnaire pour le bouton d'export du rapport PRISMA
        const exportPRISMAReportBtn2 = document.getElementById('exportPRISMAReportBtn');
        if (exportPRISMAReportBtn2) {
            exportPRISMAReportBtn2.addEventListener('click', exportPRISMAReport);
        }

        // Gestionnaire pour le bouton d'export pour la thèse
        const exportForThesisBtn2 = document.getElementById('exportForThesisBtn');
        if (exportForThesisBtn2) {
            exportForThesisBtn2.addEventListener('click', exportForThesis);
        }

        // Gestionnaire pour le bouton de création de profil
        const createProfileBtn2 = document.getElementById('createProfileBtn');
        if (createProfileBtn2) {
            createProfileBtn2.addEventListener('click', showCreateProfileModal);
        }

        // Gestionnaire pour le bouton de téléchargement de modèle Ollama
        const pullModelBtn2 = document.getElementById('pullModelBtn');
        if (pullModelBtn2) {
            pullModelBtn2.addEventListener('click', showPullModelModal);
        }

        // Gestionnaire pour le bouton de sauvegarde du prompt
        const savePromptBtn2 = document.getElementById('savePromptBtn');
        if (savePromptBtn2) {
            savePromptBtn2.addEventListener('click', handleEditPrompt);
        }

        // Gestionnaire pour le bouton de création de grille
        const createGridBtn2 = document.getElementById('createGridBtn');
        if (createGridBtn2) {
            createGridBtn2.addEventListener('click', () => openGridModal('create'));
        }

        // Gestionnaire pour le bouton de soumission de grille
        const gridForm2 = document.getElementById('gridForm');
        if (gridForm2) {
            gridForm2.addEventListener('submit', handleGridFormSubmit);
        }

        // Gestionnaire pour le bouton d'ajout manuel d'articles
        const addManualArticlesBtn2 = document.getElementById('addManualArticlesBtn');
        if (addManualArticlesBtn2) {
            addManualArticlesBtn2.addEventListener('click', showAddManualArticlesModal);
        }

        // Gestionnaire pour le bouton de recherche multi-bases
        const multiDbSearchBtn2 = document.getElementById('multiDbSearchBtn');
        if (multiDbSearchBtn2) {
            multiDbSearchBtn2.addEventListener('click', handleMultiDatabaseSearch);
        }

        // Gestionnaire pour le bouton de lancement de l'analyse avancée
        const runAdvancedAnalysisBtn3 = document.getElementById('runAdvancedAnalysisBtn');
        if (runAdvancedAnalysisBtn3) {
            runAdvancedAnalysisBtn3.addEventListener('click', showRunAnalysisModal);
        }

        // Gestionnaire pour le bouton de validation manuelle
        const validateArticleBtn2 = document.getElementById('validateArticleBtn');
        if (validateArticleBtn2) {
            validateArticleBtn2.addEventListener('click', validateArticle);
        }

        // Gestionnaire pour le bouton de toggle abstract
        const toggleAbstractBtn2 = document.getElementById('toggleAbstractBtn');
        if (toggleAbstractBtn2) {
            toggleAbstractBtn2.addEventListener('click', toggleAbstractRow);
        }

        // Gestionnaire pour le bouton de sélection de tous les articles
        const selectAllArticlesBtn2 = document.getElementById('selectAllArticlesBtn');
        if (selectAllArticlesBtn2) {
            selectAllArticlesBtn2.addEventListener('click', selectAllArticles);
        }

        // Gestionnaire pour le bouton de suppression des articles sélectionnés
        const deleteSelectedArticlesBtn3 = document.getElementById('deleteSelectedArticlesBtn');
        if (deleteSelectedArticlesBtn3) {
            deleteSelectedArticlesBtn3.addEventListener('click', handleDeleteSelectedArticles);
        }

        // Gestionnaire pour le bouton de traitement par lot
        const batchProcessModalBtn3 = document.getElementById('batchProcessModalBtn');
        if (batchProcessModalBtn3) {
            batchProcessModalBtn3.addEventListener('click', showBatchProcessModal);
        }

        // Gestionnaire pour le bouton de lancement du traitement par lot
        const startBatchProcessingBtn2 = document.getElementById('startBatchProcessingBtn');
        if (startBatchProcessingBtn2) {
            startBatchProcessingBtn2.addEventListener('click', startBatchProcessing);
        }

        // Gestionnaire pour le bouton de lancement de l'extraction complète
        const showRunExtractionModalBtn2 = document.getElementById('showRunExtractionModalBtn');
        if (showRunExtractionModalBtn2) {
            showRunExtractionModalBtn2.addEventListener('click', showRunExtractionModal);
        }

        // Gestionnaire pour le bouton de lancement de l'extraction complète
        const startFullExtractionBtn2 = document.getElementById('startFullExtractionBtn');
        if (startFullExtractionBtn2) {
            startFullExtractionBtn2.addEventListener('click', startFullExtraction);
        }

        // Gestionnaire pour le bouton de récupération des PDFs en ligne
        const handleFetchOnlinePdfsBtn3 = document.getElementById('handleFetchOnlinePdfsBtn');
        if (handleFetchOnlinePdfsBtn3) {
            handleFetchOnlinePdfsBtn3.addEventListener('click', handleFetchOnlinePdfs);
        }

        // Gestionnaire pour le bouton de lancement de l'analyse RoB
        const handleRunRobAnalysisBtn3 = document.getElementById('handleRunRobAnalysisBtn');
        if (handleRunRobAnalysisBtn3) {
            handleRunRobAnalysisBtn3.addEventListener('click', handleRunRobAnalysis);
        }

        // Gestionnaire pour le bouton de toggle select all
        const toggleSelectAllBtn2 = document.getElementById('toggleSelectAllBtn');
        if (toggleSelectAllBtn2) {
            toggleSelectAllBtn2.addEventListener('click', toggleSelectAll);
        }

        // Gestionnaire pour le bouton de suppression des articles sélectionnés
        const handleDeleteSelectedArticlesBtn3 = document.getElementById('handleDeleteSelectedArticlesBtn');
        if (handleDeleteSelectedArticlesBtn3) {
            handleDeleteSelectedArticlesBtn3.addEventListener('click', handleDeleteSelectedArticles);
        }
    } catch (e) {
        console.error('Erreur lors de l'initialisation de l'application:', e);
        showToast(`Erreur critique: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}
