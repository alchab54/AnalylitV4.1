// web/js/utils.js - Utilitaires JavaScript pour AnalyLit V4.1

/**
 * Fonction debounce - Retarde l'exécution d'une fonction jusqu'à ce qu'un certain délai se soit écoulé
 * depuis le dernier appel. Essentielle pour les événements de scroll, resize, input, etc.
 * 
 * @param {Function} func - Fonction à "debouncer"
 * @param {number} wait - Délai d'attente en millisecondes
 * @param {boolean} immediate - Si true, déclenche à la première invocation
 * @returns {Function} Fonction debouncée
 */
export function debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func.apply(this, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(this, args);
    };
}

/**
 * Fonction throttle - Limite le nombre d'exécutions d'une fonction à une fois par intervalle
 * 
 * @param {Function} func - Fonction à "throttler"
 * @param {number} limit - Intervalle minimum entre les exécutions (ms)
 * @returns {Function} Fonction throttlée
 */
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Génère un ID unique basé sur la date et un nombre aléatoire
 * 
 * @param {string} prefix - Préfixe optionnel pour l'ID
 * @returns {string} ID unique
 */
export function generateUniqueId(prefix = 'id') {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substr(2, 5);
    return `${prefix}_${timestamp}_${randomStr}`;
}

/**
 * Formate une date au format français
 * 
 * @param {Date|string|number} date - Date à formater
 * @param {Object} options - Options de formatage
 * @returns {string} Date formatée
 */
export function formatDate(date, options = {}) {
    const defaultOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        ...options
    };
    
    try {
        const dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) {
            return 'Date invalide';
        }
        return new Intl.DateTimeFormat('fr-FR', defaultOptions).format(dateObj);
    } catch (error) {
        console.error('Erreur formatage date:', error);
        return 'Date invalide';
    }
}

/**
 * Formate un nombre avec séparateurs de milliers
 * 
 * @param {number} number - Nombre à formater
 * @param {string} locale - Locale (défaut: fr-FR)
 * @returns {string} Nombre formaté
 */
export function formatNumber(number, locale = 'fr-FR') {
    if (typeof number !== 'number' || isNaN(number)) {
        return '0';
    }
    return new Intl.NumberFormat(locale).format(number);
}

/**
 * Échappe les caractères HTML pour éviter les injections XSS
 * 
 * @param {string} text - Texte à échapper
 * @returns {string} Texte échappé
 */
export function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '/': '&#x2F;'
    };
    
    return text.replace(/[&<>"'\/]/g, (s) => map[s]);
}

/**
 * Valide une adresse email
 * 
 * @param {string} email - Email à valider
 * @returns {boolean} True si valide
 */
export function isValidEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return typeof email === 'string' && emailRegex.test(email);
}

/**
 * Valide un DOI (Digital Object Identifier)
 * 
 * @param {string} doi - DOI à valider
 * @returns {boolean} True si valide
 */
export function isValidDoi(doi) {
    const doiRegex = /^10\.\d{4,}\/[-._;()\/:a-zA-Z0-9]+$/;
    return typeof doi === 'string' && doiRegex.test(doi);
}

/**
 * Tronque un texte à une longueur donnée avec ellipses
 * 
 * @param {string} text - Texte à tronquer
 * @param {number} maxLength - Longueur maximale
 * @param {string} suffix - Suffixe (défaut: '...')
 * @returns {string} Texte tronqué
 */
export function truncateText(text, maxLength, suffix = '...') {
    if (typeof text !== 'string' || text.length <= maxLength) {
        return text;
    }
    return text.substr(0, maxLength - suffix.length) + suffix;
}

/**
 * Transforme un texte en slug URL-friendly
 * 
 * @param {string} text - Texte à transformer
 * @returns {string} Slug
 */
export function slugify(text) {
    if (typeof text !== 'string') return '';
    
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
        .replace(/[^a-z0-9 -]/g, '') // Ne garde que lettres, chiffres, espaces, tirets
        .replace(/\s+/g, '-') // Remplace espaces par tirets
        .replace(/-+/g, '-') // Supprime tirets multiples
        .trim('-'); // Supprime tirets en début/fin
}

/**
 * Deep clone d'un objet (évite les références)
 * 
 * @param {*} obj - Objet à cloner
 * @returns {*} Clone profond
 */
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    if (typeof obj === 'object') {
        const cloned = {};
        Object.keys(obj).forEach(key => {
            cloned[key] = deepClone(obj[key]);
        });
        return cloned;
    }
}

/**
 * Mélange aléatoirement un tableau (Fisher-Yates shuffle)
 * 
 * @param {Array} array - Tableau à mélanger
 * @returns {Array} Tableau mélangé
 */
export function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Groupe les éléments d'un tableau par une propriété
 * 
 * @param {Array} array - Tableau à grouper
 * @param {string|Function} key - Clé ou fonction de groupage
 * @returns {Object} Objet groupé
 */
export function groupBy(array, key) {
    if (!Array.isArray(array)) return {};
    
    return array.reduce((groups, item) => {
        const groupKey = typeof key === 'function' ? key(item) : item[key];
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(item);
        return groups;
    }, {});
}

/**
 * Calcule la différence entre deux tableaux
 * 
 * @param {Array} arr1 - Premier tableau
 * @param {Array} arr2 - Deuxième tableau
 * @returns {Array} Éléments présents dans arr1 mais pas dans arr2
 */
export function arrayDifference(arr1, arr2) {
    if (!Array.isArray(arr1) || !Array.isArray(arr2)) return [];
    return arr1.filter(item => !arr2.includes(item));
}

/**
 * Supprime les doublons d'un tableau
 * 
 * @param {Array} array - Tableau avec doublons potentiels
 * @param {string} key - Clé pour la comparaison (objets)
 * @returns {Array} Tableau sans doublons
 */
export function removeDuplicates(array, key = null) {
    if (!Array.isArray(array)) return [];
    
    if (key) {
        const seen = new Set();
        return array.filter(item => {
            const keyValue = item[key];
            if (seen.has(keyValue)) return false;
            seen.add(keyValue);
            return true;
        });
    }
    
    return [...new Set(array)];
}

/**
 * Convertit une taille en bytes vers un format lisible
 * 
 * @param {number} bytes - Taille en bytes
 * @param {number} decimals - Nombre de décimales
 * @returns {string} Taille formatée
 */
export function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Vérifie si une valeur est vide (null, undefined, chaîne vide, tableau vide, objet vide)
 * 
 * @param {*} value - Valeur à vérifier
 * @returns {boolean} True si vide
 */
export function isEmpty(value) {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (typeof value === 'object' && Object.keys(value).length === 0) return true;
    return false;
}

/**
 * Attend un délai donné (pour async/await)
 * 
 * @param {number} ms - Délai en millisecondes
 * @returns {Promise} Promise qui résout après le délai
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Copie du texte dans le presse-papiers
 * 
 * @param {string} text - Texte à copier
 * @returns {Promise<boolean>} True si succès
 */
export async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        } else {
            // Fallback pour les anciens navigateurs
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'absolute';
            textArea.style.left = '-999999px';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            return true;
        }
    } catch (error) {
        console.error('Erreur copie presse-papiers:', error);
        return false;
    }
}

/**
 * Détecte le type de device (mobile, tablet, desktop)
 * 
 * @returns {string} Type de device
 */
export function getDeviceType() {
    const width = window.innerWidth;
    if (width <= 768) return 'mobile';
    if (width <= 1024) return 'tablet';
    return 'desktop';
}

/**
 * Retourne une couleur aléatoire en hexadécimal
 * 
 * @returns {string} Couleur hexadécimale
 */
export function getRandomColor() {
    return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
}

/**
 * Convertit une couleur hex en RGB
 * 
 * @param {string} hex - Couleur hexadécimale
 * @returns {Object|null} Objet {r, g, b} ou null si invalide
 */
export function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

/**
 * Extrait les mots-clés d'un texte (supprime mots vides français)
 * 
 * @param {string} text - Texte à analyser
 * @param {number} minLength - Longueur minimale des mots
 * @returns {Array} Liste des mots-clés
 */
export function extractKeywords(text, minLength = 3) {
    if (typeof text !== 'string') return [];
    
    const stopWords = new Set([
        'le', 'de', 'et', 'à', 'un', 'il', 'être', 'et', 'en', 'avoir', 'que', 'pour',
        'dans', 'ce', 'son', 'une', 'sur', 'avec', 'ne', 'se', 'pas', 'tout', 'plus',
        'par', 'grand', 'bien', 'être', 'autre', 'même', 'celui', 'cette', 'ces',
        'the', 'of', 'and', 'a', 'to', 'in', 'is', 'you', 'that', 'it', 'he', 'was',
        'for', 'on', 'are', 'as', 'with', 'his', 'they', 'i', 'at', 'be', 'this'
    ]);
    
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length >= minLength && !stopWords.has(word))
        .filter((word, index, arr) => arr.indexOf(word) === index);
}

/**
 * Calcule la similarité entre deux chaînes (algorithme de Levenshtein simplifié)
 * 
 * @param {string} str1 - Première chaîne
 * @param {string} str2 - Deuxième chaîne
 * @returns {number} Score de similarité (0-1)
 */
export function stringSimilarity(str1, str2) {
    if (typeof str1 !== 'string' || typeof str2 !== 'string') return 0;
    if (str1 === str2) return 1;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
}

/**
 * Calcule la distance de Levenshtein entre deux chaînes
 * 
 * @param {string} str1 - Première chaîne
 * @param {string} str2 - Deuxième chaîne
 * @returns {number} Distance de Levenshtein
 */
function levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    
    return matrix[str2.length][str1.length];
}

// Export de compatibilité globale pour le débogage
if (typeof window !== 'undefined') {
    window.AnalyLitUtils = {
        debounce,
        throttle,
        generateUniqueId,
        formatDate,
        formatNumber,
        escapeHtml,
        isValidEmail,
        isValidDoi,
        truncateText,
        slugify,
        deepClone,
        shuffleArray,
        groupBy,
        arrayDifference,
        removeDuplicates,
        formatBytes,
        isEmpty,
        sleep,
        copyToClipboard,
        getDeviceType,
        getRandomColor,
        hexToRgb,
        extractKeywords,
        stringSimilarity
    };
}