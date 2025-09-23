describe('Tests de Smoke - Vérifications de base AnalyLit', () => {
  
  beforeEach(() => {
    cy.visit('/');
  });

  it('Devrait charger la page principale sans erreur JavaScript', () => {
    // Vérification du chargement de la page
    cy.contains('h1', 'AnalyLit').should('be.visible');
    
    // Vérification qu'il n'y a pas d'erreurs dans la console
    cy.window().then((win) => {
      cy.spy(win.console, 'error').as('consoleError');
    });
    
    // Attendre le chargement complet
    cy.get('body').should('be.visible');
    
    // Vérifier qu'aucune erreur console n'a été émise
    cy.get('@consoleError').should('not.have.been.called');
  });

  it('Devrait afficher la section des projets par défaut', () => {
    cy.contains('Projets').should('be.visible');
    cy.get('[data-section-id="projects"]').should('have.class', 'active');
  });

  it('Devrait permettre la navigation entre les sections principales', () => {
    // Tester la navigation vers Recherche
    cy.get('[data-section-id="search"]').click();
    cy.get('#searchContainer').should('be.visible');
    
    // Tester la navigation vers Résultats
    cy.get('[data-section-id="results"]').click();
    cy.get('#resultsContainer').should('be.visible');
    
    // Tester la navigation vers Analyses
    cy.get('[data-section-id="analyses"]').click();
    cy.get('#analysisContainer').should('be.visible');
    
    // Retour aux Projets
    cy.get('[data-section-id="projects"]').click();
    cy.contains('Projets').should('be.visible');
  });

  it('Devrait vérifier la connexion WebSocket', () => {
    // Vérifier l'indicateur de connexion WebSocket
    cy.get('.connection-indicator', { timeout: 10000 })
      .should('be.visible')
      .and('contain', 'Connecté');
  });
});