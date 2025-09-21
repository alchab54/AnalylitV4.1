Corrections Frontend AnalyLit v4.1 – Synchronisation API et Tests
Objectif
Harmoniser le frontend avec l’API réelle, corriger la désynchronisation job_id/task_id, aligner les endpoints, ajouter un script de test rapide et documenter les cha

Constat clé

Incohérence identifiée: le frontend lit task_id alors que l’API renvoie job_id (preuve via logs/tests).

Endpoints à corriger: analysis-profiles, settings/models, routes d’analyse unifiées via /projects/{id}/run-analysis, etc.

Besoin d’un mini-script de test de vérification et d’une documentation de corrections appliquées.

Plan en 5 phases

Phase 1 — Diagnostic et sauvegarde (30 min)

Vérifier que les services sont up (compose ps).

Inspecter les logs pour le couple job_id/task_id.

Sauvegarder le dossier web/ avant modifications.

Phase 2 — Corrections API (2 h)
A. we

Garantir un préfixe /api, gérer JSON/erreurs proprement.

B. web/js/articles.js — Passer de task_id à job_id + endpoint batch-delete

Lors des retours d’API, lire response.job_id et non response.task_id.

Utiliser /articles/batch-delete et rafraîchir la liste.

C. web/js/analyses.js — Uniformiser les endpoints d’analyse

Utiliser /projects/{projectId}/run-analysis et passer type: 'atnscores' pour l’ATN.

Lire job_id dans la réponse et notifier l’utilisateur.

D. web/js/tasks.js — Affichage du statut des tâches par job_id

Récupérer /tasks/status, construire le DOM avec data-job-id et job_id/status/progress/date.

E. web/js/settings.js — Profils d’analyse et modèles Ollama

/analysis-profiles pour les profils, /settings/models pour les modèles.

Phase 3 — HTML/UI (1 h)

Mettre à jour les data-attributes et blocs de monitoring pour refléter “job”.

Ajouter un script de migration qui convertit data-task-id → data-job-id et met à jour les listeners d’événements.

Phase 4 — Tests et validation (1 h)

Créer un petit script de test frontend pour appeler /projects et /tasks/status et vérifier la présence de job_id.

Redémarrer web/worker, vérifier console du navigateur et tester les fonctionnalités critiques (création projet, lancement d’analyse, suivi tâches).

Phase 5 — Documentation (30 min)

Créer CORRECTIONS_APPLIQUEES.md listant les écarts corrigés, les fichiers modifiés et les tests effectués.

Patches à appliquer

web/js/api.js
Remplacer la fonction

js
export async function fetchAPI(endpoint, options = {}) {
    const baseURL = '/api';
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
web/js/articles.js

Remplacer toute lecture task_id par job_id:

js
// Ancien
// const taskId = response.task_id;

// Nouveau
const jobId = response.job_id;
Exemple de suppression par lot:

js
export async function handleDeleteSelectedArticles() {
    const selectedArticles = getSelectedArticles();
    if (selectedArticles.length === 0) {
        showToast('Aucun article sélectionné', 'warning');
        return;
    }
    if (!confirm(`Supprimer ${selectedArticles.length} article(s) sélectionné(s) ?`)) return;

    try {
        const response = await fetchAPI('/articles/batch-delete', {
            method: 'POST',
            body: JSON.stringify({
                article_ids: selectedArticles.map(a => a.id),
                project_id: appState.currentProject.id
            })
        });

        if (response.job_id) {
            showToast(`Suppression lancée (Job ID: ${response.job_id})`, 'success');
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('articles:refresh'));
            }, 2000);
        }
    } catch (error) {
        showToast(`Erreur lors de la suppression : ${error.message}`, 'error');
    }
}
web/js/analyses.js

Centraliser les endpoints d’analyse via /projects/{id}/run-analysis et typer l’ATN:

js
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
            body: JSON.stringify({ type: 'atnscores' })
        });
        if (response.job_id) {
            showToast(`Analyse ATN lancée (Job ID: ${response.job_id})`, 'success');
        }
    } catch (error) {
        showToast(`Erreur : ${error.message}`, 'error');
    } finally {
        hideOverlay();
    }
}
web/js/tasks.js

Afficher la liste et le statut par job_id:

js
export async function fetchTasks() {
    try {
        const response = await fetchAPI('/tasks/status');
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
web/js/settings.js

Charger profils d’analyse et modèles:

js
export async function loadAnalysisProfiles() {
    try {
        const response = await fetchAPI('/analysis-profiles');
        return response.profiles || [];
    } catch (error) {
        console.error('Erreur chargement profils:', error);
        return [];
    }
}

export async function loadOllamaModels() {
    try {
        const response = await fetchAPI('/settings/models');
        return response.models || [];
    } catch (error) {
        console.error('Erreur chargement modèles:', error);
        return [];
    }
}
web/index.html — Bloc de monitoring (exemple)

Harmoniser la sémantique “job”:

xml
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
web/js/migration-fix.js — Migration DOM job_id/task_id

js
export function migrateTaskReferences() {
    const taskElements = document.querySelectorAll('[data-task-id]');
    taskElements.forEach(el => {
        const taskId = el.getAttribute('data-task-id');
        el.removeAttribute('data-task-id');
        el.setAttribute('data-job-id', taskId);
    });

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
test_frontend_fixes.js — Test rapide endpoints

js
// A placer à la racine ou dans web/js/tests/, exécuter avec votre bundler
import { fetchAPI } from './web/js/api.js';

async function testAPIEndpoints() {
    console.log('=== Test des corrections API ===');
    try {
        const projects = await fetchAPI('/projects');
        console.log('✓ Endpoint /projects OK');

        const tasks = await fetchAPI('/tasks/status');
        console.log('✓ Endpoint /tasks/status OK');

        if (Array.isArray(tasks.tasks) && tasks.tasks.length > 0) {
            const first = tasks.tasks[0];
            if (first.job_id) console.log('✓ Structure job_id confirmée');
            else if (first.task_id) console.warn('⚠️ task_id détecté - corriger le frontend');
        }
    } catch (error) {
        console.error('❌ Erreur test API:', error);
    }
}

testAPIEndpoints();
CORRECTIONS_APPLIQUEES.md — Journal des corrections

Documenter la désynchronisation, les endpoints corrigés, les fonctions impactées, les tests effectués.

Validation — Checklist

Redémarrer web/worker.

Ouvrir l’app, vérifier absence d’erreurs console.

Vérifier création projet → lancement analyse → suivi tâches affichant bien job_id.

Lancer test_frontend_fixes.js et vérifier les ✓.

Notes

Cette mise à jour supprime la source primaire d’échecs liés à task_id/job_id et réaligne le frontend sur les routes stables de l’API.