// web/js/tasks.js

import { fetchAPI } from './api.js';
import { setBackgroundTasks } from './state.js';
import { API_ENDPOINTS, MESSAGES } from './constants.js';

/**
 * Récupère l'état des tâches en cours depuis le backend et met à jour l'interface utilisateur.
 * Cette fonction est conçue pour être appelée périodiquement.
 */
export async function fetchTasks() {
    try {
        // 1. Vérifier que l'endpoint des tâches est disponible avant de faire l'appel.
        //    Ceci évite les erreurs si la fonction est appelée avant que la configuration soit chargée.
        if (!API_ENDPOINTS?.tasksStatus) {
            console.warn("API_ENDPOINTS.tasksStatus n'est pas encore défini. L'appel est reporté.");
            return;
        }

        // 2. Faire l'appel API pour obtenir le statut des tâches.
        const response = await fetchAPI(API_ENDPOINTS.tasksStatus);
        
        // 3. S'assurer que la réponse contient un tableau de tâches, même s'il est vide.
        //    La notation `|| []` est une sécurité pour éviter les erreurs si `response.tasks` est `undefined`.
        setBackgroundTasks(response.tasks || []);
        
        // 4. Mettre à jour l'interface utilisateur avec les tâches récupérées.
        renderTasks(tasks);

    } catch (error) {
        // 5. Capturer et logger toute erreur survenant pendant le processus.
        //    Ceci empêche l'application de planter en cas de problème réseau ou serveur.
        console.error("Erreur lors de la récupération du statut des tâches:", error);
        
        // Optionnel : Afficher un message d'erreur discret dans l'UI.
        const tasksContainer = document.getElementById('tasks-list');
        if (tasksContainer) {
            tasksContainer.innerHTML = `<p class="error">${MESSAGES.errorFetchingTasks}</p>`;
        }
    }
}

/**
 * Gère le rendu HTML de la liste des tâches dans le conteneur approprié.
 * @param {Array} tasks - Un tableau d'objets représentant les tâches.
 * NOTE: Cette fonction est maintenant appelée avec appState.backgroundTasks.values()
 */
export function renderTasks(tasksIterable) {
    const tasksContainer = document.getElementById('tasks-list');

    // Si le conteneur n'existe pas dans le DOM, on ne peut rien faire.
    if (!tasksContainer) {
        console.warn("Le conteneur de tâches avec l'ID 'tasks-list' n'a pas été trouvé.");
        return;
    }

    // Si le tableau de tâches est vide, afficher un message informatif.
    if (tasks.length === 0) {
        tasksContainer.innerHTML = `<p>${MESSAGES.noTasksInProgress}</p>`; // Correction: tasks.length est 0 ici, mais tasksIterable peut être vide
        return;
    }

    // Construire le HTML pour chaque tâche en utilisant les données reçues.
    // L'utilisation de `data-job-id` permet d'identifier facilement les éléments plus tard.
    const tasksHtml = Array.from(tasksIterable).map(task => `
        <div class="task-item" data-job-id="${task.job_id}">
            <div class="task-header">
                <strong>Job ID:</strong> ${task.job_id}
                <span class="task-status ${task.status.toLowerCase()}">${task.status}</span>
            </div>
            <div class="task-details">
                <p><strong>Type:</strong> ${task.type || 'N/A'}</p>
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${task.progress || 0}%;"></div>
                    <span>${task.progress || 0}%</span>
                </div>
                <p class="task-timestamp"><strong>Créé le:</strong> ${new Date(task.created_at).toLocaleString('fr-FR')}</p>
            </div>
        </div>
    `).join('');

    // Injecter le HTML généré dans le conteneur.
    tasksContainer.innerHTML = tasksHtml;
}
