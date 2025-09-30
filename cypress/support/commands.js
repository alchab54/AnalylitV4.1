// cypress/support/commands.js - VERSION COMPLÈTE ET CORRIGÉE

// ===================================================================
// == COMMANDES DE BASE ET DE NAVIGATION
// ===================================================================

Cypress.Commands.add('visitApp', () => {
  // ✅ CORRECTION: Utilise le baseUrl de cypress.config.js (http://localhost:8888)
  // et gère les échecs de statut pour les tests isolés.
  cy.visit('/', { failOnStatusCode: false });
});

Cypress.Commands.add('navigateToSection', (sectionId) => {
  // ✅ PATCH: Navigation vers une section avec validation
  cy.get(`.app-nav__button[data-section-id="${sectionId}"]`, { timeout: 5000 })
    .should('be.visible')
    .click({ force: true });
  cy.get(`.app-nav__button[data-section-id="${sectionId}"]`, { timeout: 5000 })
    .should('have.class', 'app-nav__button--active');
  cy.get(`#${sectionId}`).should('be.visible').and('not.be.empty');
  cy.log(`Navigated to section: ${sectionId}`);
});

Cypress.Commands.add('waitForAppReady', () => {
  // Attend que les appels API initiaux soient terminés et que l'UI soit stable.
  cy.wait('@getProjects', { timeout: 15000 });
  cy.get('.app-main').should('be.visible');
  cy.get('#projects-list').should('be.visible');
  cy.log('Application is ready.');
});

Cypress.Commands.add('checkAppIsLoaded', () => {
  cy.get('body').should('be.visible');
  cy.get('.app-header').should('be.visible');
  cy.get('.app-nav').should('be.visible');
});

// ===================================================================
// == COMMANDES DE MOCK API
// ===================================================================

Cypress.Commands.add('setupMockAPI', () => {
  // Intercepte les appels API les plus courants pour les tests isolés.
  cy.intercept('GET', '/api/projects', { fixture: 'projects.json' }).as('getProjects');
  cy.intercept('GET', '/api/analysis-profiles', { body: [] }).as('getAnalysisProfiles');
  cy.intercept('GET', '/api/databases', { body: [] }).as('getDatabases');
  cy.intercept('GET', '/api/projects/*/search-results?page=1', { fixture: 'articles.json' }).as('getArticles');
  cy.intercept('GET', '/api/projects/*/extractions', { fixture: 'extractions.json' }).as('getExtractions');
  cy.log('Mock API setup complete.');
});

// ===================================================================
// == COMMANDES DE WORKFLOW
// ===================================================================

Cypress.Commands.add('smokeTest', () => {
  cy.visitApp();
  cy.checkAppIsLoaded();
  cy.contains('Projets').should('be.visible');
  cy.log('Smoke test passed.');
});

Cypress.Commands.add('createTestProject', (projectData = {}) => {
  const projectName = projectData.name || `Projet Test ${Date.now()}`;

  cy.get('#create-project-btn').click({ force: true });
  cy.get('#newProjectModal').should('be.visible');
  cy.get('#projectName').type(projectName);
  cy.get('#projectDescription').type(projectData.description || 'Description de test');
  cy.get('#createProjectForm').submit();
  cy.log(`Test project creation simulated for: ${projectName}`);
});

Cypress.Commands.add('selectProject', (projectName) => {
  // ✅ PATCH: Sélection de projet robuste
  cy.intercept('GET', '/api/projects').as('getProjects');
  cy.visit('/', { failOnStatusCode: false });
  cy.wait('@getProjects', { timeout: 15000 });

  cy.get('#projects-list', { timeout: 10000 })
    .should('be.visible')
    .and(($el) => {
      expect(parseInt($el.css('height'))).to.be.greaterThan(0);
    });

  cy.contains('.project-card', projectName, { timeout: 10000 })
    .should('be.visible')
    .click({ force: true });

  cy.contains('.project-card--selected', projectName, { timeout: 5000 }).should('exist');
  cy.log(`Selected project: ${projectName}`);
});

// ===================================================================
// == COMMANDES UTILITAIRES ET DE DEBUG
// ===================================================================

Cypress.Commands.add('waitForElement', (selector, options = {}) => {
  const timeout = options.timeout || 10000;
  cy.get(selector, { timeout }).should('be.visible').and(($el) => {
    expect(parseInt($el.css('height'))).to.be.greaterThan(0);
  });
});

Cypress.Commands.add('resetApp', () => {
  // Simule un rechargement propre de l'état de l'application.
  cy.window().then((win) => {
    if (win.AnalyLitState && typeof win.AnalyLitState.initializeState === 'function') {
      win.AnalyLitState.initializeState();
    }
  });
  cy.log('Application state reset.');
});

Cypress.Commands.add('waitForToast', (type, message) => {
  // Attend qu'un toast spécifique apparaisse.
  cy.get(`.toast.toast--${type}`, { timeout: 10000 }).should('contain.text', message);
  cy.log(`Toast found: [${type}] ${message}`);
});

Cypress.Commands.add('debugUI', () => {
  cy.log('--- UI Debug ---');
  cy.get('body').screenshot('debug-screenshot', { capture: 'viewport' });
});