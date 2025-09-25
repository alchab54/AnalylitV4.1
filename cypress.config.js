import { defineConfig } from 'cypress';

export default defineConfig({
  projectId: 'tn6aw5',
  e2e: {
    baseUrl: 'http://localhost:8080',
    supportFile: 'cypress/support/e2e.js',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    video: true,
    videoCompression: 32,
    screenshotOnRunFailure: true,
    screenshotsFolder: 'reports/cypress/screenshots',
    videosFolder: 'reports/cypress/videos',
    viewportWidth: 1920,
    viewportHeight: 1080,
    defaultCommandTimeout: 6000,
    pageLoadTimeout: 8000,
    requestTimeout: 5000,
    responseTimeout: 5000,
    taskTimeout: 8000,
    numTestsKeptInMemory: 20,
    experimentalMemoryManagement: true,
    chromeWebSecurity: false,
    experimentalStudio: true,
    setupNodeEvents(on, config) {
      // Plugin events here
    },
  },
  component: {
    devServer: {
      framework: 'vanilla',
      bundler: 'webpack',
    },
  }
});