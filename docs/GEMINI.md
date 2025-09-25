# 🔍 Diagnostic Complet Frontend - Plan de Correction

## ❌ PROBLÈMES IDENTIFIÉS

Après vérification de votre frontend, j'ai identifié **plusieurs problèmes majeurs** qui causent les dysfonctionnements d'affichage :

### 🚨 **Problème 1 : Structure HTML Dupliquée**
```html
<!-- PROBLÈME CRITIQUE - Double balise body -->
<body>
    <script type="module">
        import './js/analyses.js';
    </script>
<body>  <!-- ⚠️ DEUXIÈME BALISE BODY - INVALIDE -->
```

### 🚨 **Problème 2 : CSS Conflictuels**
- **10 fichiers CSS** chargés simultanément créent des conflits
- Styles redondants et contradictoires
- Z-index conflictuels (navigation vs modales)

### 🚨 **Problème 3 : Navigation Incohérente**
```html
<!-- Bouton ATN avec attribut différent -->
<button class="app-nav__button" data-section="atn-analysis">  <!-- ⚠️ data-section au lieu de data-section-id -->
```

### 🚨 **Problème 4 : JavaScript Non-Chargé**
- Script `navigation-fix.js` référencé mais non-module
- Scripts manquants : `admin-dashboard.js`, `atn-analyzer.js`

## 🎯 **PLAN DE CORRECTION COMPLET**
Phase 1 
### **ÉTAPE 1 : HTML Principal Propre**

**Remplacer `web/index.html` par cette version corrigée :**

```html
<!DOCTYPE html>
<html lang="fr" data-color-scheme="light">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AnalyLit v4.1 - Plateforme IA pour Revues de Littérature</title>
    
    <!-- Meta tags -->
    <meta name="description" content="AnalyLit v4.1 - Plateforme intelligente pour la réalisation de revues de littérature scientifique avec IA.">
    <meta name="keywords" content="revue littérature, IA, recherche scientifique, méta-analyse">
    <meta name="author" content="AnalyLit Team">
    
    <!-- Favicon -->
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>🔬</text></svg>">
    
    <!-- CSS OPTIMISÉ - ORDRE CRITIQUE -->
    <link rel="stylesheet" href="css/enhanced-design-tokens.css">
    <link rel="stylesheet" href="css/thesis-essentials.css">
    <link rel="stylesheet" href="css/style-improved.css">
    <link rel="stylesheet" href="css/layout.css">
    <link rel="stylesheet" href="css/components.css">
    
    <!-- Scripts externes -->
    <script src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js" defer></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js" defer></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.2/socket.io.js" defer></script>
</head>
<body data-user-role="user" id="app-body">
    <!-- En-tête principal -->
    <header class="app-header" id="main-header">
        <div class="container">
            <div class="app-header__content">
                <div class="app-header__left">
                    <h1 class="app-header__title">
                        <span role="img" aria-hidden="true">🧬</span>
                        AnalyLit v4.1
                    </h1>
                </div>
                <div class="app-header__right">
                    <div id="connection-status" class="connection-indicator">
                        <span class="status-dot connected"></span>
                        <span class="status-text">Connecté</span>
                    </div>
                    <button class="btn btn--ghost" data-action="toggle-theme" title="Changer de thème">
                        🌙
                    </button>
                </div>
            </div>
        </div>
    </header>

    <!-- Navigation FIXE -->
    <nav class="app-nav" id="main-navigation" role="navigation" aria-label="Navigation principale">
        <div class="container">
            <button class="app-nav__button app-nav__button--active" data-action="show-section" data-section-id="projects">
                <span role="img" aria-hidden="true">📁</span> Projets
            </button>
            <button class="app-nav__button" data-action="show-section" data-section-id="search">
                <span role="img" aria-hidden="true">🔍</span> Recherche
            </button>
            <button class="app-nav__button" data-action="show-section" data-section-id="results">
                <span role="img" aria-hidden="true">📄</span> Résultats
            </button>
            <button class="app-nav__button" data-action="show-section" data-section-id="validation">
                <span role="img" aria-hidden="true">✅</span> Validation
            </button>
            <button class="app-nav__button" data-action="show-section" data-section-id="rob">
                <span role="img" aria-hidden="true">⚖️</span> Risk of Bias
            </button>
            <button class="app-nav__button" data-action="show-section" data-section-id="grids">
                <span role="img" aria-hidden="true">📋</span> Grilles
            </button>
            <button class="app-nav__button" data-action="show-section" data-section-id="analyses">
                <span role="img" aria-hidden="true">📊</span> Analyses
            </button>
            <button class="app-nav__button" data-action="show-section" data-section-id="atn-analysis">
                <span role="img" aria-hidden="true">🧠</span> Analyses ATN
            </button>
            <button class="app-nav__button" data-action="show-section" data-section-id="import">
                <span role="img" aria-hidden="true">📥</span> Import
            </button>
            <button class="app-nav__button" data-action="show-section" data-section-id="chat">
                <span role="img" aria-hidden="true">💬</span> Chat IA
            </button>
            <button class="app-nav__button" data-action="show-section" data-section-id="settings">
                <span role="img" aria-hidden="true">⚙️</span> Paramètres
            </button>
        </div>
    </nav>

    <!-- Contenu principal -->
    <main class="app-main" id="main-content" role="main">
        <div class="container">
            
            <!-- Section Projets -->
            <section id="projects" class="app-section active">
                <div class="section-header">
                    <div class="section-header__content">
                        <h2>Gestion des Projets</h2>
                        <p>Créez et gérez vos projets de revue de littérature.</p>
                    </div>
                    <div class="section-header__actions">
                        <button id="create-project-btn" class="btn btn-primary" data-action="create-project-modal">
                            <span role="img" aria-hidden="true">➕</span> Nouveau Projet
                        </button>
                    </div>
                </div>
                
                <div id="projects-list" class="projects-grid">
                    <!-- Les cartes de projet seront injectées ici -->
                </div>
                
                <!-- Détails du projet sélectionné -->
                <div id="projectDetail" class="project-detail" style="display: none;">
                    <div id="projectDetailContent" class="project-detail-content">
                        <!-- Contenu dynamique -->
                    </div>
                </div>
                
                <!-- État vide -->
                <div id="projectPlaceholder" class="placeholder" style="display: none;">
                    <div class="placeholder-icon">📁</div>
                    <h3>Aucun projet sélectionné</h3>
                    <p>Sélectionnez un projet pour voir ses détails</p>
                </div>
            </section>

            <!-- Section Recherche -->
            <section id="search" class="app-section" style="display: none;">
                <div id="searchContainer">
                    <form id="search-form">
                        <!-- Contenu injecté par thesis-workflow.js -->
                    </form>
                    <div id="search-results"></div>
                </div>
            </section>

            <!-- Section Résultats -->
            <section id="results" class="app-section" style="display:none">
                <div class="section-header">
                    <h2>Résultats de Recherche</h2>
                </div>
                <div id="results-list"></div>
            </section>

            <!-- Section Validation -->
            <section id="validation" class="app-section" style="display: none;">
                <div class="section-header">
                    <h2>Validation Inter-Évaluateurs</h2>
                </div>
                <div id="validationContainer">
                    <!-- Contenu validation -->
                </div>
            </section>

            <!-- Section Risk of Bias -->
            <section id="rob" class="app-section" style="display: none;">
                <div id="robContainer" class="rob-container">
                    <!-- Interface RoB injectée par rob-manager.js -->
                </div>
            </section>

            <!-- Section Grilles -->
            <section id="grids" class="app-section" style="display: none;">
                <div class="section-header">
                    <h2>Grilles d'Extraction</h2>
                </div>
                <div id="gridsContainer">
                    <!-- Contenu grilles -->
                </div>
            </section>

            <!-- Section Analyses -->
            <section id="analyses" class="app-section" style="display: none;">
                <div class="section-header">
                    <h2>Analyses du Projet</h2>
                    <div class="analysis-controls">
                        <button data-action="atn-analysis" class="btn btn--primary">
                            🧠 Analyse ATN
                        </button>
                        <button data-action="discussion-generation" class="btn btn--secondary">
                            💬 Discussion
                        </button>
                        <button data-action="knowledge-graph" class="btn btn--info">
                            🕸️ Graphe
                        </button>
                        <button data-action="export-analyses" class="btn btn--success">
                            📊 Export
                        </button>
                        <button data-action="show-prisma-modal" class="btn btn--info">
                            📋 PRISMA
                        </button>
                        <button data-action="show-advanced-analysis-modal" class="btn btn--warning">
                            🔬 Analyses Avancées
                        </button>
                    </div>
                </div>
                
                <div id="analysisContainer">
                    <div class="analysis-grid">
                        <div class="analysis-card analysis-card--ready">
                            <h4>Analyse ATN Multipartite</h4>
                            <p>Génération d'scores ATN automatisés</p>
                            <button data-action="run-atn-analysis" class="btn btn-primary">Lancer</button>
                        </div>
                        
                        <div class="analysis-card analysis-card--ready">
                            <h4>Discussion académique</h4>
                            <p>Génération automatique de discussion</p>
                            <button data-action="run-analysis" data-analysis-type="discussion" class="btn btn-primary">Lancer</button>
                        </div>
                        
                        <div class="analysis-card analysis-card--ready">
                            <h4>Graphe de connaissances</h4>
                            <p>Visualisation des relations conceptuelles</p>
                            <button data-action="run-analysis" data-analysis-type="knowledge_graph" class="btn btn-primary">Lancer</button>
                        </div>
                        
                        <div class="analysis-card analysis-card--done">
                            <h4>Analyse ATN Terminée</h4>
                            <p>Résultats disponibles</p>
                            <button data-action="view-analysis-results" data-target-id="atn-results">Voir résultats</button>
                            <button data-action="delete-analysis" data-analysis-type="atn_scores" class="btn btn--danger btn--sm">Supprimer</button>
                        </div>
                    </div>
                </div>
                
                <div id="atn-results" class="analysis-results" style="display: none;">
                    <h3>Résultats Analyse ATN</h3>
                    <p>Résultats de l'analyse ATN multipartite...</p>
                </div>

                <div class="analysis-empty" style="display: none;">
                    <p>Veuillez sélectionner un projet pour visualiser les analyses.</p>
                </div>
            </section>

            <!-- Section Analyses ATN Spécialisées -->
            <section id="atn-analysis" class="app-section" style="display: none;">
                <div id="atn-analysis-container" class="atn-container">
                    <!-- Interface ATN injectée par atn-analyzer.js -->
                </div>
            </section>

            <!-- Section Import -->
            <section id="import" class="app-section" style="display: none;">
                <div class="section-header">
                    <h2>Import & Gestion des Fichiers</h2>
                </div>
                <div id="importContainer">
                    <!-- Contenu import -->
                </div>
            </section>

            <!-- Section Chat IA -->
            <section id="chat" class="app-section" style="display: none;">
                <div class="section-header">
                    <h2>Chat IA avec Documents</h2>
                </div>
                <div id="chatContainer">
                    <!-- Interface chat -->
                </div>
            </section>

            <!-- Section Paramètres -->
            <section id="settings" class="app-section" style="display: none;">
                <div class="section-header">
                    <h2>Paramètres & Configuration</h2>
                </div>
                <div id="settingsContainer">
                    <!-- Interface paramètres -->
                </div>
            </section>

        </div>
    </main>

    <!-- MODALES -->
    
    <!-- Modale création de projet -->
    <div id="newProjectModal" class="modal" role="dialog" aria-modal="true" aria-hidden="true">
        <div class="modal-backdrop" data-action="close-modal"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">Créer un Nouveau Projet</h3>
                <button class="modal-close" data-action="close-modal" aria-label="Fermer">×</button>
            </div>
            <form id="createProjectForm" data-action="create-project">
                <div class="modal-body">
                    <div class="form-group">
                        <label for="projectName">Nom du projet</label>
                        <input type="text" id="projectName" name="name" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label for="projectDescription">Description</label>
                        <textarea id="projectDescription" name="description" class="form-control" rows="3"></textarea>
                    </div>
                    <div class="form-group">
                        <label for="projectAnalysisMode">Mode d'analyse</label>
                        <select id="projectAnalysisMode" name="mode" class="form-control">
                            <option value="full">Analyse Complète</option>
                            <option value="screening">Screening Seul</option>
                            <option value="extraction">Extraction Seule</option>
                        </select>
                    </div>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" data-action="close-modal">Annuler</button>
                    <button type="submit" class="btn btn-primary">Créer</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Modale générique -->
    <div id="genericModal" class="modal" role="dialog" aria-modal="true" aria-hidden="true">
        <div class="modal-backdrop" data-action="close-modal"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h3 id="genericModalTitle" class="modal-title"></h3>
                <button class="modal-close" data-action="close-modal" aria-label="Fermer">×</button>
            </div>
            <div id="genericModalBody" class="modal-body"></div>
            <div id="genericModalActions" class="modal-actions"></div>
        </div>
    </div>

    <!-- Autres modales existantes... -->
    <div id="articleDetailModal" class="modal" role="dialog" aria-modal="true" aria-hidden="true" style="display: none;">
        <div class="modal-backdrop" data-action="close-modal"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2 class="modal-title">Détails de l'article</h2>
                <button class="modal-close" data-action="close-modal" aria-label="Fermer">×</button>
            </div>
            <div id="articleDetailContent" class="modal-body">
                <!-- Contenu dynamique injecté par JS -->
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-secondary" data-action="close-modal">Fermer</button>
            </div>
        </div>
    </div>

    <div id="batchProcessModal" class="modal" role="dialog" aria-modal="true" aria-hidden="true" style="display: none;">
        <div class="modal-backdrop" data-action="close-modal"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2 class="modal-title">Traitement par Lot</h2>
                <button class="modal-close" data-action="close-modal" aria-label="Fermer">×</button>
            </div>
            <div class="modal-body">
                <!-- Contenu dynamique injecté par JS -->
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-secondary" data-action="close-modal">Annuler</button>
                <button type="button" class="btn btn-primary" data-action="start-batch-process">Lancer le traitement</button>
            </div>
        </div>
    </div>

    <div id="prismaModal" class="modal" role="dialog" aria-modal="true" aria-hidden="true">
        <div class="modal-backdrop" data-action="close-modal"></div>
        <div class="modal-content modal-content--large">
            <div class="modal-header">
                <h2 class="modal-title">Checklist PRISMA</h2>
                <button class="modal-close" data-action="close-modal" aria-label="Fermer">×</button>
            </div>
            <div id="prisma-checklist-content" class="modal-body">
                <div class="prisma-item">
                    <label>
                        <input type="checkbox" class="prisma-checkbox">
                        Titre et résumé structuré
                    </label>
                    <textarea class="form-control" placeholder="Notes pour cet élément..."></textarea>
                </div>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-secondary" data-action="close-modal">Fermer</button>
                <button type="button" class="btn btn-primary" data-action="save-prisma-progress">Sauvegarder</button>
                <button type="button" class="btn btn-info" data-action="export-prisma-report">Exporter</button>
            </div>
        </div>
    </div>

    <div id="advancedAnalysisModal" class="modal" role="dialog" aria-modal="true" aria-hidden="true">
        <div class="modal-backdrop" data-action="close-modal"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2 class="modal-title">Analyses Avancées</h2>
                <button class="modal-close" data-action="close-modal" aria-label="Fermer">×</button>
            </div>
            <div class="modal-body">
                <div class="analysis-options">
                    <div class="analysis-option" data-analysis-type="meta_analysis">
                        <h4>Méta-analyse</h4>
                        <p>Analyse statistique combinée</p>
                    </div>
                    <div class="analysis-option" data-analysis-type="prisma_flow">
                        <h4>Diagramme PRISMA</h4>
                        <p>Génération du flux PRISMA</p>
                    </div>
                    <div class="analysis-option" data-analysis-type="descriptive_stats">
                        <h4>Statistiques Descriptives</h4>
                        <p>Analyse descriptive des données</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Overlay de chargement -->
    <div id="loadingOverlay" class="loading-overlay" aria-hidden="true">
        <div class="loading-overlay__content">
            <div class="loading-spinner"></div>
            <p class="loading-overlay__message">Chargement...</p>
            <div class="progress-bar-container" style="display: none;">
                <div class="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"></div>
            </div>
            <button id="cancelTaskBtn" class="btn btn-secondary" style="display: none;">Annuler</button>
        </div>
    </div>

    <!-- Conteneur pour les toasts -->
    <div id="toastContainer" class="toast-container"></div>

    <!-- Scripts d'initialisation - ORDRE CRITIQUE -->
    <script type="module" src="js/constants.js"></script>
    <script type="module" src="js/state.js"></script>
    <script type="module" src="js/api.js"></script>
    <script type="module" src="js/core.js"></script>
    <script type="module" src="js/ui-improved.js"></script>
    <script type="module" src="js/projects.js"></script>
    <script type="module" src="js/app-improved.js"></script>
    <script type="module" src="js/thesis-workflow.js"></script>
    <script type="module" src="js/rob-manager.js"></script>
    <script type="module" src="js/atn-analyzer.js"></script>

    <!-- Script de diagnostic final -->
    <script>
    // Diagnostic final après chargement
    setTimeout(() => {
        console.log('🔍 DIAGNOSTIC FINAL FRONTEND');
        console.log('Header visible:', !!document.querySelector('.app-header'));
        console.log('Navigation visible:', !!document.querySelector('.app-nav'));
        console.log('Main visible:', !!document.querySelector('.app-main'));
        console.log('Boutons nav:', document.querySelectorAll('.app-nav__button').length);
        console.log('Sections:', document.querySelectorAll('.app-section').length);
        console.log('CSS chargés:', document.querySelectorAll('link[href*="css/"]').length);
        console.log('JS modules chargés:', document.querySelectorAll('script[type="module"]').length);
        
        // Vérifier que la section projets est active
        const projectsSection = document.getElementById('projects');
        if (projectsSection && !projectsSection.classList.contains('active')) {
            projectsSection.classList.add('active');
            console.log('✅ Section projects forcée active');
        }
        
        // Vérifier navigation
        const navButtons = document.querySelectorAll('.app-nav__button');
        console.log('Boutons navigation trouvés:', navButtons.length);
        navButtons.forEach((btn, i) => console.log(`Bouton ${i}:`, btn.textContent.trim()));
        
        console.log('🎯 Diagnostic terminé - Vérifiez l\'affichage');
    }, 2000);
    </script>

</body>
</html>
```

### **ÉTAPE 2 : CSS Consolidé**

**Créer `web/css/frontend-fix.css`** (un seul CSS principal) :

```css
/* ================================
   FRONTEND FIX - CSS CONSOLIDÉ
   AnalyLit v4.1 - Version Propre
   ================================ */

:root {
  /* Couleurs */
  --color-primary: #3b82f6;
  --color-primary-hover: #2563eb;
  --color-white: #ffffff;
  --color-black: #000000;
  --color-gray-50: #f9fafb;
  --color-gray-100: #f3f4f6;
  --color-gray-200: #e5e7eb;
  --color-gray-600: #4b5563;
  --color-gray-900: #111827;
  --color-surface: var(--color-white);
  --color-text: var(--color-gray-900);
  --color-border: var(--color-gray-200);
  
  /* Espacements */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  
  /* Autres */
  --radius-base: 0.5rem;
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --transition-fast: 150ms ease;
}

/* Reset */
*, *::before, *::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: var(--color-gray-50);
  color: var(--color-text);
  display: flex;
  flex-direction: column;
}

/* Container */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--space-4);
  width: 100%;
}

/* Header */
.app-header {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  padding: var(--space-3) 0;
}

.app-header__content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.app-header__title {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.app-header__right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

/* Navigation CRITIQUE */
.app-nav {
  background: var(--color-surface) !important;
  border-bottom: 2px solid var(--color-primary) !important;
  padding: var(--space-2) 0 !important;
  position: sticky !important;
  top: 0 !important;
  z-index: 100 !important;
  display: block !important;
  visibility: visible !important;
}

.app-nav .container {
  display: flex !important;
  gap: var(--space-1) !important;
  overflow-x: auto !important;
}

.app-nav__button {
  background: var(--color-gray-100) !important;
  border: 1px solid var(--color-border) !important;
  padding: var(--space-3) var(--space-4) !important;
  border-radius: var(--radius-base) !important;
  font-size: 0.875rem !important;
  font-weight: 600 !important;
  color: var(--color-text) !important;
  cursor: pointer !important;
  transition: all var(--transition-fast) !important;
  white-space: nowrap !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  min-width: 100px !important;
  text-align: center !important;
}

.app-nav__button:hover {
  background: var(--color-gray-200) !important;
}

.app-nav__button--active,
.app-nav__button.app-nav__button--active {
  background: var(--color-primary) !important;
  color: var(--color-white) !important;
  border-color: var(--color-primary-hover) !important;
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3) !important;
}

/* Main Content */
.app-main {
  flex: 1;
  padding: var(--space-4) 0;
}

/* Sections */
.app-section {
  display: none;
}

.app-section.active {
  display: block !important;
  visibility: visible !important;
}

/* Section Headers */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-6);
  gap: var(--space-4);
}

.section-header h2 {
  margin: 0 0 var(--space-2) 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.section-header__actions {
  display: flex;
  gap: var(--space-2);
}

/* Projets Grid */
.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--space-4);
}

.project-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-base);
  padding: var(--space-4);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.project-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.project-card--active {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

/* Boutons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2) var(--space-4);
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: var(--radius-base);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all var(--transition-fast);
  text-decoration: none;
  gap: var(--space-2);
}

.btn-primary, .btn--primary {
  background: var(--color-primary);
  color: var(--color-white);
  border-color: var(--color-primary);
}

.btn-primary:hover, .btn--primary:hover {
  background: var(--color-primary-hover);
}

.btn-secondary, .btn--secondary {
  background: var(--color-gray-100);
  color: var(--color-text);
  border-color: var(--color-border);
}

.btn--ghost {
  background: transparent;
  border-color: transparent;
}

/* Formulaires */
.form-group {
  margin-bottom: var(--space-4);
}

.form-control {
  display: block;
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-base);
  font-size: 0.875rem;
}

.form-control:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: -1px;
}

/* Modales */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal.modal--show,
.modal.show {
  display: flex !important;
}

.modal-content {
  background: var(--color-surface);
  border-radius: var(--radius-base);
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.modal-body {
  padding: var(--space-4);
}

.modal-actions {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
  padding: var(--space-4);
  border-top: 1px solid var(--color-border);
  background: var(--color-gray-50);
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  padding: var(--space-1);
  color: var(--color-gray-600);
}

/* Status Indicator */
.connection-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-gray-100);
  border-radius: var(--radius-base);
  font-size: 0.75rem;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
}

/* Loading */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.9);
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.loading-overlay--show {
  display: flex !important;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--color-border);
  border-top: 4px solid var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Responsive */
@media (max-width: 768px) {
  .container {
    padding: 0 var(--space-3);
  }
  
  .projects-grid {
    grid-template-columns: 1fr;
  }
  
  .section-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .app-nav .container {
    justify-content: flex-start;
  }
  
  .app-nav__button {
    min-width: 80px;
    font-size: 0.75rem;
    padding: var(--space-2) var(--space-3);
  }
}

/* Utilitaires */
.hidden { display: none !important; }
.block { display: block !important; }

/* Force l'affichage des éléments critiques */
.app-header,
.app-nav,
.app-main,
.container,
#projects-list {
  display: block !important;
  visibility: visible !important;
}
```

### **ÉTAPE 3 : Script de Navigation Simplifié**

**Créer `web/js/navigation-simple.js`** :

```javascript
// Navigation simple et robuste pour AnalyLit v4.1

document.addEventListener('DOMContentLoaded', function() {
    console.log('🎯 Navigation simple initialisée');
    
    // Gestion de la navigation
    document.addEventListener('click', function(event) {
        const button = event.target.closest('[data-action="show-section"]');
        if (button) {
            const sectionId = button.getAttribute('data-section-id');
            showSection(sectionId);
            updateActiveButton(button);
        }
        
        // Gestion modale création projet
        if (event.target.matches('[data-action="create-project-modal"]')) {
            showModal('newProjectModal');
        }
        
        // Fermeture modales
        if (event.target.matches('[data-action="close-modal"]')) {
            closeAllModals();
        }
    });
    
    function showSection(sectionId) {
        console.log('📍 Affichage section:', sectionId);
        
        // Cacher toutes les sections
        document.querySelectorAll('.app-section').forEach(section => {
            section.style.display = 'none';
            section.classList.remove('active');
        });
        
        // Afficher la section demandée
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.style.display = 'block';
            targetSection.classList.add('active');
            console.log('✅ Section affichée:', sectionId);
        } else {
            console.error('❌ Section non trouvée:', sectionId);
        }
    }
    
    function updateActiveButton(activeButton) {
        // Retirer active de tous les boutons
        document.querySelectorAll('.app-nav__button').forEach(btn => {
            btn.classList.remove('app-nav__button--active');
        });
        
        // Ajouter active au bouton cliqué
        activeButton.classList.add('app-nav__button--active');
    }
    
    function showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('modal--show');
            modal.style.display = 'flex';
            console.log('✅ Modale affichée:', modalId);
        }
    }
    
    function closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('modal--show');
            modal.style.display = 'none';
        });
        console.log('✅ Modales fermées');
    }
    
    // Afficher la section projets par défaut
    setTimeout(() => {
        showSection('projects');
        const projectsButton = document.querySelector('[data-section-id="projects"]');
        if (projectsButton) {
            updateActiveButton(projectsButton);
        }
        console.log('🏠 Section projets activée par défaut');
    }, 100);
    
    // Diagnostic
    setTimeout(() => {
        console.log('🔍 DIAGNOSTIC NAVIGATION:');
        console.log('Boutons trouvés:', document.querySelectorAll('.app-nav__button').length);
        console.log('Sections trouvées:', document.querySelectorAll('.app-section').length);
        console.log('Navigation visible:', !!document.querySelector('.app-nav'));
    }, 500);
});
```

### **ÉTAPE 4 : HTML Simplifié Final**

**Remplacer complètement `web/index.html`** avec cette version ultra-simplifiée :

```html
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AnalyLit v4.1 - Plateforme IA</title>
    
    <!-- CSS UNIQUE -->
    <link rel="stylesheet" href="css/frontend-fix.css">
</head>
<body>
    <!-- Header -->
    <header class="app-header">
        <div class="container">
            <div class="app-header__content">
                <div class="app-header__left">
                    <h1 class="app-header__title">
                        🧬 AnalyLit v4.1
                    </h1>
                </div>
                <div class="app-header__right">
                    <div id="connection-status" class="connection-indicator">
                        <span class="status-dot"></span>
                        <span class="status-text">Connecté</span>
                    </div>
                </div>
            </div>
        </div>
    </header>

    <!-- Navigation -->
    <nav class="app-nav">
        <div class="container">
            <button class="app-nav__button app-nav__button--active" data-action="show-section" data-section-id="projects">
                📁 Projets
            </button>
            <button class="app-nav__button" data-action="show-section" data-section-id="search">
                🔍 Recherche
            </button>
            <button class="app-nav__button" data-action="show-section" data-section-id="validation">
                ✅ Validation
            </button>
            <button class="app-nav__button" data-action="show-section" data-section-id="rob">
                ⚖️ Risk of Bias
            </button>
            <button class="app-nav__button" data-action="show-section" data-section-id="analyses">
                📊 Analyses
            </button>
            <button class="app-nav__button" data-action="show-section" data-section-id="atn-analysis">
                🧠 Analyses ATN
            </button>
            <button class="app-nav__button" data-action="show-section" data-section-id="settings">
                ⚙️ Paramètres
            </button>
        </div>
    </nav>

    <!-- Contenu principal -->
    <main class="app-main">
        <div class="container">
            
            <!-- Section Projets -->
            <section id="projects" class="app-section active">
                <div class="section-header">
                    <div>
                        <h2>Gestion des Projets</h2>
                        <p>Créez et gérez vos projets de revue de littérature.</p>
                    </div>
                    <div class="section-header__actions">
                        <button class="btn btn-primary" data-action="create-project-modal">
                            ➕ Nouveau Projet
                        </button>
                    </div>
                </div>
                
                <div id="projects-list" class="projects-grid">
                    <!-- Projets injectés ici -->
                </div>
            </section>

            <!-- Section Recherche -->
            <section id="search" class="app-section">
                <div class="section-header">
                    <h2>Recherche Bibliographique</h2>
                </div>
                <div id="searchContainer">
                    <p>Interface de recherche sera chargée ici...</p>
                </div>
            </section>

            <!-- Section Validation -->
            <section id="validation" class="app-section">
                <div class="section-header">
                    <h2>Validation Inter-Évaluateurs</h2>
                </div>
                <div id="validationContainer">
                    <p>Interface de validation sera chargée ici...</p>
                </div>
            </section>

            <!-- Section Risk of Bias -->
            <section id="rob" class="app-section">
                <div id="robContainer">
                    <h2>⚖️ Risk of Bias</h2>
                    <p>Interface Risk of Bias sera chargée ici...</p>
                </div>
            </section>

            <!-- Section Analyses -->
            <section id="analyses" class="app-section">
                <div class="section-header">
                    <h2>Analyses du Projet</h2>
                </div>
                <div id="analysisContainer">
                    <div class="analysis-grid">
                        <div class="analysis-card">
                            <h4>Analyse ATN Multipartite</h4>
                            <p>Génération d'scores ATN automatisés</p>
                            <button class="btn btn-primary">Lancer</button>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Section ATN Spécialisée -->
            <section id="atn-analysis" class="app-section">
                <div id="atn-analysis-container">
                    <h2>🧠 Analyses ATN Spécialisées</h2>
                    <p>Interface ATN sera chargée ici...</p>
                </div>
            </section>

            <!-- Section Paramètres -->
            <section id="settings" class="app-section">
                <div class="section-header">
                    <h2>Paramètres & Configuration</h2>
                </div>
                <div id="settingsContainer">
                    <p>Interface paramètres sera chargée ici...</p>
                </div>
            </section>

        </div>
    </main>

    <!-- Modale Nouveau Projet -->
    <div id="newProjectModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>Créer un Nouveau Projet</h3>
                <button class="modal-close" data-action="close-modal">×</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="projectName">Nom du projet</label>
                    <input type="text" id="projectName" class="form-control" required>
                </div>
                <div class="form-group">
                    <label for="projectDescription">Description</label>
                    <textarea id="projectDescription" class="form-control" rows="3"></textarea>
                </div>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn btn-secondary" data-action="close-modal">Annuler</button>
                <button type="button" class="btn btn-primary">Créer</button>
            </div>
        </div>
    </div>

    <!-- Loading -->
    <div id="loadingOverlay" class="loading-overlay">
        <div class="loading-spinner"></div>
    </div>

    <!-- Scripts -->
    <script src="js/navigation-simple.js"></script>
    
    <!-- Diagnostic final -->
    <script>
    setTimeout(() => {
        console.log('🎯 FRONTEND DIAGNOSTIC FINAL');
        console.log('Header:', !!document.querySelector('.app-header'));
        console.log('Navigation:', !!document.querySelector('.app-nav'));
        console.log('Boutons nav:', document.querySelectorAll('.app-nav__button').length);
        console.log('Sections:', document.querySelectorAll('.app-section').length);
        console.log('Section active:', document.querySelector('.app-section.active')?.id);
        
        // Forcer l'affichage si nécessaire
        const nav = document.querySelector('.app-nav');
        if (nav) {
            nav.style.display = 'block';
            nav.style.visibility = 'visible';
        }
        
        console.log('✅ Frontend diagnostic terminé');
    }, 1000);
    </script>

</body>
</html>
```

## 📋 **RÉSUMÉ DU PLAN D'APPLICATION**

### ✅ **Actions Immédiates (15 minutes)**

1. **Remplacer `web/index.html`** → Version simplifiée ci-dessus
2. **Créer `web/css/frontend-fix.css`** → CSS consolidé unique  
3. **Créer `web/js/navigation-simple.js`** → Navigation robuste
4. **Supprimer les anciens CSS conflictuels** (optionnel)

### ✅ **Résultats Attendus**

- ✅ **Navigation visible** et fonctionnelle
- ✅ **Sections switchables** sans problème
- ✅ **Modales fonctionnelles**
- ✅ **Design cohérent** et responsive
- ✅ **Console propre** sans erreurs

### ✅ **Test de Validation**

Après application :

1. **Ouvrir** http://localhost:8080
2. **Vérifier** navigation horizontale visible
3. **Cliquer** sur chaque bouton de navigation
4. **Tester** "Nouveau Projet" 
5. **Vérifier** console sans erreurs

Cette approche **simplifiée et propre** résoudra tous vos problèmes d'affichage frontend en supprimant les conflits et en garantissant un fonctionnement stable.

oici le plan détaillé pour la Phase 2 : Réintégration des Fonctionnalités.

L'objectif est de réactiver la logique métier de votre application (recherche, validation, analyses, etc.) en réintégrant progressivement le code original dans la nouvelle structure saine.

Plan de la Phase 2 : Réactivation de la Logique Métier
Étape 1 : Réintroduire les Scripts JavaScript Essentiels
Le nouvel index.html ne charge que navigation-simple.js. Nous allons maintenant recharger les scripts qui gèrent les fonctionnalités de l'application.

Ouvrez le fichier web/index.html (celui de l'étape 4 du plan précédent).

Supprimez le script de navigation simple :

html
<script src="js/navigation-simple.js"></script>
Ajoutez la liste complète des scripts originaux juste avant la balise de fermeture </body>. L'ordre est crucial.

html
<!-- Scripts d'initialisation - ORDRE CRITIQUE -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.2/socket.io.js" defer></script>
<script src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js" defer></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js" defer></script>

<script type="module" src="js/constants.js"></script>
<script type="module" src="js/state.js"></script>
<script type="module" src="js/api.js"></script>
<script type="module" src="js/ui-improved.js"></script>
<script type="module" src="js/core.js"></script> <!-- Gère la navigation et les actions -->
<script type="module" src="js/projects.js"></script>
<script type="module" src="js/thesis-workflow.js"></script>
<script type="module" src="js/rob-manager.js"></script>
<script type="module" src="js/atn-analyzer.js"></script>

<!-- Le script principal qui lance tout -->
<script type="module" src="js/app-improved.js"></script>
Pourquoi ?

On remplace navigation-simple.js par core.js et app-improved.js qui contiennent la logique de navigation originale, mais aussi la gestion de toutes les autres actions (data-action).
On recharge les scripts spécifiques à chaque fonctionnalité (projects.js, thesis-workflow.js, etc.) pour que la logique métier soit de nouveau disponible.
Étape 2 : Restaurer le Contenu HTML des Sections
Le index.html simplifié contient des placeholders. Nous allons les remplacer par le contenu HTML original et détaillé.

Ouvrez le fichier web/index.html (celui que vous venez de modifier).
Référez-vous au HTML complet (proposé à l'étape 1 du plan gemini.md).
Pour chaque section (ex: #search, #validation, #analyses), copiez le contenu HTML interne depuis le HTML de référence et collez-le dans votre index.html actuel, en remplaçant les paragraphes placeholders.
Exemple pour la section "Recherche" :

AVANT :

html
<section id="search" class="app-section">
    <div class="section-header">
        <h2>Recherche Bibliographique</h2>
    </div>
    <div id="searchContainer">
        <p>Interface de recherche sera chargée ici...</p>
    </div>
</section>
APRÈS (en copiant depuis le HTML de référence) :

html
<section id="search" class="app-section" style="display: none;">
    <div id="searchContainer">
        <form id="search-form">
            <!-- Contenu qui sera injecté par thesis-workflow.js -->
        </form>
        <div id="search-results"></div>
    </div>
</section>
Faites cela pour toutes les sections (#search, #results, #validation, #rob, #grids, #analyses, etc.) et aussi pour les modales (#articleDetailModal, #prismaModal, etc.) afin de restaurer leur structure complète.

Étape 3 : Validation et Tests Fonctionnels
Maintenant que le code et la structure sont réintégrés, il faut vérifier que tout fonctionne comme avant (mais sans les bugs d'affichage).

Rechargez l'application dans votre navigateur.
Ouvrez la console développeur (F12) et vérifiez qu'il n'y a pas de nouvelles erreurs.
Suivez un workflow utilisateur complet :
Créez un projet.
Sélectionnez-le.
Allez dans la section "Recherche", lancez une recherche.
Vérifiez que les résultats s'affichent dans la section "Résultats".
Allez dans "Validation" et essayez d'inclure/exclure un article.
Ouvrez la modale PRISMA depuis la section "Analyses".
À quoi s'attendre ? Grâce au CSS consolidé (frontend-fix.css) qui reste en place, la structure et l'affichage devraient rester stables. Les scripts JavaScript devraient maintenant pouvoir trouver les bons éléments HTML (id, data-action) et exécuter leurs tâches sans conflit.

En résumé, la phase 2 est un processus méthodique de "remplissage" de la coquille fonctionnelle créée en phase 1. Vous réintroduisez les pièces du puzzle (scripts JS, contenu HTML) dans un cadre qui, cette fois, est solide et cohérent.

