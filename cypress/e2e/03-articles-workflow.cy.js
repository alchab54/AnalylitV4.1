describe('Workflow de Gestion des Articles', () => {
  
  beforeEach(() => {
    cy.visit('/');
    cy.waitForAppReady();
    
    cy.createTestProject('Projet Articles Test');
    cy.wait(500);
    
    // ✅ MOCKING: Intercepter l'appel qui charge les articles et fournir notre fixture.
    cy.intercept('GET', '/api/projects/*/search_results*', { fixture: 'articles.json' }).as('getArticles');

    cy.selectProject('Projet Articles Test');

    // ✅ NAVIGATION: S'assurer que la section des résultats est visible et que les données sont chargées.
    cy.navigateToSection('results');
    cy.wait('@getArticles');
  });

  it('Devrait afficher la liste des articles du projet sélectionné', () => {
    // Le test est maintenant déterministe grâce au mock.
    cy.get('.result-row').should('have.length', 3);
    cy.contains('.result-row', 'Intelligence Artificielle en Santé').should('be.visible');
  });

  it("Devrait permettre la sélection multiple d'articles", () => {
    // ✅ Le test n'est plus conditionnel.
    cy.get('[data-action="toggle-article-selection"]').first().check({ force: true });
    cy.get('[data-action="toggle-article-selection"]').eq(1).check({ force: true });
    
    // Vérifier que les boutons sont actifs.
    cy.get('[data-action="delete-selected-articles"]').should('not.be.disabled');
    cy.get('[data-action="batch-process-modal"]').should('not.be.disabled');
  });

  it("Devrait ouvrir les détails d'un article", () => {
    // Cliquer sur le bouton "Détails" du premier article.
    cy.get('.result-row').first().find('[data-action="view-details"]').click({ force: true });
    
    // Vérifier l'ouverture de la modale.
    cy.get('#articleDetailModal').should('be.visible');
    // ✅ Utiliser scrollIntoView pour gérer les problèmes de superposition.
    cy.contains('.modal-title', "Détails de l'article").scrollIntoView().should('be.visible');
    
    // Fermer la modale.
    cy.get('#articleDetailModal [data-action="close-modal"]').first().click();
    // ✅ La modale est cachée, elle n'est pas retirée du DOM.
    cy.get('#articleDetailModal').should('not.be.visible');
  });

  it('Devrait permettre le screening par lot', () => {
    // Sélectionner des articles.
    cy.get('[data-action="toggle-article-selection"]').first().check({ force: true });
    cy.get('[data-action="toggle-article-selection"]').eq(1).check({ force: true });
    
    // Ouvrir la modale de traitement par lot.
    cy.get('[data-action="batch-process-modal"]').click({ force: true });
    
    // Vérifier l'ouverture de la modale et lancer le screening.
    cy.get('#batchProcessModal').should('be.visible');
    cy.get('#batchProcessModal [data-action="start-batch-process"]').click({ force: true });
    
    // ✅ CORRECTION: Le message de succès est plus précis.
    cy.waitForToast('success', 'Tâche de screening lancée avec succès');
  });

  it("Devrait gérer l'état vide quand aucun article n'est présent", () => {
    // Intercepter la requête pour ce test spécifique et retourner un tableau vide.
    cy.intercept('GET', '/api/projects/*/search_results*', []).as('getEmptyArticles');
    cy.navigateToSection('results');
    cy.wait('@getEmptyArticles');

    // Vérifier que l'état vide est affiché.
    cy.get('.results-empty').should('be.visible').and('contain', 'Aucun article trouvé');
  });
});