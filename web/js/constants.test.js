/**
 * <!-- Import failed: jest-environment - ENOENT: no such file or directory, access 'c:\Users\alich\Downloads\exported-assets (1)\docs\jest-environment' --> jsdom
 */
import { SELECTORS, API_ENDPOINTS, MESSAGES } from './constants.js';

describe('Module Constants - Configuration centralisée', () => {
  
  describe('SELECTORS', () => {
    test('devrait contenir tous les sélecteurs DOM essentiels', () => {
      expect(SELECTORS.projectsList).toBeDefined();
      expect(SELECTORS.projectContainer).toBeDefined();
      expect(SELECTORS.resultsContainer).toBeDefined();
      expect(SELECTORS.settingsContainer).toBeDefined();
      
      // Vérification du format des sélecteurs
      expect(SELECTORS.projectsList).toMatch(/^[#.]/); // Commence par # ou .
      expect(SELECTORS.resultsContainer).toMatch(/^[#.]/);
    });
  });

  describe('API_ENDPOINTS', () => {
    test('devrait contenir tous les endpoints API essentiels', () => {
      expect(API_ENDPOINTS.projects).toBe('/projects/');
      expect(API_ENDPOINTS.databases).toBe('/api/databases');
      expect(API_ENDPOINTS.analysisProfiles).toBe('/api/analysis-profiles');
    });

    test('les fonctions d\'endpoints dynamiques devraient fonctionner', () => {
      expect(API_ENDPOINTS.projectById('123')).toBe('/projects/123');
      expect(API_ENDPOINTS.gridById('proj1', 'grid2')).toBe('/projects/proj1/grids/grid2');
      expect(API_ENDPOINTS.projectExport('456')).toBe('/projects/456/export');
    });
  });

  describe('MESSAGES', () => {
    test('devrait contenir tous les messages utilisateur essentiels', () => {
      expect(MESSAGES.loading).toBeDefined();
      expect(MESSAGES.projectCreated).toBeDefined();
      expect(MESSAGES.projectDeleted).toBeDefined();
      expect(MESSAGES.noProjects).toBeDefined();
      
      // Vérification que les messages ne sont pas vides
      expect(MESSAGES.projectCreated).not.toBe('');
      expect(MESSAGES.loading).not.toBe('');
    });

    test('les fonctions de messages dynamiques devraient fonctionner', () => {
      const projectName = 'Test Project';
      const confirmMessage = MESSAGES.confirmDeleteProjectBody(projectName);
      expect(confirmMessage).toContain(projectName);
      expect(confirmMessage).toContain('strong'); // HTML markup présent
    });
  });
});