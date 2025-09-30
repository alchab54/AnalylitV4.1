describe('Tests de Smoke - Vérifications de base AnalyLit', () => {
  
  beforeEach(() => {
    // ✅ CORRECTION: Utiliser la commande centralisée qui configure TOUS les mocks nécessaires.
    cy.setupBasicTest();
  });

  it('Devrait charger la page principale sans erreur JavaScript', () => {
    cy.get('.app-header').should('be.visible');
    cy.get('.app-nav').should('be.visible');
    cy.get('.app-main').should('be.visible');
    cy.contains('h1', 'AnalyLit v4.1').should('be.visible');
  });

  it('Devrait afficher la section des projets par défaut', () => {
    cy.get('#projects').should('be.visible').and('have.class', 'active');
    cy.get('[data-section-id="projects"]').should('have.class', 'app-nav__button--active');
  });

  it('Devrait vérifier la connexion WebSocket', () => {
    // Vérifier l'indicateur de connexion WebSocket
    cy.get('#connection-status', { timeout: 10000 })
      .should('be.visible')
      .find('.status-dot')
      .should('have.class', 'connected');
  });
});
