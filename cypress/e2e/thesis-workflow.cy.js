describe('Workflow de Thèse ATN - Version Optimisée', () => {
  const projectName = 'Thèse ATN Test';

  beforeEach(() => {
    // ✅ CORRECTION: Définir les interceptions AVANT de visiter la page.
    cy.intercept('GET', '/api/projects', { fixture: 'projects.json' }).as('getProjects');
    cy.intercept('POST', '/api/projects/', { fixture: 'test-project.json' }).as('createProject');
    cy.intercept('GET', '/api/projects/test-project-e2e-1/extractions', { fixture: 'extractions.json' }).as('getExtractions');

    // Visiter l'application SANS initialisation automatique
    cy.visitApp();

    // Initialiser l'application manuellement APRÈS la mise en place des intercepteurs
    cy.window().then((win) => {
      expect(win.AnalyLit).to.be.an('object');
      win.AnalyLit.initializeApplication();
    });

    // Attendre que l'application soit prête et que les projets soient chargés
    cy.waitForAppReady();
    cy.wait('@getProjects'); // This was correct, but let's ensure it's here.
  });

  it('devrait permettre une recherche spécialisée ATN', () => {
    cy.intercept('POST', '/api/search', { body: { task_id: 'search-task-123' } }).as('runSearch');
    cy.navigateToSection('search');

    cy.get('input[name="query"]').type('alliance thérapeutique numérique');
    cy.get('form[data-action="run-multi-search"]').submit();

    cy.wait('@runSearch');
    cy.waitForToast('success', 'Recherche lancée en arrière-plan.');
  });

  it('devrait afficher les statistiques de validation et permettre le calcul du Kappa', () => {
    // Sélectionner le projet de test pour ce scénario
    cy.selectProject('Projet E2E AnalyLit');

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
    // Sélectionner le projet de test pour ce scénario
    cy.selectProject('Projet E2E AnalyLit');

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
