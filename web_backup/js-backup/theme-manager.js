// web/js/theme-manager.js
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
        return localStorage.getItem('analylit-theme');
    }

    storeTheme(theme) {
        localStorage.setItem('analylit-theme', theme);
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-color-scheme', theme);
        this.currentTheme = theme;
        this.storeTheme(theme);
        this.updateThemeButton();
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme);
    }

    setTheme(theme) {
        if (['light', 'dark', 'auto'].includes(theme)) {
            if (theme === 'auto') {
                this.applyTheme(this.getSystemTheme());
                localStorage.removeItem('analylit-theme');
            } else {
                this.applyTheme(theme);
            }
        }
    }

    setupSystemThemeListener() {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!this.getStoredTheme()) { // Only follow system if no stored preference
                this.applyTheme(e.matches ? 'dark' : 'light');
            }
        });
    }

    setupThemeToggle() {
        // Create theme toggle button if it doesn't exist
        if (!document.getElementById('theme-toggle')) {
            const themeToggle = document.createElement('button');
            themeToggle.id = 'theme-toggle';
            themeToggle.className = 'btn btn--icon theme-toggle';
            themeToggle.setAttribute('aria-label', 'Changer le thème');
            themeToggle.title = 'Changer le thème';
            
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
            const icon = this.currentTheme === 'light' ? '🌙' : '☀️';
            const label = this.currentTheme === 'light' ? 'Mode sombre' : 'Mode clair';
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