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
});
