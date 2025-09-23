/**
 * @jest-environment jsdom
 */

import * as articles from './articles.js';

describe('Module Articles', () => {
  test('devrait charger le module sans erreur', () => {
    expect(articles).toBeDefined();
  });
});