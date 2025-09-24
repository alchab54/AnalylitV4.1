// web/js/stakeholders.js

import { API_ENDPOINTS, SELECTORS, MESSAGES } from './constants.js';
import { fetchAPI } from './api.js';
import { showToast, showError } from './ui-improved.js'; // Use ui-improved.js for toast
import { appState } from './app-improved.js';
import { setStakeholders, setStakeholderGroups } from './state.js';

const stakeholdersModule = (() => {

    const getStakeholdersContainer = () => document.querySelector(SELECTORS.stakeholdersContainer);
    const getStakeholdersList = () => document.querySelector(SELECTORS.stakeholdersList);
    const getCreateStakeholderBtn = () => document.querySelector(SELECTORS.createStakeholderBtn);
    const getNewStakeholderForm = () => document.querySelector(SELECTORS.newStakeholderForm);

    const init = () => {
        console.log('Stakeholders module initialized.');
        // Event listener for project selection change
        window.addEventListener('current-project-changed', handleProjectChanged);

        // Event listener for creating a new stakeholder
        const createBtn = getCreateStakeholderBtn();
        if (createBtn) {
            createBtn.addEventListener('click', () => showCreateStakeholderModal(appState.currentProject?.id));
        }

        // Event listener for new stakeholder form submission
        const newForm = getNewStakeholderForm();
        if (newForm) {
            newForm.addEventListener('submit', (e) => handleCreateStakeholder(e, appState.currentProject?.id));
        }
    };

    const handleProjectChanged = () => {
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
            const stakeholders = await fetchAPI(API_ENDPOINTS.projectStakeholders(projectId)); // Assuming this endpoint exists
            setStakeholders(stakeholders || []); // Update state
            renderStakeholders(stakeholders);
        } catch (error) {
            showError('Erreur lors du chargement des parties prenantes.');
            console.error('Error loading stakeholders:', error);
        }
    };

    const renderStakeholders = (stakeholders) => {
        const listElement = getStakeholdersList(); // Use getter
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
                <h3>${stakeholder.name}</h3>
                <p>Rôle: ${stakeholder.role || 'N/A'}</p>
                <p>Contact: ${stakeholder.contact_info || 'N/A'}</p>
                <p>Notes: ${stakeholder.notes || 'N/A'}</p>
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

    const showCreateStakeholderModal = (projectId) => {
        // Logic to show a modal for creating a new stakeholder
        // For now, just log and reset form
        console.log('Showing create stakeholder modal');
        const form = getNewStakeholderForm();
        if (form) {
            form.reset();
            // Assuming a modal with ID 'newStakeholderModal' exists
            const modal = document.getElementById('newStakeholderModal');
            if (modal) modal.classList.remove('hidden');
        }
    };

    const handleCreateStakeholder = async (event, projectId) => {
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
            // Close modal
            const modal = document.getElementById('newStakeholderModal');
            if (modal) modal.classList.add('hidden');
        } catch (error) {
            showError('Erreur lors de la création de la partie prenante.');
            console.error('Error creating stakeholder:', error);
        }
    };

    const showEditStakeholderModal = async (projectId, stakeholderId) => {
        if (!projectId) {
            showError('Veuillez sélectionner un projet d\'abord.');
            return;
        }
        try {
            const stakeholder = await fetchAPI(API_ENDPOINTS.stakeholderById(projectId, stakeholderId));
            // Populate a modal form with stakeholder data
            console.log('Showing edit modal for:', stakeholder);
            // Assuming a modal with ID 'editStakeholderModal' exists
            const modal = document.getElementById('editStakeholderModal');
            if (modal) {
                modal.querySelector('#editStakeholderId').value = stakeholder.id;
                modal.querySelector('#editStakeholderName').value = stakeholder.name;
                modal.querySelector('#editStakeholderRole').value = stakeholder.role;
                modal.querySelector('#editStakeholderContact').value = stakeholder.contact_info;
                modal.querySelector('#editStakeholderNotes').value = stakeholder.notes;
                modal.classList.remove('hidden'); // Assuming 'hidden' class for modal
                modal.querySelector('form').onsubmit = (e) => handleUpdateStakeholder(e, projectId, stakeholder.id);
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
            // Close modal
            const modal = document.getElementById('editStakeholderModal');
            if (modal) modal.classList.add('hidden');
        } catch (error) {
            showError('Erreur lors de la mise à jour de la partie prenante.');
            console.error('Error updating stakeholder:', error);
        }
    };

    const handleDeleteStakeholder = async (projectId, stakeholderId) => {
        if (!projectId) {
            showError('Veuillez sélectionner un projet d\'abord.');
            return;
        }
        if (!confirm(MESSAGES.confirmDeleteStakeholder)) return; // Assuming a confirmation message

        try { // Assuming this endpoint exists
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
        if (!projectId) { // Assuming this endpoint exists
            showError('ID du projet requis pour ajouter un groupe de parties prenantes.');
            return null;
        }

        try {
            const newGroup = await fetchAPI(API_ENDPOINTS.projectStakeholderGroups(projectId), {
                method: 'POST',
                body: JSON.stringify(groupData)
            });
            setStakeholderGroups([...(appState.stakeholderGroups || []), newGroup]); // Update state
            showToast('Groupe de parties prenantes créé avec succès.', 'success');
            return newGroup;
        } catch (error) {
            showError('Erreur lors de la création du groupe.');
            console.error('Error creating stakeholder group:', error);
            return null;
        }
    };

    const removeStakeholderGroup = async (projectId, groupId) => {
        if (!projectId || !groupId) { // Assuming this endpoint exists
            showError('ID du projet et du groupe requis.');
            return false;
        }

        if (!confirm('Supprimer ce groupe de parties prenantes ?')) return false;

        try {
            await fetchAPI(API_ENDPOINTS.stakeholderGroupById(projectId, groupId), {
                method: 'DELETE'
            });
            setStakeholderGroups((appState.stakeholderGroups || []).filter(g => g.id !== groupId)); // Update state
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
        addStakeholderGroup,        
        removeStakeholderGroup
    };
})();

export function showStakeholderManagementModal() { // This function is called by core.js
    console.log('Ouverture modale gestion parties prenantes');
    // Logic à implémenter selon vos besoins
}

export const deleteStakeholderGroup = (groupId) => stakeholdersModule.removeStakeholderGroup(appState.currentProject?.id, groupId);
export const addStakeholderGroup = (groupData) => stakeholdersModule.addStakeholderGroup(appState.currentProject?.id, groupData);
export function runStakeholderAnalysis() { /* Logic to run stakeholder analysis */ }

export default stakeholdersModule;
