/**
 * @jest-environment jsdom
 */

import * as projects from './projects.js';

describe('Module Projects', () => {
  test('devrait charger le module sans erreur', () => {
    expect(projects).toBeDefined();
  });
});