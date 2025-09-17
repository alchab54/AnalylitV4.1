// web/js/stakeholders.js
import { appState } from '../app.js';
import { fetchAPI } from './api.js';
import { showToast, openModal, escapeHtml } from './ui-improved.js';

export async function showStakeholderManagementModal() { // Already exported, but keeping for consistency with request
    if (!appState.currentProject) {
        showToast('Veuillez sélectionner un projet.', 'warning');
        return;
    }
    openModal('stakeholderManagementModal');
    await renderStakeholderGroups();
}
export function runStakeholderAnalysis() {}
async function renderStakeholderGroups() {
    const container = document.getElementById('stakeholderGroupsList');
    if (!container) return;

    try {
        const groups = await fetchAPI(`/projects/${appState.currentProject.id}/stakeholders`);
        if (groups.length === 0) {
            container.innerHTML = '<p class="text-muted">Aucun groupe de parties prenantes défini.</p>';
            return;
        }
        container.innerHTML = groups.map(group => `
            <div class="stakeholder-group-item" data-group-id="${group.id}">
                <div class="stakeholder-group-info">
                    <h5 style="color: ${escapeHtml(group.color)};">${escapeHtml(group.name)}</h5>
                    <p>${escapeHtml(group.description)}</p>
                </div>
                <div class="stakeholder-group-actions">
                    <button class="btn btn--danger btn--sm" data-action="delete-stakeholder-group" data-group-id="${group.id}">Supprimer</button>
                </div>
            </div>
        `).join('');
    } catch (e) {
        container.innerHTML = '<p class="text-error">Erreur de chargement des groupes.</p>';
    }
}

export async function addStakeholderGroup() { // Already exported, but keeping for consistency with request
    const nameInput = document.getElementById('newStakeholderName');
    const colorInput = document.getElementById('newStakeholderColor');
    const descInput = document.getElementById('newStakeholderDesc');

    const name = nameInput.value.trim();
    if (!name) {
        showToast('Le nom du groupe est requis.', 'warning');
        return;
    }

    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/stakeholders`, {
            method: 'POST',
            body: {
                name: name,
                color: colorInput.value,
                description: descInput.value
            }
        });
        showToast('Groupe ajouté.', 'success');
        nameInput.value = '';
        descInput.value = '';
        await renderStakeholderGroups();
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    }
}

export async function deleteStakeholderGroup(groupId) { // Already exported, but keeping for consistency with request
    if (!groupId) return;
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce groupe ?')) return;

    try {
        await fetchAPI(`/stakeholder-groups/${groupId}`, { method: 'DELETE' }); // CORRIGÉ: La route backend est /api/stakeholder-groups/{id}
        showToast('Groupe supprimé.', 'success');
        await renderStakeholderGroups();
    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
    }
}