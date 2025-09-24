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
    cy.get('[data-section-id="projects"]').should('have.class', 'app-nav__button--active');
  });

  

  it('Devrait vérifier la connexion WebSocket', () => {
    // Vérifier l'indicateur de connexion WebSocket
    cy.get('#connection-status', { timeout: 10000 })
      .should('be.visible')
      .and('contain', '✅'); // Changed from 'Connecté'
  });
});
