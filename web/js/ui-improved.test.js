/**
 * <!-- Import failed: jest-environment - ENOENT: no such file or directory, access 'c:\Users\alich\Downloads\exported-assets (1)\docs\jest-environment' --> jsdom
 */
import * as ui from './ui-improved.js';

describe('Module UI Improved', () => {
  
  beforeEach(() => {
    // Nettoie le DOM avant chaque test
    document.body.innerHTML = '';
    
    // Mock de setTimeout pour contrôler les timers
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('escapeHtml', () => {
    it('devrait échapper les caractères HTML spéciaux', () => {
      const input = '<script>alert("xss")</script>';
      const expected = '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;';
      expect(ui.escapeHtml(input)).toBe(expected);
    });

    it('devrait retourner une chaîne vide pour une entrée non-chaîne', () => {
      expect(ui.escapeHtml(null)).toBe('');
      expect(ui.escapeHtml(undefined)).toBe('');
      expect(ui.escapeHtml(123)).toBe('');
      expect(ui.escapeHtml({})).toBe('');
    });
  });

  describe('Toasts', () => {
    test('devrait créer et afficher un toast avec message simple', () => {
      const toastElement = ui.showToast('Message de test');
      
      expect(toastElement).not.toBeNull();
      expect(toastElement.textContent).toContain('Message de test');
      expect(toastElement.classList.contains('toast--info')).toBe(true);
    });

    test('devrait afficher un toast de succès avec la bonne classe CSS', () => {
      const toastElement = ui.showToast('Opération réussie', 'success');
      
      expect(toastElement.classList.contains('toast--success')).toBe(true);
    });

    test('devrait afficher un toast d\'erreur avec la bonne classe CSS', () => {
      const toastElement = ui.showToast('Erreur survenue', 'error');
      
      expect(toastElement.classList.contains('toast--error')).toBe(true);
    });

    test('devrait supprimer le toast après le délai spécifié', () => {
      const toastElement = ui.showToast('Message temporaire', 'info', 5000);
      
      expect(toastElement).not.toBeNull();
      
      // Avance le temps de la durée du toast
      jest.advanceTimersByTime(5000);
      
      // Avance encore de 300ms pour l'animation de fade-out et le retour au pool
      jest.advanceTimersByTime(300);
      
      expect(toastElement.classList.contains('toast--hidden')).toBe(true);
    });
  });
  
  describe('renderProjectCards', () => {
    beforeEach(() => {
      document.body.innerHTML = `<div id="projects-list"></div>`;
    });
    
    it('devrait rendre les cartes de projet correctement', () => {
      const mockProjects = [
        { id: '1', name: 'Projet Alpha', description: 'Desc 1', created_at: new Date(), article_count: 5 },
        { id: '2', name: 'Projet Beta', description: 'Desc 2', created_at: new Date(), article_count: 10 },
      ];
      
      ui.renderProjectCards(mockProjects);
      
      const cards = document.querySelectorAll('.project-card');
      expect(cards).toHaveLength(2);
      expect(cards[0].textContent).toContain('Projet Alpha');
      expect(cards[1].textContent).toContain('Articles: 10');
    });
    
    it('devrait afficher un message si aucun projet n\'est fourni', () => {
      ui.renderProjectCards([]);
      const container = document.querySelector('#projects-list');
      expect(container.textContent).toContain('Aucun projet trouvé');
    });
  });
  
  describe('showLoadingOverlay', () => {
    beforeEach(() => {
      document.body.innerHTML = `<div id="loadingOverlay"><p class="loading-overlay__message"></p></div>`;
    });
    
    it('devrait afficher l\'overlay avec un message', () => {
      ui.showLoadingOverlay(true, 'Chargement en cours...');
      const overlay = document.getElementById('loadingOverlay');
      expect(overlay.classList.contains('loading-overlay--show')).toBe(true);
      expect(overlay.textContent).toContain('Chargement en cours...');
    });
    
    it('devrait masquer l\'overlay', () => {
      ui.showLoadingOverlay(true); // Show it first
      ui.showLoadingOverlay(false); // Then hide it
      const overlay = document.getElementById('loadingOverlay');
      expect(overlay.classList.contains('loading-overlay--show')).toBe(false);
    });
  });
  
  describe('updateLoadingProgress', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="loadingOverlay">
          <p class="loading-overlay__message"></p>
          <div class="progress-bar-container">
            <div class="progress-bar" aria-valuenow="0"></div>
          </div>
        </div>`;
    });

    it('devrait mettre à jour la barre de progression et le message', () => {
      ui.updateLoadingProgress(5, 10, 'Indexation 5/10');
      const overlay = document.getElementById('loadingOverlay');
      const progressBar = overlay.querySelector('.progress-bar');

      expect(overlay.classList.contains('loading-overlay--show')).toBe(true);
      expect(overlay.textContent).toContain('Indexation 5/10');
      expect(progressBar.style.width).toBe('50%');
      expect(progressBar.getAttribute('aria-valuenow')).toBe('50');
    });
  });

  describe('Modals', () => {
    beforeEach(() => {
      document.body.innerHTML = `<div id="testModal" class="modal"></div>`;
    });
    
    it('showModal devrait afficher une modale et closeModal devrait la masquer', () => {
      const modal = document.getElementById('testModal');
      ui.showModal('testModal');
      expect(modal.classList.contains('modal--show')).toBe(true);
      expect(modal.style.display).toBe('block');
      
      ui.closeModal('testModal');
      expect(modal.classList.contains('modal--show')).toBe(false);
      expect(modal.style.display).toBe('none');
    });
  });

  describe('showConfirmModal', () => {
    let onConfirm, onCancel;

    beforeEach(() => {
      // Le HTML de la modale générique est créé dynamiquement par la fonction
      document.body.innerHTML = `<div id="modalsContainer"></div>`;
      onConfirm = jest.fn();
      onCancel = jest.fn();
    });

    it('devrait afficher une modale de confirmation et appeler onConfirm', async () => {
      // ✅ CORRECTION: Call the function that creates and shows the modal.
      ui.showConfirmModal('Titre Test', 'Message Test', { onConfirm, onCancel });

      const modal = document.getElementById('genericModal');
      expect(modal).not.toBeNull();
      expect(modal.textContent).toContain('Titre Test');
      expect(modal.textContent).toContain('Message Test');

      // Simuler le clic sur le bouton de confirmation
      const confirmButton = modal.querySelector('[data-action="confirm-action"]');
      expect(confirmButton).not.toBeNull();
      confirmButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      // ✅ CORRECTION: Attendre que toutes les promesses et timers soient résolus.
      await jest.runAllTimersAsync(); 

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('devrait appeler onCancel lors du clic sur le bouton Annuler', async () => {
      // ✅ CORRECTION: Call the function that creates and shows the modal.
      ui.showConfirmModal('Titre Test', 'Message Test', { onConfirm, onCancel });
      
      const modal = document.getElementById('genericModal');
      const cancelButton = modal.querySelector('[data-action="close-modal"]');
      cancelButton.click();

      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('validateForm', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <form id="test-form">
          <input name="name" id="name" required>
          <input type="email" name="email">
        </form>
      `;
    });

    it('devrait retourner false si un champ requis est vide', () => {
      const form = document.getElementById('test-form');
      const result = ui.validateForm(form);

      expect(result).toBe(false);
      expect(form.querySelector('#name').classList.contains('form-control--error')).toBe(true);
    });

    it('devrait retourner true si tous les champs requis sont remplis', () => {
      const form = document.getElementById('test-form');
      form.querySelector('#name').value = 'Test';
      expect(ui.validateForm(form)).toBe(true);
    });
  });
});
