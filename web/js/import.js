import { appState, elements } from '../app.js';
import { fetchAPI } from './api.js';
import { showToast, showLoadingOverlay, escapeHtml, openModal, closeModal } from './ui.js';
import { loadSearchResults } from './articles.js';
import { showModal, closeModal } from './ui.js';

export function renderImportSection(project) {
    const container = document.getElementById('importContainer');
    if (!container) return;

    if (!project) {
        container.innerHTML = `<div class="card"><div class="card__body text-center"><p>Veuillez sélectionner un projet pour gérer les imports et les fichiers.</p></div></div>`;
        return;
    }

    container.innerHTML = `
        <div class="import-sections">
            <div class="import-card">
                <h4>📚 Importer un fichier Zotero (.json)</h4>
                <p>Ajoutez des références à votre projet à partir d'un fichier d'export Zotero.</p>
                <input type="file" id="zoteroFileInput" accept=".json" style="display: none;">
                <button class="btn btn--primary" data-action="trigger-zotero-upload">
                    Choisir un fichier JSON
                </button>
            </div>

            <div class="import-card">
                <h4>📄 Uploader des PDFs</h4>
                <p>Associez directement des fichiers PDF à votre projet.</p>
                <input type="file" id="bulkPDFInput" accept=".pdf" multiple style="display: none;">
                <button class="btn btn--primary" data-action="trigger-pdf-upload">
                    Choisir des PDFs
                </button>
            </div>

            <div class="import-card">
                <h4>🔍 Indexer les PDFs pour le Chat RAG</h4>
                <p>Permet à l'IA de lire le contenu de vos PDFs pour répondre à vos questions dans la section "Chat".</p>
                <button class="btn btn--secondary" data-action="run-indexing">
                    Lancer l'indexation
                </button>
            </div>

            <div class="import-card">
                <h4>🌐 Récupération automatique de PDFs</h4>
                <p>Recherche automatique via Unpaywall pour les articles avec DOI.</p>
                <button class="btn btn--secondary" data-action="fetch-online-pdfs">
                    Lancer recherche
                </button>
            </div>

            <div class="import-card">
                <h4>📝 Ajouter des articles manuellement</h4>
                <p>Saisissez des identifiants d'articles (PMID, DOI, ArXiv ID) séparés par des retours à la ligne.</p>
                <button class="btn btn--secondary" data-action="show-manual-add">
                    Ajouter articles
                </button>
            </div>

            <div class="import-card">
                <h4>📥 Importer des PDFs depuis Zotero</h4>
                <p>Synchronise les PDFs de votre bibliothèque Zotero avec les articles de votre projet.</p>
                <button class="btn btn--secondary" data-action="import-zotero-pdfs">
                    Importer PDFs Zotero
                </button>
            </div>
        </div>
    `;

    // Attacher les listeners pour les uploads de fichiers
    document.getElementById('zoteroFileInput').addEventListener('change', handleZoteroFileUpload);
    document.getElementById('bulkPDFInput').addEventListener('change', handleBulkPDFUpload);
}

export async function handleZoteroFileUpload(event) {
    const file = event.target.files[0];
    if (!file || !appState.currentProject) return;
    const formData = new FormData();
    formData.append('file', file);
    showLoadingOverlay(true, 'Import du fichier Zotero...');
    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/import-zotero-file`, {
            method: 'POST',
            body: formData
        });
        showToast('Tâche d\'import Zotero lancée. Les articles apparaîtront dans la section Recherche.', 'success');
    } catch (error) {
        showToast(`Erreur: ${error.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
        event.target.value = '';
    }
}

export async function handleBulkPDFUpload(event) {
    const files = event.target.files;
    if (!files.length || !appState.currentProject) return;
    const formData = new FormData();
    Array.from(files).forEach(file => formData.append('files', file));
    showLoadingOverlay(true, `Upload de ${files.length} PDF(s)...`);
    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/upload-pdfs-bulk`, {
            method: 'POST',
            body: formData
        });
        showToast('PDFs uploadés avec succès.', 'success');
        // appState.projectFiles = await loadProjectFilesSet(appState.currentProject.id); // Mettre à jour la liste des fichiers
    } catch (error) {
        showToast(`Erreur: ${error.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
        event.target.value = '';
    }
}

export async function handleManualPDFUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    if (!appState.currentProject?.id) {
        showToast('Sélectionnez un projet avant d\'uploader', 'warning');
        return;
    }
    
    const formData = new FormData();
    Array.from(files).forEach(file => formData.append('files', file));
    
    try {
        showLoadingOverlay(true, `Upload de ${files.length} PDF(s)...`);
        const result = await fetchAPI(`/projects/${appState.currentProject.id}/upload-pdfs-bulk`, {
            method: 'POST',
            body: formData
        });
        
        showToast(`${result.successful.length} PDF(s) importés avec succès`, 'success');
        if (result.failed.length > 0) {
            console.warn('Échecs upload:', result.failed);
        }
    } catch (e) {
        showToast(`Erreur upload: ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
        event.target.value = ''; // Reset input
    }
}

export async function handleRunIndexing() {
    if (!appState.currentProject) return;
    showLoadingOverlay(true, 'Lancement de l\'indexation des PDFs...');
    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/index`, { method: 'POST' });
        showToast('Indexation des PDFs lancée en arrière-plan.', 'success');
    } catch (error) {
        showToast(`Erreur : ${error.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

// Exposition globale pour les `onclick`
window.handleRunIndexing = handleRunIndexing;
window.handleFetchOnlinePdfs = handleFetchOnlinePdfs;
window.showAddManualArticlesModal = showAddManualArticlesModal;
window.handleImportZoteroPdfs = handleImportZoteroPdfs;

export async function handleFetchOnlinePdfs() {
    if (!appState.currentProject) return;
    const selectedIds = Array.from(appState.selectedSearchResults);
    if (selectedIds.length === 0) {
        showToast("Veuillez d'abord sélectionner des articles dans la section 'Recherche'.", 'warning');
        return;
    }
    showLoadingOverlay(true, `Recherche de ${selectedIds.length} PDF(s) en ligne...`);
    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/fetch-online-pdfs`, {
            method: 'POST',
            body: { article_ids: selectedIds }
        });
        showToast('Recherche de PDFs lancée en arrière-plan. Les notifications indiqueront les succès.', 'success');
    } catch (error) {
        showToast(`Erreur : ${error.message}`, 'error');
    }
}

export function showAddManualArticlesModal() {
    openModal('addManualArticlesModal');
}

export function showAddManualArticlesModal() {
    if (!appState.currentProject) {
        showToast('Veuillez sélectionner un projet.', 'warning');
        return;
    }
    const modalContent = `
        <form id="manualArticleForm">
            <div class="form-group">
                <label for="manualArticlesTextarea" class="form-label">Identifiants des articles</label>
                <textarea id="manualArticlesTextarea" name="identifiers" class="form-control" rows="10" 
                          placeholder="Collez ici une liste d'identifiants (un par ligne) :&#10;10.1038/nphys1170&#10;PMID:12345678&#10;arXiv:2101.00001"></textarea>
                <p class="form-text">Les identifiants PMID, DOI et arXiv sont supportés.</p>
            </div>
            <div class="modal__actions">
                <button type="button" class="btn btn--secondary" onclick="closeModal('genericModal')">Annuler</button>
                <button type="submit" class="btn btn--primary">Ajouter les articles</button>
            </div>
        </form>
    `;
    showModal('Ajouter des Articles Manuellement', modalContent);

    // Attacher le listener au formulaire de la modale
    document.getElementById('manualArticleForm').addEventListener('submit', handleAddManualArticles);
}

// MODIFICATION : Mettez à jour la fonction handleAddManualArticles pour qu'elle gère l'événement
export async function handleAddManualArticles(event) {
    event.preventDefault(); // Empêche le rechargement de la page
    
    if (!appState.currentProject?.id) {
        showToast('Sélectionnez d’abord un projet.', 'warning');
        return;
    }

    const form = event.target;
    const textarea = form.querySelector('textarea[name="identifiers"]');
    const rawIdentifiers = textarea ? textarea.value.trim() : '';

    if (!rawIdentifiers) {
        showToast('Veuillez saisir au moins un identifiant.', 'warning');
        return;
    }

    closeModal('genericModal');
    showLoadingOverlay(true, 'Ajout des articles en cours...');

    try {
        const response = await fetchAPI(`/projects/${appState.currentProject.id}/add-manual-articles`, {
            method: 'POST',
            body: { identifiers: rawIdentifiers }
        });

        showToast(response.message, 'success');
        // Rafraîchir la liste des articles dans la section "Recherche"
        if (typeof loadSearchResults === 'function') {
            loadSearchResults();
        }
    } catch (e) {
        showToast(`Erreur : ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

export async function handleImportZoteroPdfs() {
    if (!appState.currentProject?.id) {
        showToast('Veuillez sélectionner un projet.', 'warning');
        return;
    }
    
    if (appState.searchResults.length === 0) {
        showToast("Aucun article dans ce projet à synchroniser avec Zotero.", 'info');
        return;
    }

    const articleIds = appState.searchResults.map(r => r.article_id);
    
    showLoadingOverlay(true, 'Lancement de la récupération des PDFs via Zotero...');
    try {
        const response = await fetchAPI(`/projects/${appState.currentProject.id}/import-zotero`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ articles: articleIds })
        });
        showToast(response.message || 'Récupération des PDFs depuis Zotero lancée.', 'success');
    } catch (e) {
        showToast(`Erreur : ${e.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}
