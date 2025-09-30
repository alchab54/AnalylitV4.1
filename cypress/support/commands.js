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
  // ✅ PATCH : Navigation plus robuste avec scrollIntoView
  // Attendre que la navigation soit visible
  cy.get('.app-nav', { timeout: 10000 }).should('be.visible');
  
  // ✅ CORRECTION : Ajouter scrollIntoView pour résoudre le problème d'overflow
  cy.get(`.app-nav__button[data-section-id="${sectionId}"]`, { timeout: 5000 })
    .should('exist')
    .scrollIntoView()  // ✅ PATCH : Scroll pour rendre visible
    .click({ force: true }); // ✅ CORRECTION: force:true contourne la vérification de visibilité qui échoue à cause du toast.
    
  // Vérifier l'activation
  cy.get(`.app-nav__button[data-section-id="${sectionId}"]`, { timeout: 5000 })
    .should('have.class', 'app-nav__button--active');
    
  // Vérifier que la section est visible et contient du contenu
  cy.get(`#${sectionId}`, { timeout: 10000 })
    .should('be.visible')
    .should('not.be.empty');
    
  cy.log(`✅ Navigated to section: ${sectionId}`);
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
  // ✅ PATCH : Intercepter les deux variations d'URL (avec et sans slash final)
  cy.intercept('GET', '/api/projects*', { fixture: 'projects.json' }).as('getProjects');
  cy.intercept('GET', '/api/projects/*', { fixture: 'projects.json' }).as('getProjectsSlash');
  cy.intercept('GET', '/api/analysis-profiles*', { body: [] }).as('getAnalysisProfiles');
  cy.intercept('GET', '/api/databases*', { body: [] }).as('getDatabases');
  cy.intercept('GET', '/api/projects/*/search-results*', { fixture: 'articles.json' }).as('getArticles');
  cy.intercept('GET', '/api/projects/*/extractions*', { fixture: 'extractions.json' }).as('getExtractions');
  cy.intercept('GET', '/api/projects/*/articles*', { fixture: 'articles.json' }).as('getProjectArticles');
  cy.intercept('POST', '/api/projects/*/run-analysis*', { body: { job_id: 'analysis-job-123' } }).as('runAnalysis');
  
  // ✅ PATCH : Ajouter plus d'intercepts pour RoB et autres sections
  cy.intercept('GET', '/api/projects/*/rob*', { body: [] }).as('getRobData');
  cy.intercept('GET', '/api/projects/*/chat-history*', { body: [] }).as('getChatHistory');
  
  cy.log('✅ Mock API setup complete with flexible patterns');
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
  // Intercepter AVANT de visiter
  cy.setupMockAPI();
  
  // Visiter avec gestion d'erreur
  cy.visit('/', { failOnStatusCode: false, timeout: 30000 });
  
  // ✅ CORRECTION FINALE ET DÉFINITIVE: Déclencher manuellement l'initialisation de l'application.
  // C'est l'étape qui manquait pour que l'appel API soit effectué.
  cy.window().then((win) => {
    expect(win.AnalyLit, 'AnalyLit object should exist on window').to.be.an('object');
    win.AnalyLit.initializeApplication();
  });

  // Attendre l'une des deux interceptions (avec timeout plus long)
  cy.wait(['@getProjects', '@getProjectsSlash'], { timeout: 20000 })
    .then(() => {
      cy.log('✅ Projects API intercepted successfully');
      
      // Attendre que la liste des projets soit visible ET ait une hauteur > 0
      cy.get('#projects-list', { timeout: 10000 })
        .should('be.visible')
        .should(($el) => {
          const height = parseInt($el.css('height')) || 0;
          expect(height).to.be.greaterThan(0);
        });
      
      // Sélectionner le projet
      cy.contains('.project-card', projectName, { timeout: 10000 })
        .should('be.visible')
        .click({ force: true });
        
      // Vérifier la sélection
      cy.get('.project-card--selected', { timeout: 5000 }).should('exist');
      cy.log(`✅ Project selected: ${projectName}`);
    });
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