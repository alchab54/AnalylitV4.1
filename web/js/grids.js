// web/js/grids.js

function renderGridsSection(project) {
    const container = document.getElementById('gridsContainer');
    if (!container || !project) return;

    const gridsHtml = appState.currentProjectGrids.length > 0
        ? appState.currentProjectGrids.map(grid => `
            <div class="grid-item">
                <div class="grid-item__content">
                    <h5>${escapeHtml(grid.name)}</h5>
                    <p class="grid-meta">${grid.fields.length} champs • ${new Date(grid.created_at).toLocaleDateString()}</p>
                </div>
                <div class="grid-item__actions">
                    <button class="btn btn--sm btn--outline" data-action="edit-grid" data-grid-id="${grid.id}">Modifier</button>
                    <button class="btn btn--sm btn--danger" data-action="delete-grid" data-grid-id="${grid.id}">Supprimer</button>
                </div>
            </div>
        `).join('')
        : '<p class="text-muted">Aucune grille personnalisée pour ce projet.</p>';

    container.innerHTML = `
        <div class="card">
            <div class="card__header">
                <h4>Grilles personnalisées</h4>
                <div class="grid-actions">
                    <button class="btn btn--primary btn--sm" data-action="create-grid">Créer une grille</button>
                    <input type="file" id="importGridFileInput" accept=".json" style="display: none;">
                    <button class="btn btn--secondary btn--sm" onclick="document.getElementById('importGridFileInput').click()">Importer une grille</button>
                </div>
            </div>
            <div class="card__body">
                <div class="grids-list">${gridsHtml}</div>
            </div>
        </div>
    `;

    // Attacher les listeners après le rendu
    document.querySelector('[data-action="create-grid"]').addEventListener('click', () => openGridModal());
    document.querySelectorAll('[data-action="edit-grid"]').forEach(button => {
        button.addEventListener('click', (e) => openGridModal(e.currentTarget.dataset.gridId));
    });
    document.querySelectorAll('[data-action="delete-grid"]').forEach(button => {
        button.addEventListener('click', (e) => handleDeleteGrid(e.currentTarget.dataset.gridId));
    });
    document.getElementById('importGridFileInput').addEventListener('change', handleImportGridFile);
}

async function loadProjectGrids(projectId) {
    try {
        appState.currentProjectGrids = await fetchAPI(`/projects/${projectId}/grids`);
    } catch (error) {
        console.error('Erreur chargement grilles:', error);
        showToast('Erreur lors du chargement des grilles.', 'error');
        appState.currentProjectGrids = [];
    }
}

function openGridModal(gridId = null) {
    const grid = gridId ? appState.currentProjectGrids.find(g => g.id === gridId) : null;
    const fields = grid ? JSON.parse(grid.fields) : [{ name: '', description: '' }];

    const fieldsHtml = fields.map((field, index) => `
        <div class="form-group-row" data-field-index="${index}">
            <input type="text" placeholder="Nom du champ" value="${escapeHtml(field.name)}" class="form-control">
            <input type="text" placeholder="Description (optionnel)" value="${escapeHtml(field.description)}" class="form-control">
            <button type="button" class="btn btn--danger btn--sm" onclick="this.parentElement.remove()">-</button>
        </div>
    `).join('');

    const content = `
        <form id="gridForm" onsubmit="handleSaveGrid(event, '${gridId || ''}')">
            <div class="form-group">
                <label class="form-label">Nom de la grille</label>
                <input type="text" name="name" class="form-control" required value="${grid ? escapeHtml(grid.name) : ''}">
            </div>
            <div class="form-group">
                <label class="form-label">Champs d'extraction</label>
                <div id="gridFieldsContainer">
                    ${fieldsHtml}
                </div>
                <button type="button" class="btn btn--sm btn--outline" id="addGridFieldBtn">+ Ajouter un champ</button>
            </div>
            <div class="modal__actions">
                <button type="submit" class="btn btn--primary">Sauvegarder</button>
            </div>
        </form>
    `;

    showModal(gridId ? 'Modifier la grille' : 'Créer une grille', content);

    // Add event listener for adding new fields
    document.getElementById('addGridFieldBtn').addEventListener('click', () => {
        const container = document.getElementById('gridFieldsContainer');
        const newFieldIndex = container.children.length;
        const newField = document.createElement('div');
        newField.className = 'form-group-row';
        newField.dataset.fieldIndex = newFieldIndex;
        newField.innerHTML = `
            <input type="text" placeholder="Nom du champ" class="form-control">
            <input type="text" placeholder="Description (optionnel)" class="form-control">
            <button type="button" class="btn btn--danger btn--sm" onclick="this.parentElement.remove()">-</button>
        `;
        container.appendChild(newField);
    });
}

async function handleSaveGrid(event, gridId) {
    event.preventDefault();
    const form = event.target;
    const name = form.elements.name.value;
    const fieldsContainer = document.getElementById('gridFieldsContainer');
    const fieldRows = fieldsContainer.querySelectorAll('.form-group-row');
    const fields = Array.from(fieldRows).map(row => ({
        name: row.children[0].value,
        description: row.children[1].value
    })).filter(field => field.name.trim() !== '');

    if (!name || fields.length === 0) {
        showToast('Le nom de la grille et au moins un champ sont requis.', 'warning');
        return;
    }

    const method = gridId ? 'PUT' : 'POST';
    const url = gridId ? `/projects/${appState.currentProject.id}/grids/${gridId}` : `/projects/${appState.currentProject.id}/grids`;

    try {
        showLoadingOverlay(true, 'Sauvegarde de la grille...');
        await fetchAPI(url, {
            method: method,
            body: { name, fields: JSON.stringify(fields) }
        });
        showToast('Grille sauvegardée.', 'success');
        closeModal('genericModal');
        renderGridsSection(appState.currentProject);
    } catch (error) {
        showToast(`Erreur: ${error.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

async function handleDeleteGrid(gridId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette grille ?')) return;

    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/grids/${gridId}`, { method: 'DELETE' });
        showToast('Grille supprimée.', 'success');
        renderGridsSection(appState.currentProject);
    } catch (error) {
        showToast(`Erreur: ${error.message}`, 'error');
    }
}

async function handleImportGridFile(event) {
    const file = event.target.files[0];
    if (!file || !appState.currentProject?.id) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
        showLoadingOverlay(true, 'Import de la grille...');
        await fetchAPI(`/projects/${appState.currentProject.id}/grids/import`, {
            method: 'POST',
            body: formData
        });
        showToast('Grille importée avec succès.', 'success');
        renderGridsSection(appState.currentProject);
    } catch (err) {
        showToast(`Erreur: ${err.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

window.renderGridsSection = renderGridsSection;
window.openGridModal = openGridModal;
window.handleSaveGrid = handleSaveGrid;
window.handleDeleteGrid = handleDeleteGrid;
window.handleImportGridFile = handleImportGridFile;