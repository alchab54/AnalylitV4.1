describe('Workflow des Analyses ATN Spécialisées', () => {
  const projectName = 'Projet ATN Test';

  beforeEach(() => {
    // ✅ CORRECTION: Définir les interceptions AVANT de visiter la page
    // pour éviter toute "race condition".
    cy.intercept('GET', '/api/projects', { fixture: 'projects.json' }).as('getProjects');
    cy.intercept('POST', '/api/projects', { fixture: 'test-project.json' }).as('createProject');
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
    cy.wait('@getProjects');
  });

  it("devrait afficher l'interface ATN complète", () => {
    // Sélectionner le projet et naviguer vers la section
    cy.selectProject('Projet ATN Test');
    cy.navigateToSection('atn-analysis');

    cy.get('.atn-header h2').should('contain', 'Analyses ATN Spécialisées');
    cy.get('.atn-nav').should('be.visible');
    cy.get('.atn-tab').should('have.length', 4);
  });

  it('devrait permettre de charger les articles pour l\'extraction ATN', () => {
    cy.selectProject('Projet ATN Test');
    cy.navigateToSection('atn-analysis');

    cy.get('.atn-tab[data-tab="extraction"]').click();
    cy.get('button').contains('Charger Articles').click();
    cy.wait('@getExtractions'); // ✅ CORRECTION: Attendre explicitement que les données arrivent.
    cy.get('.atn-articles-grid').should('be.visible');
    cy.get('.atn-article-card').should('have.length.greaterThan', 0);
  });

  it('devrait switcher entre les onglets ATN', () => {
    cy.selectProject('Projet ATN Test');
    cy.navigateToSection('atn-analysis');

    cy.get('.atn-tab[data-tab="empathy"]').click();
    cy.get('#atn-empathy.atn-panel.active').should('be.visible');
    cy.contains('h3', 'Analyse Comparative Empathie').should('be.visible');

    cy.get('.atn-tab[data-tab="analysis"]').click();
    cy.get('#atn-analysis.atn-panel.active').should('be.visible');
    cy.contains('h3', 'Analyses ATN Multipartites').should('be.visible');
  });

  it("devrait pouvoir lancer une analyse d'empathie", () => {
    cy.selectProject('Projet ATN Test');
    cy.navigateToSection('atn-analysis');

    cy.intercept('POST', '/api/projects/*/run-analysis', { body: { task_id: 'empathy-task-123' } }).as('runEmpathy');

    cy.get('.atn-tab[data-tab="empathy"]').click();
    cy.get('button').contains('Analyser Empathie').click();

    cy.wait('@runEmpathy').its('request.body.type').should('eq', 'empathy_comparative_analysis');
    cy.get('.analyzing').should('be.visible').and('contain', 'Analyse de l\'empathie en cours');
  });
});