/**
 * @jest-environment jsdom
 */
import * as reporting from './reporting.js';
import { appState } from './app-improved.js';
import * as api from './api.js';
import * as ui from './ui-improved.js';

// Mocker les dépendances
jest.mock('./api.js');
jest.mock('./ui-improved.js', () => ({
  showToast: jest.fn(),
  showError: jest.fn(),
}));
jest.mock('./app-improved.js', () => ({
  appState: {
    currentProject: null,
  },
}));

describe('Module Reporting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = `<div id="reportingContainer"></div>`;
    appState.currentProject = { id: 'proj-1', name: 'Projet de Test' };
  });

  describe('generateBibliography', () => {
    it('devrait générer une bibliographie au format APA', () => {
      const articles = [
        { id: '1', title: 'Titre 1', authors: 'Auteur A', journal: 'Journal A', year: 2022 },
        { id: '2', title: 'Titre 2', authors: 'Auteur B', journal: 'Journal B', publication_date: '2023-01-01' },
      ];
      const result = reporting.generateBibliography(articles);
      expect(result).toHaveLength(2);
      expect(result[0].citation).toBe('Auteur A (2022). Titre 1. Journal A.');
    });

    it('devrait retourner un tableau vide si aucune donnée n\'est fournie', () => {
      expect(reporting.generateBibliography(null)).toEqual([]);
    });
  });

  describe('generateSummaryTable', () => {
    const data = [{ id: '1', title: 'Article 1', authors: 'Auteur A', year: 2023 }];

    it('devrait générer un tableau de synthèse avec les en-têtes par défaut', () => {
      const result = reporting.generateSummaryTable(data);
      expect(result.headers).toEqual(['ID', 'Titre', 'Auteurs', 'Journal', 'Année', 'Type', 'Statut', 'Score', 'Citations']);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0][1]).toBe('Article 1');
    });

    it('devrait générer un tableau sans statistiques si l\'option est désactivée', () => {
      const result = reporting.generateSummaryTable(data, { includeStats: false });
      expect(result.headers).not.toContain('Score');
    });
  });

  describe('exportSummaryTableExcel', () => {
    const mockData = [{ col1: 'a', col2: 'b' }];

    it('devrait utiliser la librairie XLSX si elle est disponible', () => {
      global.XLSX = {
        utils: { json_to_sheet: jest.fn(), book_new: jest.fn(), book_append_sheet: jest.fn() },
        writeFile: jest.fn(),
      };

      reporting.exportSummaryTableExcel(mockData);

      expect(global.XLSX.writeFile).toHaveBeenCalled();
      expect(ui.showToast).toHaveBeenCalledWith('Fichier Excel exporté avec succès', 'success');
      delete global.XLSX;
    });

    it('devrait utiliser un fallback JSON si XLSX n\'est pas disponible', () => {
      global.XLSX = undefined;
      // Mock pour le fallback
      global.URL.createObjectURL = jest.fn();
      global.URL.revokeObjectURL = jest.fn();
      document.createElement = jest.fn(() => ({
        click: jest.fn(),
        setAttribute: jest.fn(),
        style: {},
      }));
      document.body.appendChild = jest.fn();
      document.body.removeChild = jest.fn();

      reporting.exportSummaryTableExcel(mockData);

      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(ui.showToast).toHaveBeenCalledWith('Données exportées en JSON', 'info');
    });
  });

  describe('renderReportingSection', () => {
    it('devrait rendre la section de reporting avec les boutons activés si un projet est sélectionné', () => {
      reporting.renderReportingSection('#reportingContainer', 'proj-1');
      const generateBtn = document.getElementById('generateBibliographyBtn');
      expect(generateBtn).not.toBeNull();
      expect(generateBtn.disabled).toBe(false);
    });

    it('devrait rendre la section avec les boutons désactivés si aucun projet n\'est sélectionné', () => {
      reporting.renderReportingSection('#reportingContainer', null);
      const generateBtn = document.getElementById('generateBibliographyBtn');
      expect(generateBtn).not.toBeNull();
      expect(generateBtn.disabled).toBe(true);
    });
  });

  describe('savePrismaChecklist', () => {
    it('devrait sauvegarder les données dans le localStorage', () => {
      // Mock localStorage
      const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');

      reporting.savePrismaChecklist({ title: 'Test' }, 'proj-1');

      expect(setItemSpy).toHaveBeenCalledWith(
        'prisma_checklist_proj-1',
        expect.any(String)
      );
      expect(ui.showToast).toHaveBeenCalledWith(expect.stringContaining('Checklist PRISMA sauvegardée'), 'success');
    });
  });
});