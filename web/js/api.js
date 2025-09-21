// web/js/api.js
import { showToast } from './ui-improved.js';

/**
 * Generic function to fetch data from the API.
 * @param {string} url - The API endpoint (with or without /api prefix).
 * @param {object} options - Fetch options (method, headers, body).
 * @returns {Promise<any|null>} - Parsed JSON, [] for empty collections, or null.
 */
export async function fetchAPI(endpoint, options = {}) {
    const baseURL = 'http://localhost:5001/api';

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
            let errorData = {};
            try {
                errorData = await response.json();
            } catch (e) {
                // The response was not JSON, which can happen with 404s, etc.
            }
            throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
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
