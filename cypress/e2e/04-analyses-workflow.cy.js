describe('Workflow de Gestion des Analyses', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.waitForAppReady();
    
    // Créer et sélectionner un projet pour la plupart des tests
    cy.createTestProject('Projet Analyses Test');
    cy.selectProject('Projet Analyses Test');
    
    // Naviguer vers la section Analyses
    cy.navigateToSection('analyses');
  });

  it("Devrait afficher la section des analyses et les cartes d'analyse", () => {
    cy.contains('h2', 'Analyses du Projet').should('exist');
    cy.get('.analysis-grid').should('exist');
    cy.get('.analysis-card').should('have.length.at.least', 4); // Au moins ATN, Discussion, Graphe, PRISMA
  });

  it("Devrait lancer l'Analyse ATN Multipartite", () => {
    cy.get('.analysis-card').contains('h4', 'Analyse ATN Multipartite').parents('.analysis-card').within(() => {
      cy.get('[data-action="run-atn-analysis"]').click({ force: true });
    });
    cy.waitForToast('success', 'Analyse ATN lancée');
    // Vérifier l'état de chargement de la carte
    cy.get('.analysis-card').contains('h4', 'Analyse ATN Multipartite').parents('.analysis-card').should('have.class', 'analysis-card--loading');
  });

  it('Devrait lancer une Discussion académique', () => {
    cy.get('.analysis-card').contains('h4', 'Discussion académique').parents('.analysis-card').within(() => {
      cy.get('[data-action="run-analysis"][data-analysis-type="discussion"]').click({ force: true });
    });
    cy.waitForToast('success', 'Tâche de génération du brouillon de discussion lancée');
    cy.get('.analysis-card').contains('h4', 'Discussion académique').parents('.analysis-card').should('have.class', 'analysis-card--loading');
  });

  it('Devrait lancer un Graphe de connaissances', () => {
    cy.get('.analysis-card').contains('h4', 'Graphe de connaissances').parents('.analysis-card').within(() => {
      cy.get('[data-action="run-analysis"][data-analysis-type="knowledge_graph"]').click({ force: true });
    });
    cy.waitForToast('success', 'Tâche de génération du graphe de connaissances lancée');
    cy.get('.analysis-card').contains('h4', 'Graphe de connaissances').parents('.analysis-card').should('have.class', 'analysis-card--loading');
  });

  it(`Devrait afficher les résultats d'une analyse terminée (si disponible)`, () => {
    // Ce test est conditionnel et ne s'exécute que si une analyse est déjà terminée.
    cy.get('.analysis-card--done').first().then(($card) => {
      if ($card.length > 0) {
        cy.wrap($card).find('[data-action="view-analysis-results"]').click({ force: true });
        // Vérifier que le conteneur de résultats correspondant est visible
        const targetId = $card.find('[data-action="view-analysis-results"]').attr('data-target-id');
        cy.get(`#${targetId}`).should('exist');
      } else {
        cy.log('Aucune analyse terminée trouvée pour visualiser les résultats. Ce test est conditionnel.');
      }
    });
  });

  it('Devrait interagir avec la modale PRISMA', () => {
    cy.get('[data-action="show-prisma-modal"]').click({ force: true });
    cy.get('#prismaModal').should('be.visible');
    cy.contains('h2', 'Checklist PRISMA').should('be.visible');

    // Interagir avec les éléments de la checklist
    cy.get('.prisma-item').first().within(() => {
      cy.get('input[type="checkbox"]').check({ force: true });
      cy.get('textarea').type(`Notes de test pour l'élément PRISMA.`, { force: true });
    });

    // Sauvegarder la progression PRISMA
    cy.get('[data-action="save-prisma-progress"]').click({ force: true });
    cy.waitForToast('success', 'Checklist PRISMA sauvegardée');

    // Exporter le rapport PRISMA
    cy.get('[data-action="export-prisma-report"]').click({ force: true });
    cy.waitForToast('info', 'Exportation PRISMA non implémentée');

    cy.closeModal('#prismaModal');
    cy.get('#prismaModal').should('not.exist');
  });

  it(`Devrait ouvrir la modale d'analyses avancées et lancer diverses analyses`, () => {
    cy.openModal('[data-action="show-advanced-analysis-modal"]', '.modal-content');

    // Lancer une Méta-analyse
    cy.get('.analysis-option[data-analysis-type="meta_analysis"]').click({ force: true });
    cy.waitForToast('success', 'Tâche de méta-analyse lancée');
    cy.get('.modal-content').should('not.be.visible');

    // Réouvrir la modale pour les autres tests
    cy.openModal('[data-action="show-advanced-analysis-modal"]', '.modal-content');

    // Lancer un Diagramme PRISMA
    cy.get('.analysis-option[data-analysis-type="prisma_flow"]').click({ force: true });
    cy.waitForToast('success', 'Tâche de génération du diagramme PRISMA lancée');
    cy.get('.modal-content').should('not.be.visible');

    // Réouvrir la modale pour les autres tests
    cy.openModal('[data-action="show-advanced-analysis-modal"]', '.modal-content');

    // Lancer des Statistiques Descriptives
    cy.get('.analysis-option[data-analysis-type="descriptive_stats"]').click({ force: true });
    cy.waitForToast('success', 'Tâche de statistiques descriptives lancée');
    cy.get('.modal-content').should('not.be.visible');
  });

  it(`Devrait permettre d'exporter les analyses`, () => {
    cy.get('[data-action="export-analyses"]').click({ force: true });
    cy.waitForToast('info', `Préparation de l'exportation des analyses...`);
    // On ne peut pas tester le téléchargement de fichier directement avec Cypress sans plugins spécifiques
    // Mais on peut vérifier que l'action est déclenchée et la notification affichée.
  });

  it(`Devrait gérer l'état vide si aucun projet n'est sélectionné`, () => {
    // Test autonome : ne pas utiliser le beforeEach global
    cy.visit('/');
    cy.waitForAppReady();
    cy.navigateToSection('analyses');
    cy.get('#analysisContainer').contains('p', 'Veuillez sélectionner un projet pour visualiser les analyses.').should('be.visible');
  });

  // --- Scénarios d'erreur (basiques, car les mocks backend sont complexes en E2E) ---
  it('Devrait afficher une erreur si une analyse est lancée sans projet sélectionné', () => {
    // Test autonome : ne pas utiliser le beforeEach global
    cy.visit('/');
    cy.waitForAppReady();
    cy.navigateToSection('analyses');

    // Tenter de lancer une analyse ATN
    cy.get('.analysis-card').contains('h4', 'Analyse ATN Multipartite').parents('.analysis-card').within(() => {
      cy.get('[data-action="run-atn-analysis"]').click({ force: true });
    });
    cy.waitForToast('warning', 'Veuillez sélectionner un projet en premier.');
  });

  it('Devrait permettre de supprimer une analyse', () => {
    // Lancer une analyse pour avoir quelque chose à supprimer
    cy.get('.analysis-card').contains('h4', 'Analyse ATN Multipartite').parents('.analysis-card').within(() => {
      cy.get('[data-action="run-atn-analysis"]').click({ force: true });
    });
    cy.waitForToast('success', 'Analyse ATN lancée');

    // Cliquer sur le bouton de suppression de l'analyse ATN
    cy.get('.analysis-card').contains('h4', 'Analyse ATN Multipartite').parents('.analysis-card').within(() => {
      cy.get('[data-action="delete-analysis"][data-analysis-type="atn_scores"]').click({ force: true });
    });

    // Confirmer la suppression (Cypress gère les alertes/confirms natifs)
    cy.on('window:confirm', (str) => {
      expect(str).to.include(`Êtes-vous sûr de vouloir supprimer les résultats de l'analyse atn_scores`);
      return true;
    });

    cy.waitForToast('success', `Résultats de l'analyse atn_scores supprimés avec succès.`);
    cy.get('.analysis-card').contains('h4', 'Analyse ATN Multipartite').parents('.analysis-card').find('[data-action="run-atn-analysis"]').should('be.visible');
  });
});