/**
 * @jest-environment jsdom
 */
import { ThemeManager } from './theme-manager.js'; // Assurez-vous que le chemin est correct
import { CONFIG } from './constants.js'; // Assurez-vous que le chemin est correct

// Mocker localStorage pour isoler les tests
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mocker window.matchMedia pour simuler les préférences système
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false, // Par défaut, simule le mode 'light'
    media: query,
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe('Module ThemeManager', () => {
  beforeEach(() => {
    // Réinitialiser les mocks et le DOM avant chaque test
    localStorage.clear();
    jest.clearAllMocks();
    document.body.innerHTML = '<header class="app-header__right"></header>';
    // ✅ CORRECTION: Réinitialiser le mock de matchMedia à une valeur par défaut (light) avant chaque test
    window.matchMedia.mockImplementation(query => ({
      matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn()
    }));
    document.documentElement.removeAttribute('data-color-scheme');
  });

  test('devrait initialiser avec le thème système (light) par défaut', () => {
    window.matchMedia.mockImplementation(query => ({ matches: false, addEventListener: jest.fn() }));
    new ThemeManager();
    expect(document.documentElement.getAttribute('data-color-scheme')).toBe('light');
  });

  test('devrait initialiser avec le thème système (dark) par défaut', () => {
    window.matchMedia.mockImplementation(query => ({ matches: true, addEventListener: jest.fn() }));
    new ThemeManager();
    expect(document.documentElement.getAttribute('data-color-scheme')).toBe('dark');
  });

  test('devrait initialiser avec le thème stocké dans localStorage', () => {
    localStorage.setItem(CONFIG.LOCAL_STORAGE_THEME, 'dark');
    new ThemeManager();
    expect(document.documentElement.getAttribute('data-color-scheme')).toBe('dark');
    expect(localStorage.getItem(CONFIG.LOCAL_STORAGE_THEME)).toBe('dark');
  });

  test('toggleTheme devrait basculer de light à dark', () => {
    const themeManager = new ThemeManager(); // Initialise en 'light'
    expect(themeManager.currentTheme).toBe('light');

    themeManager.toggleTheme();

    expect(themeManager.currentTheme).toBe('dark');
    expect(document.documentElement.getAttribute('data-color-scheme')).toBe('dark');
    expect(localStorage.getItem(CONFIG.LOCAL_STORAGE_THEME)).toBe('dark');
  });

  test('setTheme devrait appliquer le thème "dark" et le stocker', () => {
    const themeManager = new ThemeManager();
    themeManager.setTheme('dark');

    expect(themeManager.currentTheme).toBe('dark');
    expect(document.documentElement.getAttribute('data-color-scheme')).toBe('dark');
    expect(localStorage.getItem(CONFIG.LOCAL_STORAGE_THEME)).toBe('dark');
  });

  test('setTheme("auto") devrait appliquer le thème système et supprimer le stockage', () => {
    localStorage.setItem(CONFIG.LOCAL_STORAGE_THEME, 'light');
    window.matchMedia.mockImplementation(query => ({ matches: true, addEventListener: jest.fn() })); // Système est 'dark'

    const themeManager = new ThemeManager();
    themeManager.setTheme('auto');

    expect(themeManager.currentTheme).toBe('dark');
    expect(document.documentElement.getAttribute('data-color-scheme')).toBe('dark');
    expect(localStorage.getItem(CONFIG.LOCAL_STORAGE_THEME)).toBeNull();
  });

  test('devrait créer le bouton de bascule s\'il n\'existe pas', () => {
    expect(document.getElementById('theme-toggle')).toBeNull();
    new ThemeManager();
    expect(document.getElementById('theme-toggle')).not.toBeNull();
  });

  test('le clic sur le bouton de bascule devrait appeler toggleTheme', () => {
    const themeManager = new ThemeManager();
    const toggleSpy = jest.spyOn(themeManager, 'toggleTheme');
    const button = document.getElementById('theme-toggle');

    button.click();

    expect(toggleSpy).toHaveBeenCalledTimes(1);
  });

  test('updateThemeButton devrait mettre à jour l\'icône et le titre du bouton', () => {
    const themeManager = new ThemeManager();
    const button = document.getElementById('theme-toggle');

    themeManager.applyTheme('dark');
    expect(button.innerHTML).toBe('☀️');
    expect(button.title).toBe('Mode clair');

    themeManager.applyTheme('light');
    expect(button.innerHTML).toBe('🌙');
    expect(button.title).toBe('Mode sombre');
  });

  test('createThemeSelector devrait retourner le HTML correct', () => {
    const themeManager = new ThemeManager();
    const selectorHtml = themeManager.createThemeSelector();
    expect(selectorHtml).toContain('<select id="theme-select"');
    // Par défaut, le thème est 'light', donc 'auto' ne sera pas sélectionné si un thème est déjà défini.
    // On vérifie que l'option 'light' est bien sélectionnée.
    expect(selectorHtml).not.toContain('<option value="auto" selected>');
    expect(selectorHtml).toContain('<option value="light" selected>');
  });

  test('handleThemeSelectChange devrait appeler setTheme avec la bonne valeur', () => {
    const themeManager = new ThemeManager();
    const setThemeSpy = jest.spyOn(themeManager, 'setTheme');
    const mockEvent = { target: { value: 'dark' } };

    themeManager.handleThemeSelectChange(mockEvent);

    expect(setThemeSpy).toHaveBeenCalledWith('dark');
  });
});