describe('Workflow de Gestion des Analyses - Version Optimisée avec Mocks API', () => {
  const projectName = 'Projet Analyses Test';

  beforeEach(() => {
    // ✅ Intercepter les appels API pour isoler les tests
    cy.setupMockAPI(); // Call this first
    cy.intercept('GET', '/api/projects/', { body: [{ id: 'test-project-123', name: projectName, description: 'Description de test', article_count: 0 }] }).as('getProjects');
    cy.intercept('POST', '/api/projects/', { fixture: 'test-project.json' }).as('createProject');
    cy.intercept('GET', '/api/projects/test-project-123', { fixture: 'test-project.json' }).as('getProjectDetails');
    cy.intercept('GET', '/api/projects/test-project-123/analyses', {
      body: {
        // Simuler une analyse terminée pour le test de visualisation
        atn_scores: { status: 'completed', result: { mean_score: 4.5 } }
      }
    }).as('getAnalyses');

    // Visiter l'application
    cy.visit('/', { timeout: 30000 });
    cy.waitForAppReady();

    // Créer et sélectionner le projet via les commandes robustes
    cy.createTestProject({ name: projectName });
    cy.selectProject(projectName);

    // Naviguer vers la section des analyses
    cy.navigateToSection('analyses');
  });

  it("Devrait afficher la section des analyses et les cartes d'analyse", () => {
    cy.contains('h2', 'Analyses du Projet').should('be.visible');
    cy.get('.analysis-grid').should('be.visible');
    cy.get('.analysis-card').should('have.length.at.least', 4); // Au moins ATN, Discussion, Graphe, PRISMA
  });

  it('Devrait lancer les analyses principales depuis leurs cartes respectives', () => {
    const mainAnalyses = [
      { type: 'atn_scores', cardTitle: 'Analyse ATN Multipartite', toastMessage: 'Analyse ATN lancée' },
      { type: 'discussion', cardTitle: 'Discussion académique', toastMessage: 'Tâche de génération du brouillon de discussion lancée' },
      { type: 'knowledge_graph', cardTitle: 'Graphe de connaissances', toastMessage: 'Tâche de génération du graphe de connaissances lancée' }
    ];

    mainAnalyses.forEach(analysis => {
      // Intercepter l'appel API pour cette analyse spécifique
      cy.intercept('POST', '/api/projects/*/run-analysis', { body: { job_id: `job-${analysis.type}` } }).as(`run-${analysis.type}`);

      // Lancer l'analyse depuis la carte
      cy.get('.analysis-card').contains('h4', analysis.cardTitle).parents('.analysis-card').as('targetCard').within(() => {
        cy.get('button').click({ force: true });
      });

      // Assert: Valider l'appel API et la notification
      cy.wait(`@run-${analysis.type}`).its('request.body.type').should('eq', analysis.type);
      cy.waitForToast('success', analysis.toastMessage);

      // Vérifier que la carte passe en état de chargement
      cy.wait(100); // Give UI time to update
      cy.get('@targetCard').should('have.class', 'analysis-card--loading');
    });
  });

  it('Devrait afficher les résultats d\'une analyse terminée', () => {
    // Grâce au mock dans beforeEach, la carte "terminée" doit exister
    cy.get('.analysis-card--done').should('be.visible').first().as('completedCard');

    // Act: Cliquer pour voir les résultats
    cy.get('@completedCard').find('[data-action="view-analysis-results"]').click({ force: true });

    // Assert: Vérifier que le conteneur de résultats est visible
    cy.get('#atn-results').should('be.visible').and('contain', 'Résultats Analyse ATN');
  });

  it('Devrait interagir avec la modale PRISMA', () => {
    // Intercepter la sauvegarde
    cy.intercept('POST', '/api/projects/*/prisma-checklist', { statusCode: 200, body: { message: 'OK' } }).as('savePrisma');

    // Act: Ouvrir la modale
    cy.get('[data-action="show-prisma-modal"]').click({ force: true });
    cy.get('#prismaModal').as('prismaModal').should('be.visible');
    cy.contains('h2', 'Checklist PRISMA').should('be.visible');

    // Act: Interagir avec la checklist
    cy.get('.prisma-item').first().within(() => {
      cy.get('input[type="checkbox"]').check({ force: true });
      cy.get('textarea').type(`Notes de test pour l'élément PRISMA.`, { force: true });
    });

    // Act & Assert: Sauvegarder et valider l'appel API
    cy.get('[data-action="save-prisma-progress"]').click({ force: true });
    cy.wait('@savePrisma');
    cy.waitForToast('success', 'Checklist PRISMA sauvegardée');

    // Act & Assert: Exporter et valider le toast (action client)
    cy.get('[data-action="export-prisma-report"]').click({ force: true });
    cy.waitForToast('success', 'Exportation de la checklist PRISMA terminée.');

    // Act & Assert: Fermer la modale
    cy.get('@prismaModal').find('.modal-close').click({ force: true });
    cy.get('@prismaModal').should('not.be.visible');
  });

  it("Devrait lancer des analyses depuis la modale d'analyses avancées", () => {
    const advancedAnalyses = [
      { type: 'meta_analysis', toastMessage: 'Tâche de méta-analyse lancée' },
      { type: 'prisma_flow', toastMessage: 'Tâche de diagramme PRISMA lancée' },
      { type: 'descriptive_stats', toastMessage: 'Tâche de statistiques descriptives lancée' }
    ];

    advancedAnalyses.forEach(analysis => {
      // Intercepter l'appel API
      cy.intercept('POST', '/api/projects/*/run-analysis', { body: { job_id: `job-${analysis.type}` } }).as(`run-advanced-${analysis.type}`);

      // Act: Ouvrir la modale
      cy.get('[data-action="show-advanced-analysis-modal"]').click({ force: true });
      cy.get('#advancedAnalysisModal').as('advancedModal').should('be.visible');

      // Act: Lancer l'analyse
      cy.get(`.analysis-option[data-analysis-type="${analysis.type}"]`).click({ force: true });
      
      // Assert: Valider l'appel, le toast et la fermeture de la modale
      cy.wait(`@run-advanced-${analysis.type}`).its('request.body.type').should('eq', analysis.type);
      cy.waitForToast('success', analysis.toastMessage);
      cy.get('@advancedModal').should('not.be.visible');
    });
  });

  it("Devrait déclencher l'exportation des analyses", () => {
    // L'exportation ouvre une nouvelle fenêtre, on vérifie juste le déclenchement
    cy.get('[data-action="export-analyses"]').click({ force: true });
    cy.waitForToast('info', `Préparation de l'exportation des analyses...`);
  });

  it("Devrait gérer l'état vide si aucun projet n'est sélectionné", () => {
    // Ce test est maintenant autonome et ne dépend plus du beforeEach
    cy.intercept('GET', '/api/projects/', { body: [] }).as('getEmptyProjects');
    cy.visit('/');
    cy.wait('@getEmptyProjects');

    // Cliquer manuellement sur la section sans utiliser la commande qui assert la visibilité
    cy.get('.app-nav__button[data-section-id="analyses"]').click();

    // L'assertion clé : le conteneur doit afficher le message pour l'état vide
    cy.get('#analysisContainer').should('contain.text', 'Veuillez sélectionner un projet pour visualiser les analyses.');
    
    // Vérifier que la section elle-même n'est pas nécessairement "visible" au sens de la commande,
    // mais que le bouton de nav est bien actif.
    cy.get('.app-nav__button[data-section-id="analyses"]').should('have.class', 'app-nav__button--active');
  });

  it('Devrait permettre de supprimer une analyse et de confirmer l\'appel API', () => {
    const analysisTypeToDelete = 'atn_scores';
    // Intercepter la requête DELETE
    cy.intercept('DELETE', `/api/projects/*/analyses/${analysisTypeToDelete}`, { statusCode: 200, body: { message: 'Deleted' } }).as('deleteAnalysis');

    // Simuler la confirmation de l'utilisateur
    cy.on('window:confirm', (str) => {
      expect(str).to.contain('supprimer les résultats de l\'analyse');
      return true;
    });

    // Cliquer sur le bouton de suppression de l'analyse terminée (mockée)
    cy.get('.analysis-card--done').find(`[data-action="delete-analysis"][data-analysis-type="${analysisTypeToDelete}"]`).click({ force: true });

    // Valider l'appel API et le toast de succès
    cy.wait('@deleteAnalysis').its('response.statusCode').should('eq', 200);
    cy.waitForToast('success', `Résultats de l'analyse ${analysisTypeToDelete} supprimés avec succès.`);
  });
});