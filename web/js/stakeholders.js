// web/js/stakeholders.js

import { API_ENDPOINTS, SELECTORS, MESSAGES } from './constants.js';
import { fetchAPI } from './api.js';
import { showToast, showError } from './toast.js';
import { appState } from './app-improved.js';

const stakeholdersModule = (() => {
    let currentProjectId = null;

    const getStakeholdersContainer = () => document.querySelector(SELECTORS.stakeholdersContainer);
    const getStakeholdersList = () => document.querySelector(SELECTORS.stakeholdersList);
    const getCreateStakeholderBtn = () => document.querySelector(SELECTORS.createStakeholderBtn);
    const getNewStakeholderForm = () => document.querySelector(SELECTORS.newStakeholderForm);

    const init = () => {
        console.log('Stakeholders module initialized.');
        // Event listener for project selection change
        document.addEventListener('projectSelected', handleProjectSelected);

        // Event listener for creating a new stakeholder
        const createBtn = getCreateStakeholderBtn();
        if (createBtn) {
            createBtn.addEventListener('click', showCreateStakeholderModal);
        }

        // Event listener for new stakeholder form submission
        const newForm = getNewStakeholderForm();
        if (newForm) {
            newForm.addEventListener('submit', handleCreateStakeholder);
        }
    };

    const handleProjectSelected = (event) => {
        currentProjectId = event.detail.projectId;
        if (currentProjectId) {
            loadStakeholders(currentProjectId);
            getStakeholdersContainer().classList.remove('hidden');
        } else {
            getStakeholdersContainer().classList.add('hidden');
        }
    };

    const loadStakeholders = async (projectId) => {
        try {
            const stakeholders = await fetchAPI(API_ENDPOINTS.projectStakeholders(projectId));
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

        if (stakeholders.length === 0) {
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
            button.addEventListener('click', (e) => showEditStakeholderModal(e.target.dataset.id));
        });
        listElement.querySelectorAll('[data-action="delete-stakeholder"]').forEach(button => {
            button.addEventListener('click', (e) => handleDeleteStakeholder(e.target.dataset.id));
        });
    };

    const showCreateStakeholderModal = () => {
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

    const handleCreateStakeholder = async (event) => {
        event.preventDefault();
        if (!currentProjectId) {
            showError('Veuillez sélectionner un projet d\'abord.');
            return;
        }

        const form = event.target;
        const name = form.querySelector('#stakeholderName').value;
        const role = form.querySelector('#stakeholderRole').value;
        const contact_info = form.querySelector('#stakeholderContact').value;
        const notes = form.querySelector('#stakeholderNotes').value;

        try {
            const newStakeholder = await fetchAPI(API_ENDPOINTS.projectStakeholders(currentProjectId), {
                method: 'POST',
                body: JSON.stringify({ name, role, contact_info, notes })
            });
            showToast('Partie prenante créée avec succès.', 'success');
            loadStakeholders(currentProjectId);
            // Close modal
            const modal = document.getElementById('newStakeholderModal');
            if (modal) modal.classList.add('hidden');
        } catch (error) {
            showError('Erreur lors de la création de la partie prenante.');
            console.error('Error creating stakeholder:', error);
        }
    };

    const showEditStakeholderModal = async (stakeholderId) => {
        if (!currentProjectId) {
            showError('Veuillez sélectionner un projet d\'abord.');
            return;
        }
        try {
            const stakeholder = await fetchAPI(API_ENDPOINTS.stakeholderById(currentProjectId, stakeholderId));
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
                modal.classList.remove('hidden');
                modal.querySelector('form').onsubmit = (e) => handleUpdateStakeholder(e, stakeholder.id);
            }
        } catch (error) {
            showError('Erreur lors du chargement des détails de la partie prenante.');
            console.error('Error loading stakeholder details:', error);
        }
    };

    const handleUpdateStakeholder = async (event, stakeholderId) => {
        event.preventDefault();
        if (!currentProjectId) {
            showError('Veuillez sélectionner un projet d\'abord.');
            return;
        }

        const form = event.target;
        const name = form.querySelector('#editStakeholderName').value;
        const role = form.querySelector('#editStakeholderRole').value;
        const contact_info = form.querySelector('#editStakeholderContact').value;
        const notes = form.querySelector('#editStakeholderNotes').value;

        try {
            await fetchAPI(API_ENDPOINTS.stakeholderById(currentProjectId, stakeholderId), {
                method: 'PUT',
                body: JSON.stringify({ name, role, contact_info, notes })
            });
            showToast('Partie prenante mise à jour avec succès.', 'success');
            loadStakeholders(currentProjectId);
            // Close modal
            const modal = document.getElementById('editStakeholderModal');
            if (modal) modal.classList.add('hidden');
        } catch (error) {
            showError('Erreur lors de la mise à jour de la partie prenante.');
            console.error('Error updating stakeholder:', error);
        }
    };

    const handleDeleteStakeholder = async (stakeholderId) => {
        if (!currentProjectId) {
            showError('Veuillez sélectionner un projet d\'abord.');
            return;
        }
        if (!confirm(MESSAGES.confirmDeleteStakeholder)) return; // Assuming a confirmation message

        try {
            await fetchAPI(API_ENDPOINTS.stakeholderById(currentProjectId, stakeholderId), {
                method: 'DELETE'
            });
            showToast('Partie prenante supprimée avec succès.', 'success');
            loadStakeholders(currentProjectId);
        } catch (error) {
            showError('Erreur lors de la suppression de la partie prenante.');
            console.error('Error deleting stakeholder:', error);
        }
    };

    return {
        init,
        loadStakeholders
    };
})();

export default stakeholdersModule;
