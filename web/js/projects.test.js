/**
 * @jest-environment jsdom
 */

import * as projects from './projects.js';
import { appState } from './app-improved.js';
import * as api from './api.js';
import * as uiImproved from './ui-improved.js';
import * as state from './state.js';

// Mock app-improved.js
jest.mock('./app-improved.js', () => ({
  appState: {
    projects: [],
    currentProject: null,
  },
  elements: {
    projectsList: null,
  },
}));

// Mock dependencies
jest.mock('./api.js');
jest.mock('./ui-improved.js');
jest.mock('./state.js');

// L'import de 'projects' est déjà fait en haut, pas besoin de le répéter.

describe('Module Projects', () => {
  test('devrait charger le module sans erreur', () => {
    expect(projects).toBeDefined();
  });
});