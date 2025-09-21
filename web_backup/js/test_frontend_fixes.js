// Script de test des corrections frontend
async function testAPIEndpoints() {
    console.log('=== Test des corrections API ===');
    
    try {
        // Test 1: Vérification endpoint projets
        const projects = await fetchAPI('/projects');
        console.log('✓ Endpoint /projects OK');
        
        // Test 2: Vérification endpoint tâches  
        const tasks = await fetchAPI('/tasks/status');
        console.log('✓ Endpoint /tasks/status OK');
        console.log('Structure retournée:', Object.keys(tasks));
        
        // Test 3: Vérification présence job_id
        if (tasks.tasks && tasks.tasks.length > 0) {
            const firstTask = tasks.tasks[0];
            if (firstTask.job_id) {
                console.log('✓ Structure job_id confirmée');
            } else if (firstTask.task_id) {
                console.warn('⚠️ Structure task_id détectée - correction nécessaire');
            }
        }
        
    } catch (error) {
        console.error('❌ Erreur test API:', error);
    }
}

// Lancer le test
testAPIEndpoints();
