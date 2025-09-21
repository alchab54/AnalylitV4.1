// Script de migration job_id/task_id
export function migrateTaskReferences() {
    // Remplace toutes les références task_id par job_id dans le DOM
    const taskElements = document.querySelectorAll('[data-task-id]');
    taskElements.forEach(el => {
        const taskId = el.getAttribute('data-task-id');
        el.removeAttribute('data-task-id');
        el.setAttribute('data-job-id', taskId);
    });

    // Met à jour les event listeners
    document.addEventListener('socket:job_update', (event) => {
        const { job_id, status, progress } = event.detail;
        updateJobProgress(job_id, status, progress);
    });
}

function updateJobProgress(jobId, status, progress) {
    const jobElement = document.querySelector(`[data-job-id="${jobId}"]`);
    if (jobElement) {
        jobElement.querySelector('.job-status').textContent = status;
        jobElement.querySelector('.job-progress').textContent = `${progress}%`;
    }
}
