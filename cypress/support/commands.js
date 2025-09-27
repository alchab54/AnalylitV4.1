// cypress/support/commands.js - VERSION ULTRA SIMPLE
Cypress.Commands.add('visitApp', () => {
  cy.visit('http://localhost:5050');
  cy.wait(3000); // Simple attente
});

Cypress.Commands.add('basicTest', () => {
  cy.visitApp();
  cy.get('body').should('be.visible');
  
  // Vérifier qu'il y a du contenu
  cy.get('body').should('not.be.empty');
  
  // Si il y a des boutons, cliquer sur le premier
  cy.get('body').then(($body) => {
    if ($body.find('button').length > 0) {
      cy.get('button').first().click();
      cy.wait(1000);
    }
  });
});