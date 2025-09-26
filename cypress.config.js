// ===================================================================
// == ANALYLIT V4.1 - CONFIGURATION CYPRESS CORRIGÉE ==
// ===================================================================

import { defineConfig } from 'cypress';

export default defineConfig({
  // ===============================================
  // == TESTS E2E SEULEMENT (Désactiver Component) ==
  // ===============================================
  e2e: {
    // Configuration de base
    baseUrl: 'http://localhost:8080',
    viewportWidth: 1280,
    viewportHeight: 720,
    
    // Chemins des fichiers
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.js',
    fixturesFolder: 'cypress/fixtures',

    // Résultats et rapports
    screenshotsFolder: 'reports/cypress/screenshots',
    videosFolder: 'reports/cypress/videos',
    downloadsFolder: 'cypress/downloads',
    // Timeouts optimisés Ryzen 3700X
    defaultCommandTimeout: 15000,
    requestTimeout: 15000,
    responseTimeout: 15000,
    pageLoadTimeout: 30000,
    taskTimeout: 60000,
    
    // Options d'exécution
    video: false,
    screenshotOnRunFailure: true,
    trashAssetsBeforeRuns: true,
    watchForFileChanges: false,
    
    // Retries intelligents
    retries: {
      runMode: 2,
      openMode: 1
    },
    
    // Variables d'environnement
    env: {
      apiUrl: 'http://localhost:5000/api',
      coverage: false,
    },
    
    // Exclusions
    excludeSpecPattern: [
      '**/examples/*',
      '**/node_modules/*',
      '**/*.hot-update.js'
    ],
    
    // Configuration navigateur
    chromeWebSecurity: false,
    modifyObstructiveCode: false,
    
    setupNodeEvents(on, config) {
      // Tâches personnalisées
      on('task', { log(message) {
          console.log(message);
          return null;
        }
      });

      return config
    },
  },

  // ===============================================
  // == DÉSACTIVER COMPLÈTEMENT LES TESTS COMPONENT ==
  // ===============================================
  // ❌ PAS DE TESTS DE COMPOSANTS pour AnalyLit v4.1
  // Ceci résout l'erreur "supportFile component missing"
  
  // NE PAS inclure de section "component" du tout
  // Cypress ne cherchera plus de supportFile component
});