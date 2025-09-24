/**
 * @jest-environment jsdom
 */

import * as projects from './projects.js';
jest.mock('./app-improved.js'); // Mock app-improved.js

describe('Module Projects', () => {
  test('devrait charger le module sans erreur', () => {
    expect(projects).toBeDefined();
  });
});