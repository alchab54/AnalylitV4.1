describe('Workflow Projets - Version Simplifiée', () => {
  
  beforeEach(() => {
    // Met en place les simulations d'API pour des tests rapides et isolés.
    cy.setupMockAPI();
  });

  it('Devrait afficher la section projets', () => {
    // Visite l'application et attend que les projets soient chargés.
    cy.visitApp();
    
    // Vérifie que l'application est chargée et que les projets de la fixture sont visibles.
    cy.checkAppIsLoaded();
    cy.contains('Projet E2E AnalyLit').should('be.visible');
  });

  it('Devrait pouvoir créer un projet (simulation)', () => {
    const projectName = 'Mon Projet E2E Test';
    cy.createTestProject({
      name: projectName,
      description: 'Description du projet de test automatisé'
    });
    
    // Vérifie que la requête de création a été envoyée.
    cy.wait('@createProject');
    
    // Vérifie que l'application affiche une notification de succès.
    cy.contains('Projet créé avec succès').should('be.visible');
  });

  it('Devrait pouvoir naviguer vers les articles', () => {
    cy.visitApp();
    
    // Utilise la commande de navigation robuste.
    cy.navigateToSection('articles');
    
    // Vérifie que la section des articles est bien affichée.
    cy.contains('h2', 'Articles').should('be.visible');
  });
});