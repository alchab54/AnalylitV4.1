// web/js/migration-fix.js

/**
 * Script de migration pour remplacer les références de 'task_id' par 'job_id'.
 * Ce script assure la compatibilité ascendante et la cohérence dans le DOM et les événements.
 */
export function migrateTaskReferences() {
    // Remplace toutes les références data-task-id par data-job-id dans le DOM
    const taskElements = document.querySelectorAll('[data-task-id]');
    taskElements.forEach(el => {
        const taskId = el.getAttribute('data-task-id');
        el.removeAttribute('data-task-id');
        el.setAttribute('data-job-id', taskId);
    });

    console.log(`Migration: ${taskElements.length} attributs 'data-task-id' ont été mis à jour vers 'data-job-id'.`);
}

// Note: La logique de mise à jour de la progression (updateJobProgress)
// est maintenant gérée directement dans les modules concernés (ex: ui-improved.js)
// via les notifications WebSocket qui transmettent le job_id.
// Ce fichier sert principalement de script de migration ponctuel si nécessaire,
// mais la logique active a été intégrée ailleurs pour une meilleure modularité.