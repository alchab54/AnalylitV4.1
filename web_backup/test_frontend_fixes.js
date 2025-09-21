// web/js/test_frontend_fixes.js

import { fetchAPI } from './api.js';

/**
 * Script de test pour valider les corrections apportées au frontend,
 * notamment la transition de task_id vers job_id et la validité des endpoints.
 * À exécuter depuis la console du navigateur.
 */
export async function testFrontendFixes() {
    console.log('=== 🚀 Lancement du test des corrections frontend ===');
    
    try {
        // Test 1: Vérification de l'endpoint des projets
        console.log('Test 1: Appel de /api/projects...');
        const projects = await fetchAPI('/projects');
        console.log('  => ✓ Endpoint /projects OK.', Array.isArray(projects) ? `${projects.length} projets trouvés.` : '');
        
        // Test 2: Vérification de l'endpoint des tâches
        console.log('Test 2: Appel de /api/tasks/status...');
        const tasks = await fetchAPI('/tasks/status');
        console.log('  => ✓ Endpoint /tasks/status OK.');
        
        // Test 3: Vérification de la structure de la réponse des tâches
        if (Array.isArray(tasks) && tasks.length > 0) {
            const firstTask = tasks[0];
            console.log('  Structure de la première tâche:', firstTask);
            console.log(`  => ${firstTask.id ? '✓' : '❌'} Présence de "id" (job_id) confirmée.`);
        }
    } catch (error) {
        console.error('❌ Erreur lors du test des endpoints API:', error);
    }
}