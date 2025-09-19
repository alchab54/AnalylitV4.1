# INSTRUCTIONS DÉTAILLÉES GEMINI AGENT - ANALYLIT V4.1

## MISSION PRINCIPALE
Finaliser le frontend JavaScript d'AnalyLit v4.1 en mode agent pour obtenir une application 100% fonctionnelle.

## ÉTAPE 1 : DIAGNOSTIC ET ANALYSE
### Actions à effectuer :
1. **Analyser tous les fichiers frontend existants** dans le dossier `web/`
2. **Identifier précisément** les 48 fonctions manquant d'exports dans les 12 fichiers JS
3. **Cartographier** les appels `fetchAPI` et vérifier leur cohérence avec `server_v4_complete.py`
4. **Évaluer** l'état actuel de `index.html` et `style.css`

### Commandes d'analyse suggérées :
```bash
# Scanner les fichiers JS pour les exports manquants
grep -n "function.*(" web/js/*.js | grep -v "export"

# Vérifier les imports dans core.js
grep "import.*from" web/js/core.js

# Lister les routes API backend
grep "@api_bp.route" server_v4_complete.py
```

## ÉTAPE 2 : CORRECTION SYSTÉMATIQUE DES EXPORTS

### Liste EXACTE des fonctions à exporter par fichier :

#### web/js/articles.js (8 exports à ajouter)
```javascript
export function handleDeleteSelectedArticles() { /* existing code */ }
export function showBatchProcessModal() { /* existing code */ }
export function startBatchProcessing() { /* existing code */ }
export function showRunExtractionModal() { /* existing code */ }
export function startFullExtraction() { /* existing code */ }
export function toggleArticleSelection() { /* existing code */ }
export function viewArticleDetails() { /* existing code */ }
export function selectAllArticles() { /* existing code */ }
```

#### web/js/analyses.js (9 exports à ajouter)
```javascript
export function handleRunDiscussionDraft() { /* existing code */ }
export function handleRunKnowledgeGraph() { /* existing code */ }
export function handleRunMetaAnalysis() { /* existing code */ }
export function handleRunATNAnalysis() { /* existing code */ }
export function showRunAnalysisModal() { /* existing code */ }
export function runProjectAnalysis() { /* existing code */ }
export function showPRISMAModal() { /* existing code */ }
export function savePRISMAProgress() { /* existing code */ }
export function exportPRISMAReport() { /* existing code */ }
```

#### web/js/validation.js (3 exports à ajouter)
```javascript
export function handleValidateExtraction() { /* existing code */ }
export function resetValidationStatus() { /* existing code */ }
export function filterValidationList() { /* existing code */ }
```

#### web/js/grids.js (5 exports à ajouter)
```javascript
export function handleDeleteGrid() { /* existing code */ }
export function showGridFormModal() { /* existing code */ }
export function addGridFieldInput() { /* existing code */ }
export function removeGridField() { /* existing code */ }
export function handleSaveGrid() { /* existing code */ }
```

#### web/js/import.js (7 exports à ajouter)
```javascript
export function handleZoteroImport() { /* existing code */ }
export function showPmidImportModal() { /* existing code */ }
export function handleUploadPdfs() { /* existing code */ }
export function handleIndexPdfs() { /* existing code */ }
export function handleZoteroSync() { /* existing code */ }
export function processPmidImport() { /* existing code */ }
export function exportForThesis() { /* existing code */ }
```

#### web/js/chat.js (1 export à ajouter)
```javascript
export function sendChatMessage() { /* existing code */ }
```

#### web/js/rob.js (3 exports à ajouter)
```javascript
export function handleRunRobAnalysis() { /* existing code */ }
export function fetchAndDisplayRob() { /* existing code */ }
export function handleSaveRobAssessment() { /* existing code */ }
```

#### web/js/search.js (2 exports à ajouter)
```javascript
export function showSearchModal() { /* existing code */ }
export function handleMultiDatabaseSearch() { /* existing code */ }
```

#### web/js/reporting.js (4 exports à ajouter)
```javascript
export function generateBibliography() { /* existing code */ }
export function generateSummaryTable() { /* existing code */ }
export function exportSummaryTableExcel() { /* existing code */ }
export function savePrismaChecklist() { /* existing code */ }
```

#### web/js/stakeholders.js (3 exports à ajouter)
```javascript
export function showStakeholderManagementModal() { /* existing code */ }
export function addStakeholderGroup() { /* existing code */ }
export function deleteStakeholderGroup() { /* existing code */ }
```

#### web/js/tasks.js (1 export à ajouter)
```javascript
export function setupTasksAutoRefresh() { /* existing code */ }
```

#### web/js/notifications.js (2 exports à ajouter)
```javascript
export function clearNotifications() { /* existing code */ }
export function updateNotificationIndicator() { /* existing code */ }
```

## ÉTAPE 3 : VÉRIFICATION COHÉRENCE API

### Routes critiques à vérifier dans server_v4_complete.py :
1. `@api_bp.route('/projects', methods=['GET', 'POST'])`
2. `@api_bp.route('/projects/<int:project_id>/export-thesis', methods=['GET'])`
3. `@api_bp.route('/projects/<int:project_id>/run-analysis', methods=['POST'])`
4. `@api_bp.route('/search', methods=['POST'])`
5. `@api_bp.route('/projects/<int:project_id>/chat', methods=['POST'])`

### Action requise :
Pour chaque appel `fetchAPI` dans les fichiers JS, vérifier :
- L'URL correspond à une route backend existante
- Les données envoyées correspondent aux paramètres attendus
- Le format de réponse est correctement traité

## ÉTAPE 4 : MODERNISATION INTERFACE

### web/index.html - Structure cible :
```html
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AnalyLit v4.1 - Alliance Thérapeutique Numérique</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <!-- Navigation moderne et accessible -->
    <nav class="main-nav" role="navigation">
        <!-- Éléments de navigation avec data-action -->
    </nav>
    
    <!-- Contenu principal -->
    <main class="main-content" role="main">
        <!-- Sections de l'application -->
    </main>
    
    <!-- Modales et overlays -->
    <div id="modal-container"></div>
    
    <!-- Scripts -->
    <script type="module" src="app.js"></script>
</body>
</html>
```

### web/style.css - Design system moderne :
```css
:root {
    /* Variables CSS pour cohérence */
    --primary-color: #2dd4bf;
    --secondary-color: #0d9488;
    --accent-color: #14b8a6;
    --text-primary: #1f2937;
    --text-secondary: #6b7280;
    --background: #ffffff;
    --surface: #f9fafb;
    --border: #e5e7eb;
    
    /* Espacements */
    --spacing-xs: 0.25rem;
    --spacing-sm: 0.5rem;
    --spacing-md: 1rem;
    --spacing-lg: 1.5rem;
    --spacing-xl: 2rem;
    
    /* Typographie */
    --font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    --font-size-sm: 0.875rem;
    --font-size-base: 1rem;
    --font-size-lg: 1.125rem;
    --font-size-xl: 1.25rem;
}

/* Reset et base styles */
* { box-sizing: border-box; }
body { 
    font-family: var(--font-family);
    line-height: 1.6;
    color: var(--text-primary);
    background: var(--background);
    margin: 0;
}

/* Components modernes */
.btn { /* Styles boutons */ }
.card { /* Styles cartes */ }
.modal { /* Styles modales */ }
.toast { /* Styles notifications */ }

/* Layout responsive */
@media (max-width: 768px) { /* Mobile styles */ }
```

## ÉTAPE 5 : TESTS ET VALIDATION

### Checklist de validation :
```bash
# 1. Vérifier le chargement sans erreurs
# Ouvrir http://localhost:8080 et inspecter la console (0 erreur)

# 2. Tester navigation
# Cliquer sur les éléments avec data-action="..."

# 3. Vérifier WebSocket
# Observer les notifications temps réel

# 4. Tester fonctionnalités critiques
# - Création projet
# - Recherche multi-bases
# - Screening IA
# - Extraction ATN
# - Export thèse
```

### Commandes de débogage :
```javascript
// Dans la console du navigateur
console.log(window.appState); // Vérifier l'état global
console.log(Object.keys(window)); // Voir les objets globaux
```

## ÉTAPE 6 : LIVRABLES FINAUX

### Fichiers modifiés/créés :
1. **web/js/*.js** - Tous les fichiers JS avec exports corrigés
2. **web/index.html** - Structure moderne et accessible  
3. **web/style.css** - Design system professionnel
4. **web/app.js** - Améliorations si nécessaires

### Documentation :
1. **CHANGELOG.md** - Liste des corrections apportées
2. **TESTS-FRONTEND.md** - Guide de tests de l'interface
3. **README-FRONTEND.md** - Documentation frontend mise à jour

## CONTRAINTES CRITIQUES

### ❌ NE PAS MODIFIER :
- `server_v4_complete.py` (backend intouchable)
- `tasksv4_complete.py` (tâches backend)
- Architecture existante (délégation d'événements via `core.js`)
- Structure `appState` (source unique de vérité)

### ✅ RESPECTER OBLIGATOIREMENT :
- Sécurité : utiliser `escapeHtml` pour tout affichage DOM
- Performance : lazy loading et optimisations
- Accessibilité : attributs ARIA, navigation clavier
- Responsive : design mobile-first

## RÉSULTAT ATTENDU

Une application AnalyLit v4.1 avec frontend **100% fonctionnel** permettant :
- Navigation fluide entre toutes les sections
- Utilisation complète des fonctionnalités ATN
- Interface moderne et professionnelle
- Aucune erreur console
- Compatibilité mobile et desktop
- Prête pour utilisation immédiate en recherche ATN

**Priorité absolue : Rendre l'application immédiatement utilisable pour la finalisation d'une thèse sur l'Alliance Thérapeutique Numérique.**