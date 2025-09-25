describe('Workflow de Gestion des Analyses', () => {
  beforeEach(() => {
    cy.visit('/');
    // S'assurer qu'un projet est sélectionné avant de naviguer vers les analyses
    // Nous allons créer un projet si aucun n'existe pour garantir un état de base
    cy.get('[data-section-id="projects"]').click({ force: true });
    cy.get('body').then(($body) => {
      if ($body.find('.project-card').length === 0) {
        cy.get('[data-action="create-project-modal"]').click({ force: true });
        cy.get('#projectName').type('Projet pour Analyses E2E');
        cy.get('#projectDescription').type("Description du projet pour les tests d'analyses");
        cy.get('#projectAnalysisMode').select('screening');
        cy.get('form[data-form="create-project"]').submit();
        cy.wait(1000);
        cy.contains('.toast--success', 'Projet créé avec succès').should('be.visible');
      }
    });
    cy.get('.project-card').first().click({ force: true }); // Sélectionne le premier projet disponible
    
    // Naviguer vers la section Analyses
    cy.get('[data-section-id="analyses"]').click({ force: true });
    cy.get('#analysisContainer').should('be.visible');
  });

  it("Devrait afficher la section des analyses et les cartes d'analyse", () => {
    cy.contains('h2', 'Analyses du Projet').should('be.visible');
    cy.get('.analysis-grid').should('be.visible');
    cy.get('.analysis-card').should('have.length.at.least', 4); // Au moins ATN, Discussion, Graphe, PRISMA
  });

  it("Devrait lancer l'Analyse ATN Multipartite", () => {
    cy.get('.analysis-card').contains('h4', 'Analyse ATN Multipartite').parents('.analysis-card').within(() => {
      cy.get('[data-action="run-atn-analysis"]').click();
    });
    cy.contains('.toast--success', 'Analyse ATN lancée').should('be.visible');
    // Vérifier l'état de chargement de la carte
    cy.get('.analysis-card').contains('h4', 'Analyse ATN Multipartite').parents('.analysis-card').should('have.class', 'analysis-card--loading');
  });

  it('Devrait lancer une Discussion académique', () => {
    cy.get('.analysis-card').contains('h4', 'Discussion académique').parents('.analysis-card').within(() => {
      cy.get('[data-action="run-analysis"][data-analysis-type="discussion"]').click();
    });
    cy.contains('.toast--success', 'Tâche de génération du brouillon de discussion lancée').should('be.visible');
    cy.get('.analysis-card').contains('h4', 'Discussion académique').parents('.analysis-card').should('have.class', 'analysis-card--loading');
  });

  it('Devrait lancer un Graphe de connaissances', () => {
    cy.get('.analysis-card').contains('h4', 'Graphe de connaissances').parents('.analysis-card').within(() => {
      cy.get('[data-action="run-analysis"][data-analysis-type="knowledge_graph"]').click();
    });
    cy.contains('.toast--success', 'Tâche de génération du graphe de connaissances lancée').should('be.visible');
    cy.get('.analysis-card').contains('h4', 'Graphe de connaissances').parents('.analysis-card').should('have.class', 'analysis-card--loading');
  });

  it(`Devrait afficher les résultats d'une analyse terminée (si disponible)`, () => {
    // Ce test est difficile à rendre fiable sans un backend qui renvoie des analyses terminées
    // ou un moyen de mocker cet état. Pour l'instant, nous allons vérifier le bouton
    // et la présence du conteneur de résultats si le bouton est cliquable.

    // Nous allons chercher une carte d'analyse qui est marquée comme 'done'
    cy.get('.analysis-card--done').first().then(($card) => {
      if ($card.length > 0) {
        cy.wrap($card).find('[data-action="view-analysis-results"]').click();
        // Vérifier que le conteneur de résultats correspondant est visible
        const targetId = $card.find('[data-action="view-analysis-results"]').attr('data-target-id');
        cy.get(`#${targetId}`).should('be.visible');
      } else {
        cy.log('Aucune analyse terminée trouvée pour visualiser les résultats. Ce test est conditionnel.');
      }
    });
  });

  it('Devrait interagir avec la modale PRISMA', () => {
    cy.get('[data-action="show-prisma-modal"]').click();
    cy.get('#prismaModal').should('be.visible');
    cy.contains('h2', 'Checklist PRISMA').should('be.visible');

    // Interagir avec les éléments de la checklist
    cy.get('.prisma-item').first().within(() => {
      cy.get('input[type="checkbox"]').check();
      cy.get('textarea').type(`Notes de test pour l'élément PRISMA.`);
    });

    // Sauvegarder la progression PRISMA
    cy.get('[data-action="save-prisma-progress"]').click();
    cy.contains('.toast--success', 'Checklist PRISMA sauvegardée').should('be.visible');

    // Exporter le rapport PRISMA
    cy.get('[data-action="export-prisma-report"]').click();
    cy.contains('.toast--info', 'Exportation PRISMA non implémentée').should('be.visible'); // Message d'info attendu

    cy.get('[data-action="close-modal"]').click();
    cy.get('#prismaModal').should('not.exist');
  });

  it(`Devrait ouvrir la modale d'analyses avancées et lancer diverses analyses`, () => {
    cy.get('[data-action="show-advanced-analysis-modal"]').click();
    cy.get('.modal-content').should('be.visible');
    cy.contains('h2', 'Lancer une Analyse Avancée').should('be.visible');

    // Lancer une Méta-analyse
    cy.get('.analysis-option[data-analysis-type="meta_analysis"]').click();
    cy.contains('.toast--success', 'Tâche de méta-analyse lancée').should('be.visible');
    cy.get('.modal-content').should('not.exist'); // La modale devrait se fermer

    // Réouvrir la modale pour les autres tests
    cy.get('[data-action="show-advanced-analysis-modal"]').click();
    cy.get('.modal-content').should('be.visible');

    // Lancer un Diagramme PRISMA
    cy.get('.analysis-option[data-analysis-type="prisma_flow"]').click();
    cy.contains('.toast--success', 'Tâche de génération du diagramme PRISMA lancée').should('be.visible');
    cy.get('.modal-content').should('not.exist');

    // Réouvrir la modale pour les autres tests
    cy.get('[data-action="show-advanced-analysis-modal"]').click();
    cy.get('.modal-content').should('be.visible');

    // Lancer des Statistiques Descriptives
    cy.get('.analysis-option[data-analysis-type="descriptive_stats"]').click();
    cy.contains('.toast--success', 'Tâche de statistiques descriptives lancée').should('be.visible');
    cy.get('.modal-content').should('not.exist');
  });

  it(`Devrait permettre d'exporter les analyses`, () => {
    cy.get('[data-action="export-analyses"]').click();
    cy.contains('.toast--info', `Préparation de l'exportation des analyses...`).should('be.visible');
    // On ne peut pas tester le téléchargement de fichier directement avec Cypress sans plugins spécifiques
    // Mais on peut vérifier que l'action est déclenchée et la notification affichée.
  });

  it(`Devrait gérer l'état vide si aucun projet n'est sélectionné`, () => {
    // Désélectionner le projet actuel ou naviguer sans projet sélectionné
    // Pour simuler cela, nous allons recharger la page et ne pas sélectionner de projet.
    cy.visit('/');
    cy.get('[data-section-id="analyses"]').click();
    cy.get('#analysisContainer').should('be.visible');
    cy.get('#analysisContainer').contains('p', 'Veuillez sélectionner un projet pour visualiser les analyses.').should('be.visible');
  });

  // --- Scénarios d'erreur (basiques, car les mocks backend sont complexes en E2E) ---
  it('Devrait afficher une erreur si une analyse est lancée sans projet sélectionné', () => {
    // Simuler l'absence de projet sélectionné en rechargeant la page et en ne sélectionnant pas de projet.
    cy.visit('/');
    cy.get('[data-section-id="analyses"]').click();
    cy.get('#analysisContainer').should('be.visible');

    // Tenter de lancer une analyse ATN
    cy.get('.analysis-card').contains('h4', 'Analyse ATN Multipartite').parents('.analysis-card').within(() => {
      cy.get('[data-action="run-atn-analysis"]').click();
    });
    cy.contains('.toast--warning', 'Veuillez sélectionner un projet en premier.').should('be.visible');
  });

  it('Devrait permettre de supprimer une analyse', () => {
    // Lancer une analyse pour avoir quelque chose à supprimer
    cy.get('.analysis-card').contains('h4', 'Analyse ATN Multipartite').parents('.analysis-card').within(() => {
      cy.get('[data-action="run-atn-analysis"]').click();
    });
    cy.contains('.toast--success', 'Analyse ATN lancée').should('be.visible');

    // Cliquer sur le bouton de suppression de l'analyse ATN
    cy.get('.analysis-card').contains('h4', 'Analyse ATN Multipartite').parents('.analysis-card').within(() => {
      cy.get('[data-action="delete-analysis"][data-analysis-type="atn_scores"]').click();
    });

    // Confirmer la suppression (Cypress gère les alertes/confirms natifs)
    cy.on('window:confirm', (str) => {
      expect(str).to.include(`Êtes-vous sûr de vouloir supprimer les résultats de l'analyse atn_scores`);
      return true; // Confirmer l'action
    });

    cy.contains('.toast--success', `Résultats de l'analyse atn_scores supprimés avec succès.`).should('be.visible');
    // Vérifier que la carte d'analyse ATN n'est plus marquée comme 'done' ou que le bouton est revenu à 'Lancer'
    cy.get('.analysis-card').contains('h4', 'Analyse ATN Multipartite').parents('.analysis-card').find('[data-action="run-atn-analysis"]').should('be.visible');
  });
});