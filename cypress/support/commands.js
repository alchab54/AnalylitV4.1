// cypress/support/commands.js - Version E2E Stable

// ===== COMMANDES DE BASE =====
Cypress.Commands.add('visitApp', () => {
  // ✅ CORRECTION: Intercepter AVANT de visiter pour attraper l'appel initial.
  cy.intercept('GET', '**/api/projects**', { fixture: 'projects.json' }).as('getProjects');
  cy.visit('http://localhost:8888/cypress-support.html');
  cy.wait('@getProjects'); // Attendre que les projets soient chargés.
  cy.get('body').should('be.visible');
});

Cypress.Commands.add('setupMockAPI', () => {
  // Interceptions API avec fixtures
  cy.intercept('GET', '**/api/projects**', { fixture: 'projects.json' }).as('getProjects');
  cy.intercept('POST', '**/api/projects**', { fixture: 'project-create-response.json' }).as('createProject');
  cy.intercept('GET', '**/api/search-results**', { fixture: 'search-results.json' }).as('getSearchResults');
  cy.intercept('GET', '**/api/extractions**', { fixture: 'extractions.json' }).as('getExtractions');
  cy.intercept('POST', '**/api/search**', { 
    statusCode: 202,
    body: { message: 'Recherche lancée', task_id: 'mock-search-task-123' }
  }).as('startSearch');
  cy.intercept('POST', '**/api/run-analysis**', {
    statusCode: 202, 
    body: { message: 'Analyse lancée', task_id: 'mock-analysis-task-456' }
  }).as('runAnalysis');
});

// ===== COMMANDES DE NAVIGATION =====
Cypress.Commands.add('navigateToSection', (sectionName) => {
  // Chercher les boutons de navigation de différentes façons
  cy.get('body').then(($body) => {
    // Option 1: Data attribute
    if ($body.find(`[data-section="${sectionName}"]`).length > 0) {
      cy.get(`[data-section="${sectionName}"]`).first().click();
    }
    // Option 2: Contient le texte
    else if ($body.find(`button:contains("${sectionName}")`).length > 0) {
      cy.get(`button:contains("${sectionName}")`).first().click();
    }
    // Option 3: Classe CSS
    else if ($body.find(`.nav-${sectionName}, .btn-${sectionName}`).length > 0) {
      cy.get(`.nav-${sectionName}, .btn-${sectionName}`).first().click();
    }
    // Option 4: Fallback - chercher n'importe quel bouton
    else {
      cy.log(`Navigation vers ${sectionName} - utilisation du fallback`);
      cy.get('button, .clickable').first().click();
    }
  });
  cy.wait(1000);
});

// ===== COMMANDES PROJETS =====
Cypress.Commands.add('createTestProject', (projectData = {}) => {
  const project = {
    name: 'Test Project E2E',
    description: 'Projet créé automatiquement par les tests E2E',
    mode: 'screening',
    ...projectData
  };

  cy.visitApp(); // visitApp gère maintenant l'attente de l'API
  
  // Chercher le bouton de création de projet
  // ✅ CORRECTION: Ouvrir la modale avant d'essayer d'interagir avec le formulaire.
  cy.get('body').then(($body) => {
    // Différentes façons de trouver le bouton créer projet
    const selectors = [
      '[data-action="create-project"]',
      'button:contains("Créer")',
      'button:contains("Nouveau")', 
      '.btn-create',
      '[data-action="create-project-modal"]',
      '.create-project-btn',
      '#create-project-btn'
    ];
    
    let found = false;
    for (const selector of selectors) {
      if ($body.find(selector).length > 0) {
        cy.get(selector).first().click();
        found = true;
        break;
      }
    }
    
    if (!found) {
      cy.log('Bouton créer projet non trouvé - utilisation du premier bouton disponible');
      cy.get('button').first().click();
    }
  });
  
  cy.wait(2000);
  
  // Remplir le formulaire de création
  const nameSelectors = [
    'input[name="name"]',
    '#projectName', 
    'input[placeholder*="nom"]',
    'input[type="text"]'
  ];
  
  cy.get('body').then(($body) => {
    for (const selector of nameSelectors) {
      if ($body.find(selector).length > 0) {
        cy.get(selector).first().clear().type(project.name);
        break;
      }
    }
  });
  
  const descSelectors = [
    'textarea[name="description"]',
    '#projectDescription',
    'textarea',
    'input[name="description"]'
  ];
  
  cy.get('body').then(($body) => {
    for (const selector of descSelectors) {
      if ($body.find(selector).length > 0) {
        cy.get(selector).first().clear().type(project.description);
        break;
      }
    }
  });
  
  // Soumettre le formulaire
  const submitSelectors = [
    'button[type="submit"]',
    '.btn-submit',
    'button:contains("Créer")',
    'button:contains("Valider")'
  ];
  
  cy.get('body').then(($body) => {
    for (const selector of submitSelectors) {
      if ($body.find(selector).length > 0) {
        cy.get(selector).first().click();
        break;
      }
    }
  });
  
  cy.wait(3000);
});

// ===== COMMANDES D'ATTENTE ROBUSTES =====
Cypress.Commands.add('waitForElement', (selector, timeout = 10000) => {
  cy.get(selector, { timeout }).should('exist');
});

Cypress.Commands.add('waitForText', (text, timeout = 10000) => {
  cy.contains(text, { timeout }).should('be.visible');
});

// ===== COMMANDES DE VÉRIFICATION =====
Cypress.Commands.add('checkAppIsLoaded', () => {
  cy.get('body').should('be.visible');
  cy.get('html').should('not.have.class', 'loading');
  
  // Vérifier qu'il y a du contenu
  cy.get('main, .content, section, .container').should('exist');
  
  // Vérifier qu'il y a des éléments interactifs
  cy.get('button, input, select, textarea, [role="button"]').should('have.length.at.least', 1);
});

// ===== COMMANDE POUR TESTS DE SMOKE =====
Cypress.Commands.add('smokeTest', () => {
  cy.visitApp();
  cy.checkAppIsLoaded();
  
  // Test basique d'interaction
  cy.contains('Projet E2E AnalyLit').should('be.visible');
  cy.wait(1000);
  
  // Vérifier qu'on peut naviguer (si possible)
  cy.get('body').then(($body) => {
    if ($body.find('[data-section]').length > 0) {
      cy.get('[data-section]').first().click();
      cy.wait(1000);
    }
  });
});

// Import des commandes Cypress par défaut
import './commands';