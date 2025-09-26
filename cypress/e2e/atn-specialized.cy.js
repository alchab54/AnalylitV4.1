describe('Workflow des Analyses ATN Spécialisées', () => {
  const projectName = 'Projet ATN Test';

  beforeEach(() => {
    cy.intercept('GET', '/api/projects/', { fixture: 'projects-empty.json' }).as('getProjects');
    cy.intercept('POST', '/api/projects/', { fixture: 'test-project.json' }).as('createProject');
    cy.intercept('GET', '/api/projects/test-project-123/extractions', { fixture: 'extractions.json' }).as('getExtractions');

    cy.visit('/');
    cy.waitForAppReady();

    cy.createTestProject(projectName);
    cy.selectProject(projectName);
    cy.navigateToSection('atn-analysis');
  });

  it("devrait afficher l'interface ATN complète", () => {
    cy.get('.atn-header h2').should('contain', 'Analyses ATN Spécialisées');
    cy.get('.atn-nav').should('be.visible');
    cy.get('.atn-tab').should('have.length', 4);
  });

  it('devrait permettre de charger les articles pour l\'extraction ATN', () => {
    cy.get('.atn-tab[data-tab="extraction"]').click();
    cy.get('button').contains('Charger Articles').click();
    cy.wait('@getExtractions');
    cy.get('.atn-articles-grid').should('be.visible');
    cy.get('.atn-article-card').should('have.length.greaterThan', 0);
  });

  it('devrait switcher entre les onglets ATN', () => {
    cy.get('.atn-tab[data-tab="empathy"]').click();
    cy.get('#atn-empathy.atn-panel.active').should('be.visible');
    cy.contains('h3', 'Analyse Comparative Empathie').should('be.visible');

    cy.get('.atn-tab[data-tab="analysis"]').click();
    cy.get('#atn-analysis.atn-panel.active').should('be.visible');
    cy.contains('h3', 'Analyses ATN Multipartites').should('be.visible');
  });

  it("devrait pouvoir lancer une analyse d'empathie", () => {
    cy.intercept('POST', '/api/projects/*/run-analysis', { body: { task_id: 'empathy-task-123' } }).as('runEmpathy');

    cy.get('.atn-tab[data-tab="empathy"]').click();
    cy.get('button').contains('Analyser Empathie').click();

    cy.wait('@runEmpathy').its('request.body.type').should('eq', 'empathy_comparative_analysis');
    cy.get('.analyzing').should('be.visible').and('contain', 'Analyse de l\'empathie en cours');
  });
});