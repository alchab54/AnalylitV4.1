// jest.config.js
export default {
  testEnvironment: 'jest-environment-jsdom',
  // Indique à Jest où trouver les tests
  testMatch: ['<rootDir>/web/js/**/*.test.js'],
  // Nécessaire pour supporter 'import/export' dans les tests et les mocks
  transform: {},
  moduleFileExtensions: ['js', 'json', 'node'],
  // Permet aux tests de trouver les modules (ex: app.js depuis core.js)
  moduleDirectories: ['node_modules', 'web/js', 'web'],
};