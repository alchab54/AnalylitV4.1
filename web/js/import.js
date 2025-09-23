// web/js/import.js
import { appState } from './app-improved.js'; // L'état global vient de l'entrypoint
import { fetchAPI } from './api.js';         // La fonction API vient de son module dédié
import { showToast, showLoadingOverlay, showModal, closeModal, updateLoadingProgress } from './ui-improved.js';
import { API_ENDPOINTS, MESSAGES, SELECTORS } from './constants.js';
import { loadSearchResults } from './articles.js';

// Cette fonction est appelée par le routeur principal, elle doit être exportée.
export function renderImportSection(project) {
  const container = document.querySelector(SELECTORS.importContainer);
  if (!container) return;

  if (!project) {
    container.innerHTML = `<div class="placeholder">${MESSAGES.selectProjectForImport}</div>`;
    return;
  }

  container.innerHTML = "
    <div class=\"section-header\">
      <div class=\"section-header__content\">
        <h2>Import & Fichiers</h2>
        <p>Import Zotero (JSON), récupération PDFs, indexation.</p>
      </div>
    </div>

    <div class=\"import-sections\">
      <div class=\"import-card\">
        <h3>📚 Importer un export Zotero (.json)</h3>
        <p>Ajoutez des références à votre projet à partir d'un fichier d'export Zotero.</p>
        <input type=\"file\" id=\"" + SELECTORS.zoteroFileInput.substring(1) + "\" accept=\".json\" style=\"display:none\" data-action=\"handle-zotero-import">
        <button class=\"btn\" data-action=\"trigger-zotero-import\">Choisir un fichier JSON</button>
      </div>

      <div class=\"import-card\">
        <h3>📄 Uploader des PDFs (jusqu'à 20)</h3>
        <p>Associez directement des fichiers PDF à votre projet.</p>
        <input type=\"file\" id=\"" + SELECTORS.bulkPDFInput.substring(1) + "\" accept=\".pdf\" multiple style=\"display:none\" data-action=\"handle-pdf-upload">
        <button class=\"btn\" data-action=\"trigger-upload-pdfs\">Sélectionner PDFs</button>
      </div>

      <div class=\"import-card\">
        <h3>🔍 Indexer les PDFs pour le Chat RAG</h3>
        <p>Permet à l'IA de lire le contenu de vos PDFs pour répondre à vos questions dans la section "Chat".</p>
        <button class=\"btn btn--secondary\" data-action=\"index-pdfs\">Indexer les PDFs</button>
      </div>

      <div class=\"import-card\">
        <h3>📝 Ajouter des articles manuellement</h3>
        <p>Recherche automatique via Unpaywall pour les articles avec DOI.</p>
        <button class=\"btn\" data-action=\"show-pmid-import-modal\">Import manuel PMID/DOI</button>
      </div>

      <div class=\"import-card\">
        <h3>🔄 Synchroniser avec Zotero</h3>
        <p>Synchronise les PDFs de votre bibliothèque Zotero.</p>
        <button class=\"btn\" data-action=\"zotero-sync\">Synchroniser Zotero</button>
      </div>

      <div class=\"import-card\">
        <h3>📖 Export pour Thèse</h3>
        <p>Téléchargez un package complet avec données, graphiques haute résolution et rapports automatiques.</p>
        <button class=\"btn btn--primary\" data-action=\"export-for-thesis\">📚 Export Thèse Complet</button>
      </div>
    </div>
  ";
}

export function handleZoteroImport(target) {
  const fileInput = document.querySelector(SELECTORS.zoteroFileInput);
  if (target && target.files && target.files.length > 0) {
    processZoteroFile(target.files);
  }
  else {
    fileInput.click();
  }
}

export function showPmidImportModal() {
  const content = `
    <form id="pmid-import-form" data-action="submit-pmid-import">
      <div class="form-group">
        <label for="${SELECTORS.pmidList.substring(1)}">PMIDs / DOI / arXiv ID (un par ligne)</label>
        <textarea id="${SELECTORS.pmidList.substring(1)}" rows="5" class="form-control" placeholder="32123456\n10.1038/s41586-020-2649-2\narXiv:2004.12345"></textarea>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn--secondary" data-action="close-modal">Annuler</button>
        <button type="submit" class="btn btn--primary">Importer</button>
      </div>
    </form>`;
  showModal(MESSAGES.pmidImportModalTitle, content);
}

export function handleUploadPdfs(target) {
  const fileInput = document.querySelector(SELECTORS.bulkPDFInput);
  if (target && target.files && target.files.length > 0) {
    processPdfUpload(target.files);
  }
  else {
    fileInput.click();
  }
}

export async function handleBulkPdfDownload() {
    if (!appState.currentProject) return;
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
    if (!appState.currentProject) {
        showToast(MESSAGES.noProjectSelected, 'warning');
        return;
    }
    showLoadingOverlay(true, MESSAGES.generatingThesisExport);
    const exportUrl = `/api${API_ENDPOINTS.projectExportThesis(appState.currentProject.id)}`;
    window.location.href = exportUrl;
    showLoadingOverlay(false);
}

export async function handleIndexPdfs() {
  if (!appState.currentProject) return;
  
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
    showLoadingOverlay(false); // Masquer en cas d'erreur de lancement
  }
}

export async function handleZoteroSync() {
  showToast(MESSAGES.zoteroSyncNotImplemented, 'info');
}

async function processZoteroFile(file) {
  if (!appState.currentProject) {
    showToast(MESSAGES.selectProject, 'warning');
    return;
  }
  showLoadingOverlay(true, MESSAGES.importingZotero);
  try {
    const formData = new FormData();
    formData.append('file', file[0]); // 'file' est le nom attendu par le backend
    // CORRECTION : Utilisation de fetchAPI qui gère correctement les FormData
    const result = await fetchAPI(API_ENDPOINTS.projectImportZotero(appState.currentProject.id), { method: 'POST', body: formData });
    showToast(MESSAGES.referencesImported(result.imported || 0), 'success');
    await loadSearchResults(); // Refresh results to show new articles
  } catch (e) {
    showToast(`${MESSAGES.errorImportingZotero}: ${e.message}`, 'error');
  } finally {
    showLoadingOverlay(false, '');
  }
}

export async function processPmidImport(event) {
  event.preventDefault();
  // 1. LIRE LES VALEURS D'ABORD
  const pmidTextarea = document.querySelector(SELECTORS.pmidList);
  if (!pmidTextarea) {
    showToast(MESSAGES.pmidFieldNotFound, 'error');
    return;
  }
  const pmidList = pmidTextarea.value;

  // 2. ENSUITE, FERMER LE MODAL
  closeModal();

  // 3. CONTINUER LE TRAITEMENT
  if (!appState.currentProject) {
    showToast(MESSAGES.selectProject, 'warning');
    return;
  }

  const ids = pmidList.split('\n').map(s => s.trim()).filter(Boolean);
  if (ids.length === 0) {
    showToast(MESSAGES.identifierRequired, 'warning');
    return;
  }
  showLoadingOverlay(true, MESSAGES.importingIds(ids.length));
  try {
    await fetchAPI(API_ENDPOINTS.projectAddManualArticles(appState.currentProject.id), { method: 'POST', body: { identifiers: ids } });
    showToast(MESSAGES.importStartedForIds(ids.length), 'success');
    await loadSearchResults();
  } catch (e) {
    showToast(`${MESSAGES.errorImporting}: ${e.message}`, 'error');
  } finally {
    showLoadingOverlay(false, '');
  }
}

// --- Fonctions ajoutées pour la complétude de l'architecture ---

export async function handleSaveZoteroSettings(e) {
    e.preventDefault();
    const userId = document.querySelector(SELECTORS.zoteroUserId).value.trim();
    const apiKey = document.querySelector(SELECTORS.zoteroApiKey).value.trim();

    if (!userId || !apiKey) {
        return showToast(MESSAGES.zoteroCredentialsRequired, 'warning');
    }

    try {
        await fetchAPI(API_ENDPOINTS.settingsZotero, {
            method: 'POST',
            body: { userId, apiKey }
        });
        showToast(MESSAGES.zoteroCredentialsSaved, 'success');
    } catch (error) {
        showToast(`${MESSAGES.errorSaving}: ${error.message}`, 'error');
    }
}

export function startZoteroStatusPolling(projectId) { /* ... logique de polling ... */ }

async function processPdfUpload(files) {
  if (!appState.currentProject) {
    showToast(MESSAGES.selectProject, 'warning');
    return;
  }
  if (files.length > 20) {
    showToast(MESSAGES.max20Pdfs, 'warning');
    return;
  }
  showLoadingOverlay(true, MESSAGES.uploadingPdfs(files.length));
  try {
    const formData = new FormData();
    [...files].forEach(f => formData.append('files', f));
    const result = await fetchAPI(API_ENDPOINTS.projectUploadPdfsBulk(appState.currentProject.id), { method: 'POST', body: formData });
    showToast(MESSAGES.pdfsUploaded(result.successful_uploads?.length || 0), 'success');
    document.querySelector(SELECTORS.bulkPDFInput).value = ''; // Reset file input
  } catch (e) {
    showToast(`${MESSAGES.errorUploading}: ${e.message}`, 'error');
  } finally {
    showLoadingOverlay(false, '');
  }
}