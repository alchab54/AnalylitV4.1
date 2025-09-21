// web/js/api.js
import { showToast } from './ui-improved.js';

/**
 * Generic function to fetch data from the API.
 * @param {string} url - The API endpoint (with or without /api prefix).
 * @param {object} options - Fetch options (method, headers, body).
 * @returns {Promise<any|null>} - Parsed JSON, [] for empty collections, or null.
 */
export async function fetchAPI(url, options = {}) {
  const apiUrl = url.startsWith('/') && !url.startsWith('/api') ? `/api${url}` : url;

  // Set headers for JSON body, but leave it for FormData
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    options.headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    options.body = JSON.stringify(options.body);
  } else if (options.body instanceof FormData && options.headers) {
    // CORRECTION : Pour FormData, le navigateur DOIT définir le Content-Type.
    // On supprime donc tout Content-Type défini manuellement pour éviter les conflits.
    delete options.headers['Content-Type'];
    delete options.headers['content-type'];
  }

  try {
    const response = await fetch(apiUrl, options);
    if (!response.ok) {
      let errorData = { message: `API request failed with status ${response.status}: ${response.statusText}` };
      try {
        // Try to parse a JSON error message from the backend
        const errorJson = await response.json();
        if (errorJson.message) {
          errorData.message = errorJson.message;
        }
      } catch {
        // If the error response is not JSON, use the default message
      }
      throw new Error(errorData.message);
    }

    const text = await response.text();
    if (!text) {
      // Return [] for obvious collection endpoints
      const isCollection = url.includes('/results') || url.includes('/extractions') || url.includes('/grids') || url.includes('/models') || url.endsWith('/projects') || url.endsWith('/analyses') || url.endsWith('/chat-messages');
      return isCollection ? [] : null;
    }
    return JSON.parse(text);
  } catch (error) {
    console.error(`Fetch API Error for URL ${apiUrl}:`, error);
    showToast(`Erreur de communication avec l'API: ${error.message}`, 'error');
    throw error;
  }
}
