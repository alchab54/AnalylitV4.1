describe('Workflow des Analyses ATN Spécialisées', () => {
  const projectName = 'Projet ATN Test';

  beforeEach(() => {
    // ✅ CORRECTION: La commande selectProject gère maintenant tout (intercept, visit, wait).
    // On l'appelle simplement.
    cy.selectProject('Projet E2E AnalyLit');
  });

  it("devrait afficher l'interface ATN complète", () => {
    cy.navigateToSection('atn');
    
    // Vérifier les éléments ATN
    cy.get('body').should('contain.text', 'ATN')
      .or('contain.text', 'Alliance')
      .or('contain.text', 'Thérapeutique');
  });

  it('devrait permettre de charger les articles pour l\'extraction ATN', () => {
    cy.navigateToSection('atn');

    cy.get('.atn-tab[data-tab="extraction"]').click();
    cy.get('button').contains('Charger Articles').click();
    cy.wait('@getExtractions'); // ✅ CORRECTION: Attendre explicitement que les données arrivent.
    cy.get('.atn-articles-grid').should('be.visible');
    cy.get('.atn-article-card').should('have.length.greaterThan', 0);
  });

  it('devrait switcher entre les onglets ATN', () => {
    cy.navigateToSection('atn');

    cy.get('.atn-tab[data-tab="empathy"]').click();
    cy.get('#atn-empathy.atn-panel.active').should('be.visible');
    cy.contains('h3', 'Analyse Comparative Empathie').should('be.visible');

    cy.get('.atn-tab[data-tab="analysis"]').click();
    cy.get('#atn-analysis.atn-panel.active').should('be.visible');
    cy.contains('h3', 'Analyses ATN Multipartites').should('be.visible');
  });

  it("devrait pouvoir lancer une analyse d'empathie", () => {
    cy.navigateToSection('atn');

    cy.intercept('POST', '/api/projects/*/run-analysis', { body: { task_id: 'empathy-task-123' } }).as('runEmpathy');

    cy.get('.atn-tab[data-tab="empathy"]').click();
    cy.get('button').contains('Analyser Empathie').click();

    cy.wait('@runEmpathy').its('request.body.type').should('eq', 'empathy_comparative_analysis');
    cy.get('.analyzing').should('be.visible').and('contain', 'Analyse de l\'empathie en cours');
  });
});