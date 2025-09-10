// web/js/import.js

function renderImportSection(project) {
    const container = document.getElementById('importContainer');
    if (!container) return;

    if (!project) {
        container.innerHTML = `<div class="card"><div class="card__body text-center"><p>Veuillez sélectionner un projet pour gérer les imports et les fichiers.</p></div></div>`;
        return;
    }

    container.innerHTML = `
        <div class="import-sections">
            <div class="import-card">
                <h4>📚 Importer un export Zotero (.json)</h4>
                <p>Chargez un fichier d'export Zotero pour ajouter des références.</p>
                <input type="file" id="zoteroFileInput" accept=".json" style="display: none;">
                <button class="btn btn--primary" onclick="document.getElementById('zoteroFileInput').click()">
                    Choisir un fichier JSON
                </button>
            </div>

            <div class="import-card">
                <h4>📄 Uploader des PDFs</h4>
                <p>Ces PDFs seront liés au projet courant.</p>
                <input type="file" id="bulkPDFInput" accept=".pdf" multiple style="display: none;">
                <button class="btn btn--primary" onclick="document.getElementById('bulkPDFInput').click()">
                    Choisir des PDFs
                </button>
            </div>

            <div class="import-card">
                <h4>🌐 Récupérer PDFs en ligne</h4>
                <p>Lance une recherche de PDFs en libre accès pour les articles sélectionnés dans la section "Recherche".</p>
                <button class="btn btn--secondary" onclick="handleFetchOnlinePdfs()">Lancer la récupération</button>
            </div>
            
            <div class="import-card">
                <h4>🔍 Indexer les PDFs pour le Chat RAG</h4>
                <p>Permettra de poser des questions au corpus de documents.</p>
                <button class="btn btn--primary" onclick="handleRunIndexing()">
                    Lancer l'indexation
                </button>
            </div>
        </div>
    `;

    // Attacher les listeners pour les uploads de fichiers
    document.getElementById('zoteroFileInput').addEventListener('change', handleZoteroFileUpload);
    document.getElementById('bulkPDFInput').addEventListener('change', handleBulkPDFUpload);
}

async function handleZoteroFileUpload(event) {
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
        showToast('Tâche d\'import Zotero lancée.', 'success');
    } catch (error) {
        showToast(`Erreur: ${error.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
        event.target.value = '';
    }
}

async function handleBulkPDFUpload(event) {
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
        await loadProjectFilesSet(appState.currentProject.id); // Mettre à jour la liste des fichiers
    } catch (error) {
        showToast(`Erreur: ${error.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
        event.target.value = '';
    }
}

async function handleFetchOnlinePdfs() {
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
            body: { articles: selectedIds }
        });
        showToast('Recherche de PDFs lancée en arrière-plan.', 'success');
    } catch (error) {
        showToast(`Erreur : ${error.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

async function handleRunIndexing() {
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

// Rendre les fonctions accessibles globalement
window.handleFetchOnlinePdfs = handleFetchOnlinePdfs;
window.handleRunIndexing = handleRunIndexing;