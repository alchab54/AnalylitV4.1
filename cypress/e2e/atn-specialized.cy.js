describe('Analyses ATN Spécialisées', () => {
    beforeEach(() => {
        cy.visit('http://localhost:8080');
        cy.wait(2000);
        
        // Sélectionner un projet (assume qu'il existe)
        cy.get('#projects-list .project-card').first().click();
        cy.wait(1000);
        
        // Naviguer vers la section ATN
        cy.get('[data-section="atn-analysis"]').click();
        cy.get('#atn-analysis').should('be.visible');
    });

    it('devrait afficher l\'interface ATN complète', () => {
        // Vérifier header ATN
        cy.get('.atn-header h2').should('contain', 'Analyses ATN Spécialisées');
        cy.get('.atn-subtitle').should('contain', 'Première plateforme mondiale');

        // Vérifier navigation ATN
        cy.get('.atn-tab').should('have.length', 4);
        cy.get('.atn-tab[data-tab="extraction"]').should('contain', 'Extraction ATN');
        cy.get('.atn-tab[data-tab="empathy"]').should('contain', 'Empathie IA vs Humain');
        cy.get('.atn-tab[data-tab="analysis"]').should('contain', 'Analyses Multipartites');
        cy.get('.atn-tab[data-tab="reports"]').should('contain', 'Rapports ATN');
    });

    it('devrait permettre de charger les articles ATN', () => {
        // Cliquer sur charger articles
        cy.get('button').contains('Charger Articles').click();
        
        // Vérifier le message de progression
        cy.get('.progress-info').should('be.visible');
        
        // Simuler des articles chargés (si données de test disponibles)
        cy.get('.atn-articles-grid', { timeout: 10000 }).should('exist');
    });

    it('devrait afficher les 29 champs ATN spécialisés', () => {
        // Vérifier les catégories de champs
        cy.get('.field-category').should('have.length.gte', 7);
        
        // Vérifier quelques champs spécifiques
        cy.get('[for="field-alliance_therapeutique_numerique"]').should('contain', 'Alliance Thérapeutique Numérique');
        cy.get('[for="field-empathie_ia_detectee"]').should('contain', 'Empathie IA Détectée');
        cy.get('[for="field-efficacite_clinique_atn"]').should('contain', 'Efficacité Clinique ATN');
    });

    it('devrait switcher entre les onglets ATN', () => {
        // Test navigation onglets
        cy.get('.atn-tab[data-tab="empathy"]').click();
        cy.get('#atn-empathy').should('have.class', 'active');
        cy.get('.empathy-placeholder').should('be.visible');

        cy.get('.atn-tab[data-tab="analysis"]').click();
        cy.get('#atn-analysis').should('have.class', 'active');
        cy.get('.analysis-types').should('be.visible');

        cy.get('.atn-tab[data-tab="reports"]').click();
        cy.get('#atn-reports').should('have.class', 'active');
        cy.get('.report-templates').should('be.visible');
    });

    it('devrait pouvoir lancer une analyse empathie', () => {
        // Aller à l'onglet empathie
        cy.get('.atn-tab[data-tab="empathy"]').click();
        
        // Cliquer sur analyser empathie
        cy.get('button').contains('Analyser Empathie').click();
        
        // Vérifier le message d'analyse en cours
        cy.get('.analyzing').should('contain', 'Analyse de l\'empathie en cours');
    });

    it('devrait pouvoir générer des rapports ATN', () => {
        // Aller à l'onglet rapports
        cy.get('.atn-tab[data-tab="reports"]').click();
        
        // Vérifier les boutons de génération
        cy.get('button').contains('Générer Rapport').should('be.visible');
        cy.get('button').contains('Générer Focus').should('be.visible');
        cy.get('button').contains('Export Publication').should('be.visible');
        cy.get('button').contains('Générer Guide').should('be.visible');
    });
});

describe('Risk of Bias Cochrane', () => {
    beforeEach(() => {
        cy.visit('http://localhost:8080');
        cy.wait(2000);
        
        // Sélectionner un projet
        cy.get('#projects-list .project-card').first().click();
        cy.wait(1000);
        
        // Naviguer vers Risk of Bias
        cy.get('[data-action="show-section"][data-section-id="rob"]').click();
        cy.get('#rob').should('be.visible');
    });

    it('devrait afficher l\'interface RoB Cochrane', () => {
        // Vérifier header RoB
        cy.get('.rob-header h2').should('contain', 'Évaluation du Risque de Biais');
        cy.get('.rob-subtitle').should('contain', 'Cochrane Risk of Bias Tool');

        // Vérifier navigation RoB
        cy.get('.rob-tab').should('have.length', 4);
        cy.get('.rob-tab[data-tab="assessment"]').should('contain', 'Évaluation');
        cy.get('.rob-tab[data-tab="summary"]').should('contain', 'Synthèse');
        cy.get('.rob-tab[data-tab="visualization"]').should('contain', 'Visualisation');
        cy.get('.rob-tab[data-tab="export"]').should('contain', 'Export');
    });

    it('devrait pouvoir charger les articles pour évaluation RoB', () => {
        // Cliquer sur charger articles
        cy.get('button').contains('Charger Articles').click();
        
        // Vérifier la liste des articles (si disponibles)
        cy.get('.articles-list', { timeout: 10000 }).should('exist');
    });

    it('devrait afficher les 7 domaines Cochrane', () => {
        // Charger un article d\'abord
        cy.get('button').contains('Charger Articles').click();
        cy.wait(2000);
        
        // Supposer qu\'un article est disponible et cliquer évaluer
        cy.get('button').contains('Évaluer').first().click();
        
        // Vérifier les 7 domaines RoB
        cy.get('.rob-domain').should('have.length', 7);
        
        // Vérifier quelques domaines spécifiques
        cy.get('.domain-header h5')
          .should('contain', 'Génération de la séquence aléatoire');
        cy.get('.domain-header h5')
          .should('contain', 'Dissimulation de l\'allocation');
        cy.get('.domain-header h5')
          .should('contain', 'Aveuglement des participants');
    });

    it('devrait permettre d\'évaluer le risque pour chaque domaine', () => {
        // Simuler une évaluation
        cy.get('button').contains('Charger Articles').click();
        cy.wait(2000);
        cy.get('button').contains('Évaluer').first().click();
        
        // Sélectionner "Faible risque" pour le premier domaine
        cy.get('.risk-option.risk-low input[type="radio"]').first().click();
        
        // Ajouter une justification
        cy.get('.domain-notes textarea').first()
          .type('Randomisation appropriée avec générateur de nombres aléatoires');
        
        // Sauvegarder
        cy.get('button').contains('Sauvegarder').click();
        
        // Vérifier le message de confirmation
        cy.on('window:alert', (alertText) => {
            expect(alertText).to.contains('Évaluation RoB sauvegardée');
        });
    });

    it('devrait pouvoir générer des visualisations RoB', () => {
        // Aller à l\'onglet visualisation
        cy.get('.rob-tab[data-tab="visualization"]').click();
        
        // Vérifier les boutons de génération
        cy.get('button').contains('Traffic Light Plot').should('be.visible');
        cy.get('button').contains('Summary Plot').should('be.visible');
        cy.get('button').contains('Heatmap').should('be.visible');
    });

    it('devrait proposer différents formats d\'export', () => {
        // Aller à l\'onglet export
        cy.get('.rob-tab[data-tab="export"]').click();
        
        // Vérifier les options d\'export
        cy.get('.export-card').should('have.length', 4);
        cy.get('button').contains('Exporter CSV').should('be.visible');
        cy.get('button').contains('Exporter Figures').should('be.visible');
        cy.get('button').contains('Exporter Rapport').should('be.visible');
        cy.get('button').contains('Exporter RevMan').should('be.visible');
    });
});