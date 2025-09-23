// web/js/theme-manager.js
import { CONFIG, MESSAGES } from './constants.js';
export class ThemeManager {
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
        return localStorage.getItem(CONFIG.THEME_STORAGE_KEY);
    }

    storeTheme(theme) {
        localStorage.setItem(CONFIG.THEME_STORAGE_KEY, theme);
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-color-scheme', theme);
        this.currentTheme = theme;
        this.storeTheme(theme);
        this.updateThemeButton();
    }

    toggleTheme() {
        const newTheme = this.currentTheme === MESSAGES.themeLight ? MESSAGES.themeDark : MESSAGES.themeLight;
        this.applyTheme(newTheme);
    }

    setTheme(theme) {
        if ([MESSAGES.themeLight, MESSAGES.themeDark, MESSAGES.themeAuto].includes(theme)) {
            if (theme === MESSAGES.themeAuto) {
                this.applyTheme(this.getSystemTheme());
                localStorage.removeItem(CONFIG.THEME_STORAGE_KEY);
            } else {
                this.applyTheme(theme);
            }
        }
    }

    setupSystemThemeListener() {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!this.getStoredTheme()) { // Only follow system if no stored preference
                this.applyTheme(e.matches ? MESSAGES.themeDark : MESSAGES.themeLight);
            }
        });
    }

    setupThemeToggle() {
        // Create theme toggle button if it doesn't exist
        if (!document.getElementById('theme-toggle')) {
            const themeToggle = document.createElement('button');
            themeToggle.id = 'theme-toggle';
            themeToggle.className = 'btn btn--icon theme-toggle';
            themeToggle.setAttribute('aria-label', MESSAGES.themeToggleLabel);
            themeToggle.title = MESSAGES.themeToggleLabel;
            
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
            const icon = this.currentTheme === MESSAGES.themeLight ? '🌙' : '☀️';
            const label = this.currentTheme === MESSAGES.themeLight ? MESSAGES.darkMode : MESSAGES.lightMode;
            button.innerHTML = icon;
            button.title = label;
            button.setAttribute('aria-label', label);
        }
    }

    // Method to create theme selector dropdown
    createThemeSelector() {
        return `
            <div class="theme-selector">
                <label for="theme-select" class="form-label">${MESSAGES.themeLabel}</label>
                <select id="theme-select" class="form-control">
                    <option value="${MESSAGES.themeAuto}" ${!this.getStoredTheme() ? 'selected' : ''}>${MESSAGES.themeAuto}</option>
                    <option value="${MESSAGES.themeLight}" ${this.currentTheme === MESSAGES.themeLight && this.getStoredTheme() ? 'selected' : ''}>${MESSAGES.themeLight}</option>
                    <option value="${MESSAGES.themeDark}" ${this.currentTheme === MESSAGES.themeDark && this.getStoredTheme() ? 'selected' : ''}>${MESSAGES.themeDark}</option>
                </select>
            </div>
        `;
    }

    // Method to handle theme selector changes
    handleThemeSelectChange(event) {
        this.setTheme(event.target.value);
    }
}