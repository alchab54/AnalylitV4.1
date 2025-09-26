import { fetchAPI } from './api.js';

class AdminDashboard {
    constructor() {
        this.dashboardContainer = document.getElementById('admin-dashboard');
        if (!this.dashboardContainer) return;

        this.renderLayout();
        // L'initialisation des données et du timer se fera dans une méthode async séparée
    }

    async init() {
        if (!this.dashboardContainer) return;
        await this.loadData();
        setInterval(() => this.loadData(), 10000); // Refresh every 10 seconds

        // Simulate admin role for demonstration
        document.body.dataset.userRole = 'admin';
        return this; // Permet le chaînage
    }

    renderLayout() {
        this.dashboardContainer.innerHTML = `
            <div class="admin-header">
                <h2>Tableau de Bord Administration</h2>
                <div class="admin-actions">
                    <button class="btn-admin" onclick="window.adminDashboard.refreshData()">Rafraîchir</button>
                    <button class="btn-admin-danger" onclick="window.adminDashboard.clearFailedTasks()">Purger les tâches échouées</button>
                </div>
            </div>
            <div id="admin-stats-grid" class="admin-stats-grid"></div>
            <div class="admin-panels">
                <div class="admin-panel">
                    <h3><span class="status-dot running"></span> Tâches en Cours & en Attente</h3>
                    <div id="task-queue-list" class="task-list"></div>
                </div>
                <div class="admin-panel">
                    <h3><span class="status-dot completed"></span> Tâches Récemment Terminées</h3>
                    <div id="task-completed-list" class="task-list"></div>
                </div>
                <div class="admin-panel">
                    <h3><span class="status-dot failed"></span> Tâches Échouées</h3>
                    <div id="task-failed-list" class="task-list"></div>
                </div>
                <div class="admin-panel">
                    <h3>📈 Performance Système</h3>
                    <div id="performance-metrics" class="perf-metrics"></div>
                </div>
            </div>
        `;
    }

    async loadData() {
        try {
            const [tasks, queues] = await Promise.all([
                fetchAPI('/api/tasks/status'),
                fetchAPI('/api/queues/status')
            ]);
            this.renderStats(tasks, queues);
            this.renderTaskLists(tasks);
            this.renderPerformanceMetrics(); // Mocked for now
        } catch (error) {
            console.error("Erreur chargement données admin:", error);
            document.getElementById('task-queue-list').innerHTML = `<p>Erreur de chargement des données.</p>`;
        }
    }

    refreshData() {
        this.loadData();
    }

    renderStats(tasks = [], queues = {}) {
        const statsContainer = document.getElementById('admin-stats-grid');
        if (!statsContainer) return;

        const runningTasks = tasks.filter(t => t.status === 'started').length;
        const queuedTasks = tasks.filter(t => t.status === 'queued').length;
        const failedTasks = tasks.filter(t => t.status === 'failed').length;
        const totalWorkers = queues.queues?.reduce((sum, q) => sum + q.workers, 0) || 0;

        statsContainer.innerHTML = `
            <div class="stat-card"><span class="stat-number">${runningTasks}</span><span class="stat-label">Tâches en cours</span></div>
            <div class="stat-card"><span class="stat-number">${queuedTasks}</span><span class="stat-label">Tâches en attente</span></div>
            <div class="stat-card"><span class="stat-number">${failedTasks}</span><span class="stat-label">Tâches échouées</span></div>
            <div class="stat-card"><span class="stat-number">${totalWorkers}</span><span class="stat-label">Workers Actifs</span></div>
        `;
    }

    renderTaskLists(tasks = []) {
        const running = tasks.filter(t => ['started', 'queued'].includes(t.status));
        const completed = tasks.filter(t => t.status === 'finished').slice(0, 10);
        const failed = tasks.filter(t => t.status === 'failed');

        this.renderTaskList('task-queue-list', running);
        this.renderTaskList('task-completed-list', completed);
        this.renderTaskList('task-failed-list', failed);
    }

    renderTaskList(elementId, tasks) {
        const container = document.getElementById(elementId);
        if (!container) return;

        if (tasks.length === 0) {
            container.innerHTML = `<p>Aucune tâche.</p>`;
            return;
        }

        container.innerHTML = tasks.map(task => `
            <div class="task-item status-${task.status}">
                <div class="task-info">
                    <div class="task-name">${task.description || task.id}</div>
                    <div class="task-project">Queue: ${task.queue}</div>
                    <div class="task-time">Créée: ${new Date(task.created_at).toLocaleString('fr-FR')}</div>
                </div>
                <div class="task-actions">
                    <span class="status-badge status-${task.status}">${task.status}</span>
                    ${task.status === 'started' ? '<button class="btn-cancel" onclick="window.adminDashboard.cancelTask(\' + task.id + \')">Annuler</button>' : ''}
                </div>
            </div>
        `).join('');
    }

    renderPerformanceMetrics() {
        const container = document.getElementById('performance-metrics');
        if (!container) return;

        const cpuUsage = Math.floor(Math.random() * (90 - 20 + 1)) + 20; // Mock
        const memUsage = Math.floor(Math.random() * (80 - 30 + 1)) + 30; // Mock

        container.innerHTML = `
            <div class="perf-item">
                <div class="perf-label">CPU</div>
                <div class="perf-bar"><div class="perf-fill" style="width: ${cpuUsage}%; background-color: ${cpuUsage > 80 ? '#ef4444' : '#3b82f6'};"></div></div>
                <div class="perf-value">${cpuUsage}%</div>
            </div>
            <div class="perf-item">
                <div class="perf-label">RAM</div>
                <div class="perf-bar"><div class="perf-fill" style="width: ${memUsage}%; background-color: ${memUsage > 80 ? '#ef4444' : '#10b981'};"></div></div>
                <div class="perf-value">${memUsage}%</div>
            </div>
        `;
    }

    async cancelTask(taskId) {
        if (!confirm(`Voulez-vous vraiment annuler la tâche ${taskId} ?`)) return;
        try {
            await fetchAPI(`/api/tasks/${taskId}/cancel`, { method: 'POST' });
            this.loadData();
        } catch (error) {
            console.error("Erreur annulation tâche:", error);
            alert("Impossible d'annuler la tâche.");
        }
    }

    async clearFailedTasks() {
        if (!confirm("Voulez-vous vraiment purger toutes les tâches échouées ?")) return;
        try {
            await fetchAPI('/api/queues/clear', { 
                method: 'POST', 
                body: { queue_name: 'analylit_failed_v4' } // Assumes a failed queue, adjust if needed
            });
            this.loadData();
        } catch (error) {
            console.error("Erreur purge tâches échouées:", error);
            alert("Impossible de purger les tâches.");
        }
    }
}

// Exporter la classe pour qu'elle soit importable
export default AdminDashboard;

// Initialisation si le script est chargé directement
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        // On crée l'instance, puis on l'initialise de manière asynchrone
        const dashboard = new AdminDashboard();
        dashboard.init();
        window.adminDashboard = dashboard;
    });
}
