export default {
  testEnvironment: 'jest-environment-jsdom',
  roots: ['<rootDir>/web/js'],
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  collectCoverageFrom: [
    'web/js/**/*.js',
    '!web/js/**/*.test.js',
    '!web/js/**/*.cy.js',
    '!web/js/tests/test_frontend_fixes.js', // Exclure l'ancien fichier temporaire
    '!**/node_modules/**'
  ],
  coverageDirectory: 'reports/coverage-frontend',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['@testing-library/jest-dom'],
  verbose: true,
  transform: {},
  extensionsToTreatAsEsm: ['.js'],
  globals: {
    'ts-jest': {
      useESM: true
    }
  }
};