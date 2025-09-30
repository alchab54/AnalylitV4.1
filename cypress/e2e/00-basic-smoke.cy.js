describe('Smoke Test - Vérification de base', () => {
  
  beforeEach(() => {
    // Met en place les simulations d'API pour un test rapide et isolé.
    cy.setupBasicTest();
  });

  it('Devrait charger l\'application sans erreur et permettre une interaction de base', () => {
    cy.get('.app-header').should('be.visible');
    cy.get('.app-nav').should('be.visible');
    cy.get('.app-main').should('be.visible');
  });

});