import { fetchAPI as originalFetchAPI } from '../api.js';

// Script de test des corrections frontend
async function testAPIEndpoints() {
    console.log('=== Test des corrections API ===');
    
    try {
        // On crée une version de fetchAPI SPÉCIFIQUE pour ce script de test qui sait où se trouve le serveur Docker.
        async function testFetchAPI(endpoint, options = {}) {
            // C'EST LA LIGNE QUI CORRIGE TOUT
            const BASE_URL = 'http://localhost:8080';
            const url = `${BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
            return await originalFetchAPI(url, options); // On réutilise votre logique existante
        }

        // Test 1: Vérification endpoint projets
        const projects = await testFetchAPI('/api/projects');
        console.log('✓ Endpoint /projects OK');
        
        // Test 2: Vérification endpoint tâches  
        const tasks = await testFetchAPI('/api/tasks/status');
        console.log('✓ Endpoint /tasks/status OK');
        
        // Test 3: Vérification présence job_id
        if (Array.isArray(tasks) && tasks.length > 0 && tasks[0].id) { // The backend returns 'id', not 'job_id' at the top level for tasks.
            console.log('✓ Structure de tâche confirmée avec un ID');
        }
        
    } catch (error) {
        console.error('❌ Erreur test API:', error);
    }
}

// Lancer le test
testAPIEndpoints();
