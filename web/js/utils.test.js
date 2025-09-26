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

  describe('formatNumber', () => {
    it('devrait formater un nombre correctement', () => {
      // En 'fr-FR', le séparateur est un espace insécable.
      expect(utils.formatNumber(12345.67)).toMatch(/12\s*345,67/);
    });

    it('devrait retourner "0" pour une entrée invalide', () => {
      expect(utils.formatNumber(NaN)).toBe('0');
      expect(utils.formatNumber('abc')).toBe('0');
      expect(utils.formatNumber(null)).toBe('0');
      expect(utils.formatNumber(undefined)).toBe('0');
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

  describe('isValidDoi', () => {
    it('devrait valider les DOIs corrects et rejeter les incorrects', () => {
      expect(utils.isValidDoi('10.1000/xyz123')).toBe(true);
      expect(utils.isValidDoi('11.1000/xyz123')).toBe(false);
      expect(utils.isValidDoi('not a doi')).toBe(false);
    });
  });

  describe('truncateText', () => {
    it('devrait tronquer le texte si plus long que la longueur max', () => {
      const text = 'Ceci est un texte très long';
      expect(utils.truncateText(text, 8)).toBe('Ceci est...');
    });

    it('ne devrait pas tronquer le texte si plus court', () => {
      const text = 'Texte court';
      expect(utils.truncateText(text, 20)).toBe('Texte court');
    });
  });

  describe('slugify', () => {
    it('devrait convertir un texte en slug', () => {
      expect(utils.slugify("Titre d'un Article Étonnant !")).toBe('titre-dun-article-etonnant');
    });
  });

  describe('deepClone', () => {
    it('devrait cloner un objet avec des valeurs imbriquées', () => {
      const original = { a: 1, b: { c: 2, d: [3, 4] } };
      const clone = utils.deepClone(original);

      expect(clone).toEqual(original);
      expect(clone).not.toBe(original);
      expect(clone.b).not.toBe(original.b);
      expect(clone.b.d).not.toBe(original.b.d);

      clone.b.c = 99;
      expect(original.b.c).toBe(2);
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

  describe('removeDuplicates', () => {
    it('devrait supprimer les doublons de valeurs primitives', () => {
      const array = [1, 2, 2, 3, 1, 4];
      expect(utils.removeDuplicates(array)).toEqual([1, 2, 3, 4]);
    });

    it('devrait supprimer les doublons d\'objets basés sur une clé', () => {
      const array = [{ id: 1, val: 'a' }, { id: 2, val: 'b' }, { id: 1, val: 'c' }];
      expect(utils.removeDuplicates(array, 'id')).toEqual([{ id: 1, val: 'a' }, { id: 2, val: 'b' }]);
    });
  });

  describe('formatBytes', () => {
    it('devrait formater les bytes en unités lisibles', () => {
      expect(utils.formatBytes(0)).toBe('0 Bytes');
      expect(utils.formatBytes(1024)).toBe('1 KB');
      expect(utils.formatBytes(1500)).toBe('1.46 KB');
      expect(utils.formatBytes(1024 * 1024 * 5)).toBe('5 MB');
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
    it('devrait appeler navigator.clipboard.writeText si disponible', async () => {
      const writeTextMock = jest.fn().mockResolvedValue(true); // Mock a successful resolution
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: writeTextMock }, configurable: true });
      const result = await utils.copyToClipboard('test'); 
      expect(result).toBe(true);
      expect(writeTextMock).toHaveBeenCalledWith('test');
    });

    it('devrait utiliser le fallback si navigator.clipboard n\'est pas disponible', async () => {
      // Simuler un environnement non sécurisé
      Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
      // Mock execCommand to return true to simulate a successful copy
      document.execCommand = jest.fn().mockReturnValue(true);
      
      const success = await utils.copyToClipboard('test');
      expect(success).toBe(true);
      expect(document.execCommand).toHaveBeenCalledWith('copy');
    });
  });
});