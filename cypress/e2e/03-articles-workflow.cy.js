describe('Workflow de Gestion des Articles - Version Optimisée', () => {
  const projectName = 'Projet Articles Test';
  
  beforeEach(() => {
    // ✅ CORRECTION: Définir les interceptions AVANT de visiter la page
    // pour éviter toute "race condition" où l'appel API se produit avant que l'intercepteur ne soit prêt.
    cy.intercept('GET', '/api/projects', { fixture: 'projects.json' }).as('getProjects');
    cy.intercept('GET', `/api/projects/test-project-e2e-1/search-results?page=1`, { fixture: 'articles.json' }).as('getArticles');
    cy.intercept('GET', `/api/projects/test-project-e2e-1/extractions`, { body: [] }).as('getExtractions');
 
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
 
    // Sélectionner le projet de test et naviguer vers la section des résultats
    cy.selectProject('Projet E2E AnalyLit');
    cy.navigateToSection('results');
 
    // Attendre que les articles soient chargés pour ce projet
    cy.wait('@getArticles', { timeout: 10000 });
  });

  it('Devrait afficher la liste des articles du projet sélectionné', () => {
    // Vérifier que les données du fixture sont bien affichées
    cy.get('.results-list-container').should('be.visible');
    cy.get('.result-row').should('have.length.greaterThan', 0);
    // ✅ CORRECTION: Le titre dans le fixture est "Intelligence Artificielle en Santé".
    cy.contains('.article-title', 'Intelligence Artificielle en Santé').should('be.visible');
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