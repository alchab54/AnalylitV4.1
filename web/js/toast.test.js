/**
 * <!-- Import failed: jest-environment - ENOENT: no such file or directory, access 'c:\Users\alich\Downloads\exported-assets (1)\docs\jest-environment' --> jsdom
 */
import { showToast, showSuccess, showError } from './toast.js';

describe('Module Toast - Notifications', () => {
  
  beforeEach(() => {
    // Nettoie le DOM avant chaque test
    document.body.innerHTML = '<div id="toastContainer"></div>';
    
    // Mock de setTimeout pour contrôler les timers
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('showToast()', () => {
    test('devrait créer et afficher un toast avec message simple', () => {
      showToast('Message de test');
      
      const toastElement = document.querySelector('.toast');
      expect(toastElement).not.toBeNull();
      expect(toastElement.textContent).toContain('Message de test');
      expect(toastElement.classList.contains('toast-info')).toBe(true);
    });

    test('devrait afficher un toast de succès avec la bonne classe CSS', () => {
      showToast('Opération réussie', 'success');
      
      const toastElement = document.querySelector('.toast');
      expect(toastElement.classList.contains('toast-success')).toBe(true);
      expect(toastElement.querySelector('i.fa-check-circle')).not.toBeNull();
    });

    test('devrait afficher un toast d\'erreur avec la bonne classe CSS', () => {
      showToast('Erreur survenue', 'error');
      
      const toastElement = document.querySelector('.toast');
      expect(toastElement.classList.contains('toast-error')).toBe(true);
      expect(toastElement.querySelector('i.fa-times-circle')).not.toBeNull();
    });

    test('devrait supprimer le toast après le délai spécifié', () => {
      showToast('Message temporaire', 'info', 1000);
      
      expect(document.querySelector('.toast')).not.toBeNull();
      
      // Avance le temps de 1000ms
      jest.advanceTimersByTime(1000);
      
      // Avance encore de 300ms pour l'animation de fade-out
      jest.advanceTimersByTime(300);
      
      expect(document.querySelector('.toast')).toBeNull();
    });
  });

  describe('Fonctions de raccourci', () => {
    test('showSuccess() devrait créer un toast de succès', () => {
      showSuccess('Succès !');
      
      const toastElement = document.querySelector('.toast');
      expect(toastElement.classList.contains('toast-success')).toBe(true);
      expect(toastElement.textContent).toContain('Succès !');
    });

    test('showError() devrait créer un toast d\'erreur', () => {
      showError('Erreur !');
      
      const toastElement = document.querySelector('.toast');
      expect(toastElement.classList.contains('toast-error')).toBe(true);
      expect(toastElement.textContent).toContain('Erreur !');
    });
  });
});
