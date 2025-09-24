/**
 * @jest-environment jsdom
 */

import * as articles from './articles.js';
jest.mock('./app-improved.js'); // Mock app-improved.js

describe('Module Articles', () => {
  test('devrait charger le module sans erreur', () => {
    expect(articles).toBeDefined();
  });
});