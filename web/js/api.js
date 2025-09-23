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
        return text ? JSON.parse(text) : {};

    } catch (error) {
        console.error(`❌ API Error for ${url}:`, error);
        throw error;
    }
}