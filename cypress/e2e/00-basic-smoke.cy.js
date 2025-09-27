describe('Smoke Test - Vérification de base', () => {
  
  beforeEach(() => {
    // Met en place les simulations d'API pour un test rapide et isolé.
    // Cela garantit que le test ne dépend pas d'un backend réel.
    cy.setupMockAPI();
  });

  it('Devrait charger l\'application sans erreur et permettre une interaction de base', () => {
    // Utilise la commande personnalisée 'smokeTest' définie dans cypress/support/commands.js
    // Cette commande visite l'application, vérifie son chargement et effectue un clic.
    cy.smokeTest();

    // Ajoute une vérification finale pour s'assurer que le contenu attendu est visible.
    cy.contains('Projets').should('be.visible');
  });

});