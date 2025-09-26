/**
 * @jest-environment jsdom
 */
import * as utils from './utils.js';

describe('Module Utils - Fonctions Utilitaires', () => {

  describe('debounce', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    it('ne devrait appeler la fonction qu\'une seule fois après le délai', () => {
      const mockFn = jest.fn();
      const debouncedFn = utils.debounce(mockFn, 500);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(500);

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    afterEach(() => {
      jest.useRealTimers();
    });
  });

  describe('throttle', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    it('devrait appeler la fonction immédiatement, puis pas avant la fin du délai', () => {
      const mockFn = jest.fn();
      const throttledFn = utils.throttle(mockFn, 1000);

      throttledFn(); // Appel immédiat
      throttledFn(); // Ignoré
      throttledFn(); // Ignoré

      expect(mockFn).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(500);
      throttledFn(); // Toujours ignoré
      expect(mockFn).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(500); // Le délai de 1000ms est passé
      throttledFn(); // Nouvel appel
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    afterEach(() => {
      jest.useRealTimers();
    });
  });

  describe('generateUniqueId', () => {
    it('devrait générer un ID unique avec un préfixe', () => {
      const id1 = utils.generateUniqueId('test');
      const id2 = utils.generateUniqueId('test');
      expect(id1).not.toEqual(id2);
      expect(id1).toMatch(/^test_/);
    });
  });

  describe('formatDate', () => {
    it('devrait formater une date correctement', () => {
      const date = new Date('2023-10-27T10:00:00Z');
      // Le format exact dépend de la locale du système de test, on vérifie juste les parties
      const formatted = utils.formatDate(date);
      expect(formatted).toContain('2023');
      expect(formatted).toContain('octobre');
      expect(formatted).toContain('27');
    });
  });

  describe('isValidEmail', () => {
    it('devrait valider les emails corrects et rejeter les incorrects', () => {
      expect(utils.isValidEmail('test@example.com')).toBe(true);
      expect(utils.isValidEmail('test.example.com')).toBe(false);
      expect(utils.isValidEmail('test@example')).toBe(false);
      expect(utils.isValidEmail(null)).toBe(false);
    });
  });

  describe('truncateText', () => {
    it('devrait tronquer le texte si plus long que la longueur max', () => {
      const text = 'Ceci est un texte très long';
      expect(utils.truncateText(text, 10)).toBe('Ceci est...');
    });

    it('ne devrait pas tronquer le texte si plus court', () => {
      const text = 'Texte court';
      expect(utils.truncateText(text, 20)).toBe('Texte court');
    });
  });

  describe('slugify', () => {
    it('devrait convertir un texte en slug', () => {
      expect(utils.slugify('Titre d\'un Article Étonnant !')).toBe('titre-d-un-article-etonnant');
    });
  });

  describe('groupBy', () => {
    it('devrait grouper un tableau d\'objets par une clé', () => {
      const array = [
        { category: 'A', value: 1 },
        { category: 'B', value: 2 },
        { category: 'A', value: 3 },
      ];
      const grouped = utils.groupBy(array, 'category');
      expect(grouped['A']).toHaveLength(2);
      expect(grouped['B']).toHaveLength(1);
      expect(grouped['A'][1].value).toBe(3);
    });
  });

  describe('isEmpty', () => {
    it('devrait retourner true pour les valeurs vides', () => {
      expect(utils.isEmpty(null)).toBe(true);
      expect(utils.isEmpty(undefined)).toBe(true);
      expect(utils.isEmpty('')).toBe(true);
      expect(utils.isEmpty('  ')).toBe(true);
      expect(utils.isEmpty([])).toBe(true);
      expect(utils.isEmpty({})).toBe(true);
    });

    it('devrait retourner false pour les valeurs non vides', () => {
      expect(utils.isEmpty('a')).toBe(false);
      expect(utils.isEmpty([1])).toBe(false);
      expect(utils.isEmpty({ a: 1 })).toBe(false);
      expect(utils.isEmpty(0)).toBe(false);
      expect(utils.isEmpty(false)).toBe(false);
    });
  });

  describe('copyToClipboard', () => {
    it('devrait utiliser le fallback si navigator.clipboard n\'est pas disponible', async () => {
      // Simuler un environnement non sécurisé
      Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
      document.execCommand = jest.fn();

      const success = await utils.copyToClipboard('test');
      expect(success).toBe(true);
      expect(document.execCommand).toHaveBeenCalledWith('copy');
    });
  });
});