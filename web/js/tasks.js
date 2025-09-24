// web/js/tasks.js
import { fetchAPI } from './api.js';
import { API_ENDPOINTS } from './constants.js';

export async function fetchTasks() {
    try {
        // Le garde est bon, mais le bloc doit être complet
        if (!API_ENDPOINTS?.tasks) {
            console.warn('API_ENDPOINTS.tasks not defined yet');
            return;
        }
        const tasks = await fetchAPI(API_ENDPOINTS.tasks);
    try {
        const response = await fetchAPI(API_ENDPOINTS.tasksStatus);
        
        // CORRECTION : Traite les tâches avec job_id
        const tasks = response.tasks || [];
        const tasksHtml = tasks.map(task => `
            <div class="task-item" data-job-id="${task.job_id}">
                <div class="task-header">
                    <strong>Job ID:</strong> ${task.job_id}
                    <span class="task-status ${task.status}">${task.status}</span>
                </div>
                <div class="task-details">
                    <p><strong>Type:</strong> ${task.type || 'N/A'}</p>
                    <p><strong>Progression:</strong> ${task.progress || 0}%</p>
                    <p><strong>Créé:</strong> ${new Date(task.created_at).toLocaleString()}</p>
                </div>
            </div>
        `).join('');

        const tasksContainer = document.getElementById('tasks-list');
        if (tasksContainer) {
            tasksContainer.innerHTML = tasksHtml || `<p>${MESSAGES.noTasksInProgress}</p>`;
        }
    } catch (error) {

        console.error("Erreur lors de la récupération des tâches:", error);
    }
}