const BASE_URL = '/api';

export async function fetchAPI(endpoint, options = {}) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${BASE_URL}${cleanEndpoint}`;

    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...options.headers,
        },
        ...options,
    };

    // FIX: Body must be stringified for fetch API
    if (defaultOptions.body && typeof defaultOptions.body === 'object') {
        defaultOptions.body = JSON.stringify(defaultOptions.body);
    }

    console.log(`🔗 API Request: ${defaultOptions.method || 'GET'} ${url}`);

    try {
        const response = await fetch(url, defaultOptions);

        if (!response.ok) {
            let errorMsg = `Erreur interne du serveur`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorData.message || `Route non trouvée: ${defaultOptions.method || 'GET'} ${url}`;
            } catch (e) { /* Pas de JSON dans la réponse, on garde le message par défaut */ }
            throw new Error(errorMsg);
        }
        
        const text = await response.text();
        // Gère le cas où la réponse est vide
        if (!text) {
            // Si l'endpoint est une collection (ex: /results, /articles), retourne un tableau vide
            if (endpoint.includes('/results') || endpoint.includes('/articles')) {
                return [];
            }
            return {};
        }
        return JSON.parse(text);

    } catch (error) {
        console.error(`❌ API Error for ${url}:`, error);
        throw error;
    }
}