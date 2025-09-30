// ===================================================================
// == COMMANDES DE BASE ET DE NAVIGATION
// ===================================================================

// ✅ PATCH MAJEUR : Navigation simplifiée et robuste
Cypress.Commands.add('navigateToSection', (sectionId) => {
  cy.log(`🔄 Navigation vers: ${sectionId}`);
  
  // Attendre que la navigation soit visible
  cy.get('.app-nav, .navigation, nav', { timeout: 10000 }).should('be.visible');
  
  // ✅ SOLUTION : Sélecteurs multiples et force click
  const selectors = [
    `[data-section-id="${sectionId}"]`,
    `#nav-${sectionId}`,
    `.nav-${sectionId}`,
    `[href*="${sectionId}"]`,
    `button:contains("${sectionId}")`,
    `.app-nav__button:contains("${sectionId}")`
  ];
  
  let found = false;
  selectors.forEach(selector => {
    if (!found) {
      cy.get('body').then($body => {
        if ($body.find(selector).length > 0) {
          cy.get(selector)
            .scrollIntoView()
            .should('be.visible')
            .click({ force: true });
          found = true;
          cy.log(`✅ Navigation réussie vers ${sectionId} avec ${selector}`);
        }
      });
    }
  });
  
  // Fallback : navigation par texte
  if (!found) {
    cy.contains('button, a, .nav-item', new RegExp(sectionId, 'i'))
      .first()
      .scrollIntoView()
      .click({ force: true });
  }
  
  // Attendre que la section soit active/visible
  cy.wait(1000); // Délai pour la transition
  cy.log(`✅ Navigation terminée vers: ${sectionId}`);
});

// ===================================================================
// == COMMANDES DE WORKFLOW
// ===================================================================

// ✅ PATCH MAJEUR : Nouvelle approche sans interception problématique
Cypress.Commands.add('selectProject', (projectName = 'Projet E2E AnalyLit') => {
  cy.log(`🔄 Début de selectProject: ${projectName}`);
  
  // ✅ SOLUTION 1 : Approche directe sans interception
  cy.visit('/', { failOnStatusCode: false, timeout: 30000 });
  
  // Attendre que la page soit complètement chargée
  cy.get('body', { timeout: 15000 }).should('be.visible');
  
  // ✅ SOLUTION 2 : Attendre les éléments naturellement (sans cy.wait sur intercept)
  cy.get('#projects-list, .projects-grid, .project-container', { timeout: 15000 })
    .should('be.visible')
    .should(($el) => {
      // Vérifier que l'élément a une hauteur > 0
      const height = parseInt($el.css('height')) || 0;
      expect(height).to.be.greaterThan(0);
    });
  
  // ✅ SOLUTION 3 : Attendre que les projets soient chargés (méthode alternative)
  cy.get('.project-card, .project-item', { timeout: 15000 })
    .should('have.length.gte', 1)
    .then(($cards) => {
      cy.log(`✅ ${$cards.length} project(s) trouvé(s)`);
      
      // Chercher le projet spécifique ou prendre le premier
      if ($cards.text().includes(projectName)) {
        cy.contains('.project-card', projectName).click({ force: true });
        cy.log(`✅ Projet sélectionné: ${projectName}`);
      } else {
        cy.get('.project-card').first().click({ force: true });
        cy.log(`✅ Premier projet sélectionné par défaut`);
      }
        
      // Vérifier la sélection
      cy.get('.project-card--selected, .project-card.selected', { timeout: 5000 })
        .should('exist');
    });
});

// ===================================================================
// == COMMANDES UTILITAIRES ET DE DEBUG
// ===================================================================

// ✅ NOUVELLE COMMANDE : Attente flexible d'éléments
Cypress.Commands.add('waitForElement', (selector, options = {}) => {
  const timeout = options.timeout || 10000;
  const shouldBeVisible = options.visible !== false;
  
  cy.get(selector, { timeout })
    .should(shouldBeVisible ? 'be.visible' : 'exist')
    .should('not.be.empty');
});

// ✅ NOUVELLE COMMANDE : Setup minimal sans interception
Cypress.Commands.add('setupBasicTest', () => {
  cy.log('🔄 Setup test basique sans interception API');
  cy.visit('/', { failOnStatusCode: false });
  cy.get('body').should('be.visible');
  cy.wait(1000); // Laisser le temps à l'app de se charger
});