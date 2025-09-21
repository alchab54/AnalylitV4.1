import { fetchAPI } from '../web/js/api.js';

// Script de test des corrections frontend
async function testAPIEndpoints() {
    console.log('=== Test des corrections API ===');
    
    try {
        // On crée une version de fetchAPI SPÉCIFIQUE pour ce script de test
        // qui sait où se trouve le serveur Docker.
        const testFetchAPI = async (endpoint, options = {}) => {
            // C'EST LA LIGNE QUI CORRIGE TOUT
            const BASE_URL = 'http://localhost:8080/api';
            const url = `${BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint.replace(/^\/api/, '')}`;
            return await fetchAPI(url, options); // On réutilise votre logique existante
        };

        // Test 1: Vérification endpoint projets
        const projects = await testFetchAPI('/projects');
        console.log('✓ Endpoint /projects OK');
        
        // Test 2: Vérification endpoint tâches  
        const tasks = await testFetchAPI('/tasks/status');
        console.log('✓ Endpoint /tasks/status OK');
        
        // Test 3: Vérification présence job_id
        if (Array.isArray(tasks) && tasks.length > 0 && tasks[0].id) {
            console.log('✓ Structure de tâche confirmée avec un ID');
        }
        
    } catch (error) {
        console.error('❌ Erreur test API:', error);
    }
}

// Lancer le test
testAPIEndpoints();
