// web/js/import.js
import { appState } from './app-improved.js'; // Read from state
import { fetchAPI } from './api.js';         // La fonction API vient de son module dédié
import { showLoadingOverlay, showModal, closeModal, updateLoadingProgress, showToast } from './ui-improved.js'; // Corrected import
import { loadSearchResults } from './articles.js';
import { API_ENDPOINTS, MESSAGES, SELECTORS } from './constants.js';

// Cette fonction est appelée par le routeur principal, elle doit être exportée.
export function renderImportSection(project) {
  const container = document.querySelector(SELECTORS.importContainer);
  if (!container) return;

  if (!project) {
    container.innerHTML = `<div class="placeholder">${MESSAGES.selectProjectForImport}</div>`;
    return;
  }

  container.innerHTML = `
    <div class="section-header">
      <div class="section-header__content">
        <h2>Import & Fichiers</h2>
        <p>Import Zotero (JSON), récupération PDFs, indexation.</p>
      </div>
    </div>

    <div class="import-sections">
      <div class="import-card">
        <h3>📚 Importer un export Zotero (.json)</h3>
        <p>Ajoutez des références à votre projet à partir d'un fichier d'export Zotero.</p>
        <input type="file" id="zoteroFileInput" accept=".json" style="display:none" data-action="handle-zotero-import">
        <button class="btn" data-action="trigger-zotero-import">Choisir un fichier JSON</button>
      </div>

      <div class="import-card">
        <h3>📄 Uploader des PDFs (jusqu'à 20)</h3>
        <p>Associez directement des fichiers PDF à votre projet.</p>
        <input type="file" id="bulkPDFInput" accept=".pdf" multiple style="display:none" data-action="handle-pdf-upload">
        <button class="btn" data-action="trigger-upload-pdfs">Sélectionner PDFs</button>
      </div>

      <div class="import-card">
        <h3>🔍 Indexer les PDFs pour le Chat RAG</h3>
        <p>Permet à l'IA de lire le contenu de vos PDFs pour répondre à vos questions dans la section "Chat".</p>
        <button class="btn btn--secondary" data-action="index-pdfs">Indexer les PDFs</button>
      </div>

      <div class="import-card">
        <h3>📝 Ajouter des articles manuellement</h3>
        <p>Recherche automatique via Unpaywall pour les articles avec DOI.</p>
        <button class="btn" data-action="show-pmid-import-modal">Import manuel PMID/DOI</button>
      </div>

      <div class="import-card">
        <h3>🔄 Synchroniser avec Zotero</h3>
        <p>Synchronise les PDFs de votre bibliothèque Zotero.</p>
        <button class="btn" data-action="zotero-sync">Synchroniser Zotero</button>
      </div>

      <div class="import-card">
        <h3>📖 Export pour Thèse</h3>
        <p>Téléchargez un package complet avec données, graphiques haute résolution et rapports automatiques.</p>
        <button class="btn btn--primary" data-action="export-for-thesis">📚 Export Thèse Complet</button>
      </div>
    </div>
  `;
}

export function handleZoteroImport(target) {
  const fileInput = document.getElementById('zoteroFileInput');
  if (target && target.files && target.files.length > 0) {
    processZoteroFile(target.files);
  } else {
    fileInput.click();
  }
}

export function showPmidImportModal() {
  const content = `
    <form id="pmid-import-form" data-action="submit-pmid-import">
      <div class="form-group">
        <label for="pmid-list">PMIDs / DOI / arXiv ID (un par ligne)</label>
        <textarea id="pmid-list" rows="5" class="form-control" placeholder="32123456\n10.1038/s41586-020-2649-2\narXiv:2004.12345"></textarea>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn--secondary" data-action="close-modal">Annuler</button>
        <button type="submit" class="btn btn--primary">Importer</button>
      </div>
    </form>`;
  showModal(MESSAGES.manualImportTitle, content);
}

export function handleUploadPdfs(target) {
  const fileInput = document.getElementById('bulkPDFInput');
  if (target && target.files && target.files.length > 0) {
    processPdfUpload(target.files);
  } else {
    fileInput.click();
  }
}

export async function handleBulkPdfDownload() {
    if (!appState.currentProject) return; // Read from state
    showLoadingOverlay(true, MESSAGES.searchingFreePdfs);
    try {
        await fetchAPI(API_ENDPOINTS.projectBulkPdfDownload(appState.currentProject.id), { method: 'POST' });
        showToast(MESSAGES.pdfSearchStarted, 'info');
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false, '');
    }
}

export async function exportForThesis() {
    if (!appState.currentProject) { // Read from state
        showToast(MESSAGES.noProjectSelected, 'warning');
        return;
    }
    showLoadingOverlay(true, MESSAGES.generatingThesisExport);
    const exportUrl = API_ENDPOINTS.projectExportThesis(appState.currentProject.id);
    window.location.href = exportUrl;
    showLoadingOverlay(false);
}

export async function handleIndexPdfs() {
  if (!appState.currentProject) return; // Read from state
  
  // Affiche l'overlay avec un message initial et prépare la barre de progression
  showLoadingOverlay(true, MESSAGES.startingIndexing);
  updateLoadingProgress(0, 1, MESSAGES.startingIndexing); // Affiche la barre à 0%

  try {
    const data = await fetchAPI(API_ENDPOINTS.projectIndexPdfs(appState.currentProject.id), { method: 'POST' });
    // L'overlay est maintenant affiché avec une barre de progression.
    // CORRECTION : Utilisation de job_id au lieu de task_id pour la cohérence avec le backend.
    const jobId = data.job_id;
    console.log('Job ID:', jobId);
    showLoadingOverlay(true, MESSAGES.indexingInProgress, jobId);
    showToast(MESSAGES.indexingStarted, 'info');
  } catch (e) {
    showToast(`Erreur: ${e.message}`, 'error');
    showLoadingOverlay(false); // Masquer en cas d\'erreur de lancement
  }
}

export async function handleZoteroSync() {
  showToast(MESSAGES.zoteroSyncNotImplemented, 'info');
}

async function processZoteroFile(file) {
  if (!appState.currentProject) { // Read from state
    showToast(MESSAGES.selectProjectFirst, 'warning');
    return;
  }
  showLoadingOverlay(true, MESSAGES.importingZoteroFile);
  try {
    const formData = new FormData();
    formData.append('file', file[0]); // 'file' est le nom attendu par le backend
    const result = await fetchAPI(API_ENDPOINTS.projectImportZotero(appState.currentProject.id), { method: 'POST', body: formData }); // Corrected endpoint usage
    showToast(MESSAGES.zoteroImportSuccess(result.imported || 0), 'success');
    await loadSearchResults(); // Refresh results to show new articles
  } catch (e) {
    showToast(`${MESSAGES.zoteroImportError}: ${e.message}`, 'error');
  } finally {
    showLoadingOverlay(false, '');
  }
}

export async function processPmidImport(event) {
  event.preventDefault();
  // 1. LIRE LES VALEURS D'ABORD
  const pmidTextarea = document.getElementById('pmidDoiInput');
  if (!pmidTextarea) {
    showToast(MESSAGES.pmidImportFieldNotFound, 'error');
    return;
  }
  const pmidList = pmidTextarea.value;

  // 2. ENSUITE, FERMER LE MODAL
  closeModal();

  // 3. CONTINUER LE TRAITEMENT
  if (!appState.currentProject) { // Read from state
    showToast(MESSAGES.selectProjectFirst, 'warning');
    return;
  }

  const ids = pmidList.split('\n').map(s => s.trim()).filter(Boolean);
  if (ids.length === 0) {
    showToast(MESSAGES.atLeastOneIdRequired, 'warning');
    return;
  }
  showLoadingOverlay(true, MESSAGES.importingIds(ids.length));
  try {
    await fetchAPI(API_ENDPOINTS.projectAddManualArticles(appState.currentProject.id), { method: 'POST', body: { identifiers: ids } }); // Corrected endpoint usage
    showToast(MESSAGES.importStartedForIds(ids.length), 'success');
    await loadSearchResults();
  } catch (e) {
    showToast(`${MESSAGES.importError}: ${e.message}`, 'error');
  } finally {
    showLoadingOverlay(false, '');
  }
}

// --- Fonctions ajoutées pour la complétude de l'architecture ---

export async function handleSaveZoteroSettings(e) {
    e.preventDefault();
    const userId = document.getElementById('zoteroUserId').value.trim();
    const apiKey = document.getElementById('zoteroApiKey').value.trim();
    
    if (!userId || !apiKey) {
        return showToast(MESSAGES.zoteroCredentialsRequired, 'warning');
    }
    
    try {
        await fetchAPI(API_ENDPOINTS.zoteroSettings, {
            method: 'POST',
            body: { userId, apiKey }
        });
        showToast(MESSAGES.zoteroCredentialsSaved, 'success');
    } catch (error) {
        showToast(`Erreur lors de la sauvegarde : ${error.message}`, 'error');
    }
}

export function startZoteroStatusPolling(projectId) { /* ... logique de polling ... */ }

async function processPdfUpload(files) {
  if (!appState.currentProject) {
    showToast(MESSAGES.selectProjectFirst, 'warning');
    return;
  }
  if (files.length > 20) {
    showToast(MESSAGES.pdfUploadLimit, 'warning');
    return;
  }
  showLoadingOverlay(true, MESSAGES.uploadingPdfs(files.length));
  try {
    const formData = new FormData();
    [...files].forEach(f => formData.append('files', f));
    const result = await fetchAPI(API_ENDPOINTS.projectUploadPdfs(appState.currentProject.id), { method: 'POST', body: formData }); // Corrected endpoint usage
    showToast(MESSAGES.pdfsUploadedSuccess(result.successful_uploads?.length || 0), 'success');
    document.getElementById('bulkPDFInput').value = ''; // Reset file input
  } catch (e) {
    showToast(`${MESSAGES.uploadError}: ${e.message}`, 'error');
  } finally {
    showLoadingOverlay(false, '');
  }
}
