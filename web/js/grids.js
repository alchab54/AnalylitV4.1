// web/js/grids.js

import { appState, elements } from './app-improved.js';
import { fetchAPI } from './api.js';
import { setCurrentProjectGrids } from './state.js'; // Assuming this is correct, no ui import here.
import { showToast, escapeHtml } from './ui-improved.js';
import { API_ENDPOINTS, MESSAGES } from './constants.js';

// CORRECTION : Ajout de la fonction manquante `loadProjectGrids`
export async function loadProjectGrids(projectId) {
    if (!projectId) return;

    try {
        const grids = await fetchAPI(API_ENDPOINTS.grids(projectId));
        setCurrentProjectGrids(grids || []);
        renderGridsSection(appState.currentProject, elements);
    } catch (error) {
        console.error('Failed to load project grids:', error);
        showToast(MESSAGES.errorLoadingGrids, 'error');
    }
}

export function renderGridsSection(project, elements) {
    const container = document.getElementById('gridsContainer');
    if (!container) return;
    if (!project) {
        container.innerHTML = `<div class="placeholder">${MESSAGES.selectProjectToViewGrids}</div>`;
        return;
    }

    const grids = appState.currentProjectGrids || [];
    const gridsHtml = grids.length > 0
        ? grids.map(renderGridItem).join('')
        : `<div class="placeholder">${MESSAGES.noCustomGrids}</div>`;
    
    container.innerHTML = `
        <!-- L'en-tête est maintenant dans index.html -->
        <div class="grid-layout">
            ${gridsHtml}
        </div>
    `;
}

function renderGridItem(grid) {
    let fieldCount = 0;
    if (Array.isArray(grid.fields)) {
        fieldCount = grid.fields.length;
    } else if (typeof grid.fields === 'string') {
        try {
            const parsed = JSON.parse(grid.fields);
            fieldCount = Array.isArray(parsed) ? parsed.length : 0;
        } catch {
            fieldCount = 0;
        }
    }
    
    return `
        <div class="card" data-grid-id="${grid.id}">
            <div class="card__header">
                <h3>${escapeHtml(grid.name || 'Sans titre')}</h3>
                <div class="card-actions">
                    <button class="btn btn--icon btn--small" data-action="edit-grid" data-grid-id="${grid.id}">✏️</button>
                    <button class="btn btn--icon btn--small btn--danger" data-action="delete-grid" data-grid-id="${grid.id}">🗑️</button>
                </div>
            </div>
            <div class="card__body">
                <p>${escapeHtml(grid.description || 'Aucune description.')}</p>
            </div>
            <div class="card__footer">
                <span>${fieldCount} champ(s)</span>
            </div>
        </div>
    `;
}

export async function handleDeleteGrid(gridId) {
    if (!gridId) return;
    if (!confirm(MESSAGES.confirmDeleteGrid)) return;

    try {
        await fetchAPI(API_ENDPOINTS.gridById(appState.currentProject.id, gridId), { method: 'DELETE' });
        showToast(MESSAGES.gridDeleted, 'success');
        
        // Mettre à jour l'état localement
        const updatedGrids = (appState.currentProjectGrids || []).filter(g => g.id !== gridId);
        setCurrentProjectGrids(updatedGrids);
        await loadProjectGrids(appState.currentProject.id);

    } catch (error) {
        showToast(`Erreur: ${error.message}`, 'error');
    }
}

export function showGridFormModal(gridId = null) {
    const modal = document.getElementById('gridFormModal');
    const title = document.getElementById('gridFormModalTitle');
    const form = document.getElementById('gridForm');
    const fieldsContainer = document.getElementById('gridFields');

    form.reset();
    fieldsContainer.innerHTML = '';
    document.getElementById('gridId').value = gridId || '';

    if (gridId) {
        title.textContent = MESSAGES.editGridTitle;
        const grid = appState.currentProjectGrids.find(g => g.id === gridId);
        if (grid) {
            document.getElementById('gridName').value = grid.name;
            document.getElementById('gridDescription').value = grid.description || '';
            const fields = Array.isArray(grid.fields) ? grid.fields : [];
            fields.forEach(field => addFieldInput(fieldsContainer, field.name, field.description));
        }
    } else {
        title.textContent = MESSAGES.createGridTitle;
        // Ajouter un champ par défaut pour la création
        addFieldInput(fieldsContainer);
    }

    modal.classList.add('modal--show');
}

export function addGridFieldInput() {
    const container = document.getElementById('gridFields');
    if (container) {
        addFieldInput(container);
    }
}

function addFieldInput(container, name = '', description = '') {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'grid-field-item';
    fieldDiv.innerHTML = `
        <input type="text" placeholder="Nom du champ" value="${escapeHtml(name)}" class="form-control grid-field-name" required>
        <input type="text" placeholder="Description (optionnel)" value="${escapeHtml(description)}" class="form-control grid-field-desc">
        <button type="button" class="btn btn--danger btn--sm" data-action="remove-grid-field">X</button>
    `;
    container.appendChild(fieldDiv);
}

/**
 * Déclenche le clic sur le champ de fichier caché
 */
export function triggerGridImport() {
    document.getElementById('grid-import-input').click();
}

/**
 * Gère l'upload du fichier de grille JSON sélectionné
 */
export async function handleGridImportUpload(event) {
    const file = event.target.files[0];
    if (!file || !appState.currentProject?.id) {
        return;
    }

    if (!file.name.endsWith('.json')) {
        showToast(MESSAGES.invalidJsonFile, 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        await fetchAPI(API_ENDPOINTS.gridImport(appState.currentProject.id), {
            method: 'POST',
            body: formData, // fetchAPI gère automatiquement le FormData
        });
        
        showToast(MESSAGES.gridImported, 'success');
        await loadProjectGrids(appState.currentProject.id); // Recharger la liste des grilles
    
    } catch (error) {
        console.error('Erreur lors de l\'importation de la grille:', error);
        showToast(`Erreur: ${error.message}`, 'error');
    }

    // Réinitialiser le champ de fichier pour permettre de re-télécharger le même fichier
    event.target.value = null;
}

export function removeGridField(target) {
    target.closest('.grid-field-item').remove();
}

export async function handleSaveGrid(event) {
    event.preventDefault();
    const form = document.getElementById('gridForm');
    const gridId = form.elements.id.value;
    const name = form.elements.name.value;
    const description = form.elements.description.value;

    const fields = Array.from(document.querySelectorAll('.grid-field-item')).map(item => ({
        name: item.querySelector('.grid-field-name').value,
        description: item.querySelector('.grid-field-desc').value,
    })).filter(field => field.name.trim() !== '');

    if (!name || fields.length === 0) {
        showToast(MESSAGES.gridNameAndFieldRequired, 'warning');
        return;
    }

    const payload = { name, description, fields: JSON.stringify(fields) };
    const method = gridId ? 'PUT' : 'POST';
    const endpoint = gridId ? API_ENDPOINTS.gridById(appState.currentProject.id, gridId) : API_ENDPOINTS.grids(appState.currentProject.id);

    try {
        const savedGrid = await fetchAPI(endpoint, { method, body: payload });

        if (gridId) {
            // Remplacer la grille existante dans l'état
            const index = appState.currentProjectGrids.findIndex(g => g.id === gridId);
            if (index !== -1) {
                appState.currentProjectGrids[index] = savedGrid;
            }
        } else {
            // Ajouter la nouvelle grille à l'état
            appState.currentProjectGrids.push(savedGrid);
        }
        
        // Mettre à jour l'état et re-rendre la section
        setCurrentProjectGrids([...appState.currentProjectGrids]);

        showToast(MESSAGES.gridSaved(!!gridId), 'success');
        document.getElementById('gridFormModal').classList.remove('modal--show');

    } catch (error) {
        showToast(`${MESSAGES.errorSavingGrid}: ${error.message}`, 'error');
    }
}
