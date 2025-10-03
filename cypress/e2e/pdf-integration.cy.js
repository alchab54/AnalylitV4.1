describe('Intégration PDF', () => {
  it('Upload et analyse PDF', () => {
    // Préparation : Créer un projet pour l'upload du PDF
    cy.visit('/');
    cy.get('[data-cy=create-project]').click();
    cy.get('[data-cy=project-name]').type('Projet PDF');
    cy.get('[data-cy=submit]').click();
    cy.url().should('include', '/projects/');

    // Aller à l'onglet d'importation
    cy.get('[data-cy=import-tab]').click();

    // Upload PDF (assurez-vous que 'sample.pdf' existe dans cypress/fixtures/)
    cy.get('[data-cy=pdf-upload]').selectFile('cypress/fixtures/sample.pdf');
    cy.get('[data-cy=upload-button]').click();

    // Assertions pour vérifier le traitement (à adapter selon l'UI)
    // Ces sélecteurs sont des exemples, ajustez-les en fonction de votre application
    cy.get('[data-cy=pdf-status]', { timeout: 10000 }).should('contain', 'Traité'); // Attendre jusqu'à 10 secondes
    cy.get('[data-cy=extracted-text]', { timeout: 10000 }).should('be.visible'); // Attendre que le texte extrait soit visible

  });
});