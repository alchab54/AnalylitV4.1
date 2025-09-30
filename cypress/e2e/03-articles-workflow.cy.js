describe('Workflow de Gestion des Articles - Version Optimisée', () => {
  const projectName = 'Projet Articles Test';
  

  beforeEach(() => {
    // ✅ CORRECTION: Définir les interceptions AVANT de visiter la page
    cy.setupMockAPI();
    // ✅ PATCH : Utiliser la commande corrigée
    cy.selectProject('Projet E2E AnalyLit');
    // ✅ PATCH : Navigation robuste vers les articles (la section s'appelle 'results')
    cy.navigateToSection('results');
    // ✅ PATCH : Attendre explicitement que la section articles soit prête
    cy.waitForElement('.results-list-container');
  });

  it('Devrait afficher la liste des articles du projet sélectionné', () => {
    // ✅ PATCH : Vérifications robustes
    cy.get('.results-list-container')
      .should('be.visible')
      .and('not.be.empty');
      
    cy.contains('h2', 'Résultats de la Recherche').should('be.visible');
    
    // Vérifier la présence d'au moins un élément d'article ou un message vide
    cy.get('.results-list-container')
      .within(() => {
        cy.get('.result-row, .placeholder').should('exist');
      });
  });

  it("Devrait permettre la sélection multiple d'articles", () => {
    cy.get('.result-row').first().find('input[type="checkbox"]').check({ force: true });
    cy.get('.result-row').last().find('input[type="checkbox"]').check({ force: true });

    cy.get('#selectedCount').should('contain.text', '2');
    cy.get('[data-action="batch-process-modal"]').should('not.be.disabled');
  });

  it("Devrait ouvrir les détails d'un article", () => {
    cy.get('.result-row').first().find('[data-action="view-details"]').click({ force: true });
    
    cy.get('#articleDetailModal').should('be.visible');
    // ✅ CORRECTION: Le titre dans le fixture est "Intelligence Artificielle en Santé".
    cy.get('#articleDetailContent').should('contain.text', 'Intelligence Artificielle en Santé');
  });

  it('Devrait permettre le screening par lot', () => {
    cy.intercept('POST', '/api/projects/*/run', { body: { job_id: 'batch-job-123' } }).as('startBatch');

    cy.get('.result-row').first().find('input[type="checkbox"]').check({ force: true });
    cy.get('[data-action="batch-process-modal"]').should('not.be.disabled').click({ force: true });
    
    cy.get('#batchProcessModal').should('be.visible');
    // ✅ CORRECTION: Être plus spécifique pour ne cibler que le bouton DANS la modale.
    // Le sélecteur initial correspondait à deux boutons.
    // On cible le dernier bouton, car l'injection de contenu peut créer un doublon.
    cy.get('#batchProcessModal .modal-actions button[data-action="start-batch-process"]')
      .last().click({ force: true });

    cy.wait('@startBatch');
    cy.waitForToast('success', 'Tâche de screening lancée avec succès');
  });

  it("Devrait gérer l'état vide quand aucun article n'est présent", () => {
    // Intercepter la réponse pour simuler une liste vide
    // ✅ CORRECTION: Utiliser le bon ID de projet ('test-project-e2e-1') pour que l'intercept corresponde.
    cy.intercept('GET', `/api/projects/test-project-e2e-1/search-results?page=1`, { body: { articles: [], meta: {} } }).as('getEmptyArticles');
    cy.navigateToSection('results');
    cy.wait('@getEmptyArticles');
    
    cy.get('.placeholder').should('be.visible').and('contain.text', 'Aucun résultat trouvé');
  });
});