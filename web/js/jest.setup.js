// c/Users/alich/Downloads/exported-assets (1)/web/js/tests/jest.setup.js

// Ce fichier est exécuté avant chaque suite de tests.
// Il est idéal pour configurer des mocks globaux.

jest.mock('../ui-improved.js', () => {
    const originalModule = jest.requireActual('../ui-improved.js');
    const mockObject = {};
    // Mocker dynamiquement toutes les fonctions exportées
    for (const key in originalModule) {
        if (typeof originalModule[key] === 'function') {
            mockObject[key] = jest.fn();
        }
    }
    // Garder le comportement original pour escapeHtml si nécessaire
    mockObject.escapeHtml = (str) => str;
    return mockObject;
});

// Vous pouvez ajouter d'autres mocks globaux ici si nécessaire.
jest.mock('../api.js');