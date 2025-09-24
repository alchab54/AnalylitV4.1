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

import * as articles from './articles.js';
jest.mock('./app-improved.js'); // Mock app-improved.js

describe('Module Articles', () => {
  test('devrait charger le module sans erreur', () => {
    expect(articles).toBeDefined();
  });
});