describe('Workflow de Gestion des Projets - Version Optimisée', () => {
  
  beforeEach(() => {
    // ✅ Visit avec timeout étendu
    // ✅ CORRECTION: Ajouter le setup des mocks API pour que waitForAppReady fonctionne.
    cy.setupMockAPI();
    
    cy.visit('/', { timeout: 30000 });
    
    // ✅ Attente COMPLÈTE de l'app
    cy.waitForAppReady();
    
    // ✅ Reset état initial
    cy.resetApp();
    
    // Debug initial
    cy.debugUI();
  });

  it('Devrait charger l\'interface complète', () => {
    // Tests de base d'existence
    cy.get('.app-header').should('be.visible');
    cy.get('.app-nav').should('be.visible');
    cy.get('#projects').should('have.class', 'active');
    cy.get('.app-nav__button').should('have.length.gte', 7);
    
    console.log('✅ Interface de base validée');
  });

  it('Devrait ouvrir et fermer la modale de création', () => {
    // ✅ Test modal avec timeouts étendus
    cy.get('#create-project-btn', { timeout: 15000 })
      .should('be.visible')
      .click({ force: true });
    
    // Attendre modale
    cy.get('#newProjectModal', { timeout: 10000 })
      .should('be.visible')
      .and('contain', 'Créer un Nouveau Projet');
    
    // Fermer modale
    cy.get('#newProjectModal [data-action="close-modal"]')
      .click({ force: true });
    
    // Vérifier fermeture
    cy.get('#newProjectModal', { timeout: 5000 })
      .should('not.be.visible');
      
    console.log('✅ Modal workflow validé');
  });

  it('Devrait créer un projet avec API interceptée', () => {
    const projectName = `Projet Test ${Date.now()}`;
    
    // ✅ Intercepter API pour tests fiables
    cy.intercept('POST', '/api/projects/', {
      statusCode: 201,
      body: {
        id: 'test-project-123',
        name: projectName,
        description: 'Test description',
        created_at: new Date().toISOString()
      }
    }).as('createProject');
    
    cy.intercept('GET', '/api/projects/', {
      statusCode: 200,
      body: {
        projects: [{
          id: 'test-project-123',
          name: projectName,
          description: 'Test description',
          created_at: new Date().toISOString(),
          articles_count: 0
        }]
      }
    }).as('getProjectsAfterCreate');
    
    // Utiliser commande personnalisée
    cy.createTestProject(projectName);
    
    // Vérifications API
    cy.wait('@createProject');
    cy.wait('@getProjectsAfterCreate');
    
    console.log('✅ Création projet avec API validée');
  });

  it('Devrait naviguer entre toutes les sections', () => {
    const sections = ['projects', 'search', 'validation', 'analyses', 'settings'];
    
    sections.forEach(sectionId => {
      // Navigation
      cy.navigateToSection(sectionId);
      
      // Vérification section active
      cy.get(`#${sectionId}`).should('have.class', 'active');
      cy.get(`[data-section-id="${sectionId}"]`).should('have.class', 'app-nav__button--active');
      
      // Petite pause pour stabilité
      cy.wait(500);
    });
    
    console.log('✅ Navigation complète validée');
  });

  it('Devrait résister aux actions rapides multiples', () => {
    // Test de robustesse - clics rapides
    for(let i = 0; i < 3; i++) {
      cy.get('#create-project-btn').click({ force: true });
      cy.wait(100);
      cy.get('[data-action="close-modal"]').click({ force: true });
      cy.wait(100);
    }
    
    // Vérifier que l'app reste stable
    cy.get('#projects').should('have.class', 'active');
    cy.get('.modal').should('not.be.visible');
    
    console.log('✅ Tests de robustesse passés');
  });

  after(() => {
    // Nettoyage final
    cy.window().then((win) => {
      if (win.AnalyLit) {
        console.log('🧹 Nettoyage final effectué');
      }
    });
  });
});