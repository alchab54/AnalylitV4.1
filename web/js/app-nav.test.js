/**
 * @jest-environment jsdom
 */
import * as core from './core.js'; // Importer pour pouvoir le mocker

// Mocker les modules dont les fonctions sont appelées par app-nav mais ne sont pas le sujet de ce test.
jest.mock('./core.js', () => ({
  // Empêche le gestionnaire d'événements global de core.js d'interférer
  setupDelegatedEventListeners: jest.fn(), 
  // Simule la fonction qui affiche/masque les sections
  showSection: jest.fn(),
}));

describe('Module App Nav', () => {
  let mockSetCurrentSection;

  beforeEach(() => {
    // Réinitialiser le DOM avant chaque test
    document.body.innerHTML = `
      <nav id="mainNav">
        <button class="app-nav__btn" data-section="projects">Projects</button>
        <button class="app-nav__btn" data-section="search">Search</button>
      </nav>
      <main>
        <section id="projects" class="app-section hidden"></section>
        <section id="search" class="app-section hidden"></section>
      </main>
    `;

    // Mocker la fonction de l'état global que le script attend
    mockSetCurrentSection = jest.fn();
    window.AnalyLitState = {
      setCurrentSection: mockSetCurrentSection,
    };

    // Mocker scrollTo qui n'est pas implémenté dans jsdom
    window.scrollTo = jest.fn();

    // Utiliser des timers factices pour contrôler setInterval
    jest.useFakeTimers();

    // Isoler le module pour s'assurer qu'il est ré-exécuté à chaque test
    jest.isolateModules(() => {
      require('./app-nav.js');
    });

    // Déclencher l'événement DOMContentLoaded pour exécuter le script
    document.dispatchEvent(new Event('DOMContentLoaded'));
  });

  afterEach(() => {
    // Revenir à de vrais timers après chaque test
    jest.useRealTimers();
    // Nettoyer le mock global
    delete window.AnalyLitState;
  });

  test('devrait initialiser et afficher la section "projects" par défaut', () => {
    const projectsSection = document.getElementById('projects');
    const projectsButton = document.querySelector('[data-section="projects"]');

    // Au début, rien ne doit être visible
    expect(projectsSection.classList.contains('hidden')).toBe(true);
    expect(projectsButton.classList.contains('app-nav__btn--active')).toBe(false);

    // Avancer le temps pour déclencher le setInterval et l'initialisation
    jest.advanceTimersByTime(101);

    // Vérifier que la section et le bouton sont maintenant actifs
    expect(projectsSection.classList.contains('hidden')).toBe(false);
    expect(projectsButton.classList.contains('app-nav__btn--active')).toBe(true);

    // Vérifier que setCurrentSection n'est PAS appelé au chargement initial
    expect(mockSetCurrentSection).not.toHaveBeenCalled();
  });

  test('devrait changer de section lors du clic sur un bouton de navigation', () => {
    const projectsSection = document.getElementById('projects');
    const searchSection = document.getElementById('search');
    const searchButton = document.querySelector('[data-section="search"]');

    // Simuler l'état initial
    jest.advanceTimersByTime(101);
    expect(projectsSection.classList.contains('hidden')).toBe(false);
    expect(searchSection.classList.contains('hidden')).toBe(true);

    // Cliquer sur le bouton "Search"
    searchButton.click();

    // Vérifier que la classe active a changé
    expect(searchButton.classList.contains('app-nav__btn--active')).toBe(true);
    // showSection est maintenant mocké, donc le DOM ne changera pas, ce qui est OK pour ce test unitaire.

    // Vérifier que la fonction de mise à jour de l'état a été appelée
    expect(mockSetCurrentSection).toHaveBeenCalledWith('search');
  });
});