/**
 * @jest-environment jsdom
 */

describe('Module Navigation Simple', () => {
  beforeEach(() => {
    // Réinitialiser le DOM avant chaque test
    document.body.innerHTML = `
      <nav class="app-nav">
        <button class="app-nav__button" data-action="show-section" data-section-id="projects">Projects</button>
        <button class="app-nav__button" data-action="show-section" data-section-id="search">Search</button>
      </nav>
      <main>
        <section id="projects" class="app-section" style="display: none;"></section>
        <section id="search" class="app-section" style="display: none;"></section>
      </main>
      <div id="newProjectModal" class="modal" style="display: none;">
        <button data-action="close-modal">Close</button>
      </div>
      <button data-action="create-project-modal">Create Project</button>
    `;

    // Utiliser des timers factices pour contrôler les setTimeout
    jest.useFakeTimers();

    // Charger et exécuter le script de navigation
    // jest.isolateModules permet de s'assurer que le script est ré-exécuté pour chaque test
    jest.isolateModules(() => {
      require('./navigation-simple.js');
    });

    // Déclencher l'événement DOMContentLoaded manuellement pour exécuter le script
    document.dispatchEvent(new Event('DOMContentLoaded'));
  });

  afterEach(() => {
    // Revenir à de vrais timers après chaque test
    jest.useRealTimers();
  });

  test('devrait afficher la section "projects" par défaut après un délai', () => {
    const projectsSection = document.getElementById('projects');
    const projectsButton = document.querySelector('[data-section-id="projects"]');

    // Au début, rien ne doit être visible
    expect(projectsSection.style.display).toBe('none');
    expect(projectsButton.classList.contains('app-nav__button--active')).toBe(false);

    // Avancer le temps pour déclencher le setTimeout dans le script
    jest.advanceTimersByTime(101);

    // Vérifier que la section et le bouton sont maintenant actifs
    expect(projectsSection.style.display).toBe('block');
    expect(projectsButton.classList.contains('app-nav__button--active')).toBe(true);
  });

  test('devrait changer de section lors du clic sur un bouton de navigation', () => {
    const projectsSection = document.getElementById('projects');
    const searchSection = document.getElementById('search');
    const searchButton = document.querySelector('[data-section-id="search"]');

    // Simuler l'état initial
    jest.advanceTimersByTime(101);
    expect(projectsSection.style.display).toBe('block');
    expect(searchSection.style.display).toBe('none');

    // Cliquer sur le bouton "Search"
    searchButton.click();

    // Vérifier que la section a changé
    expect(projectsSection.style.display).toBe('none');
    expect(searchSection.style.display).toBe('block');
    expect(searchButton.classList.contains('app-nav__button--active')).toBe(true);
  });

  test('devrait afficher la modale de création de projet', () => {
    const createButton = document.querySelector('[data-action="create-project-modal"]');
    const modal = document.getElementById('newProjectModal');

    expect(modal.style.display).toBe('none');

    // Cliquer sur le bouton de création
    createButton.click();

    // Vérifier que la modale est visible
    expect(modal.style.display).toBe('flex');
    expect(modal.classList.contains('modal--show')).toBe(true);
  });

  test('devrait fermer toutes les modales', () => {
    const createButton = document.querySelector('[data-action="create-project-modal"]');
    const closeButton = document.querySelector('[data-action="close-modal"]');
    const modal = document.getElementById('newProjectModal');

    // Ouvrir la modale d'abord
    createButton.click();
    expect(modal.style.display).toBe('flex');

    // Cliquer sur le bouton de fermeture
    closeButton.click();

    // Vérifier que la modale est cachée
    expect(modal.style.display).toBe('none');
    expect(modal.classList.contains('modal--show')).toBe(false);
  });
});