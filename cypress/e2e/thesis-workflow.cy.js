describe('Workflow de Thèse ATN', () => {
    beforeEach(() => {
        cy.visit('http://localhost:8080');
        cy.wait(2000);
        
        // Créer ou sélectionner un projet de thèse
        cy.get('#create-project-btn').click();
        cy.get('#projectName').type('Thèse ATN Test');
        cy.get('#projectDescription').type('Projet de test pour workflow de thèse ATN');
        cy.get('button[type="submit"]').click();
        cy.wait(2000);
    });

    it('devrait permettre une recherche spécialisée ATN', () => {
        // Aller à la recherche
        cy.get('[data-action="show-section'][data-section-id="search"]').click();
        
        // Vérifier l'interface de recherche spécialisée
        cy.get('.thesis-search-header h3').should('contain', 'Recherche Bibliographique');
        cy.get('#thesis-search-query').should('be.visible');
        
        // Saisir une requête ATN
        cy.get('#thesis-search-query').type('alliance thérapeutique numérique empathie IA');
        
        // Vérifier les bases de données spécialisées
        cy.get('input[name="databases"][value="pubmed"]').should('be.checked');
        cy.get('input[name="databases"][value="crossref"]').should('be.checked');
        
        // Ajuster les paramètres
        cy.get('input[name="max_results"]').clear().type('50');
        
        // Lancer la recherche
        cy.get('button[type="submit"]').click();
        
        // Vérifier le message de progression
        cy.get('.search-status').should('contain', 'Lancement de la recherche');
    });

    it('devrait afficher les statistiques de validation PRISMA', () => {
        // Aller à la validation
        cy.get('[data-action="show-section"][data-section-id="validation"]').click();
        
        // Vérifier les statistiques PRISMA
        cy.get('.prisma-stats').should('be.visible');
        cy.get('.stat-card').should('have.length.gte', 4);
        
        // Vérifier les labels des statistiques
        cy.get('.stat-label').should('contain', 'Total Articles');
        cy.get('.stat-label').should('contain', 'Inclus');
        cy.get('.stat-label').should('contain', 'Exclus');
        cy.get('.stat-label').should('contain', 'Progression');
    });

    it('devrait pouvoir calculer le Kappa Cohen', () => {
        // Aller à la validation
        cy.get('[data-action="show-section"][data-section-id="validation"]').click();
        
        // Cliquer sur calculer Kappa
        cy.get('button').contains('Calculer Kappa Cohen').click();
        
        // Vérifier l'alerte de confirmation
        cy.on('window:alert', (alertText) => {
            expect(alertText).to.contains('Calcul Kappa Cohen lancé');
        });
    });

    it('devrait proposer tous les exports nécessaires pour la thèse', () => {
        // Aller aux analyses
        cy.get('[data-action="show-section"][data-section-id="analyses"]').click();
        
        // Vérifier la section d'export
        cy.get('.export-section').should('be.visible');
        cy.get('.export-buttons').should('be.visible');
        
        // Vérifier tous les boutons d'export
        cy.get('button').contains('Diagramme PRISMA').should('be.visible');
        cy.get('button').contains('Tableau de données').should('be.visible');
        cy.get('button').contains('Bibliographie').should('be.visible');
        cy.get('button').contains('Export complet thèse').should('be.visible');
        cy.get('button').contains('Rapport de thèse').should('be.visible');
    });

    it('devrait pouvoir générer un rapport de thèse', () => {
        // Aller aux analyses  
        cy.get('[data-action="show-section"][data-section-id="analyses"]').click();
        
        // Cliquer sur générer rapport de thèse
        cy.get('button').contains('Rapport de thèse').click();
        
        // Le fichier devrait être téléchargé automatiquement
        // (Cypress ne peut pas vérifier les téléchargements facilement, 
        // mais on peut vérifier que la fonction est appelée)
    });

    it('devrait permettre la gestion complète du checklist PRISMA', () => {
        // Ouvrir la modale PRISMA
        cy.get('[data-action="show-prisma-modal"]').click();
        
        // Vérifier la modale
        cy.get('#prismaModal').should('have.class', 'modal--show');
        cy.get('#prisma-checklist-content').should('be.visible');
        
        // Vérifier les éléments PRISMA
        cy.get('.prisma-item').should('have.length.gte', 15);
        
        // Cocher quelques éléments
        cy.get('.prisma-checkbox').first().click();
        cy.get('.prisma-notes').first().type('Titre conforme aux standards PRISMA-ScR');
        
        // Sauvegarder
        cy.get('button').contains('Sauvegarder').click();
        
        // Exporter
        cy.get('button').contains('Exporter').click();
    });
});
