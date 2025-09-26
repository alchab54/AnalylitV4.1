// Client API CORRIGÉ pour éviter les doubles /api/
export async function fetchAPI(endpoint, options = {}) {
    const url = endpoint.startsWith('/api/') ? endpoint : `/api${endpoint}`;

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
            let errorMsg = `Erreur ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorData.message || errorMsg;
            } catch (e) { 
                errorMsg = `Erreur HTTP ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMsg);
        }
        
        const text = await response.text();
        if (!text) {
            if (endpoint.includes('/articles') || endpoint.includes('/results')) {
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