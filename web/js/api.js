// Client API CORRIGÉ pour éviter les doubles /api/
export async function fetchAPI(endpoint, options = {}) {
    // ✅ CORRECTION: Utiliser une URL absolue pour appeler directement le backend sur le port 5001,
    // en contournant le proxy du serveur de développement (http-server sur 8888).
    const API_BASE_URL = 'http://localhost:5001';
    const url = `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

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