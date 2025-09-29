describe('Workflow de Gestion des Articles - Version Optimisée', () => {
  const projectName = 'Projet Articles Test';
  
  beforeEach(() => {
    // Isoler les tests avec des interceptions API
    cy.intercept('GET', '/api/projects', { fixture: 'projects.json' }).as('getProjects'); // This fixture contains the project we need to find
    // ✅ CORRECTION: L'API de création retourne un SEUL objet projet, pas un tableau.
    // On utilise un fixture qui représente un seul projet.
    cy.intercept('POST', '/api/projects', { fixture: 'test-project.json' }).as('createProject');
    cy.intercept('GET', `/api/projects/test-project-e2e-1/search-results?page=1`, { fixture: 'articles.json' }).as('getArticles');
    cy.intercept('GET', `/api/projects/test-project-e2e-1/extractions`, { body: [] }).as('getExtractions');

    cy.visit('/');
    // ✅ CORRECTION CRITIQUE: Appeler l'initialisation manuellement pour éviter la race condition.
    cy.window().then((win) => {
      expect(win.AnalyLit).to.be.an('object');
      win.AnalyLit.initializeApplication();
    });
    cy.waitForAppReady();
    
    cy.createTestProject(projectName);
    // ✅ CORRECTION: Attendre que l'API de création ET le rechargement des projets soient terminés
    // avant de tenter de sélectionner le projet. C'est ce qui corrige l'erreur "never did".
    cy.wait('@createProject');
    cy.wait('@getProjects');
    // ✅ CORRECTION FINALE: Attendre que le nouveau projet soit visible dans le DOM avant de le sélectionner.
    // Cela résout la race condition entre la réponse API et le rendu de l'UI.
    cy.contains('.project-card', 'Projet E2E AnalyLit').should('be.visible'); // Use the name from the fixture
    // ✅ CORRECTION: On doit sélectionner le projet qui existe dans le fixture, pas celui qu'on a "créé" en mémoire.
    // Le nom du projet dans `projects.json` est 'Projet E2E AnalyLit'. Le projet créé en mémoire est ignoré car la liste est rechargée depuis le fixture.
    cy.selectProject('Projet E2E AnalyLit');
    cy.navigateToSection('results');
    
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