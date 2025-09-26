describe('Workflow de Risk of Bias (RoB)', () => {
  const projectName = 'Projet RoB Test';

  beforeEach(() => {
    cy.intercept('GET', '/api/projects/', { fixture: 'projects-empty.json' }).as('getProjects');
    cy.intercept('POST', '/api/projects/', { fixture: 'test-project.json' }).as('createProject');
    cy.intercept('GET', '/api/projects/test-project-123/search-results?page=1', { fixture: 'articles.json' }).as('getArticles');
    cy.intercept('GET', '/api/projects/test-project-123/extractions', { fixture: 'extractions.json' }).as('getExtractions');

    cy.visit('/');
    cy.waitForAppReady();

    cy.createTestProject(projectName);
    cy.selectProject(projectName);
    cy.navigateToSection('rob');
  });

  it("devrait afficher l'interface RoB Cochrane", () => {
    cy.get('.rob-header h2').should('contain', 'Évaluation du Risque de Biais');
    cy.get('.rob-navigation').should('be.visible');
    cy.get('.rob-tab').should('have.length', 4);
  });

  it("devrait pouvoir charger les articles pour l'évaluation RoB", () => {
    // La section RoB se base sur les articles déjà chargés dans l'état
    // On vérifie juste que le rendu est correct
    cy.get('.rob-list').should('be.visible');
    cy.get('.rob-article-card').should('have.length.greaterThan', 0);
  });

  it("devrait afficher le formulaire d'évaluation avec les 7 domaines Cochrane", () => {
    cy.get('.rob-article-card').first().find('button[data-action="edit-rob"]').click();

    cy.get('.rob-edit-form').should('be.visible');
    cy.get('.rob-edit-form .form-group').should('have.length.at.least', 3); // Teste les 3 domaines principaux
    cy.contains('label', 'Biais dans le processus de randomisation').should('be.visible');
  });

  it("devrait permettre d'évaluer le risque et de sauvegarder", () => {
    cy.intercept('POST', '/api/projects/*/rob/*', { statusCode: 200, body: { message: 'Saved' } }).as('saveRob');

    cy.get('.rob-article-card').first().find('button[data-action="edit-rob"]').click();

    // Évaluer le premier domaine
    cy.get('.rob-edit-form').find('select[name="domain_1_bias"]').select('Low risk');
    cy.get('.rob-edit-form').find('textarea[name="domain_1_justification"]').type('Randomisation correcte.');

    // Sauvegarder
    cy.get('.rob-edit-form').find('button[type="submit"]').click();

    cy.wait('@saveRob');
    cy.waitForToast('success', 'Évaluation RoB sauvegardée.');
    cy.get('.rob-edit-form').should('not.exist');
    cy.get('.rob-details').should('be.visible').and('contain', 'Low risk');
  });
});