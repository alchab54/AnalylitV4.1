// REMPLACEZ cette fonction dans api.js
export async function fetchAPI(endpoint, options = {}) {
    let url;
    // Détecte si l'endpoint est une URL complète ou un chemin relatif.
    if (endpoint.startsWith('http')) {
        url = endpoint; // Utiliser l'URL telle quelle si elle est absolue
    } else {
        // Construit une URL propre en s'assurant qu'il n'y a qu'un seul préfixe /api.
        // Exemple: '/projects' -> '/api/projects'
        // Exemple: '/api/projects' -> '/api/projects'
        url = `/api/${endpoint.replace(/^\/api\//, '').replace(/^\//, '')}`;
    }

    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    };

    try {
        const response = await fetch(url, defaultOptions);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
        
        return await response.text();
    } catch (error) {
        console.error(`API Error for ${url}:`, error);
        throw error;
    }
}
