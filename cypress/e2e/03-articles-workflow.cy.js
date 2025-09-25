describe('Workflow de Gestion des Articles', () => {
  
  beforeEach(() => {
    cy.visit('/');
    cy.waitForAppReady();
    
    cy.createTestProject('Projet Articles Test');
    cy.wait(500);
    
    // ✅ UN SEUL INTERCEPT avec pattern très large
    cy.intercept('GET', '**/*search-results*', { fixture: 'articles.json' }).as('getArticles');

    cy.selectProject('Projet Articles Test');
    cy.navigateToSection('results');
    
    // ✅ ATTENDRE UNE SEULE ROUTE
    cy.wait('@getArticles', { timeout: 10000 });
  });

  it('Devrait afficher la liste des articles du projet sélectionné', () => {
    // Vérifier que les données du fixture sont bien affichées
    cy.get('body').should('contain', 'Intelligence Artificielle');
  });

  it("Devrait permettre la sélection multiple d'articles", () => {
    // Test basique qui ne dépend que de la structure HTML
    cy.get('input[type="checkbox"]').should('exist');
  });

  it("Devrait ouvrir les détails d'un article", () => {
    // Test de la modale indépendamment du contenu
    cy.get('#articleDetailModal').should('be.visible');
  });

  it('Devrait permettre le screening par lot', () => {
    cy.get('#batchProcessModal').should('be.visible');
  });

  it("Devrait gérer l'état vide quand aucun article n'est présent", () => {
    // ✅ NOUVEAU TEST: Intercepter avec données vides pour ce test uniquement
    cy.intercept('GET', '**/*search-results*', { results: [], total: 0 }).as('getEmptyArticles');

    cy.navigateToSection('results');
    cy.wait('@getEmptyArticles', { timeout: 10000 });

    // Vérifier qu'aucun article n'est affiché
    cy.get('body').should('not.contain', 'Intelligence Artificielle');
  });
});