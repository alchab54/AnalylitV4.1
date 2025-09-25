describe('Workflow de Gestion des Articles', () => {
  
  beforeEach(() => {
    cy.visit('/');
    cy.waitForAppReady();
    
    cy.createTestProject('Projet Articles Test');
    cy.wait(500);
    
    // ✅ PATTERN ULTRA-FLEXIBLE qui capte toutes les variantes
    cy.intercept('GET', '**/search-results*', { fixture: 'articles.json' }).as('getArticles');
    cy.intercept('GET', '**/search_results*', { fixture: 'articles.json' }).as('getArticles2');

    cy.selectProject('Projet Articles Test');

    // ✅ NAVIGATION: S'assurer que la section des résultats est visible et que les données sont chargées.
    cy.navigateToSection('results');
    
    // ✅ ATTENDRE l'une des deux routes
    cy.wait(['@getArticles', '@getArticles2'], { timeout: 10000 });
  });

  it('Devrait afficher la liste des articles du projet sélectionné', () => {
    // ✅ MULTIPLE SÉLECTEURS pour plus de robustesse
    cy.get('.result-row, .article-row, .search-result').should('have.length.at.least', 1);
    cy.contains('.result-row, .article-row, .search-result', 'Intelligence').should('be.visible');
  });

  it("Devrait permettre la sélection multiple d'articles", () => {
    // ✅ SÉLECTEURS MULTIPLES ET FLEXIBLES
    cy.get('[data-action="toggle-article-selection"], .article-checkbox, input[type="checkbox"]')
      .first().check({ force: true });
    cy.get('[data-action="toggle-article-selection"], .article-checkbox, input[type="checkbox"]')
      .eq(1).check({ force: true });
    
    // Vérifier que les boutons sont actifs.
    cy.get('[data-action="delete-selected-articles"]').should('not.be.disabled');
    cy.get('[data-action="batch-process-modal"]').should('not.be.disabled');
  });

  it("Devrait ouvrir les détails d'un article", () => {
    // ✅ CHERCHER LE BOUTON DÉTAILS DE MANIÈRE FLEXIBLE
    cy.get('.result-row, .article-row, .search-result').first()
      .find('[data-action="view-details"], .details-btn, button').contains(/détails|details|voir/i)
      .click({ force: true });
    
    // Vérifier l'ouverture de la modale.
    cy.get('#articleDetailModal').should('be.visible');
    cy.contains('.modal-title, h2', /détails/i).should('be.visible');
    
    // Fermer la modale.
    cy.get('#articleDetailModal [data-action="close-modal"], .modal-close, .close')
      .first().click({ force: true });
    cy.get('#articleDetailModal').should('not.be.visible');
  });

  it('Devrait permettre le screening par lot', () => {
    // Sélectionner des articles.
    cy.get('[data-action="toggle-article-selection"], .article-checkbox, input[type="checkbox"]')
      .first().check({ force: true });
    cy.get('[data-action="toggle-article-selection"], .article-checkbox, input[type="checkbox"]')
      .eq(1).check({ force: true });
    
    // Ouvrir la modale de traitement par lot.
    cy.get('[data-action="batch-process-modal"]').click({ force: true });
    
    // Vérifier l'ouverture de la modale et lancer le screening.
    cy.get('#batchProcessModal').should('be.visible');
    cy.get('#batchProcessModal [data-action="start-batch-process"], .start-batch').click({ force: true });
    
    cy.waitForToast('success', /screening.*lancée|batch.*started/i);
  });

  it("Devrait gérer l'état vide quand aucun article n'est présent", () => {
    // Intercepter la requête pour ce test spécifique et retourner un tableau vide.
    // ✅ INTERCEPTER AVEC PATTERN MULTIPLE pour ce test
    cy.intercept('GET', '**/search-results*', { articles: [], meta: { total: 0 } }).as('getEmptyArticles');
    cy.intercept('GET', '**/search_results*', { articles: [], meta: { total: 0 } }).as('getEmptyArticles2');

    cy.navigateToSection('results');
    
    // Attendre que la requête soit faite (avec un des patterns)
    cy.wait(['@getEmptyArticles', '@getEmptyArticles2'], { timeout: 10000 });

    // Vérifier que l'état vide est affiché.
    cy.get('.results-empty, .empty-state, .no-results')
      .should('be.visible')
      .and('contain', /aucun|no.*article|empty/i);
  });
});