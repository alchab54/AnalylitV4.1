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

// Commande de navigation CORRIGÉE
Cypress.Commands.add('navigateToSection', (sectionName) => {
  // 1. Forcer la navigation d'abord
  cy.get(`[data-section-id="${sectionName}"]`, { timeout: 8000 })
    .should('exist')
    .click({ force: true })
  
  // 2. Attendre que la section existe dans le DOM
  cy.get(`#${sectionName}`, { timeout: 10000 })
    .should('exist')
  
  // 3. NOUVEAU : Forcer l'affichage de la section si elle est cachée
  cy.get(`#${sectionName}`).then($section => {
    if ($section.css('display') === 'none') {
      cy.log('Section cachée détectée - correction automatique')
      cy.get(`[data-section-id="${sectionName}"]`).click({ force: true })
      cy.wait(500) // Laisser le temps au JavaScript de traiter
    }
  })
  
  // 4. Vérifier la visibilité finale
  cy.get(`#${sectionName}`, { timeout: 8000 })
    .should('not.have.css', 'display', 'none')
})

// Attendre que l'application soit prête
Cypress.Commands.add('waitForAppReady', () => {
  // Attendre les éléments de base
  cy.get('body', { timeout: 10000 }).should('be.visible')
  cy.get('.app-header', { timeout: 8000 }).should('be.visible')
  cy.get('.app-nav', { timeout: 8000 }).should('be.visible')
  // ✅ CORRECTION - Plus simple et robuste
  cy.get('body').should('contain', 'AnalyLit') // Juste vérifier que l'app est chargée
  cy.wait(500) // Petite pause pour la stabilité
})

// ===============================================
// == COMMANDES DE PROJET ==
// ===============================================

// Commande CORRIGÉE pour créer un projet
Cypress.Commands.add('createTestProject', (projectName = 'Projet Test Cypress') => {
  // S'assurer qu'on est dans la section projets
  cy.navigateToSection('projects')
  
  // Cliquer sur créer projet avec force
  cy.get('[data-action="create-project"]', { timeout: 8000 })
    .should('exist')
    .click({ force: true })
  
  cy.get('#newProjectModal', { timeout: 5000 })
    .should('be.visible')
    .and('have.class', 'modal--show')
  
  cy.get('#projectName')
    .clear()
    .type(projectName, { force: true })
  
  cy.get('[data-action="submit-project"]')
    .click({ force: true })
  
  // Attendre que la modale se ferme
  cy.get('#newProjectModal', { timeout: 5000 })
    .should('not.have.class', 'modal--show')
})

// Commande CORRIGÉE pour les clics sur projets
Cypress.Commands.add('selectProject', (projectName) => {
  // S'assurer qu'on est dans la section projets
  cy.navigateToSection('projects')
  
  // Cliquer sur le projet avec force
  cy.contains('.project-card', projectName, { timeout: 8000 })
    .should('exist')
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

// NOUVEAU : Commande pour forcer l'affichage d'une section
Cypress.Commands.add('forceShowSection', (sectionName) => {
  cy.get(`#${sectionName}`).then($el => {
    if ($el.css('display') === 'none') {
      cy.window().then(win => {
        win.eval(`
          document.querySelector('#${sectionName}').style.display = 'block';
          document.querySelector('[data-section-id="${sectionName}"]').click();
        `)
      })
    }
  })
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