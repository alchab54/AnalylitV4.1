// web/js/tests/jest.setup.js

// Désactive les logs de console pendant les tests pour un output plus propre.
global.console.log = jest.fn();
global.console.error = jest.fn();
global.console.warn = jest.fn();