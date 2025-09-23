describe('Workflow de Gestion des Articles', () => {
  
  beforeEach(() => {
    cy.visit('/');
    
    // S'assurer qu'un projet est sélectionné
    cy.get('[data-section-id="projects"]').click();
    cy.get('.project-card').first().click();
    
    // Naviguer vers les résultats
    cy.get('[data-section-id="results"]').click();
  });

  it('Devrait afficher la liste des articles du projet sélectionné', () => {
    cy.get(SELECTORS.resultsContainer).should('be.visible');
    cy.get('.results-table tbody').children().should('have.length.greaterThan', 0);
  });

  it('Devrait permettre la sélection multiple d\'articles', () => {
    // Vérifier la présence des checkboxes
    cy.get('[data-action="toggle-article-selection"]').should('have.length.greaterThan', 0);
    
    // Sélectionner plusieurs articles
    cy.get('[data-action="toggle-article-selection"]').first().check();
    cy.get('[data-action="toggle-article-selection"]').eq(1).check();
    
    // Vérifier que les boutons d'action sont activés
    cy.get('[data-action="delete-selected-articles"]').should('not.be.disabled'); // Bouton de suppression
    cy.get('[data-action="batch-process-modal"]').should('not.be.disabled'); // Bouton de traitement par lot
  });

  it('Devrait ouvrir les détails d\'un article', () => {
    // Cliquer sur le premier article
    cy.get('.result-row').first().find('[data-action="view-details"]').click();
    
    // Vérifier l'ouverture de la modale de détails
    cy.get('#genericModal').should('be.visible');
    cy.contains('#genericModalTitle', 'Détails de l\'article').should('be.visible');
    
    // Fermer la modale
    cy.get('[data-action="close-modal"]').click();
    cy.get('#genericModal').should('not.be.visible');
  });

  it('Devrait permettre le screening par lot', () => {
    // Sélectionner des articles
    cy.get('[data-action="toggle-article-selection"]').first().check();
    cy.get('[data-action="toggle-article-selection"]').eq(1).check();
    
    // Lancer le screening par lot
    cy.get('[data-action="batch-process-modal"]').click();
    
    // Vérifier l'ouverture de la modale
    cy.get('#genericModal').should('be.visible');
    cy.contains('#genericModalTitle', 'Lancer le Traitement par Lot').should('be.visible');
    
    // Lancer le screening
    cy.get('[data-action="start-batch-process"]').click();
    
    // Vérifier la notification de lancement
    cy.contains('.toast-success', 'Tâche de screening lancée').should('be.visible');
  });

  it('Devrait gérer l\'état vide quand aucun article n\'est présent', () => {
    // Supposer un projet sans articles
    // Cette partie nécessite un projet vide ou un mock
    cy.get('.results-empty').should('contain', 'Aucun article trouvé');
  });
});