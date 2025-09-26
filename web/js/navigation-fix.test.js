/**
 * @jest-environment jsdom
 */

describe('Module Navigation Fix', () => {

  beforeEach(() => {
    // Réinitialiser le DOM et les mocks avant chaque test
    document.body.innerHTML = '';
    jest.useFakeTimers();
    // Masquer les logs de la console pendant les tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Revenir aux vrais timers et restaurer les mocks
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // Fonction utilitaire pour charger et exécuter le script dans un environnement de test isolé
  function loadAndRunScript() {
    jest.isolateModules(() => {
      require('./navigation-fix.js');
    });
    // Le script utilise setTimeout, donc on avance les timers pour s'assurer que tout est exécuté
    jest.runAllTimers();
  }

  describe('avec une navigation existante', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <header class="app-header"></header>
        <nav class="app-nav">
          <div class="container">
            <button class="app-nav__button" data-section-id="projects">Projects</button>
            <button class="app-nav__button" data-section-id="search">Search</button>
          </div>
        </nav>
        <main>
          <section id="projects" class="app-section"></section>
          <section id="search" class="app-section" style="display: none;"></section>
        </main>
      `;
    });

    test('devrait appliquer les styles et activer le premier bouton', () => {
      loadAndRunScript();

      const nav = document.querySelector('.app-nav');
      const firstButton = document.querySelector('[data-section-id="projects"]');

      // Vérifie si les styles sont bien appliqués
      expect(nav.style.display).toBe('block');
      expect(nav.style.zIndex).toBe('1000');
      expect(firstButton.style.background).toBe('rgb(59, 130, 246)'); // #3b82f6
      expect(firstButton.style.color).toBe('white');
    });

    test('devrait changer de section lors du clic sur un bouton', () => {
      loadAndRunScript();

      const projectsSection = document.getElementById('projects');
      const searchSection = document.getElementById('search');
      const searchButton = document.querySelector('[data-section-id="search"]');

      // État initial
      expect(projectsSection.style.display).not.toBe('none');
      expect(searchSection.style.display).toBe('none');

      // Simuler un clic
      searchButton.click();

      // Vérifier le nouvel état
      expect(projectsSection.style.display).toBe('none');
      expect(searchSection.style.display).toBe('block');
      expect(searchButton.style.background).toBe('rgb(59, 130, 246)');
    });
  });

  describe('sans navigation existante', () => {
    test('devrait créer une navigation d\'urgence si le header existe', () => {
      document.body.innerHTML = `<header class="app-header"></header>`;

      loadAndRunScript();

      const emergencyNav = document.querySelector('.app-nav--emergency');
      expect(emergencyNav).not.toBeNull();
      expect(emergencyNav.querySelectorAll('.app-nav__button').length).toBeGreaterThan(0);
      expect(console.error).not.toHaveBeenCalledWith('Header introuvable !');
    });

    test('devrait logger une erreur si même le header est manquant', () => {
      // Le body est vide
      loadAndRunScript();

      expect(document.querySelector('.app-nav')).toBeNull();
      // Vérifie que le script a bien tenté de créer la nav d'urgence mais a échoué
      expect(console.error).toHaveBeenCalledWith('Navigation Fix - Navigation introuvable !');
      expect(console.error).toHaveBeenCalledWith('Header introuvable !');
    });
  });
});