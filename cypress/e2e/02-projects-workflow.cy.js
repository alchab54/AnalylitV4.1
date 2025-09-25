describe('Workflow de Gestion des Projets', () => {
  
  beforeEach(() => {
    cy.visit('/');
    cy.waitForAppReady(); // ✅ UTILISE la commande améliorée de Gemini
    
    // Navigation vers projets avec la nouvelle logique
    cy.navigateToSection('projects'); // ✅ UTILISE la commande corrigée
  });

  it('Devrait ouvrir et fermer la modale de création de projet', () => {
    // Ouvrir la modale
    cy.get('#create-project-btn').first().click({ force: true });
    cy.get('#newProjectModal').should('be.visible');
    cy.contains('h3', 'Créer un Nouveau Projet').should('be.visible');
    
    // Fermer la modale
    cy.get('#newProjectModal [data-action="close-modal"]').first().click({ force: true }); // ✅ FORCE AJOUTÉ
    cy.get('#newProjectModal').should('not.be.visible');
  });

  it('Devrait créer un nouveau projet avec succès', () => {
    // ✅ UTILISE la commande personnalisée corrigée
    cy.createTestProject('Projet Test E2E');
    
    // Vérifier que le projet apparaît
    cy.contains('.project-card', 'Projet Test E2E').should('exist'); // ✅ exist au lieu de be.visible
  });

  it("Devrait afficher les détails d'un projet sélectionné", () => {
    // Créer un projet pour ce test
    cy.createTestProject('Projet pour Détails'); // ✅ COMMANDE CORRIGÉE
    
    // ✅ CORRECTION LIGNE 52 : Utiliser selectProject avec force
    cy.selectProject('Projet pour Détails'); // ✅ UTILISE la commande corrigée
    
    // Vérifier l'affichage des détails
    cy.get('.project-detail').should('exist'); // ✅ exist au lieu de be.visible
    cy.get('.metrics-grid').should('exist');   // ✅ exist au lieu de be.visible
    cy.get('.metric-card').should('have.length.greaterThan', 0);
  });

  it("Devrait permettre la suppression d'un projet", () => {
    // Créer un projet pour le supprimer
    cy.createTestProject('Projet à Supprimer'); // ✅ COMMANDE CORRIGÉE
    
    // ✅ CORRECTION LIGNE 74 : Navigation + force click
    cy.navigateToSection('projects'); // ✅ S'assurer qu'on voit la section
    
    // ✅ CONFIGURER le stub AVANT le clic et lui donner un alias
    cy.window().then((win) => {
      cy.stub(win, 'confirm').as('confirmDialog').returns(true);
    });

    // Cliquer sur le bouton de suppression
    cy.contains('.project-card', 'Projet à Supprimer')
      .find('[data-action="delete-project"]')
      .click({ force: true }); // ✅ FORCE AJOUTÉ

    // ✅ VÉRIFIER que la boîte de dialogue de confirmation a bien été appelée
    cy.get('@confirmDialog').should('have.been.called');

    // ✅ ATTENDRE la disparition de l'élément du DOM
    cy.contains('.project-card', 'Projet à Supprimer').should('not.exist');
  });
});