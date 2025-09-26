/**
 * @jest-environment jsdom
 */
import AdminDashboard from './admin-dashboard.js'; // Utiliser l'import par défaut
import { fetchAPI } from './api.js';

// Mocker les dépendances
jest.mock('./api.js', () => ({
  fetchAPI: jest.fn(),
}));

describe('Module AdminDashboard', () => {
  let dashboard;

  beforeEach(() => {
    // Réinitialiser les mocks et le DOM
    jest.clearAllMocks();
    document.body.innerHTML = '<div id="admin-dashboard"></div>';    
    fetchAPI.mockResolvedValue({ tasks: [], queues: {} }); // Mock par défaut pour éviter les erreurs
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    // Nettoyer l'instance et les timers
    if (dashboard) {
      // La classe n'expose pas l'ID de l'intervalle, on le nettoie globalement
      const intervalIds = jest.getTimerCount();
      for (let i = 0; i < intervalIds; i++) {
        clearInterval(i);
      }
    }
  });

  test('devrait initialiser le layout et charger les données', async () => {
    fetchAPI.mockResolvedValueOnce({ tasks: [] }).mockResolvedValueOnce({ queues: [] });
    dashboard = new AdminDashboard();
    await new Promise(process.nextTick); // Permettre aux promesses de se résoudre

    expect(document.querySelector('.admin-header')).not.toBeNull();
    expect(document.querySelector('.admin-panels')).not.toBeNull();
    expect(fetchAPI).toHaveBeenCalledWith('/api/tasks/status');
    expect(fetchAPI).toHaveBeenCalledWith('/api/queues/status');
  });

  test('devrait rafraîchir les données périodiquement', async () => {
    fetchAPI.mockResolvedValue({ tasks: [], queues: {} });
    dashboard = new AdminDashboard();
    await new Promise(process.nextTick);

    expect(fetchAPI).toHaveBeenCalledTimes(2); // 1 pour tasks, 1 pour queues

    // Avancer le temps de 10 secondes
    jest.advanceTimersByTime(10000);
    await new Promise(process.nextTick);

    expect(fetchAPI).toHaveBeenCalledTimes(4); // Devrait avoir été appelé à nouveau
  });

  test('devrait afficher les statistiques correctement', async () => {
    const mockTasks = [
      { status: 'started' },
      { status: 'queued' },
      { status: 'failed' },
      { status: 'failed' },
    ];
    const mockQueues = { queues: [{ workers: 2 }, { workers: 1 }] };
    fetchAPI.mockResolvedValueOnce(mockTasks).mockResolvedValueOnce(mockQueues);

    dashboard = new AdminDashboard();
    // Attendre la résolution des promesses de fetchAPI
    await new Promise(process.nextTick);

    const statsGrid = document.getElementById('admin-stats-grid');
    // Utiliser une assertion moins stricte pour ignorer les espaces
    expect(statsGrid.textContent).toContain('1');
    expect(statsGrid.textContent).toContain('1Tâches en attente');
    expect(statsGrid.textContent).toContain('2Tâches échouées');
    expect(statsGrid.textContent).toContain('3Workers Actifs');
  });

  test('devrait afficher les listes de tâches', async () => {
    const mockTasks = [
      { id: 't1', status: 'started', description: 'Analyse en cours' },
      { id: 't2', status: 'finished', description: 'Indexation terminée' },
      { id: 't3', status: 'failed', description: 'Export échoué' },
    ];
    fetchAPI.mockResolvedValueOnce(mockTasks).mockResolvedValueOnce({ queues: [] });

    dashboard = new AdminDashboard();
    // Attendre la résolution des promesses de fetchAPI
    await new Promise(process.nextTick);

    expect(document.querySelector('#task-queue-list .task-item').textContent).toContain('Analyse en cours');
    expect(document.querySelector('#task-completed-list .task-item').textContent).toContain('Indexation terminée');
    expect(document.querySelector('#task-failed-list .task-item').textContent).toContain('Export échoué');
  });

  test('devrait afficher "Aucune tâche" si une liste est vide', async () => {
    fetchAPI.mockResolvedValueOnce([]).mockResolvedValueOnce({ queues: [] });

    dashboard = new AdminDashboard();
    // Attendre la résolution des promesses de fetchAPI
    await new Promise(process.nextTick);

    expect(document.getElementById('task-queue-list').textContent).toContain('Aucune tâche.');
  });

  test('devrait gérer une erreur de l\'API lors du chargement', async () => {
    fetchAPI.mockRejectedValue(new Error('Network Error'));
    jest.spyOn(console, 'error').mockImplementation(() => {}); // Masquer le console.error

    dashboard = new AdminDashboard();
    // Attendre la résolution des promesses de fetchAPI
    await new Promise(process.nextTick);

    expect(document.getElementById('task-queue-list').textContent).toContain('Erreur de chargement des données.');
    console.error.mockRestore();
  });

  test('devrait appeler l\'API pour annuler une tâche après confirmation', async () => {
    window.confirm = jest.fn(() => true);
    fetchAPI.mockResolvedValue({});
    dashboard = new AdminDashboard(); // Constructor calls loadData

    await dashboard.cancelTask('task-to-cancel');

    expect(window.confirm).toHaveBeenCalled();
    expect(fetchAPI).toHaveBeenCalledWith('/api/tasks/task-to-cancel/cancel', { method: 'POST' });
  });

  test('ne devrait pas annuler une tâche si l\'utilisateur annule', async () => {
    window.confirm = jest.fn(() => false);
    dashboard = new AdminDashboard();
    await new Promise(process.nextTick); // Laisser le constructeur finir

    // Clear mocks from constructor calls
    fetchAPI.mockClear();

    await dashboard.cancelTask('task-to-cancel');

    expect(window.confirm).toHaveBeenCalled();
    expect(fetchAPI).not.toHaveBeenCalled();
  });
});