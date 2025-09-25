describe('Workflow de Gestion des Articles', () => {
  
  beforeEach(() => {
    cy.visit('/');
    cy.wait(1000); // Attendre le chargement complet
    
    // S'assurer qu'un projet est sélectionné
    cy.get('.project-card').first().click();
    cy.wait(500);
    
    // Utiliser force: true pour éviter les conflits de superposition
    cy.get('[data-section-id="results"]').click({ force: true });
    cy.wait(500);
    
    cy.get('#resultsContainer').should('be.visible');
  });

  it('Devrait afficher la liste des articles du projet sélectionné', () => {
    cy.get('#resultsContainer').should('be.visible');
    // Le test doit maintenant vérifier la nouvelle structure avec .article-row
    cy.get('#articles-list').should('be.visible');
    cy.get('.article-row').should('have.length.greaterThan', 0);
  });

  it("Devrait permettre la sélection multiple d'articles", () => {
    // Vérifier la présence des checkboxes
    cy.get('.article-checkbox').should('have.length.greaterThan', 0);
    
    // Sélectionner plusieurs articles
    cy.get('.article-checkbox').first().check();
    cy.get('.article-checkbox').eq(1).check();
    
    // Vérifier que les boutons d'action sont activés
    cy.get('[data-action="delete-selected-articles"]').should('not.be.disabled');
    cy.get('[data-action="batch-screening"]').should('not.be.disabled');
  });

  it("Devrait ouvrir les détails d'un article", () => {
    // Cliquer sur le premier article
    cy.get('.article-row').first().find('.article-title').click();
    
    // Vérifier l'ouverture de la modale de détails
    cy.get('#articleDetailModal').should('be.visible');
    cy.contains('h2', "Détails de l'article").should('be.visible');
    
    // Fermer la modale
    cy.get('[data-action="close-modal"]').click();
    cy.get('#articleDetailModal').should('not.exist');
  });

  it('Devrait permettre le screening par lot', () => {
    // Sélectionner des articles
    cy.get('.article-checkbox').first().check();
    cy.get('.article-checkbox').eq(1).check();
    
    // Lancer le screening par lot
    cy.get('[data-action="batch-screening"]').click();
    
    // Vérifier l'ouverture de la modale
    cy.get('#batchProcessModal').should('be.visible');
    cy.contains('h2', 'Lancer le Screening par Lot').should('be.visible');
    
    // Lancer le screening
    cy.get('[data-action="start-batch-screening"]').click();
    
    // Vérifier la notification de lancement
    cy.contains('.toast--success', 'Tâche de screening lancée').should('be.visible');
  });

  it("Devrait gérer l'état vide quand aucun article n'est présent", () => {
    // Supposer un projet sans articles
    // Cette partie nécessite un projet vide ou un mock
    cy.get('.empty-state').should('contain', 'Aucun article');
  });
});