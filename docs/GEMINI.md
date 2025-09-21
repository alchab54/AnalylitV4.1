

# Instructions Détaillées : Corrections Frontend AnalyLit v4.1

## Phase 1 : Diagnostic et Préparation (30 minutes)

### Étape 1.1 : Vérification de l'environnement
```bash
# 1. Vérifiez que le backend est en fonctionnement
docker-compose -f docker-compose-local.yml ps

# 2. Consultez les logs pour identifier les problèmes job_id/task_id
docker-compose -f docker-compose-local.yml logs -f web | grep -i "job_id\|task_id"
docker-compose -f docker-compose-local.yml logs -f worker | grep -i "job_id\|task_id"

# 3. Sauvegardez vos fichiers actuels
mkdir backup_frontend_$(date +%Y%m%d_%H%M%S)
cp -r web/ backup_frontend_$(date +%Y%m%d_%H%M%S)/
```

### Étape 1.2 : Identification des contradictions API
```bash
# Examinez les endpoints backend réels
curl -s http://localhost:8080/api/health | jq .
curl -s http://localhost:8080/api/ | jq . 2>/dev/null || echo "Vérifiez les routes disponibles"
```

## Phase 2 : Corrections des Appels API (2 heures)

### Étape 2.1 : Correction des endpoints dans `api.js`

**Fichier :** `web/js/api.js`

```javascript
// REMPLACEZ cette fonction dans api.js
export async function fetchAPI(endpoint, options = {}) {
    const baseURL = '/api';
    
    // Assurez-vous que l'endpoint commence par /api
    const url = endpoint.startsWith('/api') ? endpoint : `${baseURL}${endpoint}`;
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    };

    try {
        const response = await fetch(url, defaultOptions);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
        
        return await response.text();
    } catch (error) {
        console.error(`API Error for ${url}:`, error);
        throw error;
    }
}
```

### Étape 2.2 : Corrections spécifiques par module

#### A. Module Articles (`web/js/articles.js`)

**Localiser et REMPLACER :**

```javascript
// ANCIEN CODE (incorrect selon les logs)
const taskId = response.task_id;
console.log('Task ID:', taskId);

// NOUVEAU CODE (correct selon les logs pytest)
const jobId = response.job_id;
console.log('Job ID:', jobId);
```

**Correction de la fonction de suppression :**

```javascript
// Dans articles.js, fonction handleDeleteSelectedArticles
export async function handleDeleteSelectedArticles() {
    const selectedArticles = getSelectedArticles();
    if (selectedArticles.length === 0) {
        showToast('Aucun article sélectionné', 'warning');
        return;
    }

    if (!confirm(`Supprimer ${selectedArticles.length} article(s) sélectionné(s) ?`)) {
        return;
    }

    try {
        // CORRECTION : Utilise la route correcte
        const response = await fetchAPI('/articles/batch-delete', {
            method: 'POST',
            body: JSON.stringify({
                article_ids: selectedArticles.map(a => a.id),
                project_id: appState.currentProject.id
            })
        });

        // CORRECTION : Utilise job_id au lieu de task_id
        if (response.job_id) {
            showToast(`Suppression lancée (Job ID: ${response.job_id})`, 'success');
            // Actualiser la liste des articles
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('articles:refresh'));
            }, 2000);
        }
    } catch (error) {
        showToast(`Erreur lors de la suppression : ${error.message}`, 'error');
    }
}
```

#### B. Module Analyses (`web/js/analyses.js`)

**REMPLACEZ toutes les occurrences :**

```javascript
// CORRECTIONS des endpoints d'analyse
const analysisEndpoints = {
    atn: `/projects/${projectId}/run-analysis`,
    prisma: `/projects/${projectId}/run-analysis`, 
    metaanalysis: `/projects/${projectId}/run-analysis`,
    descriptive: `/projects/${projectId}/run-analysis`,
    discussion: `/projects/${projectId}/run-discussion-draft`
};

// CORRECTION de la fonction d'analyse ATN
export async function handleRunATNAnalysis() {
    const projectId = appState.currentProject?.id;
    if (!projectId) {
        showToast('Aucun projet sélectionné', 'warning');
        return;
    }

    try {
        showOverlay('Lancement de l\'analyse ATN...');
        
        const response = await fetchAPI(`/projects/${projectId}/run-analysis`, {
            method: 'POST',
            body: JSON.stringify({
                type: 'atnscores' // CORRECTION : type spécifique
            })
        });

        // CORRECTION : Utilise job_id
        if (response.job_id) {
            showToast(`Analyse ATN lancée (Job ID: ${response.job_id})`, 'success');
        }
    } catch (error) {
        showToast(`Erreur : ${error.message}`, 'error');
    } finally {
        hideOverlay();
    }
}
```

#### C. Module Tâches (`web/js/tasks.js`)

**CORRECTION complète du module :**

```javascript
// REMPLACEZ le contenu de tasks.js
export async function fetchTasks() {
    try {
        const response = await fetchAPI('/tasks/status');
        
        // CORRECTION : Traite les tâches avec job_id
        const tasks = response.tasks || [];
        const tasksHtml = tasks.map(task => `
            <div class="task-item" data-job-id="${task.job_id}">
                <div class="task-header">
                    <strong>Job ID:</strong> ${task.job_id}
                    <span class="task-status ${task.status}">${task.status}</span>
                </div>
                <div class="task-details">
                    <p><strong>Type:</strong> ${task.type || 'N/A'}</p>
                    <p><strong>Progression:</strong> ${task.progress || 0}%</p>
                    <p><strong>Créé:</strong> ${new Date(task.created_at).toLocaleString()}</p>
                </div>
            </div>
        `).join('');

        const tasksContainer = document.getElementById('tasks-list');
        if (tasksContainer) {
            tasksContainer.innerHTML = tasksHtml || '<p>Aucune tâche en cours</p>';
        }
    } catch (error) {
        console.error('Erreur lors du chargement des tâches:', error);
    }
}
```

#### D. Module Paramètres (`web/js/settings.js`)

**CORRECTIONS des endpoints :**

```javascript
// CORRECTION des endpoints de paramètres
export async function loadAnalysisProfiles() {
    try {
        // CORRECTION : endpoint correct
        const response = await fetchAPI('/analysis-profiles');
        return response.profiles || [];
    } catch (error) {
        console.error('Erreur chargement profils:', error);
        return [];
    }
}

export async function loadOllamaModels() {
    try {
        // CORRECTION : endpoint correct
        const response = await fetchAPI('/settings/models');
        return response.models || [];
    } catch (error) {
        console.error('Erreur chargement modèles:', error);
        return [];
    }
}
```

## Phase 3 : Corrections HTML et Interface (1 heure)

### Étape 3.1 : Mise à jour des templates HTML

**Dans `web/index.html`, REMPLACEZ les références :**

```html
<!-- CORRECTION : Mise à jour des data-attributes -->
<div class="task-monitor" id="task-monitor">
    <div class="task-counter">
        <span id="jobs-count">0</span> tâches actives
    </div>
    <div class="task-progress" id="job-progress" style="display:none;">
        <div class="progress-bar">
            <div class="progress-fill" id="progress-fill"></div>
        </div>
        <span class="progress-text" id="progress-text">0%</span>
    </div>
</div>
```

### Étape 3.2 : Corrections JavaScript globales

**Créez un fichier de migration :** `web/js/migration-fix.js`

```javascript
// Script de migration job_id/task_id
export function migrateTaskReferences() {
    // Remplace toutes les références task_id par job_id dans le DOM
    const taskElements = document.querySelectorAll('[data-task-id]');
    taskElements.forEach(el => {
        const taskId = el.getAttribute('data-task-id');
        el.removeAttribute('data-task-id');
        el.setAttribute('data-job-id', taskId);
    });

    // Met à jour les event listeners
    document.addEventListener('socket:job_update', (event) => {
        const { job_id, status, progress } = event.detail;
        updateJobProgress(job_id, status, progress);
    });
}

function updateJobProgress(jobId, status, progress) {
    const jobElement = document.querySelector(`[data-job-id="${jobId}"]`);
    if (jobElement) {
        jobElement.querySelector('.job-status').textContent = status;
        jobElement.querySelector('.job-progress').textContent = `${progress}%`;
    }
}
```

## Phase 4 : Tests et Validation (1 heure)

### Étape 4.1 : Tests des corrections

**Créez un script de test :** `test_frontend_fixes.js`

```javascript
// Script de test des corrections frontend
async function testAPIEndpoints() {
    console.log('=== Test des corrections API ===');
    
    try {
        // Test 1: Vérification endpoint projets
        const projects = await fetchAPI('/projects');
        console.log('✓ Endpoint /projects OK');
        
        // Test 2: Vérification endpoint tâches  
        const tasks = await fetchAPI('/tasks/status');
        console.log('✓ Endpoint /tasks/status OK');
        console.log('Structure retournée:', Object.keys(tasks));
        
        // Test 3: Vérification présence job_id
        if (tasks.tasks && tasks.tasks.length > 0) {
            const firstTask = tasks.tasks[0];
            if (firstTask.job_id) {
                console.log('✓ Structure job_id confirmée');
            } else if (firstTask.task_id) {
                console.warn('⚠️ Structure task_id détectée - correction nécessaire');
            }
        }
        
    } catch (error) {
        console.error('❌ Erreur test API:', error);
    }
}

// Lancer le test
testAPIEndpoints();
```

### Étape 4.2 : Validation complète

**Commandes de validation :**

```bash
# 1. Redémarrez les services
docker-compose -f docker-compose-local.yml restart web worker

# 2. Vérifiez l'absence d'erreurs JavaScript
# Ouvrez http://localhost:8080 et ouvrez la console (F12)
# Aucune erreur ne doit apparaître

# 3. Testez les fonctionnalités critiques
# - Création de projet
# - Lancement de recherche
# - Vérification des tâches
```

## Phase 5 : Documentation et Finalisation (30 minutes)

### Étape 5.1 : Mise à jour de la documentation

**Créez `CORRECTIONS_APPLIQUEES.md` :**

```markdown
# Corrections Appliquées - Frontend AnalyLit v4.1

## Date : [DATE_ACTUELLE]

## Problèmes Corrigés

1. **Désynchronisation job_id/task_id**
   - Tous les appels API utilisent maintenant `job_id`
   - Templates HTML mis à jour
   - Event listeners corrigés

2. **Endpoints API corrigés**
   - `/api/analysis-profiles` au lieu de `/api/profiles`
   - `/api/settings/models` au lieu de `/api/ollama/models`
   - Routes d'analyse uniformisées

3. **Fonctions réactivées** 
   - `handleDeleteSelectedArticles` (articles.js)
   - `handleIndexPdfs` (import.js)
   - `handleRunRobAnalysis` (rob.js)

## Tests Effectués
- [x] Navigation sans erreurs JavaScript
- [x] Appels API fonctionnels
- [x] Cohérence job_id dans toute l'application
- [x] Fonctionnalités critiques opérationnelles

## Fichiers Modifiés
- web/js/api.js
- web/js/articles.js
- web/js/analyses.js
- web/js/tasks.js
- web/js/settings.js
- web/index.html
```

### Étape 5.2 : Vérification finale

**Checklist de validation :**

```bash
# ✅ Commandes de vérification finale
echo "=== VERIFICATION FINALE ==="

# 1. Aucune erreur dans les logs
docker-compose logs web --tail=50 | grep -i error

# 2. Frontend accessible
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080

# 3. API répondante
curl -s http://localhost:8080/api/health | jq .

# 4. Structure job_id confirmée
curl -s http://localhost:8080/api/tasks/status | jq '.tasks[0] | keys' 2>/dev/null

echo "=== FIN VERIFICATION ==="
```

## Résumé des Actions

1. **✅ Phase 1** : Diagnostic et sauvegarde (30 min)
2. **✅ Phase 2** : Corrections API job_id/task_id (2h)
3. **✅ Phase 3** : Corrections HTML/Interface (1h)  
4. **✅ Phase 4** : Tests et validation (1h)
5. **✅ Phase 5** : Documentation (30 min)

**Durée totale estimée : 5 heures**

**Résultat attendu :** Frontend complètement synchronisé avec le backend, aucune erreur job_id/task_id, toutes les fonctionnalités opérationnelles selon le CHANGELOG.md et les tests validés selon TESTS-FRONTEND.md.[1][2]

Ces corrections permettront d'éliminer complètement les contradictions identifiées entre les logs pytest et le code frontend, comme indiqué dans les instructions de l'espace.

