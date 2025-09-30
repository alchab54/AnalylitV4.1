describe('Workflow de Risk of Bias (RoB)', () => {

  beforeEach(() => {
    // ✅ CORRECTION: Définir les interceptions AVANT de visiter la page
    // pour éviter toute "race condition" où l'appel API se produit avant que l'intercepteur ne soit prêt.
    cy.setupMockAPI();

    cy.visitApp();
    // Initialiser l'application manuellement APRÈS la mise en place des intercepteurs
    cy.window().then((win) => {
      expect(win.AnalyLit).to.be.an('object');
      win.AnalyLit.initializeApplication();
    });
    cy.waitForAppReady();
    cy.wait('@getProjects'); // ✅ FIX: Wait for projects to load before interacting.

    // Sélectionner le projet. La navigation se fera dans chaque test.
    cy.contains('.project-card', 'Projet E2E AnalyLit').click();
  });

  it("devrait afficher l'interface RoB Cochrane", () => {
    // Naviguer vers la section RoB
    cy.navigateToSection('rob');

    // ✅ CORRECTION: Le titre a été mis à jour dans le code source.
    cy.contains('h2', 'Évaluation du Risque de Biais').should('be.visible');
    cy.get('.rob-navigation').should('be.visible');
  });

  it("devrait pouvoir charger les articles pour l'évaluation RoB", () => {
    // Naviguer vers la section RoB DÉCLENCHE l'appel API.
    cy.navigateToSection('rob');

    // L'interception étant prête avant la navigation, l'attente réussit.
    cy.wait('@getExtractions');
    cy.contains('Mock Article 1').should('be.visible');
    cy.get('.article-item').should('have.length.at.least', 1);
  });

  it("devrait afficher le formulaire d'évaluation avec les 7 domaines Cochrane", () => {
    cy.navigateToSection('rob');
    cy.wait('@getExtractions');

    // Act: Cliquer sur le bouton d'évaluation
    cy.contains('.article-item', 'Mock Article 1').find('button.btn-assess').click();

    // Assert: Vérifier que le formulaire est visible et contient un des domaines
    cy.get('.rob-assessment-form').should('be.visible');
    cy.contains('h5', 'Génération de la séquence aléatoire').should('be.visible');
  });

  it("devrait permettre d'évaluer le risque et de sauvegarder", () => {
    cy.navigateToSection('rob');
    cy.wait('@getExtractions');

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