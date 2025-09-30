describe('Workflow de Thèse ATN - Version Optimisée', () => {
  const projectName = 'Thèse ATN Test';

  beforeEach(() => {
    // ✅ CORRECTION: La commande selectProject gère maintenant tout.
    cy.selectProject('Projet E2E AnalyLit');
  });

  it('devrait permettre une recherche spécialisée ATN', () => {
    cy.navigateToSection('thesis');
    
    // Test de recherche ATN
    cy.get('#thesis-search-input').type('Alliance Thérapeutique');
    cy.get('#btn-thesis-search').click();
    
    // Vérifier les résultats
    cy.get('.search-results').should('be.visible');
  });

  it('devrait afficher les statistiques de validation et permettre le calcul du Kappa', () => {
    cy.intercept('POST', '/api/projects/*/calculate-kappa', { body: { success: true, task_id: 'kappa-task-123' } }).as('calculateKappa');
    cy.navigateToSection('validation');
    cy.wait('@getExtractions');

    cy.get('.validation-stats').should('be.visible');
    cy.get('.stat-item--included').should('contain.text', '1'); // Based on extractions.json fixture
    cy.get('.stat-item--excluded').should('contain.text', '1');

    cy.get('button[data-action="calculate-kappa"]').click();
    cy.wait('@calculateKappa');
    cy.waitForToast('success', 'Calcul Kappa lancé');
  });

  it('devrait permettre la gestion complète de la checklist PRISMA', () => {
    cy.intercept('POST', '/api/projects/*/prisma-checklist', { statusCode: 200, body: { message: 'OK' } }).as('savePrisma');
    cy.navigateToSection('analyses');

    cy.get('[data-action="show-prisma-modal"]').click({ force: true });
    cy.get('#prismaModal').should('be.visible');

    cy.get('.prisma-item').first().find('input[type="checkbox"]').check({ force: true });
    cy.get('.prisma-item').first().find('textarea').type('Note de test PRISMA.');

    cy.get('[data-action="save-prisma-progress"]').click();
    cy.wait('@savePrisma');
    cy.waitForToast('success', 'Checklist PRISMA sauvegardée');

    cy.get('[data-action="export-prisma-report"]').click();
    cy.waitForToast('success', 'Exportation de la checklist PRISMA terminée.');
  });
});
