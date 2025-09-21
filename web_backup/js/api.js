// REMPLACEZ cette fonction dans api.js
export async function fetchAPI(endpoint, options = {}) {
    const baseURL = '/api';
    
    // Assurez-vous que l'endpoint commence par /api
    const url = endpoint.startsWith('/api') ? endpoint : `${baseURL}${endpoint}`;
    
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
