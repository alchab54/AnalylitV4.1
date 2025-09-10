// ============================
// API Layer
// ============================

/**
 * Wrapper pour l'API fetch.
 * @param {string} url - L'URL de l'endpoint API (ex: /projects)
 * @param {object} options - Les options de fetch (method, body, headers)
 * @returns {Promise<any>} - La réponse JSON de l'API
 */
async function fetchAPI(url, options = {}) {
    const headers = {
        ...options.headers,
    };

    // Ne pas définir Content-Type pour les FormData, le navigateur le fait.
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const config = {
        ...options,
        headers,
    };

    // Si le corps est un objet, le stringify, sauf si c'est un FormData
    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
        config.body = JSON.stringify(config.body);
    }
    
    // Préfixer avec /api si nécessaire
    const fullUrl = url.startsWith('/api') ? url : `/api${url}`;

    try {
        const response = await fetch(fullUrl, config);

        // Gérer les réponses sans contenu
        if (response.status === 204) {
            return null;
        }
        
        const responseData = await response.json().catch(() => null);

        if (!response.ok) {
            const message = responseData?.message || responseData?.error || `Erreur HTTP: ${response.status}`;
            throw new Error(message);
        }

        return responseData;
    } catch (error) {
        console.error(`Erreur fetchAPI pour ${url}:`, error);
        // Propage l'erreur pour que le code appelant puisse la gérer
        throw error;
    }
}