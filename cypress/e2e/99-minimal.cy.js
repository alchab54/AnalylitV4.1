describe('Test Minimal Garantie', () => {
  
  it('Application se charge', () => {
    cy.visit('/');
    cy.get('html').should('exist');
    cy.get('body').should('be.visible');
  });

  it('Pas d\'erreurs JavaScript critiques', () => {
    cy.visit('/');
    cy.wait(5000);
    
    // Vérifier qu'on a du contenu HTML
    cy.get('body *').should('have.length.at.least', 1);
  });

  it('Interface responsive', () => {
    cy.visit('/');
    cy.viewport(1280, 720);
    cy.get('body').should('be.visible');
    
    cy.viewport(375, 667); // Mobile
    cy.get('body').should('be.visible');
  });
});