describe('Workflow Projets - Version Simplifiée', () => {
  
  beforeEach(() => {
    // Met en place les simulations d'API pour des tests rapides et isolés.
    cy.setupMockAPI();
    // ✅ CORRECTION: Ajouter les mocks manquants pour la navigation vers les résultats
    cy.intercept('GET', '/api/projects/*/search-results?page=1', { fixture: 'articles.json' }).as('getArticles');
    cy.intercept('GET', '/api/projects/*/extractions', { fixture: 'extractions.json' }).as('getExtractions');
  });

  it('Devrait afficher la section projets', () => {
    // Visite l'application et attend que les projets soient chargés.
    cy.visitApp();
    // ✅ CORRECTION CRITIQUE: Appeler l'initialisation manuellement pour éviter les race conditions.
    cy.window().then((win) => {
      // Appelle la fonction d'initialisation que nous avons exposée sur window.
      // Cela garantit que les appels API partent APRÈS que cy.intercept soit prêt.
      // La vérification 'win.AnalyLit' assure que le script principal est chargé.
      expect(win.AnalyLit).to.be.an('object');
      win.AnalyLit.initializeApplication(); 
    });
    cy.waitForAppReady(); // ✅ CORRECTION: Attendre que l'app soit prête et les projets chargés.
    
    // Vérifie que l'application est chargée et que les projets de la fixture sont visibles.
    cy.checkAppIsLoaded();
    cy.contains('Projet E2E AnalyLit').should('be.visible');
  });

  it('Devrait pouvoir créer un projet (simulation)', () => {
    const projectName = 'Mon Projet E2E Test';
    cy.visitApp();
    cy.window().then((win) => {
      expect(win.AnalyLit).to.be.an('object');
      win.AnalyLit.initializeApplication(); 
    });
    cy.waitForAppReady();

    // ✅ AJOUT: Intercepter la requête de création de projet AVANT de la déclencher.
    cy.intercept('POST', '/api/projects', {
      statusCode: 201,
      body: { id: 'new-proj-123', name: projectName, description: 'Description...' }
    }).as('createProject');

    // Rendre le test plus explicite au lieu d'utiliser une commande personnalisée
    cy.get('[data-action="create-project-modal"]').click();
    cy.get('#newProjectModal').should('be.visible');
    cy.get('#projectName').type(projectName);
    cy.get('#projectDescription').type('Description du projet de test automatisé');
    cy.get('#createProjectForm button[type="submit"]').click();

    // Attendre que la requête API soit terminée
    cy.wait('@createProject');

    // Vérifie que l'application affiche une notification de succès.
    cy.contains('Projet créé avec succès').should('be.visible');
  });

  it('Devrait pouvoir naviguer vers les articles', () => {
    cy.visitApp();
    cy.window().then((win) => {
      expect(win.AnalyLit).to.be.an('object');
      win.AnalyLit.initializeApplication(); 
    });
    cy.waitForAppReady();
    
    // Utilise la commande de navigation robuste.
    cy.navigateToSection('results'); // ✅ CORRECTION: La section des articles s'appelle 'results'.
    
    // Vérifie que la section des articles est bien affichée.
    cy.contains('h2', 'Résultats de la Recherche').should('be.visible');
  });
});