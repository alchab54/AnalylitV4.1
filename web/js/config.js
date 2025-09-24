// web/js/config.js
// Configuration centralisée pour l'application AnalyLit V4.1

const CONFIG = {
    // URL de base de l'API backend.
    // En développement, elle pointe vers le même serveur.
    // En production, elle pourrait pointer vers une URL différente.
    API_BASE_URL: '/',

    // URL du serveur WebSocket pour les mises à jour en temps réel.
    WEBSOCKET_URL: `ws://${window.location.host}/ws`,

    // Clés pour le stockage local (localStorage)
    LOCAL_STORAGE_LAST_PROJECT: 'analylit_last_project_id',
    LOCAL_STORAGE_LAST_SECTION: 'analylit_last_section',
    LOCAL_STORAGE_THEME: 'analylit_theme',
    LOCAL_STORAGE_USER_PREFS: 'analylit_user_prefs',

    // Paramètres de l'application
    APP_VERSION: '4.1.0',
    DEBUG_MODE: true, // Mettre à false en production
    DEFAULT_THEME: 'light', // Thème par défaut ('light', 'dark', 'system')

    // Paramètres pour les requêtes API
    API_TIMEOUT: 15000, // Timeout de 15 secondes pour les requêtes
    MAX_RETRIES: 2,     // Nombre de tentatives en cas d'échec réseau
};

// Export de l'objet de configuration pour qu'il soit importable
export default CONFIG;
