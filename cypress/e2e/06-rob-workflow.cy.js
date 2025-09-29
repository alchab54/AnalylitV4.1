describe('Workflow de Risk of Bias (RoB)', () => {

  beforeEach(() => {
    cy.setupMockAPI();
    cy.visitApp();
    // ✅ CORRECTION: Appeler l'initialisation manuellement pour garantir que les mocks sont prêts.
    cy.window().then((win) => {
      expect(win.AnalyLit).to.be.an('object');
      win.AnalyLit.initializeApplication();
    });
    cy.waitForAppReady();
    cy.contains('.project-card', 'Projet E2E AnalyLit').click();
    cy.navigateToSection('rob');
  });

  it("devrait afficher l'interface RoB Cochrane", () => {
    cy.contains('h2', 'Risk of Bias').should('be.visible');
    cy.get('.rob-navigation').should('be.visible'); // Assumant que cette classe existe
  });

  it("devrait pouvoir charger les articles pour l'évaluation RoB", () => {
    cy.wait('@getExtractions');
    cy.contains('Mock Article 1').should('be.visible');
  });

  it("devrait afficher le formulaire d'évaluation avec les 7 domaines Cochrane", () => {
    // Act
    cy.contains('Mock Article 1').parents('.rob-article-card').find('button[data-action="edit-rob"]').click();
    // Assert
    cy.get('.rob-edit-form').should('be.visible');
    // Vérifie la présence d'un des domaines Cochrane
    cy.contains('label', 'Biais dans le processus de randomisation').should('be.visible');
  });

  it("devrait permettre d'évaluer le risque et de sauvegarder", () => {
    // Arrange
    cy.intercept('POST', '**/api/projects/*/rob/*', { statusCode: 200, body: { message: 'Saved' } }).as('saveRob');

    // Act
    cy.contains('Mock Article 1').parents('.rob-article-card').find('button[data-action="edit-rob"]').click();

    // Évaluer le premier domaine
    cy.get('.rob-edit-form').find('select[name="domain_1_bias"]').select('Low risk');
    cy.get('.rob-edit-form').find('textarea[name="domain_1_justification"]').type('Randomisation correcte.');

    cy.get('.rob-edit-form').submit();
    // Assert
    cy.wait('@saveRob');
    cy.contains('Évaluation RoB sauvegardée').should('be.visible');
  });
});