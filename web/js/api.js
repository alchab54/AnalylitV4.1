// Client API CORRIGÉ pour éviter les doubles /api/

/**
 * Constructs the full API URL including the base path and /api prefix.
 * @param {string} endpoint - The API endpoint (e.g., '/projects').
 * @returns {Promise<string>} The full URL for the API endpoint.
 */
export async function getApiUrl(endpoint) {
    // This function seems to be the source of inconsistent URL prefixing.
    // Let's simplify and make it robust directly inside fetchAPI.
    // We will construct the URL there.
    // This function is no longer the primary URL builder to avoid confusion.
    const { CONFIG } = await import('./constants.js'); // Keep for base URL
    const API_BASE_URL = `${CONFIG.API_BASE_URL}`;
    // The /api prefix will be handled by fetchAPI
    return `${API_BASE_URL}${endpoint}`;
}

export async function fetchAPI(endpoint, options = {}) {
    // ✅ CORRECTION SYSTÉMIQUE: Assurer que tous les appels API sont préfixés par /api.
    const { CONFIG } = await import('./constants.js'); // This was already correct
    // ✅ CORRECTION: Simplifier la construction de l'URL. La base URL contient déjà '/api'.
    const url = `${CONFIG.API_BASE_URL}${endpoint}`;

    const isFormData = options.body instanceof FormData;

    const defaultOptions = {
        headers: {
            'Accept': 'application/json',
            ...options.headers,
        },
        ...options,
    };

    // Ne pas définir Content-Type pour FormData, le navigateur le fera
    if (!isFormData) {
        defaultOptions.headers['Content-Type'] = 'application/json';
    } else {
        // Supprimer le Content-Type que le navigateur doit définir lui-même
        delete defaultOptions.headers['Content-Type'];
    }

    // Ne stringify que si ce n'est pas un FormData
    if (defaultOptions.body && typeof defaultOptions.body === 'object' && !isFormData) {
        defaultOptions.body = JSON.stringify(defaultOptions.body);
    }

    console.log(`🔗 API Request: ${defaultOptions.method || 'GET'} ${url}`);

    try {
        const response = await fetch(url, defaultOptions);

        if (!response.ok) {
            // Tenter de lire le corps de la réponse pour un message d'erreur plus détaillé.
            let errorMsg = `Erreur HTTP ${response.status}: ${response.statusText}`;
            const errorText = await response.text().catch(() => null); // Ne pas planter si le corps est vide

            try {
                // Essayer de parser comme JSON, ce qui est courant pour les erreurs API.
                const errorData = errorText ? JSON.parse(errorText) : { message: response.statusText };
                errorMsg = errorData.error || errorData.message || errorMsg;
            } catch (e) {
                // Si ce n'est pas du JSON, utiliser le texte brut s'il existe.
                if (errorText) {
                    errorMsg = `${errorMsg} - ${errorText.substring(0, 150)}`; // Afficher un extrait du texte d'erreur
                }
            }
            throw new Error(errorMsg);
        }
        
        const text = await response.text();
        if (!text) {
            return {}; // Retourner un objet vide pour les réponses 204 No Content
        }
        return JSON.parse(text);

    } catch (error) {
        console.error(`❌ API Error for ${url}:`, error);
        throw error;
    }
}

export async function fetchFile(endpoint, options = {}) {
    const { CONFIG } = await import('./constants.js');
    const url = `${CONFIG.API_BASE_URL}${endpoint}`;

    console.log(`🔗 File Request: ${options.method || 'GET'} ${url}`);

    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            throw new Error(`Erreur HTTP ${response.status}: ${response.statusText}`);
        }

        const blob = await response.blob();
        const contentDisposition = response.headers.get('content-disposition');
        let filename = 'download';
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
            if (filenameMatch.length > 1) {
                filename = filenameMatch[1];
            }
        }
        return { blob, filename };

    } catch (error) {
        console.error(`❌ File Error for ${url}:`, error);
        throw error;
    }
}