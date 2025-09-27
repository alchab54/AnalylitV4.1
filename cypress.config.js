import { defineConfig } from 'cypress';

export default defineConfig({
  // Configuration globale
  projectId: 'tn6aw5', // Remplacez par votre ID de projet Cypress Dashboard

  // Configuration pour les tests End-to-End (E2E)
  e2e: {
    // URL de base de votre application en test
    baseUrl: 'http://localhost:8888',

    // Fichier de support pour les commandes personnalisées, etc.
    supportFile: 'cypress/support/e2e.js',

    // --- Optimisations pour CI/CD ---

    // 1. Désactive l'enregistrement vidéo.
    // C'est le gain de performance le plus significatif en CI.
    // Le post-traitement, la compression et la sauvegarde de la vidéo sont désactivés.
    video: false,

    // 2. Désactive les captures d'écran automatiques en cas d'échec d'un test.
    // Utile pour accélérer les runs, mais peut être activé si le débogage visuel est crucial.
    screenshotOnRunFailure: false,

    // 3. Réduit le nombre de tests gardés en mémoire vive.
    // Libère de la RAM, ce qui est bénéfique dans les conteneurs CI/CD.
    // La valeur par défaut est 50. Mettre à 0 pour une optimisation maximale.
    numTestsKeptInMemory: 5,

    setupNodeEvents(on, config) {
      // implémentez ici les écouteurs d'événements du nœud
    },
  },
});