// ============================
// UI Utilities
// ============================

/**
 * Échappe le HTML pour éviter les injections XSS.
 * @param {string} unsafe - La chaîne de caractères à échapper.
 * @returns {string} - La chaîne échappée.
 */
function escapeHtml(unsafe) {
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
function showToast(message, type = 'info') {
    if (!elements.toastContainer) return;

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
function showLoadingOverlay(show, message = '') {
    const overlay = document.getElementById('loadingOverlay');
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
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('modal--show');
    }
}

/**
 * Ferme une modale par son ID ou la première modale ouverte.
 * @param {string} [modalId] - L'ID de la modale à fermer.
 */
function closeModal(modalId) {
    let modal;
    if (modalId) {
        modal = document.getElementById(modalId);
    } else {
        modal = document.querySelector('.modal.modal--show');
    }
    
    if (modal) {
        modal.classList.remove('modal--show');
    }
}

/**
 * Affiche une modale générique avec un titre et un contenu.
 * @param {string} title - Le titre de la modale.
 * @param {string} content - Le contenu HTML de la modale.
 * @param {string} [modalClass] - Une classe CSS additionnelle pour le contenu de la modale.
 */
function showModal(title, content, modalClass = '') {
    const container = document.getElementById('modalsContainer');
    if (!container) {
        console.error('Modals container not found!');
        return;
    }

    let modal = document.getElementById('genericModal');
    if (modal) {
        modal.remove();
    }
    
    modal = document.createElement('div');
    modal.id = 'genericModal';
    modal.className = 'modal';
    
    modal.innerHTML = `
        <div class="modal__content ${modalClass}">
            <div class="modal__header">
                <h3>${title}</h3>
                <button type="button" class="modal__close" onclick="closeModal('genericModal')">&times;</button>
            </div>
            <div class="modal__body">
                ${content}
            </div>
        </div>
    `;
    container.appendChild(modal);
    
    openModal('genericModal');
}