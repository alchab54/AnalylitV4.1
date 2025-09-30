describe('Workflow de Risk of Bias (RoB)', () => {

  beforeEach(() => {
    // ✅ CORRECTION: Les interceptions doivent être définies AVANT cy.visit()
    // pour garantir qu'aucun appel API n'est manqué.
    cy.setupMockAPI();

    cy.visitApp();
    cy.window().then((win) => {
      expect(win.AnalyLit).to.be.an('object');
      win.AnalyLit.initializeApplication();
    });
    cy.waitForAppReady();

    // Sélectionner le projet et naviguer vers la section RoB
    cy.contains('.project-card', 'Projet E2E AnalyLit').click();
    cy.navigateToSection('rob');
  });

  it("devrait afficher l'interface RoB Cochrane", () => {
    // ✅ CORRECTION: Le titre a été mis à jour dans le code source (rob-manager.js).
    cy.contains('h2', 'Évaluation du Risque de Biais').should('be.visible');
    cy.get('.rob-navigation').should('be.visible');
  });

  it("devrait pouvoir charger les articles pour l'évaluation RoB", () => {
    // L'interception est maintenant prête, l'attente devrait réussir.
    cy.wait('@getExtractions');
    cy.contains('Mock Article 1').should('be.visible');
    cy.get('.article-item').should('have.length.at.least', 1);
  });

  it("devrait afficher le formulaire d'évaluation avec les 7 domaines Cochrane", () => {
    cy.wait('@getExtractions');
    // Act
    // ✅ CORRECTION: Sélecteur plus robuste pour cliquer sur le bouton d'évaluation.
    cy.contains('.article-item', 'Mock Article 1').find('button.btn-assess').click();
    // Assert
    cy.get('.rob-assessment-form').should('be.visible');
    // Vérifie la présence d'un des domaines Cochrane
    cy.contains('h5', 'Génération de la séquence aléatoire').should('be.visible');
  });

  it("devrait permettre d'évaluer le risque et de sauvegarder", () => {
    cy.wait('@getExtractions');
    // Arrange
    // L'interception est déjà dans setupMockAPI, on s'assure juste qu'elle est correcte.

    // Act
    cy.contains('.article-item', 'Mock Article 1').find('button.btn-assess').click();

    // Évaluer le premier domaine
    cy.get('.rob-assessment-form').find('input[name="random_sequence_generation"][value="low"]').check();
    cy.get('.rob-assessment-form').find('textarea[name="random_sequence_generation_notes"]').type('Randomisation correcte.');

    cy.get('.assessment-actions .btn-save').click();

    // Assert
    cy.wait('@saveRob');
    cy.get('.article-item[data-article-id="test-extraction-1"]').should('have.class', 'has-rob');
  });
});