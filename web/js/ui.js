// ============================
// UI Utilities
// ============================

/**
 * Échappe le HTML pour éviter les injections XSS.
 * @param {string} unsafe - La chaîne de caractères à échapper.
 * @returns {string} - La chaîne échappée.
 */
export function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) {
        return '';
    }
    return unsafe
         .toString()
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

/**
 * Affiche un message toast.
 * @param {string} message - Le message à afficher.
 * @param {'info'|'success'|'warning'|'error'} type - Le type de toast.
 */
export function showToast(message, type = 'info', elements) {
    if (!elements?.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

    // Contenu de la notification
    const messageElement = document.createElement('p');
    messageElement.innerHTML = `<span class="toast__icon">${icons[type] || 'ℹ️'}</span> ${escapeHtml(message)}`;
    toast.appendChild(messageElement);

    // Bouton de fermeture
    const closeButton = document.createElement('button');
    closeButton.className = 'toast__close';
    closeButton.innerHTML = '&times;'; // Symbole "x"
    closeButton.setAttribute('aria-label', 'Fermer');
    
    // Fonction pour cacher et supprimer la notification
    const hideToast = () => {
        // Empêche le double déclenchement
        if (toast.classList.contains('toast--hiding')) return;
        
        toast.classList.add('toast--hiding');
        toast.addEventListener('transitionend', () => {
            toast.remove();
        });
    };

    closeButton.onclick = hideToast;
    toast.appendChild(closeButton);
    
    elements.toastContainer.appendChild(toast);
    
    // Fait apparaître la notification
    setTimeout(() => toast.classList.add('toast--show'), 10);

    // Fait disparaître la notification après 5 secondes
    setTimeout(hideToast, 5000);
}

/**
 * Affiche ou masque l'overlay de chargement.
 * @param {boolean} show - Afficher ou masquer.
 * @param {string} message - Le message à afficher pendant le chargement.
 */
export function showLoadingOverlay(show, message = '', elements) {
    const overlay = elements?.loadingOverlay || document.getElementById('loadingOverlay');
    if (!overlay) return;

    const overlayMessage = overlay.querySelector('.loading-message');
    
    if (show) {
        if (overlayMessage) {
            overlayMessage.textContent = message;
        }
        overlay.style.display = 'flex';
    } else {
        overlay.style.display = 'none';
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
export function closeModal(modalId = 'genericModal') {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('modal--show');
        const modalBody = document.getElementById('genericModalBody');
        if (modalBody) modalBody.innerHTML = ''; // Nettoyer le contenu
    }
}

/**
 * Affiche une modale générique avec un titre et un contenu.
 * @param {string} title - Le titre de la modale.
 * @param {string} content - Le contenu HTML de la modale.
 * @param {string} [modalClass] - Une classe CSS additionnelle pour le contenu de la modale.
 */
export function showModal(title, content, modalClass = '') {
    const modal = document.getElementById('genericModal');
    const modalTitle = document.getElementById('genericModalTitle');
    const modalBody = document.getElementById('genericModalBody');
    const modalContent = modal.querySelector('.modal__content');

    if (!modal || !modalTitle || !modalBody || !modalContent) return;

    modalTitle.textContent = title;
    modalBody.innerHTML = content;

    // Gérer les classes additionnelles
    modalContent.className = 'modal__content'; // Reset
    if (modalClass) {
        modalContent.classList.add(modalClass);
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