// ===================================================================
// == ANALYLIT V4.1 - COMMANDES CYPRESS PERSONNALISÉES ==
// ===================================================================

// ===============================================
// == COMMANDES DE NAVIGATION ==
// ===============================================

// Navigation vers une section avec attente
Cypress.Commands.add('navigateToSection', (sectionName) => {
  cy.get(`[data-section-id="${sectionName}"]`, { timeout: 8000 })
    .should('be.visible')
    .click({ force: true })
  
  cy.get(`#${sectionName}`, { timeout: 8000 })
    .should('be.visible')
    .and('not.have.css', 'display', 'none')
})

// Attendre que l'application soit prête
Cypress.Commands.add('waitForAppReady', () => {
  // Attendre les éléments de base
  cy.get('body', { timeout: 10000 }).should('be.visible')
  cy.get('.app-header', { timeout: 8000 }).should('be.visible')
  cy.get('.app-nav', { timeout: 8000 }).should('be.visible')
  
  // Attendre que les API soient chargées
  cy.get('.app-content', { timeout: 8000 }).should('be.visible')
  
  // Petite pause pour les WebSockets
  cy.wait(1000)
})

// ===============================================
// == COMMANDES DE PROJET ==
// ===============================================

// Créer un projet de test
Cypress.Commands.add('createTestProject', (projectName = 'Projet Test Cypress') => {
  cy.get('[data-action="create-project"]', { timeout: 8000 })
    .should('be.visible')
    .click({ force: true })
  
  cy.get('#newProjectModal', { timeout: 5000 })
    .should('be.visible')
    .and('have.class', 'modal--show')
  
  cy.get('#projectName')
    .should('be.visible')
    .clear()
    .type(projectName, { force: true })
  
  cy.get('[data-action="submit-project"]')
    .should('be.visible')
    .click({ force: true })
  
  // Attendre que la modale se ferme
  cy.get('#newProjectModal', { timeout: 5000 })
    .should('not.have.class', 'modal--show')
  
  // Attendre l'apparition du projet
  cy.contains('.project-card', projectName, { timeout: 8000 })
    .should('be.visible')
})

// Sélectionner un projet existant
Cypress.Commands.add('selectProject', (projectName) => {
  cy.contains('.project-card', projectName, { timeout: 8000 })
    .should('be.visible')
    .click({ force: true })
  
  // Attendre que le projet soit marqué comme sélectionné
  cy.contains('.project-card', projectName)
    .should('have.class', 'project-card--active')
})

// ===============================================
// == COMMANDES DE MODAL ==
// ===============================================

// Ouvrir une modale
Cypress.Commands.add('openModal', (triggerSelector, modalSelector) => {
  cy.get(triggerSelector, { timeout: 8000 })
    .should('be.visible')
    .click({ force: true })
  
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
        .first()
        .click({ force: true })
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

// Forcer un clic même si l'élément n'est pas visible
Cypress.Commands.add('forceClick', (selector) => {
  cy.get(selector, { timeout: 8000 })
    .click({ force: true })
})

// Attendre qu'un élément soit vraiment prêt
Cypress.Commands.add('waitForElement', (selector, options = {}) => {
  const timeout = options.timeout || 8000
  const shouldBeVisible = options.visible !== false
  
  cy.get(selector, { timeout })
    .should('exist')
  
  if (shouldBeVisible) {
    cy.get(selector)
      .should('be.visible')
      .and('not.have.css', 'display', 'none')
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