/**
 * @jest-environment jsdom
 */
import * as tasks from './tasks.js';
import * as api from './api.js';
import * as state from './state.js';

// Mocker les dépendances
jest.mock('./api.js');
jest.mock('./state.js', () => ({
  setBackgroundTasks: jest.fn(),
  appState: {
    backgroundTasks: new Map(),
  },
}));

describe('Module Tasks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = `<div id="tasks-list"></div>`;
  });

  describe('fetchTasks', () => {
    it('devrait récupérer les tâches, mettre à jour l\'état et appeler le rendu', async () => {
      const mockTasks = [{ job_id: 'task-1', status: 'running' }];
      api.fetchAPI.mockResolvedValue({ tasks: mockTasks });

      await tasks.fetchTasks();

      expect(api.fetchAPI).toHaveBeenCalledWith('/api/tasks/status');
      expect(state.setBackgroundTasks).toHaveBeenCalledWith(mockTasks);
    });

    it("devrait gérer une erreur de l'API sans planter", async () => {
      api.fetchAPI.mockRejectedValue(new Error('API Error'));
      await tasks.fetchTasks();
      expect(document.getElementById('tasks-list').innerHTML).toContain('Erreur lors de la récupération des tâches');
    });
  });

  describe('renderTasks', () => {
    it('devrait afficher les tâches correctement', () => {
      const tasksMap = new Map([
        ['task-1', { job_id: 'task-1', status: 'running', description: 'Analyse en cours' }],
      ]);
      tasks.renderTasks(tasksMap.values());

      expect(document.querySelector('.task-item')).not.toBeNull();
      expect(document.body.innerHTML).toContain('Analyse en cours');
    });

    it("devrait afficher un message si aucune tâche n'est en cours", () => {
      tasks.renderTasks([].values());
      expect(document.getElementById('tasks-list').innerHTML).toContain('Aucune tâche en cours.');
    });
  });
});
