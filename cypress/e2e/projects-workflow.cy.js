describe('Workflow de Gestion des Projets', () => {
  
  beforeEach(() => {
    cy.visit('/');
    cy.get('[data-section-id="projects"]').click({ force: true });
  });

  it('Devrait ouvrir et fermer la modale de création de projet', () => {
    // Ouvrir la modale
    cy.get('#create-project-btn').first().click({ force: true });
    cy.get('#newProjectModal').should('be.visible');
    cy.contains('h3', 'Créer un Nouveau Projet').should('be.visible');
    
    // Fermer la modale
    cy.get('[data-action="close-modal"]').click();
    cy.get('#newProjectModal').should('not.exist');
  });

  it('Devrait créer un nouveau projet avec succès', () => {
    // Ouvrir la modale de création
    cy.get('#create-project-btn').first().click({ force: true });
    
    // Remplir le formulaire
    cy.get('#projectName').type('Projet Test E2E');
    cy.get('#projectDescription').type('Description du projet créé par Cypress');
    cy.get('#projectAnalysisMode').select('screening');
    
    // Soumettre le formulaire
    cy.get('form[data-form="create-project"]').submit();
    cy.wait(1000);
    
    // Vérifier la notification de succès
    cy.contains('.toast-success', 'Projet créé avec succès').should('be.visible');
    
    // Vérifier que le projet apparaît dans la liste
    cy.window().then((win) => {
      cy.log('appState.projects length:', win.AnalyLit.appState.projects.length);
    });
    cy.contains('.project-card', 'Projet Test E2E').should('be.visible');
  });

  it("Devrait afficher les détails d'un projet sélectionné", () => {
    // Supposer qu'il y a au moins un projet
    cy.get('.project-card').first().click();
    
    // Vérifier l'affichage des détails
    cy.get('.project-detail').should('be.visible');
    cy.get('.metrics-grid').should('be.visible');
    cy.get('.metric-card').should('have.length.greaterThan', 0);
  });

  it("Devrait permettre la suppression d'un projet", () => {
    // Créer d'abord un projet pour le supprimer
    cy.get('#create-project-btn').first().click({ force: true });
    cy.get('#projectName').type('Projet à Supprimer');
    cy.get('#projectDescription').type('Ce projet sera supprimé');
    cy.get('form[data-form="create-project"]').submit();
    cy.wait(1000);
    
    // Attendre la création
    cy.contains('.toast-success', 'Projet créé avec succès');
    
    // Supprimer le projet
    cy.contains('.project-card', 'Projet à Supprimer')
      .find('[data-action="delete-project"]')
      .click();
    
    // Confirmer la suppression
    cy.get('[data-action="confirm-delete-project"]').click();
    
    // Vérifier la notification de suppression
    cy.contains('.toast-success', 'Projet supprimé').should('be.visible');
    
    // Vérifier que le projet n'apparaît plus
    cy.contains('.project-card', 'Projet à Supprimer').should('not.exist');
  });
});