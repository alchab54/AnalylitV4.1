# GEMINI-TESTS.MD - Implémentation Complète des Tests Frontend AnalyLit V4.1

## 🎯 **Contexte et Objectif Stratégique**

**Contexte :** Le frontend AnalyLit V4.1 a été nettoyé et refactorisé, mais manque de tests automatisés. Actuellement, le frontend est une "boîte noire" testée uniquement manuellement, ce qui rend chaque modification risquée pour la stabilité.

**Objectif :** Implémenter une stratégie complète de tests automatisés avec Jest (tests unitaires) et Cypress (tests End-to-End) pour sécuriser le code et faciliter les futures évolutions.

**Environnement de Travail :** VS Code local dans le répertoire `C:\Users\alich\Downloads\exported-assets (1)`

**Documentation de Référence :** Le fichier `TESTS-FRONTEND.md` contient tous les scénarios manuels qui serviront de base aux tests automatisés.

---

## 📂 **Architecture de Tests à Créer**

```
exported-assets (1)/
├── package.json (À CRÉER)
├── jest.config.js (À CRÉER)
├── cypress.config.js (À CRÉER - généré par Cypress)
├── cypress/ (À CRÉER - dossier généré par Cypress)
│   └── e2e/
│       ├── smoke-test.cy.js (À CRÉER)
│       ├── projects-workflow.cy.js (À CRÉER)
│       ├── articles-workflow.cy.js (À CRÉER)
│       └── analyses-workflow.cy.js (À CRÉER)
├── web/js/
│   ├── toast.test.js (À CRÉER)
│   ├── constants.test.js (À CRÉER)
│   ├── projects.test.js (À CRÉER)
│   └── articles.test.js (À CRÉER)
└── reports/ (À CRÉER - dossier des rapports)
    ├── coverage-frontend/
    └── cypress/
        ├── screenshots/
        └── videos/
```

---

## 🔧 **MISSION 1 - CRITIQUE : Configuration de l'Environnement de Test**

### Problème Identifié
Aucun framework de test n'est configuré pour le frontend, ce qui empêche l'automatisation des vérifications de qualité.

### Action Requise - Étape 1A : Créer le fichier package.json

**CRÉER** le fichier `package.json` à la racine du projet avec ce contenu EXACT :

```json
{
  "name": "analylit-frontend-tests",
  "version": "1.0.0",
  "description": "Suite de tests pour le frontend AnalyLit V4.1",
  "private": true,
  "type": "module",
  "scripts": {
    "test:unit": "jest --coverage --verbose",
    "test:unit:watch": "jest --watch --coverage",
    "test:e2e": "cypress run --headless",
    "test:e2e:open": "cypress open",
    "test:all": "npm run test:unit && npm run test:e2e",
    "install-deps": "npm install"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0",
    "cypress": "^13.10.0",
    "@testing-library/jest-dom": "^6.1.0"
  },
  "jest": {
    "testEnvironment": "jest-environment-jsdom",
    "roots": ["<rootDir>/web/js"],
    "testMatch": ["**/__tests__/**/*.js", "**/?(*.)+(spec|test).js"],
    "collectCoverageFrom": [
      "web/js/**/*.js",
      "!web/js/**/*.test.js",
      "!web/js/**/*.cy.js",
      "!web/js/tests/**",
      "!**/node_modules/**"
    ],
    "coverageDirectory": "reports/coverage-frontend",
    "coverageReporters": ["text", "lcov", "html"],
    "setupFilesAfterEnv": ["@testing-library/jest-dom"],
    "verbose": true
  }
}
```

### Action Requise - Étape 1B : Créer le fichier de configuration Jest

**CRÉER** le fichier `jest.config.js` à la racine avec ce contenu :

```javascript
export default {
  testEnvironment: 'jest-environment-jsdom',
  roots: ['<rootDir>/web/js'],
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  collectCoverageFrom: [
    'web/js/**/*.js',
    '!web/js/**/*.test.js',
    '!web/js/**/*.cy.js',
    '!web/js/tests/test_frontend_fixes.js', // Exclure l'ancien fichier temporaire
    '!**/node_modules/**'
  ],
  coverageDirectory: 'reports/coverage-frontend',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['@testing-library/jest-dom'],
  verbose: true,
  transform: {},
  extensionsToTreatAsEsm: ['.js'],
  globals: {
    'ts-jest': {
      useESM: true
    }
  }
};
```

### Instruction pour l'Agent
Après avoir créé ces fichiers, exécuter dans le terminal :
```bash
npm install
```

---

## 🧪 **MISSION 2 - HAUTE PRIORITÉ : Tests Unitaires avec Jest**

### Tests des Fonctions Utilitaires

#### 2A. Test du module toast.js

**CRÉER** le fichier `web/js/toast.test.js` avec ce contenu :

```javascript
/**
 * @jest-environment jsdom
 */
import { showToast, showSuccess, showError } from './toast.js';

describe('Module Toast - Notifications', () => {
  
  beforeEach(() => {
    // Nettoie le DOM avant chaque test
    document.body.innerHTML = '';
    
    // Mock de setTimeout pour contrôler les timers
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('showToast()', () => {
    test('devrait créer et afficher un toast avec message simple', () => {
      showToast('Message de test');
      
      const toastElement = document.querySelector('.toast');
      expect(toastElement).not.toBeNull();
      expect(toastElement.textContent).toContain('Message de test');
      expect(toastElement.classList.contains('toast-info')).toBe(true);
    });

    test('devrait afficher un toast de succès avec la bonne classe CSS', () => {
      showToast('Opération réussie', 'success');
      
      const toastElement = document.querySelector('.toast');
      expect(toastElement.classList.contains('toast-success')).toBe(true);
      expect(toastElement.querySelector('i.fa-check-circle')).not.toBeNull();
    });

    test('devrait afficher un toast d\'erreur avec la bonne classe CSS', () => {
      showToast('Erreur survenue', 'error');
      
      const toastElement = document.querySelector('.toast');
      expect(toastElement.classList.contains('toast-error')).toBe(true);
      expect(toastElement.querySelector('i.fa-times-circle')).not.toBeNull();
    });

    test('devrait supprimer le toast après le délai spécifié', () => {
      showToast('Message temporaire', 'info', 1000);
      
      expect(document.querySelector('.toast')).not.toBeNull();
      
      // Avance le temps de 1000ms
      jest.advanceTimersByTime(1000);
      
      // Avance encore de 300ms pour l'animation de fade-out
      jest.advanceTimersByTime(300);
      
      expect(document.querySelector('.toast')).toBeNull();
    });
  });

  describe('Fonctions de raccourci', () => {
    test('showSuccess() devrait créer un toast de succès', () => {
      showSuccess('Succès !');
      
      const toastElement = document.querySelector('.toast');
      expect(toastElement.classList.contains('toast-success')).toBe(true);
      expect(toastElement.textContent).toContain('Succès !');
    });

    test('showError() devrait créer un toast d\'erreur', () => {
      showError('Erreur !');
      
      const toastElement = document.querySelector('.toast');
      expect(toastElement.classList.contains('toast-error')).toBe(true);
      expect(toastElement.textContent).toContain('Erreur !');
    });
  });
});
```

#### 2B. Test du module constants.js

**CRÉER** le fichier `web/js/constants.test.js` :

```javascript
/**
 * @jest-environment jsdom
 */
import { SELECTORS, API_ENDPOINTS, MESSAGES } from './constants.js';

describe('Module Constants - Configuration centralisée', () => {
  
  describe('SELECTORS', () => {
    test('devrait contenir tous les sélecteurs DOM essentiels', () => {
      expect(SELECTORS.projectsList).toBeDefined();
      expect(SELECTORS.projectContainer).toBeDefined();
      expect(SELECTORS.resultsContainer).toBeDefined();
      expect(SELECTORS.settingsContainer).toBeDefined();
      
      // Vérification du format des sélecteurs
      expect(SELECTORS.projectsList).toMatch(/^[#.]/); // Commence par # ou .
      expect(SELECTORS.resultsContainer).toMatch(/^[#.]/);
    });
  });

  describe('API_ENDPOINTS', () => {
    test('devrait contenir tous les endpoints API essentiels', () => {
      expect(API_ENDPOINTS.projects).toBe('/projects');
      expect(API_ENDPOINTS.databases).toBe('/databases');
      expect(API_ENDPOINTS.analysisProfiles).toBe('/analysis-profiles');
    });

    test('les fonctions d\'endpoints dynamiques devraient fonctionner', () => {
      expect(API_ENDPOINTS.projectById('123')).toBe('/projects/123');
      expect(API_ENDPOINTS.gridById('proj1', 'grid2')).toBe('/projects/proj1/grids/grid2');
      expect(API_ENDPOINTS.projectExport('456')).toBe('/projects/456/export');
    });
  });

  describe('MESSAGES', () => {
    test('devrait contenir tous les messages utilisateur essentiels', () => {
      expect(MESSAGES.loading).toBeDefined();
      expect(MESSAGES.projectCreated).toBeDefined();
      expect(MESSAGES.projectDeleted).toBeDefined();
      expect(MESSAGES.noProjects).toBeDefined();
      
      // Vérification que les messages ne sont pas vides
      expect(MESSAGES.projectCreated).not.toBe('');
      expect(MESSAGES.loading).not.toBe('');
    });

    test('les fonctions de messages dynamiques devraient fonctionner', () => {
      const projectName = 'Test Project';
      const confirmMessage = MESSAGES.confirmDeleteProjectBody(projectName);
      expect(confirmMessage).toContain(projectName);
      expect(confirmMessage).toContain('strong'); // HTML markup présent
    });
  });
});
```

---

## 🎬 **MISSION 3 - MOYENNE PRIORITÉ : Tests End-to-End avec Cypress**

### Configuration Cypress

#### 3A. Initialiser Cypress

**INSTRUCTION POUR L'AGENT :** Exécuter cette commande dans le terminal :
```bash
npx cypress open
```

Puis choisir "E2E Testing" et suivre l'assistant de configuration.

#### 3B. Configuration personnalisée

**MODIFIER** le fichier `cypress.config.js` généré automatiquement avec ce contenu :

```javascript
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:8080',
    supportFile: false,
    video: true,
    screenshotOnRunFailure: true,
    screenshotsFolder: 'reports/cypress/screenshots',
    videosFolder: 'reports/cypress/videos',
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 8000,
    pageLoadTimeout: 30000,
    setupNodeEvents(on, config) {
      // Plugin events here
    },
  },
});
```

### Tests E2E Principaux

#### 3C. Test de Smoke (Vérification de base)

**CRÉER** le fichier `cypress/e2e/smoke-test.cy.js` :

```javascript
describe('Tests de Smoke - Vérifications de base AnalyLit', () => {
  
  beforeEach(() => {
    cy.visit('/');
  });

  it('Devrait charger la page principale sans erreur JavaScript', () => {
    // Vérification du chargement de la page
    cy.contains('h1', 'AnalyLit').should('be.visible');
    
    // Vérification qu'il n'y a pas d'erreurs dans la console
    cy.window().then((win) => {
      cy.spy(win.console, 'error').as('consoleError');
    });
    
    // Attendre le chargement complet
    cy.get('body').should('be.visible');
    
    // Vérifier qu'aucune erreur console n'a été émise
    cy.get('@consoleError').should('not.have.been.called');
  });

  it('Devrait afficher la section des projets par défaut', () => {
    cy.contains('Projets').should('be.visible');
    cy.get('[data-section-id="projects"]').should('have.class', 'active');
  });

  it('Devrait permettre la navigation entre les sections principales', () => {
    // Tester la navigation vers Recherche
    cy.get('[data-section-id="search"]').click();
    cy.get('#searchContainer').should('be.visible');
    
    // Tester la navigation vers Résultats
    cy.get('[data-section-id="results"]').click();
    cy.get('#resultsContainer').should('be.visible');
    
    // Tester la navigation vers Analyses
    cy.get('[data-section-id="analyses"]').click();
    cy.get('#analysisContainer').should('be.visible');
    
    // Retour aux Projets
    cy.get('[data-section-id="projects"]').click();
    cy.contains('Projets').should('be.visible');
  });

  it('Devrait vérifier la connexion WebSocket', () => {
    // Vérifier l'indicateur de connexion WebSocket
    cy.get('.connection-indicator', { timeout: 10000 })
      .should('be.visible')
      .and('contain', 'Connecté');
  });
});
```

#### 3D. Test du Workflow Projets

**CRÉER** le fichier `cypress/e2e/projects-workflow.cy.js` :

```javascript
describe('Workflow de Gestion des Projets', () => {
  
  beforeEach(() => {
    cy.visit('/');
    cy.get('[data-section-id="projects"]').click();
  });

  it('Devrait ouvrir et fermer la modale de création de projet', () => {
    // Ouvrir la modale
    cy.get('[data-action="create-project-modal"]').click();
    cy.get('#newProjectModal').should('be.visible');
    cy.contains('h2', 'Nouveau Projet').should('be.visible');
    
    // Fermer la modale
    cy.get('[data-action="close-modal"]').click();
    cy.get('#newProjectModal').should('not.exist');
  });

  it('Devrait créer un nouveau projet avec succès', () => {
    // Ouvrir la modale de création
    cy.get('[data-action="create-project-modal"]').click();
    
    // Remplir le formulaire
    cy.get('#projectName').type('Projet Test E2E');
    cy.get('#projectDescription').type('Description du projet créé par Cypress');
    cy.get('#analysisMode').select('standard');
    
    // Soumettre le formulaire
    cy.get('form[data-form="create-project"]').submit();
    
    // Vérifier la notification de succès
    cy.contains('.toast-success', 'Projet créé avec succès').should('be.visible');
    
    // Vérifier que le projet apparaît dans la liste
    cy.contains('.project-card', 'Projet Test E2E').should('be.visible');
  });

  it('Devrait afficher les détails d\'un projet sélectionné', () => {
    // Supposer qu'il y a au moins un projet
    cy.get('.project-card').first().click();
    
    // Vérifier l'affichage des détails
    cy.get('.project-detail').should('be.visible');
    cy.get('.metrics-grid').should('be.visible');
    cy.get('.metric-card').should('have.length.greaterThan', 0);
  });

  it('Devrait permettre la suppression d\'un projet', () => {
    // Créer d'abord un projet pour le supprimer
    cy.get('[data-action="create-project-modal"]').click();
    cy.get('#projectName').type('Projet à Supprimer');
    cy.get('#projectDescription').type('Ce projet sera supprimé');
    cy.get('form[data-form="create-project"]').submit();
    
    // Attendre la création
    cy.contains('.toast-success', 'Projet créé avec succès');
    
    // Supprimer le projet
    cy.contains('.project-card', 'Projet à Supprimer')
      .find('[data-action="delete-project"]')
      .click();
    
    // Confirmer la suppression
    cy.get('[data-action="confirm-delete-project"]').click();
    
    // Vérifier la notification de suppression
    cy.contains('.toast-success', 'Projet supprimé').should('be.visible');
    
    // Vérifier que le projet n'apparaît plus
    cy.contains('.project-card', 'Projet à Supprimer').should('not.exist');
  });
});
```

#### 3E. Test du Workflow Articles

**CRÉER** le fichier `cypress/e2e/articles-workflow.cy.js` :

```javascript
describe('Workflow de Gestion des Articles', () => {
  
  beforeEach(() => {
    cy.visit('/');
    
    // S'assurer qu'un projet est sélectionné
    cy.get('[data-section-id="projects"]').click();
    cy.get('.project-card').first().click();
    
    // Naviguer vers les résultats
    cy.get('[data-section-id="results"]').click();
  });

  it('Devrait afficher la liste des articles du projet sélectionné', () => {
    cy.get('#resultsContainer').should('be.visible');
    cy.get('#article-table-body').should('be.visible');
  });

  it('Devrait permettre la sélection multiple d\'articles', () => {
    // Vérifier la présence des checkboxes
    cy.get('.article-checkbox').should('have.length.greaterThan', 0);
    
    // Sélectionner plusieurs articles
    cy.get('.article-checkbox').first().check();
    cy.get('.article-checkbox').eq(1).check();
    
    // Vérifier que les boutons d'action sont activés
    cy.get('[data-action="delete-selected-articles"]').should('not.be.disabled');
    cy.get('[data-action="batch-screening"]').should('not.be.disabled');
  });

  it('Devrait ouvrir les détails d\'un article', () => {
    // Cliquer sur le premier article
    cy.get('.article-row').first().find('.article-title').click();
    
    // Vérifier l'ouverture de la modale de détails
    cy.get('#articleDetailModal').should('be.visible');
    cy.contains('h2', 'Détails de l\'article').should('be.visible');
    
    // Fermer la modale
    cy.get('[data-action="close-modal"]').click();
    cy.get('#articleDetailModal').should('not.exist');
  });

  it('Devrait permettre le screening par lot', () => {
    // Sélectionner des articles
    cy.get('.article-checkbox').first().check();
    cy.get('.article-checkbox').eq(1).check();
    
    // Lancer le screening par lot
    cy.get('[data-action="batch-screening"]').click();
    
    // Vérifier l'ouverture de la modale
    cy.get('#batchProcessModal').should('be.visible');
    cy.contains('h2', 'Lancer le Screening par Lot').should('be.visible');
    
    // Lancer le screening
    cy.get('[data-action="start-batch-screening"]').click();
    
    // Vérifier la notification de lancement
    cy.contains('.toast-success', 'Tâche de screening lancée').should('be.visible');
  });

  it('Devrait gérer l\'état vide quand aucun article n\'est présent', () => {
    // Supposer un projet sans articles
    // Cette partie nécessite un projet vide ou un mock
    cy.get('.empty-state').should('contain', 'Aucun article');
  });
});
```

---

## 🔧 **MISSION 4 - ORGANISATION : Scripts d'Exécution et Rapports**

### 4A. Scripts NPM pour l'exécution

Les scripts sont déjà définis dans le `package.json`. Voici comment les utiliser :

```bash
# Tests unitaires avec couverture
npm run test:unit

# Tests unitaires en mode watch (rechargement automatique)
npm run test:unit:watch

# Tests E2E en mode headless (sans interface)
npm run test:e2e

# Tests E2E avec interface Cypress
npm run test:e2e:open

# Lancer tous les tests
npm run test:all
```

### 4B. Configuration des rapports

**CRÉER** le dossier `reports/` avec la structure suivante :
```
reports/
├── coverage-frontend/     (généré par Jest)
├── cypress/
│   ├── screenshots/      (généré par Cypress)
│   └── videos/           (généré par Cypress)
```

---

## ✅ **Plan de Validation et Métriques de Succès**

### Critères de Succès

1. **Jest - Tests Unitaires :**
   - ✅ Au moins 85% de couverture de code pour les modules critiques
   - ✅ Tous les tests passent sans erreur
   - ✅ Temps d'exécution < 30 secondes

2. **Cypress - Tests E2E :**
   - ✅ Tous les workflows principaux automatisés
   - ✅ Tests s'exécutent sans faux positifs
   - ✅ Capture d'écran en cas d'échec

3. **Intégration :**
   - ✅ Pipeline de tests peut être exécuté d'une seule commande
   - ✅ Rapports lisibles et exploitables
   - ✅ Tests compatibles avec l'environnement Docker existant

### Commandes de Validation Finale

```bash
# 1. Installer toutes les dépendances
npm install

# 2. Lancer l'application (dans un autre terminal)
docker-compose up -d

# 3. Lancer tous les tests
npm run test:all

# 4. Vérifier les rapports
# - Coverage : reports/coverage-frontend/index.html
# - E2E Videos : reports/cypress/videos/
# - E2E Screenshots : reports/cypress/screenshots/
```

---

## 🚀 **Ordre d'Exécution Recommandé pour l'Agent**

1. **MISSION 1** (Configuration) - 15 minutes
   - Créer `package.json`
   - Créer `jest.config.js`
   - Exécuter `npm install`

2. **MISSION 2** (Tests Unitaires) - 45 minutes
   - Créer `web/js/toast.test.js`
   - Créer `web/js/constants.test.js`
   - Exécuter `npm run test:unit`

3. **MISSION 3** (Tests E2E) - 60 minutes
   - Initialiser Cypress avec `npx cypress open`
   - Configurer `cypress.config.js`
   - Créer les fichiers de test E2E
   - Exécuter `npm run test:e2e:open` pour validation

4. **MISSION 4** (Validation) - 15 minutes
   - Créer la structure `reports/`
   - Exécuter `npm run test:all`
   - Vérifier les rapports

**Temps Total Estimé : 2 heures 15 minutes**

---

