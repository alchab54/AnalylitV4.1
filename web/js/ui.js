
export function escapeHtml(text) {
    if (text === null || typeof text === 'undefined') return '';
    const map = {
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;'
    };
    return String(text).replace(/[&<>"'']/g, (m) => map[m]);
}

export function showToast(message, type = 'info') {
    if (!elements.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    toast.innerHTML = `<span class="toast__icon">${icons[type] || 'ℹ️'}</span><p>${escapeHtml(message)}</p>`;
    elements.toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('toast--show'), 10);
    setTimeout(() => {
        toast.classList.remove('toast--show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 4000);
}

export function showLoadingOverlay(show, text = 'Chargement...') {
  if (!elements.loadingOverlay) return;
  const msgEl = elements.loadingOverlay.querySelector('[data-loading-message]') || elements.loadingOverlay.querySelector('p');
  if (msgEl) msgEl.textContent = text;
  elements.loadingOverlay.style.display = show ? 'flex' : 'none';
}

export function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        document.body.classList.add('modal-open');
        modal.classList.add('modal--show');
    } else {
        console.error(`La modale avec l\'ID #${modalId} n\'a pas été trouvée.`);
    }
}

export function closeModal(modalId) {
    const modalsToClose = modalId ? [document.getElementById(modalId)] : document.querySelectorAll('.modal--show');
    modalsToClose.forEach(modal => {
        if (modal) modal.classList.remove('modal--show');
    });
    if (document.querySelectorAll('.modal--show').length === 0) {
        document.body.classList.remove('modal-open');
    }
}

export function showModal(title, content, modalClass = '') {
    const modalId = 'genericModal';
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal';
        elements.modalsContainer.appendChild(modal);
    }

    modal.innerHTML = "`
        <div class=\"modal__content ${modalClass}\">
            <div class=\"modal__header\">
                <h3>${title}</h3>
                <button class=\"modal__close\" onclick=\"closeModal('${modalId}')\">×</button>
            </div>
            <div class=\"modal__body\">
                ${content}
            </div>
        </div>
    ";
    openModal(modalId);
}
