// ===================================================================
// COMMANDES CYPRESS RENFORCÉES - AnalyLit v4.1
// ===================================================================

// ✅ ATTENTE ROBUSTE de l'application
Cypress.Commands.add('waitForAppReady', () => {
  // ✅ CORRECTION CRITIQUE: Intercepter la requête AVANT de visiter la page.
  // Cela garantit que Cypress "écoute" au moment où l'application fait l'appel.
  cy.intercept('GET', '/api/projects/').as('getProjects');

  // Visiter la page de test dédiée. L'application va se charger et déclencher l'appel.
  cy.visit('/cypress-support.html');

  // Attendre que la requête interceptée soit terminée.
  // On augmente le timeout pour laisser le temps au serveur de répondre.
  cy.wait('@getProjects', { timeout: 15000 });
  
  // Pause finale pour stabilité
  cy.wait(2000);
  
  console.log('✅ App complètement prête');
});

// ✅ NAVIGATION RENFORCÉE
Cypress.Commands.add('navigateToSection', (sectionName) => {
  // 1. Cliquer sur le bouton avec retry
  cy.get(`[data-section-id="${sectionName}"]`, { timeout: 15000 })
    .should('exist')
    .and('be.visible')
    .click({ force: true });
  
  // 2. Attendre que la section soit active
  cy.get(`#${sectionName}`, { timeout: 10000 })
    .should('exist')
    .and('have.class', 'active')
    .and('be.visible');
    
  // 3. Vérification finale avec retry
  cy.get(`#${sectionName}`).should('not.have.css', 'display', 'none');
  
  console.log(`✅ Navigation vers ${sectionName} réussie`);
});

// ✅ CRÉATION PROJET ULTRA-ROBUSTE
Cypress.Commands.add('createTestProject', (projectName = 'Projet Test Cypress') => {
  // 1. Assurer qu'on est dans projets
  cy.navigateToSection('projects');
  
  // 2. Cliquer création avec attente
  cy.get('#create-project-btn', { timeout: 10000 })
    .should('be.visible')
    .and('not.be.disabled')
    .click({ force: true });
  
  // 3. Attendre modale visible
  cy.get('#newProjectModal', { timeout: 10000 })
    .should('be.visible')
    .and('have.class', 'modal--show');
  
  // 4. Remplir formulaire avec retry
  cy.get('#projectName', { timeout: 8000 })
    .should('be.visible')
    .clear({ force: true })
    .type(projectName, { force: true, delay: 50 });
  
  // 5. Soumettre avec interception API
  cy.intercept('POST', '/api/projects/').as('createProject');
  cy.get('#createProjectForm button[type="submit"]').click({ force: true });
  
  // 6. Attendre réponse API
  cy.wait('@createProject', { timeout: 20000 }).its('response.statusCode').should('eq', 201);
  
  // 7. Attendre fermeture modale
  cy.get('#newProjectModal', { timeout: 8000 }).should('not.be.visible');
  
  // ✅ CORRECTION ROBUSTE: Attendre que la liste des projets se recharge après la création.
  // On intercepte la requête GET qui suit la création du projet.
  cy.wait('@getProjects', { timeout: 15000 });

  // 8. Vérifier projet créé
  // On augmente le timeout ici pour laisser le temps au DOM de se mettre à jour.
  cy.contains('.project-card', projectName, { timeout: 15000 }).should('exist');
  
  console.log(`✅ Projet "${projectName}" créé avec succès`);
});

// ✅ SÉLECTION PROJET RENFORCÉE
Cypress.Commands.add('selectProject', (projectName) => {
  // 1. Navigation projets
  cy.navigateToSection('projects');
  
  // 2. Attendre le projet
  cy.contains('.project-card', projectName, { timeout: 15000 })
    .should('exist')
    .and('be.visible');
  
  // 3. Cliquer avec force
  cy.contains('.project-card', projectName).click({ force: true });
  
  // 4. Vérifier activation
  cy.contains('.project-card', projectName)
    .should('have.class', 'project-card--active');
    
  console.log(`✅ Projet "${projectName}" sélectionné`);
});

// ✅ ATTENTE TOAST AMÉLIORÉE
Cypress.Commands.add('waitForToast', (type, message) => {
  if (type && message) {
    cy.get('.toast', { timeout: 10000 })
      .should('be.visible')
      .and('contain.text', message);
  } else {
    cy.get('.toast', { timeout: 10000 }).should('be.visible');
  }
});

// ✅ DÉBOGAGE AVANCÉ
Cypress.Commands.add('debugUI', () => {
  cy.window().then((win) => {
    console.log('🔍 DEBUG UI STATE:');
    console.log('- App initialized:', win.AnalyLit ? 'YES' : 'NO');
    console.log('- Projects loaded:', win.AnalyLit?.appState?.projects?.length || 0);
    console.log('- Current section:', document.querySelector('.app-section.active')?.id);
    console.log('- Navigation buttons:', document.querySelectorAll('.app-nav__button').length);
    console.log('- Modals count:', document.querySelectorAll('.modal').length);
  });
});

// ✅ NETTOYAGE ENTRE TESTS
Cypress.Commands.add('resetApp', () => {
  // Fermer toutes modales
  cy.get('body').then($body => {
    // On vérifie si une modale est présente SANS faire échouer le test
    if ($body.find('.modal.modal--show').length) {
      // Si une modale est trouvée, on la ferme
      cy.get('.modal-close').click({ force: true, multiple: true });
      // On peut même attendre qu'elle disparaisse pour être sûr
      cy.get('.modal.modal--show').should('not.exist');
    }
  }); // Si aucune modale n'est trouvée, ce bloc est simplement ignoré.
  
  // Retour section projets
  cy.navigateToSection('projects');
  
  console.log('🧹 App réinitialisée pour prochain test');
});

// ✅ COMMANDE MANQUANTE : Ajout d'une commande générique pour ouvrir les modales.
// Cette commande est utilisée dans les tests mais n'était pas définie.
Cypress.Commands.add('openModal', (triggerSelector, modalSelector) => {
  // Cliquer sur l'élément qui déclenche l'ouverture de la modale
  cy.get(triggerSelector, { timeout: 10000 }).should('be.visible').click({ force: true });

  // Attendre que la modale soit visible
  cy.get(modalSelector, { timeout: 8000 })
    .should('be.visible')
    .and('have.class', 'modal--show');
  console.log(`✅ Modale ${modalSelector} ouverte avec succès`);
});