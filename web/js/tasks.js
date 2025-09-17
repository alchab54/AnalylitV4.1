import { fetchAPI } from './api.js';
import { showToast, escapeHtml } from './ui-improved.js';
import { appState, elements } from '../app.js';

export async function loadTasksSection() {
    if (!elements.tasksContainer) return;

    try {
        const tasks = await fetchAPI('/tasks/status');
        renderTasks(tasks);
    } catch (error) {
        elements.tasksContainer.innerHTML = `<div class="empty-state"><p>Impossible de charger la liste des tâches.</p></div>`;
        showToast(`Erreur de chargement des tâches: ${error.message}`, 'error');
    }
}

function renderTasks(tasks) {
    if (!elements.tasksContainer) return;

    if (!tasks || tasks.length === 0) {
        elements.tasksContainer.innerHTML = `<div class="empty-state"><p>Aucune tâche récente à afficher.</p></div>`;
        return;
    }

    const tasksHtml = tasks.map(task => `
        <div class="task-card task-card--${task.status}">
            <div class="task-card__header">
                <span class="task-card__status-icon">${getStatusIcon(task.status)}</span>
                <h5 class="task-card__description">${escapeHtml(task.description || 'Tâche sans description')}</h5>
                <span class="badge badge--${getStatusColor(task.status)}">${escapeHtml(task.status)}</span>
            </div>
            <div class="task-card__body">
                <div class="task-details">
                    <div><strong>ID:</strong> <code class="task-id">${escapeHtml(task.id)}</code></div>
                    <div><strong>File:</strong> ${escapeHtml(task.queue)}</div>
                    <div><strong>Date:</strong> ${formatTaskDate(task)}</div>
                </div>
                ${task.status === 'failed' && task.error ? `
                    <div class="task-error">
                        <strong>Erreur:</strong>
                        <pre>${escapeHtml(task.error.substring(0, 300))}...</pre>
                    </div>
                ` : ''}
            </div>
            <div class="task-card__footer">
                ${task.status === 'failed' ? `
                    <button class="btn btn--secondary btn--sm" data-action="retry-task" data-task-id="${task.id}">Relancer</button>
                ` : ''}
            </div>
        </div>
    `).join('');

    elements.tasksContainer.innerHTML = `<div class="tasks-list">${tasksHtml}</div>`;
}

function getStatusIcon(status) {
    switch (status) {
        case 'started': return '⏳';
        case 'queued': return '🕒';
        case 'finished': return '✅';
        case 'failed': return '❌';
        default: return '❓';
    }
}

function getStatusColor(status) {
    switch (status) {
        case 'started':
        case 'queued':
            return 'info';
        case 'finished':
            return 'success';
        case 'failed':
            return 'error';
        default:
            return 'secondary';
    }
}

function formatTaskDate(task) {
    const dateStr = task.ended_at || task.started_at || task.created_at;
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

export function setupTasksAutoRefresh() { // Already exported, but keeping for consistency with request
    // Rafraîchir toutes les 10 secondes si la section est visible
    setInterval(() => {
        if (appState.currentSection === 'tasks') {
            loadTasksSection();
        }
    }, 10000);
}

export function handleTaskNotification(notification) {
    // Si on est sur la page des tâches, on la rafraîchit immédiatement
    if (appState.currentSection === 'tasks' && ['TASK_COMPLETED', 'TASK_FAILED', 'TASK_STARTED'].includes(notification.type)) {
        // On attend une seconde pour laisser le temps à RQ de mettre à jour ses registres
        setTimeout(loadTasksSection, 1000);
    }
}