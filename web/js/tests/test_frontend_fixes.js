import { fetchAPI } from '../api.js';

async function testAPIEndpoints() {
    console.log('=== Test des corrections API ===');
    try {
        const projects = await fetchAPI('/projects');
        console.log('✓ Endpoint /projects OK');

        const tasks = await fetchAPI('/tasks/status');
        console.log('✓ Endpoint /tasks/status OK');

        if (Array.isArray(tasks.tasks) && tasks.tasks.length > 0) {
            const first = tasks.tasks[0];
            if (first.job_id) console.log('✓ Structure job_id confirmée');
            else if (first.task_id) console.warn('⚠️ task_id détecté - corriger le frontend');
        }
    } catch (error) {
        console.error('❌ Erreur test API:', error);
    }
}

testAPIEndpoints();