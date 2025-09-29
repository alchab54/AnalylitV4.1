/**
 * @jest-environment jsdom
 */
import * as projects from './projects.js';
import * as api from './api.js';
import * as ui from './ui-improved.js';
import * as state from './state.js';
import { appState, elements } from './app-improved.js';

// Mocker les dépendances
jest.mock('./api.js');
jest.mock('./ui-improved.js', () => ({
  showToast: jest.fn(),
  showError: jest.fn(),
  showSuccess: jest.fn(),
  showLoadingOverlay: jest.fn(),
  closeModal: jest.fn(),
  showConfirmModal: jest.fn(),
  escapeHtml: (str) => str, // Keep this for safety
  renderProjectCards: jest.fn(),
}));
jest.mock('./state.js');
jest.mock('./app-improved.js', () => ({
  appState: {
    projects: [],
    currentProject: null,
    currentProjectFiles: new Set(),
    analysisResults: {},
  },
  elements: {
    projectsList: jest.fn(),
  },
}));

describe('Module Projects', () => {

  beforeEach(() => {
    // Réinitialiser les mocks et le DOM
    jest.clearAllMocks();
    document.body.innerHTML = `
      <div id="projects-list"></div>
      <div id="projectDetail"><div id="projectDetailContent"></div></div>
      <div id="projectPlaceholder"></div>
      <form id="createProjectForm">
        <input id="projectName" value="Nouveau Projet Test">
        <input id="projectDescription" value="Description Test">
        <select id="projectAnalysisMode"><option value="full" selected></option></select>
      </form>
    `;
    elements.projectsList.mockReturnValue(document.querySelector('#projects-list'));
  });

  describe('loadProjects', () => {
    it('devrait charger les projets, les définir dans l\'état et les afficher', async () => {
      const mockProjects = [{ id: '1', name: 'Projet 1' }];
      api.fetchAPI.mockResolvedValue(mockProjects);
      state.setProjects.mockImplementation((projects) => {
        appState.projects = projects;
      });

      await projects.loadProjects();

      expect(api.fetchAPI).toHaveBeenCalledWith('/projects/');
      expect(state.setProjects).toHaveBeenCalledWith(mockProjects);
      expect(ui.renderProjectCards).toHaveBeenCalledWith(mockProjects);
    });

    it('devrait gérer une erreur lors du chargement des projets', async () => {
      api.fetchAPI.mockRejectedValue(new Error('API Error'));
      await projects.loadProjects();
      expect(ui.showToast).toHaveBeenCalledWith('Impossible de charger les projets.', 'error');
      expect(ui.renderProjectCards).toHaveBeenCalledWith([]);
    });
  });

  describe('handleCreateProject', () => {
    it('devrait créer un projet avec succès', async () => {
      const mockNewProject = { id: '2', name: 'Nouveau Projet Test' };
      api.fetchAPI.mockResolvedValue(mockNewProject);

      const mockEvent = { preventDefault: jest.fn(), target: document.getElementById('createProjectForm') };
      await projects.handleCreateProject(mockEvent);

      expect(ui.showLoadingOverlay).toHaveBeenCalledWith(true, 'Création du projet...');
      expect(api.fetchAPI).toHaveBeenCalledWith('/projects/', expect.objectContaining({
        method: 'POST',
        body: { name: 'Nouveau Projet Test', description: 'Description Test', mode: 'full' }
      }));
      expect(ui.showSuccess).toHaveBeenCalledWith('Projet créé avec succès');
      expect(ui.closeModal).toHaveBeenCalledWith('newProjectModal');
      expect(ui.showLoadingOverlay).toHaveBeenCalledWith(false, '');
    });

    it('devrait afficher une erreur si le nom du projet est manquant', async () => {
      document.getElementById('projectName').value = '';
      const mockEvent = { preventDefault: jest.fn(), target: document.getElementById('createProjectForm') };

      await projects.handleCreateProject(mockEvent);

      expect(ui.showToast).toHaveBeenCalledWith('Le nom du projet est requis.', 'warning');
      expect(api.fetchAPI).not.toHaveBeenCalled();
    });

    it("devrait gérer une erreur de l'API lors de la création", async () => {
      api.fetchAPI.mockRejectedValue(new Error('Creation Failed'));
      const mockEvent = { preventDefault: jest.fn(), target: document.getElementById('createProjectForm') };

      await projects.handleCreateProject(mockEvent);

      expect(ui.showLoadingOverlay).toHaveBeenCalledWith(true, 'Création du projet...');
      expect(ui.showError).toHaveBeenCalledWith('Erreur: Creation Failed');
      expect(ui.showLoadingOverlay).toHaveBeenCalledWith(false, '');
    });
  });

  describe('selectProject', () => {
    it('devrait sélectionner un projet et mettre à jour l\'UI', async () => {
      const projectToSelect = { id: '1', name: 'Projet 1' };
      appState.projects = [projectToSelect];
      state.setCurrentProject.mockImplementation((project) => {
        appState.currentProject = project;
      });

      await projects.selectProject('1');

      expect(state.setCurrentProject).toHaveBeenCalledWith(projectToSelect);
      const detailContainer = document.querySelector('#projectDetailContent');
      expect(detailContainer.innerHTML).toContain('Projet 1');
      expect(document.querySelector('#projectDetail').style.display).toBe('block');
      expect(document.querySelector('#projectPlaceholder').style.display).toBe('none');
    });

    it("ne devrait rien faire si l'ID du projet est invalide", async () => {
      appState.projects = [{ id: '1', name: 'Projet 1' }];
      await projects.selectProject('invalid-id');

      expect(state.setCurrentProject).not.toHaveBeenCalled();
    });
  });

  describe('deleteProject', () => {
    it('devrait ouvrir une modale de confirmation avant de supprimer', async () => {
      // The mock is now global for the file, no need for dynamic import

      await projects.deleteProject('1', 'Projet à supprimer');

      expect(ui.showConfirmModal).toHaveBeenCalledWith(
        'Confirmer la suppression',
        expect.stringContaining('Projet à supprimer'),
        expect.any(Object)
      );
    });
  });

  describe('confirmDeleteProject', () => {
    it('devrait appeler l\'API de suppression et recharger les projets', async () => {
      api.fetchAPI.mockResolvedValue({}); // Mock la suppression

      await projects.confirmDeleteProject('1');

      expect(ui.showLoadingOverlay).toHaveBeenCalledWith(true, 'Suppression du projet...');
      expect(api.fetchAPI).toHaveBeenCalledWith('/projects/1', { method: 'DELETE' });
      expect(ui.showToast).toHaveBeenCalledWith('Projet supprimé', 'success');
      expect(ui.showLoadingOverlay).toHaveBeenCalledWith(false);
    });

    it("devrait gérer une erreur de l'API lors de la suppression", async () => {
      api.fetchAPI.mockRejectedValue(new Error('Delete Failed'));

      await projects.confirmDeleteProject('1');

      expect(ui.showLoadingOverlay).toHaveBeenCalledWith(true, 'Suppression du projet...');
      expect(api.fetchAPI).toHaveBeenCalledWith('/projects/1', { method: 'DELETE' });
      expect(ui.showError).toHaveBeenCalledWith('Erreur lors de la suppression: Delete Failed');
      expect(ui.showLoadingOverlay).toHaveBeenCalledWith(false);
    });
  });

  describe('handleExportProject', () => {
    it("devrait ouvrir une nouvelle fenêtre avec l'URL d'export", () => {
      global.open = jest.fn();
      projects.handleExportProject('proj-export');
      expect(global.open).toHaveBeenCalledWith('/projects/proj-export/export', '_blank');
      expect(ui.showToast).toHaveBeenCalledWith("L'exportation du projet a commencé...", 'info');
    });
  });

  describe('loadProjectFilesSet', () => {
    it('devrait charger les fichiers du projet et mettre à jour l\'état', async () => {
      const mockFiles = [{ filename: 'file1.pdf' }, { filename: 'file2.pdf' }];
      api.fetchAPI.mockResolvedValue(mockFiles);

      await projects.loadProjectFilesSet('proj-1');

      expect(api.fetchAPI).toHaveBeenCalledWith('/projects/proj-1/files');
      expect(state.setCurrentProjectFiles).toHaveBeenCalledWith(new Set(['file1', 'file2']));
    });

    it("devrait gérer une erreur lors du chargement des fichiers", async () => {
      api.fetchAPI.mockRejectedValue(new Error('Files API Error'));
      await projects.loadProjectFilesSet('proj-1');
      expect(state.setCurrentProjectFiles).not.toHaveBeenCalled();
    });
  });
});