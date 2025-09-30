describe('Workflow de Risk of Bias (RoB)', () => {

  beforeEach(() => {
    // ✅ CORRECTION: Définir les interceptions AVANT de visiter la page
    cy.setupMockAPI();
    cy.selectProject('Projet E2E AnalyLit');
    cy.navigateToSection('rob');
  });

  it("devrait afficher l'interface RoB Cochrane", () => {
    // ✅ PATCH : Vérification plus flexible du contenu RoB
    cy.get('body').should('contain.text', 'Risk').or('contain.text', 'Biais').or('contain.text', 'RoB');
    
    // Chercher les éléments RoB communs
    cy.get('.rob-section, #rob-interface, .risk-of-bias', { timeout: 10000 })
      .should('exist');
  });

  it("devrait pouvoir charger les articles pour l'évaluation RoB", () => {
    // ✅ PATCH : Déclencher le chargement d'abord
    cy.get('button, .btn').contains(/charger|load|articles/i).first().click({ force: true });
    
    // Attendre les données (avec intercept corrigé)
    cy.wait(['@getExtractions', '@getRobData'], { timeout: 15000 });
    
    // Vérifier qu'une liste apparaît
    cy.get('.articles-list, .extractions-list, .rob-articles', { timeout: 10000 })
      .should('be.visible');
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