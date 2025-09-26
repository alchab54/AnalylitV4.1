module.exports = {
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
  coverageReporters: ['text', 'lcov', 'html'], // This was already correct
  // ✅ CORRECTION: Utiliser le fichier de setup pour nettoyer les logs
  setupFilesAfterEnv: ['@testing-library/jest-dom', '<rootDir>/web/js/tests/jest.setup.js'], // This was already correct, just confirming its importance
  verbose: true,
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  moduleNameMapper: {
    '^./toast.js$': '<rootDir>/web/js/ui-improved.js', // Redirect toast.js imports to ui-improved.js
  },
  moduleFileExtensions: ['js', 'mjs'], // Add mjs for ES modules
  
  
};