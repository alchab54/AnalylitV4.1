// web/js/import.js
import { appState } from './app-improved.js'; // L'état global vient de l'entrypoint
import { fetchAPI } from './api.js';         // La fonction API vient de son module dédié
import { showToast, showLoadingOverlay, showModal, closeModal, updateLoadingProgress } from './ui-improved.js';
import { loadSearchResults } from './articles.js';

// Cette fonction est appelée par le routeur principal, elle doit être exportée.
export function renderImportSection(project) {
  const container = document.getElementById('importContainer');
  if (!container) return;

  if (!project) {
    container.innerHTML = `<div class="placeholder">Veuillez sélectionner un projet pour gérer les imports et les fichiers.</div>`;
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
  showModal('Import Manuel PMID/DOI', content);
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
    // TODO: Backend route for bulk PDF download is missing.
    /*
  if (!appState.currentProject) return;
  showLoadingOverlay(true, 'Recherche des PDFs gratuits...');
  try {
    await fetchAPI(`/projects/${appState.currentProject.id}/bulk-pdf-download`, { method: 'POST' });
    showToast('Recherche de PDFs lancée en arrière-plan.', 'info');
  } catch (e) {
    showToast(`Erreur: ${e.message}`, 'error');
  } finally {
    showLoadingOverlay(false, '');
  }
  */
  showToast('La recherche de PDFs n\'est pas encore implémentée.', 'info');
}

export async function exportForThesis() {
    if (!appState.currentProject?.id) {
        showToast('Veuillez sélectionner un projet.', 'warning');
        return;
    }
    window.open(`/api/projects/${appState.currentProject.id}/export/thesis`, '_blank');
    showToast('Export pour la thèse en cours de téléchargement...', 'info');
}

export async function handleIndexPdfs() {
    // TODO: Backend route for indexing PDFs is missing.
    /*
  if (!appState.currentProject) return;
  
  // Affiche l'overlay avec un message initial et prépare la barre de progression
  showLoadingOverlay(true, 'Lancement de l\'indexation...');
  updateLoadingProgress(0, 1, 'Lancement de l\'indexation...'); // Affiche la barre à 0%

  try {
    const data = await fetchAPI(`/projects/${appState.currentProject.id}/index-pdfs`, { method: 'POST' });
    // L'overlay est maintenant affiché avec une barre de progression.
    // On peut associer l'ID de la tâche au bouton d'annulation.
    showLoadingOverlay(true, 'Indexation en cours...', data.task_id);
    showToast('Indexation lancée en arrière-plan.', 'info');
  } catch (e) {
    showToast(`Erreur: ${e.message}`, 'error');
    showLoadingOverlay(false); // Masquer en cas d\'erreur de lancement
  }
  */
  showToast('L\'indexation des PDFs n\'est pas encore implémentée.', 'info');
}

export async function handleZoteroSync() {
  showToast('Synchronisation Zotero non implémentée dans cette version.', 'info');
}

async function processZoteroFile(file) {
  if (!appState.currentProject) {
    showToast('Veuillez sélectionner un projet.', 'warning');
    return;
  }
  showLoadingOverlay(true, 'Import du fichier Zotero...');
  try {
    const formData = new FormData();
    formData.append('file', file[0]); // 'file' est le nom attendu par le backend
    // CORRECTION : Utilisation de fetchAPI qui gère correctement les FormData
    const result = await fetchAPI(`/projects/${appState.currentProject.id}/import-zotero`, { method: 'POST', body: formData });
    showToast(`${result.imported || 0} références importées.`, 'success');
    await loadSearchResults(); // Refresh results to show new articles
  } catch (e) {
    showToast(`Erreur lors de l\'import Zotero: ${e.message}`, 'error');
  } finally {
    showLoadingOverlay(false, '');
  }
}

export async function processPmidImport(event) {
  event.preventDefault();
  // 1. LIRE LES VALEURS D'ABORD
  const pmidTextarea = document.getElementById('pmid-list');
  if (!pmidTextarea) {
    showToast("Erreur : le champ d'import de PMID n'a pas été trouvé.", 'error');
    return;
  }
  const pmidList = pmidTextarea.value;

  // 2. ENSUITE, FERMER LE MODAL
  closeModal();

  // 3. CONTINUER LE TRAITEMENT
  if (!appState.currentProject) {
    showToast('Veuillez sélectionner un projet.', 'warning');
    return;
  }

  const ids = pmidList.split('\n').map(s => s.trim()).filter(Boolean);
  if (ids.length === 0) {
    showToast('Veuillez saisir au moins un identifiant.', 'warning');
    return;
  }
  showLoadingOverlay(true, `Import de ${ids.length} identifiant(s)...`);
  try {
    await fetchAPI(`/projects/${appState.currentProject.id}/add-manual-articles`, { method: 'POST', body: { identifiers: ids } });
    showToast(`Import lancé pour ${ids.length} identifiant(s).`, 'success');
    await loadSearchResults();
  } catch (e) {
    showToast(`Erreur lors de l\'import: ${e.message}`, 'error');
  } finally {
    showLoadingOverlay(false, '');
  }
}

// --- Fonctions ajoutées pour la complétude de l'architecture ---

export async function handleSaveZoteroSettings(e) {
    // TODO: Backend route for saving Zotero settings is missing.
    /*
    e.preventDefault();
    const userId = document.getElementById('zoteroUserId').value.trim();
    const apiKey = document.getElementById('zoteroApiKey').value.trim();

    if (!userId || !apiKey) {
        return showToast('L\'ID utilisateur et la clé d\'API Zotero sont requis.', 'warning');
    }

    try {
        await fetchAPI('/settings/zotero', {
            method: 'POST',
            body: { userId, apiKey }
        });
        showToast('Identifiants Zotero sauvegardés avec succès.', 'success');
    } catch (error) {
        showToast(`Erreur lors de la sauvegarde : ${error.message}`, 'error');
    }
    */
    showToast('La sauvegarde des paramètres Zotero n\'est pas encore implémentée.', 'info');
}

export function startZoteroStatusPolling(projectId) { /* ... logique de polling ... */ }

async function processPdfUpload(files) {
  if (!appState.currentProject) {
    showToast('Veuillez sélectionner un projet.', 'warning');
    return;
  }
  if (files.length > 20) {
    showToast('Maximum 20 PDFs autorisés par upload.', 'warning');
    return;
  }
  showLoadingOverlay(true, `Upload de ${files.length} PDF(s)...`);
  try {
    const formData = new FormData();
    [...files].forEach(f => formData.append('files', f));
    // CORRECTION : Utilisation de fetchAPI pour gérer l'upload de FormData
    // CORRECTED ROUTE: /upload-pdfs-bulk instead of /upload-pdfs
    const result = await fetchAPI(`/projects/${appState.currentProject.id}/upload-pdfs-bulk`, { method: 'POST', body: formData });
    showToast(`${result.uploaded || 0} PDF(s) uploadé(s).`, 'success');
  } catch (e) {
    showToast(`Erreur lors de l\'upload: ${e.message}`, 'error');
  } finally {
    showLoadingOverlay(false, '');
  }
}

