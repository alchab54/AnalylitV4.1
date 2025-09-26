/**
 * @jest-environment jsdom
 */
import { LayoutOptimizer } from './layout-optimizer.js';

describe('Module LayoutOptimizer', () => {
  let optimizer;

  beforeEach(() => {
    // Réinitialiser le DOM et l'instance de l'optimiseur avant chaque test
    document.body.innerHTML = '';
    optimizer = new LayoutOptimizer();
    // Empêcher l'initialisation automatique pour contrôler les tests
    optimizer.initialized = true;
  });

  describe('Initialization', () => {
    it('ne devrait pas s\'initialiser deux fois', () => {
      optimizer.initialized = false; // Forcer la réinitialisation
      const setupSpy = jest.spyOn(optimizer, 'setupOptimizer');
      optimizer.init();
      optimizer.init(); // Le deuxième appel ne devrait rien faire
      expect(setupSpy).toHaveBeenCalledTimes(1);
    });

    it('devrait appeler setupOptimizer lorsque le DOM est prêt', () => {
      optimizer.initialized = false;
      const setupSpy = jest.spyOn(optimizer, 'setupOptimizer');
      optimizer.init();
      expect(setupSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('DOM Optimizations', () => {
    it('optimizeContainers devrait appliquer les bons styles', () => {
      document.body.innerHTML = `
        <div class="container"></div>
        <header class="app-header"></header>
        <main class="app-main"></main>
      `;
      optimizer.optimizeContainers();

      const container = document.querySelector('.container');
      expect(container.style.maxWidth).toBe(`${optimizer.config.maxContainerWidth}px`);

      const header = document.querySelector('.app-header');
      expect(header.style.height).toBe('60px');

      const main = document.querySelector('.app-main');
      expect(main.style.minHeight).toBe('calc(100vh - 108px)');
    });

    it('optimizeSpacing devrait appliquer les bons espacements', () => {
      document.body.innerHTML = `
        <section class="section">
          <div class="card">Card 1</div>
          <div class="card">Card 2</div>
        </section>
      `;
      optimizer.optimizeSpacing();

      const section = document.querySelector('.section');
      expect(section.style.padding).toBe('0px');

      const cards = document.querySelectorAll('.card');
      expect(cards[0].style.marginBottom).toBe(optimizer.config.compactSpacing.md);
      expect(cards[1].style.marginBottom).toBe('0px'); // La dernière carte ne doit pas avoir de marge en bas
    });

    it('optimizeGrids devrait appliquer les styles de grille', () => {
      document.body.innerHTML = `<div class="projects-grid"></div>`;
      optimizer.optimizeGrids();
      const grid = document.querySelector('.projects-grid');
      expect(grid.style.display).toBe('grid');
      expect(grid.style.gridTemplateColumns).toBe('repeat(auto-fit, minmax(280px, 1fr))');
    });
  });

  describe('isEffectivelyEmpty', () => {
    it('devrait retourner true pour un élément avec seulement des espaces', () => {
      document.body.innerHTML = `<div id="test">   </div>`;
      expect(optimizer.isEffectivelyEmpty(document.getElementById('test'))).toBe(true);
    });

    it('devrait retourner false pour un élément avec du texte', () => {
      document.body.innerHTML = `<div id="test">Hello</div>`;
      expect(optimizer.isEffectivelyEmpty(document.getElementById('test'))).toBe(false);
    });

    it('devrait retourner false pour un élément avec des enfants visibles', () => {
      document.body.innerHTML = `<div id="test"><span></span></div>`;
      expect(optimizer.isEffectivelyEmpty(document.getElementById('test'))).toBe(false);
    });
  });

  describe('removeEmptyElements', () => {
    it('devrait masquer les éléments vides', () => {
      document.body.innerHTML = `<div class="card" style="display: block;">&nbsp;</div>`;
      optimizer.removeEmptyElements();
      expect(document.querySelector('.card').style.display).toBe('none');
    });

    it('devrait supprimer les divs d\'espacement vides', () => {
      document.body.innerHTML = `<div class="spacer"></div>`;
      optimizer.removeEmptyElements();
      expect(document.querySelector('.spacer')).toBeNull();
    });
  });

  describe('Compact Mode', () => {
    it('enableCompactMode devrait ajouter une classe au body et une balise style', () => {
      optimizer.enableCompactMode();
      expect(document.body.classList.contains('layout-compact')).toBe(true);
      expect(document.head.querySelector('style')).not.toBeNull();
      expect(document.head.querySelector('style').textContent).toContain('.layout-compact');
    });
  });

  describe('forceOptimize', () => {
    it('devrait appeler les principales fonctions d\'optimisation', () => {
      const spyContainers = jest.spyOn(optimizer, 'optimizeContainers');
      const spySpacing = jest.spyOn(optimizer, 'optimizeSpacing');
      const spyGrids = jest.spyOn(optimizer, 'optimizeGrids');

      optimizer.forceOptimize();

      expect(spyContainers).toHaveBeenCalled();
      expect(spySpacing).toHaveBeenCalled();
      expect(spyGrids).toHaveBeenCalled();
    });
  });
});