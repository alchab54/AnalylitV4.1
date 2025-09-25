// Client API CORRIGÉ pour éviter les doubles /api/
export async function fetchAPI(endpoint, options = {}) {
    // Ne pas ajouter /api si déjà présent
    const url = endpoint.startsWith('/api/') ? endpoint : `/api${endpoint}`;

    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...options.headers,
        },
        ...options,
    };

    if (defaultOptions.body && typeof defaultOptions.body === 'object') {
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