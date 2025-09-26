describe('Workflow de Gestion des Articles - Version Optimisée', () => {
  const projectName = 'Projet Articles Test';
  
  beforeEach(() => {
    // Isoler les tests avec des interceptions API
    cy.intercept('GET', '/api/projects/', { fixture: 'projects-empty.json' }).as('getProjects');
    cy.intercept('POST', '/api/projects/', { fixture: 'test-project.json' }).as('createProject');
    cy.intercept('GET', `/api/projects/test-project-123/search-results?page=1`, { fixture: 'articles.json' }).as('getArticles');
    cy.intercept('GET', `/api/projects/test-project-123/extractions`, { body: [] }).as('getExtractions');

    cy.visit('/');
    cy.waitForAppReady();
    
    cy.createTestProject(projectName);
    cy.selectProject(projectName);
    cy.navigateToSection('results');
    
    cy.wait('@getArticles', { timeout: 10000 });
  });

  it('Devrait afficher la liste des articles du projet sélectionné', () => {
    // Vérifier que les données du fixture sont bien affichées
    cy.get('.results-list-container').should('be.visible');
    cy.get('.result-row').should('have.length.greaterThan', 0);
    cy.contains('.article-title', 'Digital therapeutic alliance').should('be.visible');
  });

  it("Devrait permettre la sélection multiple d'articles", () => {
    cy.get('.result-row').first().find('input[type="checkbox"]').check({ force: true });
    cy.get('.result-row').last().find('input[type="checkbox"]').check({ force: true });

    cy.get('#selectedCount').should('contain.text', '2');
    cy.get('[data-action="batch-process-modal"]').should('not.be.disabled');
  });

  it("Devrait ouvrir les détails d'un article", () => {
    cy.get('.result-row').first().find('[data-action="view-details"]').click({ force: true });
    
    cy.get('#articleDetailModal').should('be.visible');
    cy.get('#articleDetailContent').should('contain.text', 'Digital therapeutic alliance');
  });

  it('Devrait permettre le screening par lot', () => {
    cy.intercept('POST', '/api/projects/*/run', { body: { job_id: 'batch-job-123' } }).as('startBatch');

    cy.get('.result-row').first().find('input[type="checkbox"]').check({ force: true });
    cy.get('[data-action="batch-process-modal"]').should('not.be.disabled').click({ force: true });
    
    cy.get('#batchProcessModal').should('be.visible');
    cy.get('#batchProcessModal button[data-action="start-batch-process"]').click({ force: true });

    cy.wait('@startBatch');
    cy.waitForToast('success', 'Tâche de screening lancée avec succès');
  });

  it("Devrait gérer l'état vide quand aucun article n'est présent", () => {
    // Intercepter la réponse pour simuler une liste vide
    cy.intercept('GET', `/api/projects/test-project-123/search-results?page=1`, { body: { articles: [], meta: {} } }).as('getEmptyArticles');
    cy.navigateToSection('results');
    cy.wait('@getEmptyArticles');
    
    cy.get('.placeholder').should('be.visible').and('contain.text', 'Aucun résultat trouvé');
  });
});