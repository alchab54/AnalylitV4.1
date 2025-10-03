describe('Workflow ATN Complet', () => {
  beforeEach(() => {
    // Mock all external APIs
    cy.intercept('POST', '/api/search', { fixture: 'pubmed-results.json' }).as('searchRequest');
    cy.intercept('GET', '/api/projects/*/search-results', { fixture: 'articles.json' }).as('getSearchResults');
    cy.intercept('POST', '/api/projects/*/run-analysis', { fixture: 'analysis-job.json' }).as('runAnalysis');
    cy.visit('/');

  })

  it('Exécute workflow ATN de A à Z', () => {
    // 1. Créer projet
    cy.get('[data-cy=create-project]').click()
    cy.get('[data-cy=project-name]').type('Test ATN E2E')
    cy.get('[data-cy=submit]').click()

    // 2. Lancer recherche
    cy.get('[data-cy=search-tab]').click()
    cy.get('[data-cy=query-input]').type('alliance thérapeutique')
    cy.get('[data-cy=search-button]').click()

    // Wait for the search request to complete
    cy.wait('@searchRequest');

    // 3. Vérifier résultats
    cy.get('[data-cy=results-count]').should('contain', '100')

    // 4. Lancer analyse ATN
    cy.get('[data-cy=analysis-tab]').click()
    cy.get('[data-cy=run-atn-analysis]').click()

    // Wait for the analysis request to complete
    cy.wait('@runAnalysis');

    // 5. Vérifier export
    cy.get('[data-cy=export-button]').should('be.enabled')

  })
})