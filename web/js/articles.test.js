/**
 * @jest-environment jsdom
 */

import * as articles from './articles.js';
import { appState } from './app-improved.js';
import * as api from './api.js';
import * as uiImproved from './ui-improved.js';
import * as state from './state.js';

// Mock app-improved.js
jest.mock('./app-improved.js', () => ({
  appState: {
    currentProject: null,
    searchResults: [],
    currentProjectExtractions: [],
    currentProjectFiles: new Set(),
  },
  elements: {
    resultsContainer: null,
  },
}));

// Mock dependencies
jest.mock('./api.js');
jest.mock('./ui-improved.js');
jest.mock('./state.js');

// L'import de 'articles' est déjà fait en haut, pas besoin de le répéter.

describe('Module Articles', () => {
  test('devrait charger le module sans erreur', () => {
    expect(articles).toBeDefined();
  });
});