/**
 * @jest-environment jsdom
 */
import { setupDelegatedEventListeners } from './core.js';

// Mocker toutes les actions importées pour vérifier qu'elles sont appelées
import * as projects from './projects.js';
import * as articles from './articles.js';
import * as analyses from './analyses.js';
import * as search from './search.js';
import * as ui from './ui-improved.js';
import * as importModule from './import.js';

jest.mock('./projects.js');
jest.mock('./articles.js');
jest.mock('./analyses.js');
jest.mock('./search.js');
jest.mock('./ui-improved.js');
jest.mock('./import.js');

describe('Module Core - Event Delegation', () => {
  beforeEach(() => {
    // Réinitialiser les mocks et le DOM
    jest.clearAllMocks();
    document.body.innerHTML = '';
    // Initialiser les écouteurs d'événements sur le nouveau body
    setupDelegatedEventListeners();
  });

  // --- Tests pour les événements 'click' ---

  it('devrait appeler selectProject lors du clic sur un projet', () => {
    // Arrange
    document.body.innerHTML = `<div data-action="select-project" data-project-id="p1"></div>`;
    const projectCard = document.querySelector('[data-action="select-project"]');

    // Act
    projectCard.click();

    // Assert
    expect(projects.selectProject).toHaveBeenCalledWith('p1');
  });

  it('devrait appeler runProjectAnalysis lors du clic sur "lancer une analyse"', () => {
    // Arrange
    document.body.innerHTML = `<button data-action="run-analysis" data-analysis-type="discussion"></button>`;
    const analysisButton = document.querySelector('[data-action="run-analysis"]');

    // Act
    analysisButton.click();

    // Assert
    expect(analyses.runProjectAnalysis).toHaveBeenCalledWith('discussion');
  });

  it('devrait appeler closeModal lors du clic sur un bouton de fermeture de modale', () => {
    // Arrange
    document.body.innerHTML = `<div class="modal" id="test-modal"><button data-action="close-modal"></button></div>`;
    const closeButton = document.querySelector('[data-action="close-modal"]');

    // Act
    closeButton.click();

    // Assert
    expect(ui.closeModal).toHaveBeenCalledWith('test-modal');
  });

  // --- Tests pour les événements 'submit' ---

  it('devrait appeler handleCreateProject lors de la soumission du formulaire de création', () => {
    // Arrange
    document.body.innerHTML = `<form data-action="create-project"></form>`;
    const form = document.querySelector('form');

    // Act
    // Simuler un événement de soumission
    const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(submitEvent);

    // Assert
    expect(projects.handleCreateProject).toHaveBeenCalledWith(expect.any(Event));
  });

  it('devrait appeler handleMultiDatabaseSearch lors de la soumission du formulaire de recherche', () => {
    // Arrange
    document.body.innerHTML = `<form data-action="run-multi-search"></form>`;
    const form = document.querySelector('form');

    // Act
    const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(submitEvent);

    // Assert
    expect(search.handleMultiDatabaseSearch).toHaveBeenCalledWith(expect.any(Event));
  });

  // --- Test pour l'événement 'change' ---

  it("devrait appeler handleZoteroImport lors d'un changement sur l'input de fichier Zotero", () => {
    // Arrange
    document.body.innerHTML = `<input type="file" id="zoteroFileInput">`;
    const fileInput = document.getElementById('zoteroFileInput');

    // Act
    const changeEvent = new Event('change', { bubbles: true });
    fileInput.dispatchEvent(changeEvent);

    // Assert
    expect(importModule.handleZoteroImport).toHaveBeenCalledWith(fileInput);
  });
});