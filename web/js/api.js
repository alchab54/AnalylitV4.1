// web/js/api.js

/**
 * Generic function to fetch data from the API.
 * @param {string} url - The API endpoint.
 * @param {object} options - Fetch options (method, headers, body).
 * @returns {Promise<any>} - The JSON response from the API.
 */
export async function fetchAPI(url, options = {}) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `API error: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Fetch API Error:', error);
        throw error;
    }
}
