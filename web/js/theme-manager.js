// web/js/theme-manager.js
import { CONFIG } from './constants.js';

export class ThemeManager {
    // No direct appState access, uses localStorage and constants
    constructor() {
        this.currentTheme = this.getStoredTheme() || this.getSystemTheme();
        this.init();
    }

    init() {
        this.applyTheme(this.currentTheme);
        this.setupSystemThemeListener();
        this.setupThemeToggle();
    }

    getSystemTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    getStoredTheme() {
        return localStorage.getItem(CONFIG.LOCAL_STORAGE_THEME);
    }

    storeTheme(theme) {
        localStorage.setItem(CONFIG.LOCAL_STORAGE_THEME, theme);
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-color-scheme', theme);
        this.currentTheme = theme;
        this.storeTheme(theme);
        this.updateThemeButton();
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light'; // Use string literals as constants are not defined yet
        this.applyTheme(newTheme);
    }

    setTheme(theme) {
        if (['light', 'dark', 'auto'].includes(theme)) { // Use string literals
            if (theme === 'auto') {
                this.applyTheme(this.getSystemTheme());
                localStorage.removeItem(CONFIG.LOCAL_STORAGE_THEME);
            } else {
                this.applyTheme(theme);
            }
        }
    }

    setupSystemThemeListener() {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!this.getStoredTheme()) { // Only follow system if no stored preference // Read from localStorage
                this.applyTheme(e.matches ? 'dark' : 'light'); // Use string literals
            }
        });
    }

    setupThemeToggle() {
        // Create theme toggle button if it doesn't exist
        if (!document.getElementById('theme-toggle')) {
            const themeToggle = document.createElement('button');
            themeToggle.id = 'theme-toggle';
            themeToggle.className = 'btn btn--icon theme-toggle'; // Use string literals
            themeToggle.setAttribute('aria-label', 'Basculer le thème'); // Use string literals
            themeToggle.title = 'Basculer le thème'; // Use string literals

            const headerRight = document.querySelector('.app-header__right');
            if (headerRight) {
                headerRight.insertBefore(themeToggle, headerRight.firstChild);
            }

            themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        this.updateThemeButton();
    }

    updateThemeButton() {
        const button = document.getElementById('theme-toggle');
        if (button) {
            const icon = this.currentTheme === 'light' ? '🌙' : '☀️'; // Use string literals
            const label = this.currentTheme === 'light' ? 'Mode sombre' : 'Mode clair'; // Use string literals
            button.innerHTML = icon;
            button.title = label;
            button.setAttribute('aria-label', label);
        }
    }

    // Method to create theme selector dropdown
    createThemeSelector() {
        return `
            <div class="theme-selector">
                <label for="theme-select" class="form-label">Thème</label>
                <select id="theme-select" class="form-control">
                    <option value="auto" ${!this.getStoredTheme() ? 'selected' : ''}>Automatique</option>
                    <option value="light" ${this.currentTheme === 'light' && this.getStoredTheme() ? 'selected' : ''}>Clair</option>
                    <option value="dark" ${this.currentTheme === 'dark' && this.getStoredTheme() ? 'selected' : ''}>Sombre</option>
                </select>
            </div>
        `;
    }

    // Method to handle theme selector changes
    handleThemeSelectChange(event) {
        this.setTheme(event.target.value);
    }
}