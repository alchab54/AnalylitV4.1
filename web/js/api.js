// web/js/api.js

/**
 * Generic function to fetch data from the API.
 * @param {string} url - The API endpoint.
 * @param {object} options - Fetch options (method, headers, body).
 * @returns {Promise<any>} - The JSON response from the API.
 */
export async function fetchAPI(url, options = {}) {
    const apiUrl = url.startsWith('/') && !url.startsWith('/api') ? `/api${url}` : url;
    try {
        const response = await fetch(apiUrl, options);
        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
            }
            throw new Error(errorData.message || `API error: ${response.statusText}`);
        }
        const text = await response.text();
        return text ? JSON.parse(text) : {};
    } catch (error) {
        console.error(`Fetch API Error for URL ${apiUrl}:`, error);
        throw error;
    }
}

