// ============================
// UI Utilities
// ============================

/**
 * Échappe le HTML pour éviter les injections XSS.
 * @param {string} unsafe - La chaîne de caractères à échapper.
 * @returns {string} - La chaîne échappée.
 */

/**
 * Affiche un message toast.
 * @param {string} message - Le message à afficher.
 * @param {'info'|'success'|'warning'|'error'} type - Le type de toast.
 */
export function showToast(message, type = 'info') {
    const toast = getToastFromPool();

    toast.className = `toast toast--${type}`;
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

    // Contenu de la notification
    const messageElement = toast.querySelector('.toast__message') || document.createElement('p');
    messageElement.className = 'toast__message';
    messageElement.innerHTML = `<span class="toast__icon">${icons[type] || 'ℹ️'}</span> ${escapeHtml(message)}`;
    if (!toast.querySelector('.toast__message')) {
        toast.appendChild(messageElement);
    }

    // Bouton de fermeture
    let closeButton = toast.querySelector('.toast__close');
    if (!closeButton) {
        closeButton = document.createElement('button');
        closeButton.className = 'toast__close';
        closeButton.innerHTML = '&times;';
        closeButton.setAttribute('aria-label', 'Fermer');
        toast.appendChild(closeButton);
    }

    // Gestionnaire pour cacher le toast
    const hideToast = () => hideAndPoolToast(toast);
    closeButton.onclick = hideToast; // Réassigner au cas où

    // Fait apparaître la notification
    toast.classList.remove('toast--hiding', 'toast--hidden');
    setTimeout(() => toast.classList.add('toast--show'), 10);

    // Fait disparaître la notification après 5 secondes
    const timer = setTimeout(hideToast, 5000);
    toast.dataset.timer = timer; // Stocker le timer pour l'annuler si besoin
}

function getToastFromPool() {
    const container = document.getElementById('toastContainer');
    const pooledToast = container?.querySelector('.toast--hidden');
    if (pooledToast) {
        return pooledToast;
    }
    const newToast = document.createElement('div');
    container?.appendChild(newToast);
    return newToast;
}

function hideAndPoolToast(toast) {
    if (!toast || toast.classList.contains('toast--hiding')) return;
    clearTimeout(toast.dataset.timer);
    toast.classList.remove('toast--show');
    toast.classList.add('toast--hiding');
    setTimeout(() => toast.classList.add('toast--hidden'), 500); // Après la transition
}

/**
 * Affiche ou masque l'overlay de chargement.
 * @param {boolean} show - Afficher (true) ou masquer (false).
 * @param {string} [message='Chargement...'] - Le message à afficher.
 * @param {string|null} [taskId=null] - L'ID de la tâche pour permettre l'annulation.
 */
export function showLoadingOverlay(show, message = 'Chargement...', taskId = null) {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;

    const overlayMessage = overlay.querySelector('.loading-overlay__message');
    const progressBar = overlay.querySelector('.progress-bar');
    const cancelBtn = document.getElementById('cancelTaskBtn');
    
    if (show) {
        if (overlayMessage) overlayMessage.textContent = message;
        // Réinitialiser la barre de progression lors de l'affichage
        if (progressBar) {
            progressBar.style.width = '0%';
            if (progressBar.parentElement) progressBar.parentElement.style.display = 'none';
        }

        if (cancelBtn) {
            if (taskId) {
                cancelBtn.dataset.taskId = taskId;
                cancelBtn.style.display = 'inline-flex';
            } else {
                cancelBtn.style.display = 'none';
            }
        }
        overlay.classList.add('loading-overlay--show');
    } else {
        overlay.classList.remove('loading-overlay--show');
    }
}

/**
 * Met à jour la barre de progression sur l'overlay de chargement.
 * @param {number} current - La valeur actuelle.
 * @param {number} total - La valeur totale.
 * @param {string} message - Le message à afficher.
 */
export function updateLoadingProgress(current, total, message, taskId = null) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay && !overlay.classList.contains('loading-overlay--show')) {
        // Transmettre le taskId si disponible
        showLoadingOverlay(true, message, taskId);
    }

    const messageEl = overlay.querySelector('.loading-overlay__message');
    const progressBarContainer = overlay.querySelector('.progress-bar-container');
    const progressBar = overlay.querySelector('.progress-bar');

    if (messageEl) messageEl.textContent = message;

    if (progressBarContainer && progressBar && total > 0) {
        const percent = Math.min(100, Math.round((current / total) * 100));
        progressBarContainer.style.display = 'block';
        progressBar.style.width = `${percent}%`;
    }
}

/**
 * Ouvre une modale spécifique par son ID.
 * @param {string} modalId - L'ID de l'élément de la modale.
 */
export function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('modal--show');
    }
}

/**
 * Ferme une modale par son ID ou la première modale ouverte.
 * @param {string} [modalId] - L'ID de la modale à fermer.
 */
export function closeModal(modalId) {
    const modalToClose = modalId ? document.getElementById(modalId) : document.querySelector('.modal.modal--show');
    const modal = modalToClose;
    if (modal) {
        modal.classList.remove('modal--show');

        // Si c'est la modale générique, on nettoie son contenu pour la prochaine utilisation
        if (modal.id === 'genericModal') {
            const modalBody = document.getElementById('genericModalBody');
            if (modalBody) modalBody.innerHTML = '';
        }
    }
}

/**
 * Affiche une modale générique avec un titre et un contenu.
 * @param {string} title - Le titre de la modale.
 * @param {string} contentHtml - Le contenu HTML du corps de la modale.
 * @param {object} [options] - Options supplémentaires.
 * @param {string} [options.modalClass] - Classe CSS additionnelle pour le contenu de la modale.
 * @param {Array<{text: string, class: string, action: string, type?: string}>} [options.actions] - Boutons d'action.
 */
export function showModal(title, contentHtml, options = {}) {
    const modal = document.getElementById('genericModal');
    const modalTitle = document.getElementById('genericModalTitle');
    const modalBody = document.getElementById('genericModalBody');
    const modalContent = modal.querySelector('.modal__content');
    const modalActionsContainer = document.getElementById('genericModalActions');

    if (!modal || !modalTitle || !modalBody || !modalContent || !modalActionsContainer) return;

    modalTitle.textContent = title;
    modalBody.innerHTML = contentHtml;

    // Gérer les classes additionnelles
    modalContent.className = 'modal__content'; // Reset
    if (options.modalClass) {
        modalContent.classList.add(options.modalClass);
    }

    // Gérer les boutons d'action
    if (options.actions && options.actions.length > 0) {
        modalActionsContainer.innerHTML = options.actions.map(action => `
            <button 
                type="${action.type || 'button'}" 
                class="${action.class || 'btn'}" 
                data-action="${action.action}"
            >
                ${escapeHtml(action.text)}
            </button>
        `).join('');
        modalActionsContainer.style.display = 'flex';
    } else {
        // S'il n'y a pas d'actions, on s'assure que le conteneur est vide et masqué
        modalActionsContainer.innerHTML = '';
        modalActionsContainer.style.display = 'none';
    }

    modal.classList.add('modal--show');
}

export function showCreateProjectModal() {
    const modal = document.getElementById('newProjectModal');
    if (modal) {
        modal.classList.add('modal--show');
        
        const form = modal.querySelector('form');
        if (form) {
            form.reset(); // Reset form fields
            form.elements.name.focus(); // Focus on the name input
        }
    } else {
        // Fallback or create modal dynamically if it doesn't exist
        const modalContent = `
            <p>La modale de création de projet n'a pas pu être trouvée.</p>
        `;
        showModal('Erreur', modalContent);
    }
}

/**
 * Bascule la visibilité de la barre latérale.
 */
export function toggleSidebar() {
    const sidebar = document.getElementById('appSidebar'); // Assurez-vous que votre sidebar a cet ID
    if (sidebar) {
        sidebar.classList.toggle('sidebar--collapsed');
    }
}