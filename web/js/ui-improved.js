// web/js/ui-improved.js
/**
 * Module UI amélioré avec animations, accessibilité et gestion d'erreurs
 */
import { MESSAGES, SELECTORS } from './constants.js';
import { selectProject } from './projects.js'; // Importez la fonction pour gérer le clic
import { escapeHtml } from './utils.js'; // Importez la fonction de sécurité
// ============================
// Utilitaires de base
// ============================

/**
 * Échappe le HTML pour éviter les injections XSS avec validation améliorée
 */
export function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) {
        return '';
    }
    
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Debounce pour limiter les appels de fonction
 */
export function debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func.apply(this, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(this, args);
    };
}

/**
 * Affiche la liste des projets sous forme de cartes interactives.
 * C'est la fonction clé qui traduit les données de l'API en éléments HTML.
 * @param {Array<Object>} projects - Le tableau d'objets projet venant de l'API.
 */
export function renderProjectCards(projects) {
    // 1. Cible le conteneur où les cartes doivent être insérées.
    const container = document.querySelector(SELECTORS.projectsList);

    // 2. Sécurité : Si le conteneur n'existe pas, on arrête tout pour éviter une erreur.
    if (!container) {
        console.error("Le conteneur de la liste des projets n'a pas été trouvé. Sélecteur attendu:", SELECTORS.projectsList);
        return;
    }

    // 3. Vider le conteneur pour éviter d'ajouter des doublons lors des rechargements.
    container.innerHTML = '';

    // 4. Gérer le cas où il n'y a aucun projet à afficher.
    if (!projects || projects.length === 0) {
        container.innerHTML = `<p class="empty-state">${MESSAGES.noProjectsFound}</p>`;
        return;
    }

    // 5. Créer et ajouter une carte pour chaque projet.
    projects.forEach(project => {
        // Crée un nouvel élément div pour la carte.
        const card = document.createElement('div');
        card.className = 'project-card'; // La classe que Cypress recherche !
        card.dataset.projectId = project.id; // Stocke l'ID du projet pour un accès facile.

        // Utilise la fonction escapeHtml pour se protéger contre les attaques XSS.
        const safeName = escapeHtml(project.name);
        const safeDescription = escapeHtml(project.description || 'Aucune description fournie.');
        const creationDate = new Date(project.created_at).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

        // Remplit la carte avec le HTML structuré.
        card.innerHTML = `
            <div class="project-card__header">
                <h3 class="project-card__title">${safeName}</h3>
            </div>
            <div class="project-card__body">
                <p class="project-card__description">${safeDescription}</p>
            </div>
            <div class="project-card__footer">
                <span class="project-card__date">Créé le: ${creationDate}</span>
                <span class="project-card__articles">Articles: ${project.article_count || 0}</span>
            </div>
        `;

        // Ajoute un écouteur d'événement pour rendre la carte cliquable.
        // Au clic, la fonction selectProject est appelée avec l'ID du projet.
        card.addEventListener('click', () => {
            selectProject(project.id);
        });

        // Ajoute la carte nouvellement créée au conteneur.
        container.appendChild(card);
    });
}

/**
 * Throttle pour limiter la fréquence d'exécution
 */
export function throttle(func, limit) {
    let lastFunc;
    let lastRan;
    return function(...args) {
        if (!lastRan) {
            func.apply(this, args);
            lastRan = Date.now();
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(() => {
                if ((Date.now() - lastRan) >= limit) {
                    func.apply(this, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    }
}

// ============================
// Gestion des Toasts améliorée
// ============================

let toastPool = [];
let toastId = 0;

const TOAST_ICONS = {
    success: '✅',
    error: '❌', 
    warning: '⚠️',
    info: 'ℹ️'
};

const TOAST_DURATION = {
    success: 4000,
    info: 5000,
    warning: 6000,
    error: 8000
};

/**
 * Affiche un toast avec animations et accessibilité améliorées
 */
export function showToast(message, type = 'info', options = {}) {
    const {
        duration = TOAST_DURATION[type],
        persistent = false,
        actionLabel,
        actionCallback,
        id = `toast-${++toastId}`
    } = options;

    const toast = getToastFromPool();
    toast.id = id;
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

    // Contenu principal
    const messageElement = createToastMessage(message, type);
    toast.innerHTML = '';
    toast.appendChild(messageElement);

    // Bouton d'action optionnel
    if (actionLabel && actionCallback) {
        const actionBtn = createToastAction(actionLabel, actionCallback, toast);
        toast.appendChild(actionBtn);
    }

    // Bouton de fermeture
    const closeButton = createToastCloseButton(toast);
    toast.appendChild(closeButton);

    // Animations et auto-fermeture
    animateToastIn(toast);
    
    if (!persistent && duration > 0) {
        const timer = setTimeout(() => hideToast(toast), duration);
        toast.dataset.timer = timer;
    }

    // Focus management pour l'accessibilité
    if (type === 'error') {
        toast.setAttribute('tabindex', '-1');
        toast.focus();
    }

    return toast;
}

function createToastMessage(message, type) {
    const messageElement = document.createElement('div');
    messageElement.className = 'toast__message';
    messageElement.innerHTML = `
        <span class="toast__icon" aria-hidden="true">${TOAST_ICONS[type] || 'ℹ️'}</span>
        <span class="toast__text">${escapeHtml(message)}</span>
    `;
    return messageElement;
}

function createToastAction(label, callback, toast) {
    const actionBtn = document.createElement('button');
    actionBtn.className = 'btn btn--sm btn--ghost toast__action';
    actionBtn.textContent = label;
    actionBtn.addEventListener('click', () => {
        callback();
        hideToast(toast);
    });
    return actionBtn;
}

function createToastCloseButton(toast) {
    const closeButton = document.createElement('button');
    closeButton.className = 'toast__close';
    closeButton.innerHTML = '×';
    closeButton.setAttribute('aria-label', 'Fermer la notification');
    closeButton.addEventListener('click', () => hideToast(toast));
    return closeButton;
}

function animateToastIn(toast) {
    toast.classList.remove('toast--hiding', 'toast--hidden');
    // Force reflow
    toast.offsetHeight;
    toast.classList.add('toast--show');
}

function hideToast(toast) {
    if (!toast || toast.classList.contains('toast--hiding')) return;
    
    clearTimeout(toast.dataset.timer);
    toast.classList.remove('toast--show');
    toast.classList.add('toast--hiding');
    
    setTimeout(() => {
        toast.classList.add('toast--hidden');
        returnToastToPool(toast);
    }, 300);
}

function getToastFromPool() {
    const container = document.getElementById('toastContainer');
    if (!container) {
        console.error('Toast container not found');
        return createToastElement();
    }

    let toast = toastPool.pop();
    if (!toast) {
        toast = createToastElement();
        container.appendChild(toast);
    }
    
    return toast;
}

function createToastElement() {
    const toast = document.createElement('div');
    toast.className = 'toast';
    return toast;
}

function returnToastToPool(toast) {
    toast.removeAttribute('id');
    toast.removeAttribute('role');
    toast.removeAttribute('aria-live');
    toast.removeAttribute('tabindex');
    toast.innerHTML = '';
    toastPool.push(toast);
}

// ============================
// Overlay de chargement amélioré
// ============================

let currentLoadingState = {
    show: false,
    message: '',
    progress: 0,
    taskId: null
};

/**
 * Affiche ou masque l'overlay de chargement avec support des progressions
 */
export function showLoadingOverlay(show, message = 'Chargement...', taskId = null) {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
        console.error('Loading overlay not found');
        return;
    }

    currentLoadingState = { show, message, taskId, progress: 0 };

    if (show) {
        updateLoadingContent(overlay, message, taskId);
        overlay.classList.add('loading-overlay--show');
        overlay.setAttribute('aria-hidden', 'false');
        
        // Trap focus in overlay for accessibility
        trapFocusInElement(overlay);
    } else {
        overlay.classList.remove('loading-overlay--show');
        overlay.setAttribute('aria-hidden', 'true');
        resetProgressBar(overlay);
        
        // Release focus trap
        releaseFocusTrap();
    }
}

function updateLoadingContent(overlay, message, taskId) {
    const messageEl = overlay.querySelector('.loading-overlay__message');
    const cancelBtn = overlay.querySelector('#cancelTaskBtn');

    if (messageEl) messageEl.textContent = message;

    if (cancelBtn) {
        if (taskId) {
            cancelBtn.dataset.taskId = taskId;
            cancelBtn.style.display = 'inline-flex';
        } else {
            cancelBtn.style.display = 'none';
        }
    }
}

/**
 * Met à jour la barre de progression
 */
export function updateLoadingProgress(current, total, message, taskId = null) {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;

    // Afficher l'overlay s'il n'est pas visible
    if (!overlay.classList.contains('loading-overlay--show')) {
        showLoadingOverlay(true, message, taskId);
    }

    const messageEl = overlay.querySelector('.loading-overlay__message');
    const progressContainer = overlay.querySelector('.progress-bar-container');
    const progressBar = overlay.querySelector('.progress-bar');

    if (messageEl) messageEl.textContent = message;

    if (progressContainer && progressBar && total > 0) {
        const percent = Math.min(100, Math.round((current / total) * 100));
        progressContainer.style.display = 'block';
        progressBar.style.width = `${percent}%`;
        progressBar.setAttribute('aria-valuenow', percent);
        
        currentLoadingState.progress = percent;
    }
}

function resetProgressBar(overlay) {
    const progressContainer = overlay.querySelector('.progress-bar-container');
    const progressBar = overlay.querySelector('.progress-bar');

    if (progressContainer) progressContainer.style.display = 'none';
    if (progressBar) {
        progressBar.style.width = '0%';
        progressBar.setAttribute('aria-valuenow', '0');
    }
}

// ============================
// Gestion des modales améliorée
// ============================

let modalStack = [];
let focusBeforeModal = null;

/**
 * Ouvre une modale avec gestion du focus et de l'accessibilité
 */
export function openModal(modalId, options = {}) {
    const modal = document.getElementById(modalId);
    if (!modal) {
        console.error(`Modal ${modalId} not found`);
        return false;
    }

    // Sauvegarder le focus actuel
    if (!focusBeforeModal) {
        focusBeforeModal = document.activeElement;
    }

    // Ajouter à la pile des modales
    modalStack.push(modalId);

    // Configurer les attributs d'accessibilité
    modal.classList.add('modal--show');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');

    // Focus sur le premier élément focusable ou la modale elle-même
    const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstFocusable) {
        firstFocusable.focus();
    } else {
        modal.focus();
    }

    // Trap focus dans la modale
    trapFocusInElement(modal);

    // Gérer la fermeture avec Échap
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeModal(modalId);
        }
    };
    
    modal.addEventListener('keydown', escapeHandler);
    modal.dataset.escapeHandler = 'true';

    return true;
}

/**
 * Ferme une modale ou la modale active
 */
export function closeModal(modalId) {
    let modal;
    
    if (modalId) {
        modal = document.getElementById(modalId);
        const index = modalStack.indexOf(modalId);
        if (index > -1) modalStack.splice(index, 1);
    } else {
        // Fermer la modale la plus récente
        const lastModalId = modalStack.pop();
        modal = lastModalId ? document.getElementById(lastModalId) : document.querySelector('.modal--show');
    }

    if (!modal) return false;

    // Animations de fermeture
    modal.classList.remove('modal--show');
    modal.setAttribute('aria-hidden', 'true');

    // Nettoyer les événements
    if (modal.dataset.escapeHandler) {
        modal.removeEventListener('keydown', modal.escapeHandler);
        delete modal.dataset.escapeHandler;
    }

    // Gérer le focus et le body
    if (modalStack.length === 0) {
        document.body.classList.remove('modal-open');
        releaseFocusTrap();
        
        if (focusBeforeModal && focusBeforeModal.focus) {
            focusBeforeModal.focus();
        }
        focusBeforeModal = null;
    } else {
        // Focus sur la modale précédente
        const previousModalId = modalStack[modalStack.length - 1];
        const previousModal = document.getElementById(previousModalId);
        if (previousModal) {
            trapFocusInElement(previousModal);
        }
    }

    // Nettoyer le contenu des modales génériques
    if (modal.id === 'genericModal') {
        const modalBody = modal.querySelector('#genericModalBody');
        if (modalBody) modalBody.innerHTML = '';
    }

    return true;
}

/**
 * Crée une modale générique avec contenu dynamique
 */
export function showModal(title, contentHtml, options = {}) {
    const {
        modalClass = '',
        actions = [],
        size = 'default'
    } = options;

    const modal = document.getElementById('genericModal');
    const modalTitle = document.getElementById('genericModalTitle');
    const modalBody = document.getElementById('genericModalBody');
    const modalContent = modal?.querySelector('.modal__content');
    const modalActions = document.getElementById('genericModalActions');

    if (!modal || !modalTitle || !modalBody || !modalContent || !modalActions) {
        console.error('Generic modal elements not found');
        return false;
    }

    // Configurer le contenu
    modalTitle.textContent = title;
    modalBody.innerHTML = contentHtml;

    // Classes CSS
    modalContent.className = `modal__content ${size === 'large' ? 'modal__content--large' : ''}`;
    if (modalClass) modalContent.classList.add(modalClass);

    // Actions
    if (actions.length > 0) {
        modalActions.innerHTML = actions.map(action => 
            `<button type="button" class="btn ${action.class || 'btn--secondary'}" 
                     data-action="${action.action || ''}" 
                     ${action.type ? `type="${action.type}"` : ''}>
                ${escapeHtml(action.text)}
             </button>`
        ).join('');
        modalActions.style.display = 'flex';
    } else {
        modalActions.innerHTML = '';
        modalActions.style.display = 'none';
    }

    return openModal('genericModal');
}

/**
 * Modale de confirmation
 */
export function showConfirmModal(title, message, options = {}) {
    const {
        confirmText = 'Confirmer',
        cancelText = 'Annuler',
        confirmClass = 'btn--primary',
        onConfirm,
        onCancel
    } = options;

    const actions = [
        {
            text: cancelText,
            class: 'btn--secondary',
            action: 'close-modal'
        },
        {
            text: confirmText,
            class: confirmClass,
            action: 'confirm-action'
        }
    ];

    showModal(title, `<p>${escapeHtml(message)}</p>`, { actions });

    // Gestionnaire temporaire pour la confirmation
    const handleConfirm = (e) => {
        if (e.target.dataset.action === 'confirm-action') {
            if (onConfirm) onConfirm();
            closeModal('genericModal');
            document.removeEventListener('click', handleConfirm);
        } else if (e.target.dataset.action === 'close-modal') {
            if (onCancel) onCancel();
            document.removeEventListener('click', handleConfirm);
        }
    };

    document.addEventListener('click', handleConfirm);
}

// ============================
// Gestion du focus et accessibilité
// ============================

let focusTrap = null;

function trapFocusInElement(element) {
    if (focusTrap) releaseFocusTrap();

    const focusableElements = element.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    focusTrap = (e) => {
        if (e.key === 'Tab') {
            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                }
            } else {
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        }
    };

    element.addEventListener('keydown', focusTrap);
}

function releaseFocusTrap() {
    if (focusTrap) {
        document.removeEventListener('keydown', focusTrap);
        focusTrap = null;
    }
}

// ============================
// Utilitaires d'interface
// ============================

/**
 * Toggle pour sidebar
 */
export function toggleSidebar() {
    const sidebar = document.getElementById('appSidebar');
    if (sidebar) {
        const isCollapsed = sidebar.classList.toggle('sidebar--collapsed');
        localStorage.setItem('sidebar-collapsed', isCollapsed);
        
        // Émettre un événement personnalisé
        window.dispatchEvent(new CustomEvent('sidebar-toggle', { 
            detail: { collapsed: isCollapsed } 
        }));
    }
}

/**
 * Modale pour créer un projet
 */
export function showCreateProjectModal() {
    const modal = document.getElementById('newProjectModal');
    if (modal) {
        openModal('newProjectModal');
        
        const form = modal.querySelector('form');
        if (form) {
            form.reset();
            const nameInput = form.elements.name;
            if (nameInput) nameInput.focus();
        }
    } else {
        showModal('Erreur', 'La modale de création de projet est introuvable.');
    }
}

// ============================
// Gestion des erreurs et logging
// ============================

/**
 * Logger personnalisé pour le débogage
 */
export const logger = {
    debug: (message, ...args) => {
        if (process.env.NODE_ENV === 'development') {
            console.log(`[DEBUG] ${message}`, ...args);
        }
    },
    info: (message, ...args) => {
        console.info(`[INFO] ${message}`, ...args);
    },
    warn: (message, ...args) => {
        console.warn(`[WARN] ${message}`, ...args);
    },
    error: (message, ...args) => {
        console.error(`[ERROR] ${message}`, ...args);
        
        // En production, on pourrait envoyer les erreurs à un service de monitoring
        if (process.env.NODE_ENV === 'production') {
            // sendErrorToMonitoring(message, args);
        }
    }
};

/**
 * Gestionnaire d'erreurs global pour l'UI
 */
export function handleUIError(error, context = '') {
    logger.error(`UI Error in ${context}:`, error);
    
    const message = error.message || 'Une erreur inattendue s\'est produite';
    showToast(`Erreur ${context}: ${message}`, 'error', {
        persistent: true,
        actionLabel: 'Signaler',
        actionCallback: () => {
            // Logique pour signaler l'erreur
            logger.info('Error reported by user:', { error, context });
        }
    });
}

// ============================
// Animations et transitions
// ============================

/**
 * Anime l'entrée d'un élément
 */
export function animateIn(element, animation = 'fadeIn', duration = 300) {
    if (!element) return Promise.resolve();

    return new Promise((resolve) => {
        element.style.animationDuration = `${duration}ms`;
        element.classList.add(`animate-${animation}`);
        
        const handleAnimationEnd = () => {
            element.classList.remove(`animate-${animation}`);
            element.removeEventListener('animationend', handleAnimationEnd);
            resolve();
        };
        
        element.addEventListener('animationend', handleAnimationEnd);
    });
}

/**
 * Anime la sortie d'un élément
 */
export function animateOut(element, animation = 'fadeOut', duration = 300) {
    if (!element) return Promise.resolve();

    return new Promise((resolve) => {
        element.style.animationDuration = `${duration}ms`;
        element.classList.add(`animate-${animation}`);
        
        const handleAnimationEnd = () => {
            element.classList.remove(`animate-${animation}`);
            element.removeEventListener('animationend', handleAnimationEnd);
            resolve();
        };
        
        element.addEventListener('animationend', handleAnimationEnd);
    });
}

// ============================
// Validation et formulaires
// ============================

/**
 * Valide un formulaire et affiche les erreurs
 */
export function validateForm(form) {
    if (!form) return false;

    const errors = [];
    const requiredFields = form.querySelectorAll('[required]');
    
    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            errors.push({
                field: field.name || field.id,
                message: `Le champ "${field.labels?.[0]?.textContent || field.name}" est requis`
            });
            field.classList.add('form-control--error');
        } else {
            field.classList.remove('form-control--error');
        }
    });

    // Validation des emails
    const emailFields = form.querySelectorAll('input[type="email"]');
    emailFields.forEach(field => {
        if (field.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value)) {
            errors.push({
                field: field.name || field.id,
                message: 'Format d\'email invalide'
            });
            field.classList.add('form-control--error');
        }
    });

    if (errors.length > 0) {
        const errorMessage = errors.map(e => e.message).join(', ');
        showToast(errorMessage, 'error');
        return false;
    }

    return true;
}

// Export par défaut des fonctions principales
export default {
    showToast,
    showLoadingOverlay,
    updateLoadingProgress,
    openModal,
    closeModal,
    showModal,
    showConfirmModal,
    showCreateProjectModal,
    toggleSidebar,
    escapeHtml,
    debounce,
    throttle,
    handleUIError,
    logger,
    validateForm,
    animateIn,
    animateOut
};