// ===================================================================
// == ANALYLIT V4.1 - COMMANDES CYPRESS PERSONNALISÉES ==
// ===================================================================

// ===============================================
// == COMMANDES D'INTERACTION INTELLIGENTES ==
// ===============================================
 
// Clic avec retry automatique
Cypress.Commands.add('smartClick', (selector, options = {}) => {
  // Amélioration : Utilise les assertions intégrées de Cypress pour la robustesse
  // et force le clic pour gérer les cas de chevauchement.
  cy.get(selector, { timeout: 8000 })
    .should('exist') // D'abord, s'assurer que l'élément est dans le DOM
    .scrollIntoView() // S'assurer qu'il est dans la vue
    .click({ force: true, ...options }); // Forcer le clic pour éviter les erreurs de "détachement" ou de couverture
});

// Attente intelligente des boutons avant de cliquer
Cypress.Commands.add('waitForButtonAndClick', (selector) => {
  cy.get(selector, { timeout: 10000 })
    .should('exist')
    .and('not.be.disabled')
    .click({ force: true }); // force:true pour gérer les cas où il serait couvert
});

// ===============================================
// == COMMANDES DE NAVIGATION ==
// ===============================================

// Navigation vers une section avec attente
Cypress.Commands.add('navigateToSection', (sectionName) => {
  // Utilisation de smartClick pour une interaction plus robuste
  cy.smartClick(`[data-section-id="${sectionName}"]`);
  
  cy.get(`#${sectionName}`, { timeout: 8000 })
    .should('be.visible'); // 'be.visible' vérifie déjà la propriété 'display', la seconde partie est redondante.
})

// Attendre que l'application soit prête
Cypress.Commands.add('waitForAppReady', () => {
  // Attendre les éléments de base
  cy.get('body', { timeout: 10000 }).should('be.visible')
  cy.get('.app-header', { timeout: 8000 }).should('be.visible')
  cy.get('.app-nav', { timeout: 8000 }).should('be.visible')

  // Optimisation : Attendre que le contenu principal (liste de projets ou état vide) soit chargé,
  // ce qui est plus fiable qu'une attente statique ou une simple vérification de visibilité.
  cy.get('.app-content', { timeout: 15000 }).within(() => {
    cy.get('.project-list-container, .empty-state').should('exist');
  });
})

// ===============================================
// == COMMANDES DE PROJET ==
// ===============================================

// Créer un projet de test
Cypress.Commands.add('createTestProject', (projectName = 'Projet Test Cypress') => {
  cy.smartClick('[data-action="create-project"]');
  
  cy.get('#newProjectModal', { timeout: 5000 })
    .should('be.visible')
    .and('have.class', 'modal--show')
  
  cy.get('#projectName')
    .clear()
    .type(projectName, { force: true });
  
  cy.smartClick('[data-action="submit-project"]');
  
  // Attendre que la modale se ferme
  cy.get('#newProjectModal', { timeout: 5000 })
    .should('not.have.class', 'modal--show')
  
  // Attendre l'apparition du projet
  cy.contains('.project-card', projectName, { timeout: 8000 })
    .should('be.visible')
})

// Sélectionner un projet existant
Cypress.Commands.add('selectProject', (projectName) => {
  cy.contains('.project-card', projectName, { timeout: 8000 }).smartClick();
  
  // Attendre que le projet soit marqué comme sélectionné
  cy.contains('.project-card', projectName)
    .should('have.class', 'project-card--active')
})

// ===============================================
// == COMMANDES DE MODAL ==
// ===============================================

// Ouvrir une modale
Cypress.Commands.add('openModal', (triggerSelector, modalSelector) => {
  cy.smartClick(triggerSelector);
  
  cy.get(modalSelector, { timeout: 5000 })
    .should('be.visible')
    .and('have.class', 'modal--show')
})

// Fermer une modale
Cypress.Commands.add('closeModal', (modalSelector) => {
  cy.get(modalSelector)
    .should('be.visible')
    .within(() => {
      cy.get('.modal__close, [data-action="close"], .btn-cancel')
        .first().smartClick();
    })
  
  cy.get(modalSelector, { timeout: 3000 })
    .should('not.have.class', 'modal--show')
})

// ===============================================
// == COMMANDES DE DEBUGGING ==
// ===============================================

// Débugger un élément
Cypress.Commands.add('debugElement', (selector) => {
  cy.get(selector).then(($el) => {
    console.log('🔍 Element debug:', {
      selector: selector,
      exists: $el.length > 0,
      visible: $el.is(':visible'),
      display: $el.css('display'),
      visibility: $el.css('visibility'),
      opacity: $el.css('opacity'),
      classes: $el.attr('class')
    })
  })
})

// Attendre qu'un élément soit vraiment prêt
Cypress.Commands.add('waitForElement', (selector, options = {}) => {
  const timeout = options.timeout || 8000
  const shouldBeVisible = options.visible !== false
  
  cy.get(selector, { timeout })
    .should('exist')
  
  if (shouldBeVisible) {
    cy.get(selector)
      .should('be.visible');
  }
})

// ===============================================
// == COMMANDES DE TOAST ==
// ===============================================

// Attendre l'apparition d'un toast
Cypress.Commands.add('waitForToast', (type = '', message = '') => {
  if (type && message) {
    cy.get(`.toast--${type}`, { timeout: 8000 })
      .should('contain.text', message)
  } else if (type) {
    cy.get(`.toast--${type}`, { timeout: 8000 })
      .should('be.visible')
  } else {
    cy.get('.toast', { timeout: 8000 })
      .should('be.visible')
  }
})