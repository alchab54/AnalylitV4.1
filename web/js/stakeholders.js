// web/js/stakeholders.js

import { API_ENDPOINTS, SELECTORS, MESSAGES } from './constants.js';
import { fetchAPI } from './api.js';
import { showToast, showError, showModal, closeModal } from './ui-improved.js'; // Use ui-improved.js for toast
import { appState } from './app-improved.js';
import { setStakeholders, setStakeholderGroups, setCurrentSection } from './state.js';

const stakeholdersModule = (() => {

    const getStakeholdersContainer = () => document.querySelector(SELECTORS.stakeholdersContainer);
    const getStakeholdersList = () => document.querySelector(SELECTORS.stakeholdersList);
    const getCreateStakeholderBtn = () => document.querySelector(SELECTORS.createStakeholderBtn);
    const getNewStakeholderForm = () => document.querySelector(SELECTORS.newStakeholderForm);

    const init = () => {
        // Event listeners are now handled by core.js delegated event listeners
        // We only need to ensure the section is rendered when the project changes
        window.addEventListener('current-project-changed', () => {
            if (appState.currentSection === 'stakeholders') {
                renderStakeholdersSection(appState.currentProject);
            }
        });
    };

    // This function is called by core.js when the section is changed
    const renderStakeholdersSection = (project) => {
        const container = getStakeholdersContainer();
        if (!container) return;

        if (!project) {
            container.innerHTML = `<div class="placeholder">${MESSAGES.selectProjectToViewStakeholders}</div>`;
            container.classList.remove('hidden'); // Ensure it's visible to show placeholder
            return;
        }

        container.innerHTML = `
            <div class="section-header">
                <div class="section-header__content">
                    <h2>Gestion des Parties Prenantes</h2>
                    <p>Ajoutez, modifiez et supprimez les parties prenantes de votre projet.</p>
                </div>
                <div class="section-header__actions">
                    <button class="btn btn-primary" data-action="show-create-stakeholder-modal">
                        <span role="img" aria-hidden="true">➕</span> Nouvelle Partie Prenante
                    </button>
                </div>
            </div>
            <div id="stakeholdersList" class="stakeholders-grid">
                <!-- Stakeholders will be rendered here -->
            </div>
        `;
        container.classList.remove('hidden');
        loadStakeholders(project.id);
    };

    const handleProjectChanged = () => { // This function is now internal and called by renderStakeholdersSection
        const projectId = appState.currentProject?.id;
        if (projectId) {
            loadStakeholders(projectId);
            getStakeholdersContainer().classList.remove('hidden');
        } else {
            getStakeholdersContainer().classList.add('hidden');
        }
    };

    const loadStakeholders = async (projectId) => {
        try {
            const stakeholders = await fetchAPI(API_ENDPOINTS.projectStakeholders(projectId));
            setStakeholders(stakeholders || []); // Update state via setStakeholders
            renderStakeholders(stakeholders);
        } catch (error) {
            showError('Erreur lors du chargement des parties prenantes.');
            console.error('Error loading stakeholders:', error);
        }
    };

    const renderStakeholders = (stakeholders) => {
        const listElement = getStakeholdersList();
        if (!listElement) return;

        listElement.innerHTML = ''; // Clear existing list

        if (!stakeholders || stakeholders.length === 0) {
            listElement.innerHTML = '<p>Aucune partie prenante pour ce projet.</p>';
            return;
        }

        stakeholders.forEach(stakeholder => {
            const stakeholderElement = document.createElement('div');
            stakeholderElement.className = 'stakeholder-item card';
            stakeholderElement.innerHTML = ` 
                <h3>${escapeHtml(stakeholder.name)}</h3>
                <p>Rôle: ${escapeHtml(stakeholder.role || 'N/A')}</p>
                <p>Contact: ${escapeHtml(stakeholder.contact_info || 'N/A')}</p>
                <p>Notes: ${escapeHtml(stakeholder.notes || 'N/A')}</p>
                <button class="btn btn-sm btn-primary" data-action="edit-stakeholder" data-id="${stakeholder.id}">Modifier</button> 
                <button class="btn btn-sm btn-danger" data-action="delete-stakeholder" data-id="${stakeholder.id}">Supprimer</button>
            `;
            listElement.appendChild(stakeholderElement);
        });

        // Add event listeners for edit and delete buttons
        listElement.querySelectorAll('[data-action="edit-stakeholder"]').forEach(button => {
            button.addEventListener('click', (e) => showEditStakeholderModal(appState.currentProject?.id, e.target.dataset.id));
        });
        listElement.querySelectorAll('[data-action="delete-stakeholder"]').forEach(button => {
            button.addEventListener('click', (e) => handleDeleteStakeholder(appState.currentProject?.id, e.target.dataset.id));
        });
    };

    const showCreateStakeholderModal = (projectId) => { // This function is called by core.js
        if (!projectId) {
            showError(MESSAGES.selectProjectFirst);
            return;
        }
        const content = `
            <form id="createStakeholderForm" data-action="create-stakeholder">
                <div class="form-group">
                    <label for="stakeholderName">Nom</label>
                    <input type="text" id="stakeholderName" class="form-control" required>
                </div>
                <div class="form-group">
                    <label for="stakeholderRole">Rôle</label>
                    <input type="text" id="stakeholderRole" class="form-control">
                </div>
                <div class="form-group">
                    <label for="stakeholderContact">Contact</label>
                    <input type="text" id="stakeholderContact" class="form-control">
                </div>
                <div class="form-group">
                    <label for="stakeholderNotes">Notes</label>
                    <textarea id="stakeholderNotes" class="form-control" rows="3"></textarea>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" data-action="close-modal">Annuler</button>
                    <button type="submit" class="btn btn-primary">Créer</button>
                </div>
            </form>
        `;
        showModal('Créer une nouvelle partie prenante', content);
    };

    const handleCreateStakeholder = async (event, projectId) => { // This function is called by core.js
        event.preventDefault();
        if (!projectId) {
            showError('Veuillez sélectionner un projet d\'abord.');
            return;
        }

        const form = event.target;
        const name = form.querySelector('#stakeholderName').value;
        const role = form.querySelector('#stakeholderRole').value;
        const contact_info = form.querySelector('#stakeholderContact').value;
        const notes = form.querySelector('#stakeholderNotes').value;

        try {
            const newStakeholder = await fetchAPI(API_ENDPOINTS.projectStakeholders(projectId), {
                method: 'POST',
                body: JSON.stringify({ name, role, contact_info, notes })
            });
            showToast('Partie prenante créée avec succès.', 'success');
            loadStakeholders(projectId);
            closeModal();
        } catch (error) {
            showError('Erreur lors de la création de la partie prenante.');
            console.error('Error creating stakeholder:', error);
        } finally {
            closeModal();
        }
    };

    const showEditStakeholderModal = async (projectId, stakeholderId) => {
        if (!projectId) {
            showError('Veuillez sélectionner un projet d\'abord.');
            return;
        }
        try {
            const stakeholder = await fetchAPI(API_ENDPOINTS.stakeholderById(projectId, stakeholderId)); // Assuming this endpoint exists
            const content = `
                <form id="editStakeholderForm" data-action="update-stakeholder">
                    <input type="hidden" id="editStakeholderId" value="${stakeholder.id}">
                    <div class="form-group">
                        <label for="editStakeholderName">Nom</label>
                        <input type="text" id="editStakeholderName" class="form-control" value="${escapeHtml(stakeholder.name)}" required>
                    </div>
                    <div class="form-group">
                        <label for="editStakeholderRole">Rôle</label>
                        <input type="text" id="editStakeholderRole" class="form-control" value="${escapeHtml(stakeholder.role || '')}">
                    </div>
                    <div class="form-group">
                        <label for="editStakeholderContact">Contact</label>
                        <input type="text" id="editStakeholderContact" class="form-control" value="${escapeHtml(stakeholder.contact_info || '')}">
                    </div>
                    <div class="form-group">
                        <label for="editStakeholderNotes">Notes</label>
                        <textarea id="editStakeholderNotes" class="form-control" rows="3">${escapeHtml(stakeholder.notes || '')}</textarea>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary" data-action="close-modal">Annuler</button>
                        <button type="submit" class="btn btn-primary">Sauvegarder</button>
                    </div>
                </form>
            `;
            showModal('Modifier la partie prenante', content);
            // Attach event listener to the form inside the modal
            const form = document.getElementById('editStakeholderForm');
            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    handleUpdateStakeholder(e, projectId, stakeholder.id);
                });
            }

        } catch (error) {
            showError('Erreur lors du chargement des détails de la partie prenante.');
            console.error('Error loading stakeholder details:', error);
        }
    };

    const handleUpdateStakeholder = async (event, projectId, stakeholderId) => {
        event.preventDefault();
        if (!projectId) {
            showError('Veuillez sélectionner un projet d\'abord.');
            return;
        }

        const form = event.target;
        const name = form.querySelector('#editStakeholderName').value;
        const role = form.querySelector('#editStakeholderRole').value;
        const contact_info = form.querySelector('#editStakeholderContact').value;
        const notes = form.querySelector('#editStakeholderNotes').value;

        try {
            await fetchAPI(API_ENDPOINTS.stakeholderById(projectId, stakeholderId), {
                method: 'PUT',
                body: JSON.stringify({ name, role, contact_info, notes })
            });
            showToast('Partie prenante mise à jour avec succès.', 'success');
            loadStakeholders(projectId);
            closeModal();
        } catch (error) {
            showError('Erreur lors de la mise à jour de la partie prenante.');
            console.error('Error updating stakeholder:', error);
        } finally {
            closeModal();
        }
    };

    const handleDeleteStakeholder = async (projectId, stakeholderId) => {
        if (!projectId) {
            showError('Veuillez sélectionner un projet d\'abord.');
            return;
        }
        if (!confirm(MESSAGES.confirmDeleteStakeholder)) return;

        try {
            await fetchAPI(API_ENDPOINTS.stakeholderById(projectId, stakeholderId), {
                method: 'DELETE'
            });
            showToast('Partie prenante supprimée avec succès.', 'success');
            loadStakeholders(projectId);
        } catch (error) {
            showError('Erreur lors de la suppression de la partie prenante.');
            console.error('Error deleting stakeholder:', error);
        }
    };

    const addStakeholderGroup = async (projectId, groupData) => {
        if (!projectId) { // Check if projectId is valid
            showError('ID du projet requis pour ajouter un groupe de parties prenantes.');
            return null;
        }

        try {
            const newGroup = await fetchAPI(API_ENDPOINTS.projectStakeholderGroups(projectId), {
                method: 'POST',
                body: JSON.stringify(groupData)
            });
            setStakeholderGroups([...(appState.stakeholderGroups || []), newGroup]); // Update state via setStakeholderGroups
            showToast('Groupe de parties prenantes créé avec succès.', 'success');
            return newGroup;
        } catch (error) {
            showError('Erreur lors de la création du groupe.');
            console.error('Error creating stakeholder group:', error);
            return null;
        }
    };

    const removeStakeholderGroup = async (projectId, groupId) => {
        if (!projectId || !groupId) { // Check if projectId and groupId are valid
            showError('ID du projet et du groupe requis.');
            return false;
        }

        if (!confirm('Supprimer ce groupe de parties prenantes ?')) return false;

        try {
            await fetchAPI(API_ENDPOINTS.stakeholderGroupById(projectId, groupId), {
                method: 'DELETE'
            });
            setStakeholderGroups((appState.stakeholderGroups || []).filter(g => g.id !== groupId)); // Update state via setStakeholderGroups
            showToast('Groupe supprimé avec succès.', 'success');
            return true;
        } catch (error) {
            showError('Erreur lors de la suppression du groupe.');
            console.error('Error deleting stakeholder group:', error);
            return false;
        }
    };

    return {
        init,
        loadStakeholders,
        renderStakeholdersSection, // Export the render function
        addStakeholderGroup,        
        removeStakeholderGroup
    };
})();

export function showStakeholderManagementModal() { // This function is called by core.js delegated event listener
    showModal('Gestion des Parties Prenantes', 'Contenu de la modale de gestion des parties prenantes.');
}

export const deleteStakeholderGroup = (groupId) => stakeholdersModule.removeStakeholderGroup(appState.currentProject?.id, groupId);
export const addStakeholderGroup = (projectId, groupData) => stakeholdersModule.addStakeholderGroup(projectId || appState.currentProject?.id, groupData);
export function runStakeholderAnalysis() { /* Logic to run stakeholder analysis */ } // This was already correct
export const renderStakeholdersSection = stakeholdersModule.renderStakeholdersSection; // Export the render function
export const init = stakeholdersModule.init;

export default stakeholdersModule;
