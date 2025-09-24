import { defineConfig } from 'cypress';

export default defineConfig({
  projectId: 'tn6aw5',
  e2e: {
    baseUrl: 'http://localhost:8080',
    supportFile: 'cypress/support/e2e.js',
    video: true,
    screenshotOnRunFailure: true,
    screenshotsFolder: 'reports/cypress/screenshots',
    videosFolder: 'reports/cypress/videos',
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 8000,
    pageLoadTimeout: 30000,
    setupNodeEvents(on, config) {
      // Plugin events here
    },
  },
});