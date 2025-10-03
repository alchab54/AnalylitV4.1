// web/js/settings.js
// --- MODIFIÉ POUR LE RENDU DYNAMIQUE ---

import { fetchAPI } from './api.js';
import { appState } from './app-improved.js';
import { setQueuesStatus, setAnalysisResults, setAnalysisProfiles, setPrompts, setOllamaModels, setSelectedProfileId } from './state.js';
import { showConfirmModal, showToast } from './ui-improved.js';
import { API_ENDPOINTS, MESSAGES, SELECTORS } from './constants.js';

let editors = {}; // Stocke les instances d'Ace Editor

// Types de prompts utilisés pour générer les éditeurs
const promptTypes = ['preprocess', 'extract', 'synthesis', 'discussion', 'rob', 'graph', 'stakeholder'];

/**
 * Charge les données initiales pour la page des paramètres.
 * Appelé par app.js lors de l'initialisation.
 */
export async function loadSettingsData() {
    await Promise.allSettled([
        loadAnalysisProfiles(),
        loadPrompts(),
        loadOllamaModels(),
        loadQueuesStatus()
    ]);
}

/**
 * Récupère les profils d'analyse depuis l'API et les stocke dans l'état.
 */
export async function loadAnalysisProfiles() {
    try {
        const profiles = await fetchAPI(API_ENDPOINTS.analysisProfiles);
        setAnalysisProfiles(profiles || []);
    } catch (error) {
        console.error('Erreur chargement profils:', error);
        setAnalysisProfiles([]);
    }
}

/**
 * Récupère les modèles de prompts depuis l'API et les stocke dans l'état.
 */
async function loadPrompts() {
    try {
        const prompts = await fetchAPI(API_ENDPOINTS.prompts);
        setPrompts(prompts || []);
    } catch (error) {
        console.error("Erreur lors du chargement des prompts:", error);
        showToast(MESSAGES.errorLoadingPrompts, 'error');
        setPrompts([]);
    }
}

/**
 * Récupère les modèles Ollama locaux (via l'API backend).
 */
export async function loadOllamaModels() {
    try {
        const models = await fetchAPI(API_ENDPOINTS.ollamaModels);
        setOllamaModels(models.models || []);
        return true; // Indiquer le succès
    } catch (error) {
        console.error('Erreur chargement modèles Ollama:', error);
        setOllamaModels([]);
        return false; // Indiquer l'échec
    }
}

/**
 * Affiche une alerte dans l'interface si la connexion à Ollama échoue.
 */
function displayOllamaConnectionError() {
    const modelsSection = document.getElementById('models-section');
    if (modelsSection) {
        const errorHtml = `
            <div class="settings-card">
                <div class="settings-card__header">
                    <h3 class="settings-card__title">Erreur de Connexion</h3>
                </div>
                <div class="settings-card__body">
                    <div class="alert alert--error">
                        <h4>Impossible de joindre le service Ollama</h4>
                        <p>Assurez-vous qu'Ollama est bien démarré sur votre machine (commande: <code>ollama serve</code>) et que le backend de l'application peut y accéder sur <code>localhost:11434</code>.</p>
                    </div>
                </div>
            </div>`;
        modelsSection.innerHTML = errorHtml;
    }
}

/**
 * ✅ **PATCH n°3 : Afficher correctement le statut des files d'attente**
 */
export async function loadQueuesStatus() {
    try {
        const status = await fetchAPI(API_ENDPOINTS.queuesInfo);
        setQueuesStatus(status);
    } catch (error) {
        console.error("Erreur lors du chargement du statut des files:", error);
        setQueuesStatus([]); // État par défaut en cas d'erreur
    }
}

export function showEditPromptModal() { /* Logic to show modal for prompt editing */ }
export function showEditProfileModal() { /* Logic to show modal for profile editing */ }
export function deleteProfile() { /* Logic to delete profile */ }

export function showPullModelModal() {}

/**
 * Fonction principale pour afficher la page des paramètres.
 * --- REFACTORISÉE POUR LE RENDU DYNAMIQUE ---
 */
export async function renderSettings() {
    const container = document.querySelector(SELECTORS.settingsContainer);
    if (!container) return;
    
    // S'assurer que les données sont chargées avant de continuer
    await loadSettingsData();

    const profiles = appState.analysisProfiles;

    if (!profiles || !appState.prompts || !appState.queuesInfo) {
        container.innerHTML = `<div class="placeholder">${MESSAGES.loadingSettingsData}</div>`;
        console.warn(MESSAGES.settingsDataNotReady);
        return; 
    }

    createSettingsLayout();
    renderAnalysisProfilesList(profiles, document.querySelector('#profile-list-container'));
    renderPromptTemplates(appState.prompts, document.querySelector('#prompt-templates-list'));
    renderQueueStatus(appState.queuesInfo, document.querySelector('#queue-status-container'));

    const ollamaConnected = await loadOllamaModels();
    if (ollamaConnected) {
        populateModelSelects(appState.ollamaModels);
        loadInstalledModels();
    } else {
        displayOllamaConnectionError();
    }

    setupSettingsEventListeners();

    const defaultProfile = profiles.find(p => p.is_default) || profiles[0];
    if (defaultProfile && !appState.selectedProfileId) {
        selectProfile(defaultProfile.id);
    }
}

/**
 * NOUVELLE FONCTION: Crée le HTML de la structure de la page des paramètres.
 */
function createSettingsLayout() {
    const mount = document.querySelector(SELECTORS.settingsContainer);
    if (mount && !mount.dataset.initialized) {
        mount.dataset.initialized = '1';
        mount.innerHTML = `<div class="grid-2"> <aside class="card"> <div class="card__header"><div class="h3">Paramètres</div></div> <div class="card__body"> <div class="tabs"> <div class="tab-list"> <button class="tab-btn active" data-tab="profiles">Profils</button> <button class="tab-btn" data-tab="models">Modèles</button> <button class="tab-btn" data-tab="templates">Templates</button> <button class="tab-btn" data-tab="queues">Files</button> <button class="tab-btn" data-tab="prefs">Préférences</button> </div> </div> </div> </aside> <section class="card"> <div class="card__header"><div class="h3" id="settingsTitle">Profils d’analyse</div></div> <div class="card__body" id="settingsContent"> <div class="text-muted">Sélectionnez une catégorie à gauche.</div> </div> </section> </div>`;
    }
}

/**
 * NOUVELLE FONCTION: Crée le HTML pour la section des profils.
 */
function createProfilesSection() {
    return `
        <div class="settings-card">
            <div class="settings-card__header">
                <h3 class="settings-card__title">Mes Profils</h3>
                <button id="new-profile-btn" class="btn btn--primary">
                    <span class="icon">＋</span> Nouveau Profil
                </button>
            </div>
            <div class="settings-card__body">
                <div id="profile-list-container" class="enhanced-list">
                    <!-- Profils injectés ici -->
                </div>
            </div>
        </div>

        <div class="settings-card">
            <div class="settings-card__header">
                <h3 class="settings-card__title">Édition du Profil</h3>
            </div>
            <div class="settings-card__body">
                <form id="profile-edit-form">
                    <input type="hidden" id="profile-id" name="id">
                    
                    <div class="form-section">
                        <h4 class="form-section-title">
                            <span class="icon">📋</span>
                            Informations Générales
                        </h4>
                        <div class="form-row">
                            <div class="form-group--enhanced">
                                <label for="profile-name">Nom du Profil</label>
                                <input type="text" id="profile-name" name="name" class="form-control--enhanced" required>
                            </div>
                            <div class="form-group--enhanced">
                                <label for="profile-is_default">
                                    <input type="checkbox" id="profile-is_default" name="is_default">
                                    Profil par défaut
                                </label>
                            </div>
                        </div>
                        <div class="form-row form-row--single">
                            <div class="form-group--enhanced">
                                <label for="profile-description">Description</label>
                                <textarea id="profile-description" name="description" class="form-control--enhanced" rows="3"></textarea>
                            </div>
                        </div>
                    </div>
                    <div class="form-section">
                        <h4 class="form-section-title">
                            <span class="icon">🤖</span>
                            Configuration des Prompts
                        </h4>
                        <div class="modern-tabs">
                            <div class="tab-header-modern">
                                ${promptTypes.map((type, index) => `
                                    <button type="button" class="tab-link-modern ${index === 0 ? 'active' : ''}" data-tab="tab-prompt-${type}">
                                        ${type.charAt(0).toUpperCase() + type.slice(1)}
                                    </button>
                                `).join('')}
                            </div>
                            <div class="tab-content-modern">
                                ${promptTypes.map((type, index) => `
                                    <div id="tab-prompt-${type}" class="tab-panel ${index === 0 ? 'active' : ''}">
                                        <div class="form-row">
                                            <div class="form-group--enhanced">
                                                <label for="profile-${type}-model">Modèle LLM</label>
                                                <select id="profile-${type}-model" name="${type}_model" class="form-control--enhanced model-select">
                                                </select>
                                            </div>
                                        </div>
                                        <div class="form-row form-row--single">
                                            <div class="form-group--enhanced">
                                                <label for="${type}-prompt-system">Prompt Système</label>
                                                <div id="${type}-prompt-system" class="ace-editor"></div>
                                            </div>
                                        </div>
                                        <div class="form-row form-row--single">
                                            <div class="form-group--enhanced">
                                                <label for="${type}-prompt-user">Template Utilisateur</label>
                                                <div id="${type}-prompt-user" class="ace-editor"></div>
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>

                    <div class="form-actions">
                        <button id="delete-profile-btn" type="button" class="btn btn--danger" disabled>
                            <span class="icon">🗑️</span> Supprimer
                        </button>
                        <button type="submit" class="btn btn--primary">
                            <span class="icon">💾</span> Sauvegarder
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

/**
 * NOUVELLE FONCTION: Crée le HTML pour la section des modèles IA.
 */
function createModelsSection() {
    return `
        <div class="settings-card">
            <div class="settings-card__header">
                <h3 class="settings-card__title">Télécharger un Modèle</h3>
            </div>
            <div class="settings-card__body">
                <div class="form-row">
                    <div class="form-group--enhanced">
                        <label for="available-models-select">Modèles Disponibles</label>
                        <select id="available-models-select" class="form-control--enhanced">
                            <option value="llama3:8b">Llama 3 8B (Recommandé)</option>
                            <option value="phi3:mini">Phi 3 Mini (Très Rapide)</option>
                            <option value="mistral:7b">Mistral 7B (Analyse)</option>
                            <option value="qwen2:7b">Qwen2 7B (Code)</option>
                            <option value="gemma:2b">Gemma 2B (Léger)</option>
                        </select>
                    </div>
                    <div class="form-group--enhanced">
                        <label>&nbsp;</label>
                        <button data-action="download-selected-model" class="btn btn--primary">
                            <span class="icon">⬇️</span> Télécharger
                        </button>
                    </div>
                </div>
                <div id="download-progress" class="progress-container" style="display:none;">
                    <div class="progress-bar" id="download-progress-bar"></div>
                    <span id="download-status">Téléchargement en cours...</span>
                </div>
            </div>
        </div>

        <div class="settings-card">
            <div class="settings-card__header">
                <h3 class="settings-card__title">Modèles Installés</h3>
                <span id="ollama-status-indicator" class="status-indicator status-indicator--success">
                    <span class="status-dot"></span>
                    Connecté à Ollama
                </span>
            </div>
            <div class="settings-card__body">
                <div id="installed-models-list" class="enhanced-list">
                    <!-- Modèles installés injectés ici -->
                </div>
            </div>
        </div>
    `;
}

/**
 * NOUVELLE FONCTION: Crée le HTML pour la section des templates.
 */
function createTemplatesSection() {
    return `
        <div class="settings-card">
            <div class="settings-card__header">
                <h3 class="settings-card__title">Templates de Prompts</h3>
                <button class="btn btn--primary">
                    <span class="icon">＋</span> Nouveau Template
                </button>
            </div>
            <div class="settings-card__body">
                <div id="prompt-templates-list" class="enhanced-list">
                    <!-- Templates injectés ici -->
                </div>
            </div>
        </div>
    `;
}

/**
 * NOUVELLE FONCTION: Crée le HTML pour la section des files d'attente.
 */
function createQueuesSection() {
    return `
        <div class="settings-card">
            <div class="settings-card__header">
                <h3 class="settings-card__title">Statut des Files</h3>
                <button id="refresh-queues-btn" class="btn btn--secondary">
                    <span class="icon">🔄</span> Actualiser
                </button>
            </div>
            <div class="settings-card__body">
                <div id="queue-status-container">
                    <!-- Statut des files injecté ici -->
                </div>
            </div>
        </div>
    `;
}

/**
 * NOUVELLE FONCTION: Crée le HTML pour la section des préférences.
 */
function createPreferencesSection() {
    return `
        <div class="settings-card">
            <div class="settings-card__header">
                <h3 class="settings-card__title">Préférences Générales</h3>
            </div>
            <div class="settings-card__body">
                <div class="form-section">
                    <h4 class="form-section-title">
                        <span class="icon">🎨</span>
                        Interface
                    </h4>
                    <div class="form-row">
                        <div class="form-group--enhanced">
                            <label for="theme-select">Thème</label>
                            <select id="theme-select" class="form-control--enhanced">
                                <option value="light">Clair</option>
                                <option value="dark">Sombre</option>
                                <option value="auto">Automatique</option>
                            </select>
                        </div>
                        <div class="form-group--enhanced">
                            <label for="language-select">Langue</label>
                            <select id="language-select" class="form-control--enhanced">
                                <option value="fr">Français</option>
                                <option value="en">English</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="form-section">
                    <h4 class="form-section-title">
                        <span class="icon">🔔</span>
                        Notifications
                    </h4>
                    <div class="form-group--enhanced">
                        <label>
                            <input type="checkbox" id="notifications-enabled">
                            Activer les notifications
                        </label>
                    </div>
                    <div class="form-group--enhanced">
                        <label>
                            <input type="checkbox" id="email-notifications">
                            Notifications par email
                        </label>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Renders the list of analysis profiles.
 */
function renderAnalysisProfilesList(profiles, container) {
    if (!container) return;
    if (!profiles || profiles.length === 0) {
        container.innerHTML = `<p class="placeholder">${MESSAGES.noAnalysisProfileFound}</p>`;
        return;
    }

    const listHtml = profiles.map(profile => `
        <div class="list-item" data-profile-id="${profile.id}">
            <div class="list-item__content">
                <h5 class="list-item__title">${profile.name} ${profile.is_default ? '<span class="badge badge--default">Défaut</span>' : ''}</h5>
                <p class="list-item__description">${profile.description || 'Pas de description.'}</p>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = `<div class="list-group">${listHtml}</div>`;
    
    container.querySelectorAll('.list-item').forEach(item => {
        item.addEventListener('click', () => selectProfile(item.dataset.profileId));
    });
}

/**
 * Gère le rendu du contenu de la section Paramètres en fonction de l'onglet actif.
 */
function renderSettingsSection(tabId) {
    const contentContainer = document.getElementById('settingsContent');
    if (!contentContainer) return;

    let html = '';
    switch (tabId) {
        case 'profiles':
            html = createProfilesSection();
            break;
        case 'models':
            html = createModelsSection();
            break;
        case 'templates':
            html = createTemplatesSection();
            break;
        case 'queues':
            html = createQueuesSection();
            break;
        case 'prefs':
            html = createPreferencesSection();
            break;
        default:
            html = '<div class="text-muted">Sélectionnez une catégorie à gauche.</div>';
    }
    contentContainer.innerHTML = html;

    if (tabId === 'profiles') {
        renderAnalysisProfilesList(appState.analysisProfiles, document.querySelector('#profile-list-container'));
        populateModelSelects(appState.ollamaModels);
        initializeAllEditors();
        const defaultProfile = appState.analysisProfiles.find(p => p.is_default) || appState.analysisProfiles[0];
        if (defaultProfile) selectProfile(defaultProfile.id);
    } else if (tabId === 'models') {
        loadInstalledModels();
        populateModelSelects(appState.ollamaModels);
    } else if (tabId === 'templates') {
        renderPromptTemplates(appState.prompts, document.querySelector('#prompt-templates-list'));
    } else if (tabId === 'queues') {
        renderQueueStatus(appState.queuesInfo, document.querySelector('#queue-status-container'));
    }

    setupSettingsEventListeners();
}

function initSettingsTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const title = document.getElementById('settingsTitle');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      
      const titles = {
        profiles: "Profils d’analyse",
        models: "Modèles IA",
        templates: "Templates de prompts",
        queues: "Files de tâches",
        prefs: "Préférences"
      };
      title.textContent = titles[tab] || "Paramètres";
      renderSettingsSection(tab);
    });
  });
}

/**
 * Configure tous les écouteurs d'événements pour la page des paramètres.
 */
function setupSettingsEventListeners() {
    document.querySelector('#new-profile-btn')?.addEventListener('click', handleNewProfile); 
    document.querySelector('#delete-profile-btn')?.addEventListener('click', handleDeleteProfile); 
    document.querySelector('#apply-template-btn')?.addEventListener('click', () => {
        const select = document.querySelector('#prompt-template-select'); 
        if (select && select.value) {
            applyPromptTemplate(select.value);
        }
    });
    document.querySelector(SELECTORS.refreshQueuesBtn)?.addEventListener('click', async () => {
        showToast(MESSAGES.refreshingQueuesStatus, 'info');
        await loadQueuesStatus();
        renderQueueStatus(appState.queuesInfo, document.querySelector('#queue-status-container'));
    });

    const profileEditForm = document.querySelector(SELECTORS.settingsForm);
    if (profileEditForm) {
        profileEditForm.addEventListener('submit', handleSaveProfile);
    }

    initSettingsTabs();
}

/**
 * Affiche la liste des modèles de prompts.
 */
function renderPromptTemplates(prompts, container) {
    if (!container) return;
    if (!prompts || prompts.length === 0) {
        container.innerHTML = `<p class="placeholder">${MESSAGES.noPromptTemplateFound}</p>`;
        return;
    }
    const listHtml = prompts.map(prompt => `
        <div class="list-item list-item--condensed">
             <div class="list-item__content">
                <h5 class="list-item__title">${prompt.name}</h5>
                <p class="list-item__description">${prompt.description || 'Pas de description.'}</p>
            </div>
        </div>
    `).join('');
    container.innerHTML = `<div class="list-group">${listHtml}</div>`;
}

/**
 * Remplit tous les <select> de modèles avec les modèles Ollama récupérés.
 */
function populateModelSelects(models) {
    const modelSelects = document.querySelectorAll('.model-select');
    if (!models || models.length === 0) {
        modelSelects.forEach(select => {
            select.innerHTML = `<option value="">${MESSAGES.noOllamaModelFound}</option>`;
        });
        return;
    }
    
    const optionsHtml = models.map(model => `<option value="${model.name}">${model.name}</option>`).join('');
    
    modelSelects.forEach(select => {
        select.innerHTML = `<option value="">-- Choisir un modèle --</option>${optionsHtml}`;
    });
}

/**
 * Initialise tous les éditeurs de code Ace sur la page.
 */
function initializeAllEditors(retryCount = 0) {
    if (typeof ace === 'undefined') {
        if (retryCount > 50) {
            console.error(MESSAGES.aceNotLoaded);
            return;
        }
        console.warn(MESSAGES.aceRetry);
        setTimeout(() => initializeAllEditors(retryCount + 1), 100);
        return;
    }

    const theme = document.body.classList.contains('dark-theme') ? "ace/theme/tomorrow_night" : "ace/theme/chrome";

    promptTypes.forEach(type => {
        try {
            const systemEditorId = `${type}-prompt-system`;
            const userEditorId = `${type}-prompt-user`;

            if (document.querySelector(`#${systemEditorId}`)) {
                editors[`${type}_system`] = ace.edit(systemEditorId);
                editors[`${type}_system`].setTheme(theme);
                editors[`${type}_system`].session.setMode("ace/mode/markdown");
            }

            if (document.querySelector(`#${userEditorId}`)) {
                editors[`${type}_user`] = ace.edit(userEditorId);
                editors[`${type}_user`].setTheme(theme);
                editors[`${type}_user`].session.setMode("ace/mode/markdown");
            }
        } catch (e) {
            console.warn(MESSAGES.aceInitError(type)(e.message));
        }
    });
}

/**
 * Sélectionne un profil et charge ses données dans le formulaire d'édition.
 */
export function selectProfile(profileId) {
    const profiles = appState.analysisProfiles;
    const profile = profiles.find(p => p.id === profileId);

    if (!profile) {
        console.error(`Profil non trouvé: ${profileId}`);
        return;
    }
    
    setSelectedProfileId(profileId);

    document.querySelectorAll(`${SELECTORS.settingsContainer} .list-item`).forEach(item => {
        item.classList.remove('active');
        if (item.dataset.profileId === profileId) {
            item.classList.add('active');
        }
    });

    renderProfileForm(profile);
}

/**
 * Affiche les données d'un profil sélectionné dans les champs du formulaire et les éditeurs.
 */
function renderProfileForm(profile) {
    const form = document.querySelector('#profile-edit-form');
    if (!form) return; 

    form.querySelector('#profile-id').value = profile.id || ''; 
    form.querySelector('#profile-name').value = profile.name || ''; 
    form.querySelector('#profile-description').value = profile.description || ''; 
    form.querySelector('#profile-is_default').checked = profile.is_default || false; 

    promptTypes.forEach(type => {
        const select = form.querySelector(`#profile-${type}-model`);
        if (select) {
            select.value = profile[`${type}_model`] || '';
        }
    });

    const deleteBtn = document.querySelector('#delete-profile-btn');
    if (profile.is_default || (profile.id && profile.id.startsWith('new_'))) {
        deleteBtn.disabled = true;
        deleteBtn.title = profile.is_default ? MESSAGES.cannotDeleteDefaultProfile : "";
    } else {
        deleteBtn.disabled = false;
        deleteBtn.title = MESSAGES.deleteThisProfile;
    }

    promptTypes.forEach(type => {
        const promptKey = (type === 'stakeholder') ? 'stakeholder_analysis_prompt' : `${type}_prompt`;
        const dbContent = profile[promptKey] || "{}";
        let promptData = { system: "", user: "" };

        try {
            const parsedData = JSON.parse(dbContent);
            promptData.system = parsedData.system || "";
            promptData.user = parsedData.user || "";
        } catch (e) {
            promptData.system = dbContent;
            promptData.user = "";
        }

        if (editors[`${type}_system`]) {
            editors[`${type}_system`].setValue(promptData.system, -1);
        }
        if (editors[`${type}_user`]) {
            editors[`${type}_user`].setValue(promptData.user, -1);
        }
    });
}

/**
 * Applique un modèle de prompt (template) aux éditeurs de prompts actuellement actifs.
 */
function applyPromptTemplate(templateId) {
    const templates = appState.prompts;
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    const activeTab = document.querySelector('.tab-content.active');
    let targetType = null;
    if (activeTab) {
        targetType = activeTab.id.replace('tab-prompt-', '');
    }

    if (!targetType) {
        targetType = promptTypes.find(type => template.name.toLowerCase().includes(type));
    }

    if (targetType && editors[`${targetType}_system`] && editors[`${targetType}_user`]) {
        editors[`${targetType}_system`].setValue(template.system_message || "", -1);
        editors[`${targetType}_user`].setValue(template.user_message_template || "", -1);
        showToast(MESSAGES.templateApplied(template.name, targetType), 'success');
    } else {
        showToast(MESSAGES.cannotApplyTemplate, 'warn');
    }
}

/**
 * Récupère les valeurs actuelles de tous les éditeurs Ace.
 */
function getPromptEditorValues() {
    const values = [];
    promptTypes.forEach(type => {
        if (editors[`${type}_system`]) {
            values.push({
                name: `${type}_system`,
                content: editors[`${type}_system`].getValue()
            });
        }
        if (editors[`${type}_user`]) {
            values.push({
                name: `${type}_user`,
                content: editors[`${type}_user`].getValue()
            });
        }
    });
    return values;
}

/**
 * Collecte toutes les données du formulaire de profil dans un objet JSON propre.
 */
function collectProfileData() {
    const form = document.querySelector(SELECTORS.settingsForm);
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    const promptsList = getPromptEditorValues();

    promptTypes.forEach(type => {
        const sysPrompt = promptsList.find(p => p.name === `${type}_system`);
        const userPrompt = promptsList.find(p => p.name === `${type}_user`);

        const combinedPromptData = {
            system: sysPrompt ? sysPrompt.content : "",
            user: userPrompt ? userPrompt.content : ""
        };

        const key = (type === 'stakeholder') ? 'stakeholder_analysis_prompt' : `${type}_prompt`;
        data[key] = JSON.stringify(combinedPromptData);
    });

    data.is_default = form.querySelector('#profile-is_default').checked;
    
    return data;
}

function handleNewProfile() {
    const newProfile = {
        id: `new_${Date.now()}`,
        name: "Nouveau Profil",
        description: "",
        is_default: false,
    };
    
    renderProfileForm(newProfile);
    document.querySelector('#profile-id').value = ""; 
    
    document.querySelectorAll(`${SELECTORS.settingsContainer} .list-item`).forEach(item => {
        item.classList.remove('active');
    });

    document.querySelector('#profile-name').focus();
}

export async function handleSaveProfile(e) {
    e.preventDefault();
    const form = e.target;
    const saveBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span class="icon">⌛</span> ${MESSAGES.saving}`;

    try {
        const profileData = collectProfileData();
        const profileId = document.querySelector('#profile-id').value; 

        let url = API_ENDPOINTS.analysisProfiles;
        let method = 'POST';

        if (profileId && !profileId.startsWith('new_')) {
            url = API_ENDPOINTS.analysisProfileById(profileId);
            method = 'PUT';
        } else {
            delete profileData.id;
        }

        const updatedProfile = await fetchAPI(url, {
            method: method,
            body: JSON.stringify(profileData)
        });

        showToast(MESSAGES.profileSaved(updatedProfile.name), 'success');
        
        await loadAnalysisProfiles();
        renderSettings();
        
        selectProfile(updatedProfile.id);

    } catch (error) {
        console.error(MESSAGES.errorSavingProfile, error);
        showToast(error.message, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalBtnText;
    }
}

export async function handleDeleteProfile() {
    const profileId = appState.selectedProfileId;
    const profiles = appState.analysisProfiles;
    const profile = profiles.find(p => p.id === profileId);

    if (!profile || profile.is_default) {
        showToast(MESSAGES.cannotDeleteProfile, 'warn');
        return;
    }

    showConfirmModal(
        MESSAGES.confirmProfileDeleteTitle,
        MESSAGES.confirmDeleteBody('le profil', profile.name),
        {
            confirmText: MESSAGES.deleteButton,
            confirmClass: 'btn--danger',
            onConfirm: async () => {
                try {
                    await fetchAPI(API_ENDPOINTS.analysisProfileById(profileId), { method: 'DELETE' });
                    showToast(MESSAGES.profileDeleted(profile.name), 'success');
                    
                    await loadAnalysisProfiles();
                    renderSettings();

                } catch (error) {
                    console.error(MESSAGES.errorDeletingProfile, error);
                    showToast(error.message, 'error');
                }
            }
        }
    );
}

/**
 * Affiche le statut des files d'attente RQ.
 */
function renderQueueStatus(queues, container) {
    if (!container || !queues) {
        return;
    }

    // ✅ CORRECTION: Gérer le cas où 'queues' n'est pas un tableau ou est vide.
    if (!Array.isArray(queues) || queues.length === 0) {
        container.innerHTML = '<p class="placeholder">Aucune information sur les files d\'attente disponible.</p>';
        return;
    }

    let html = '<ul class="list-group list-group--condensed">';
    queues.forEach(queue => {
        const queueName = queue.name || 'undefined';
        const jobCount = queue.count !== undefined ? queue.count : 'N/A';
        html += `
            <li class="list-item list-item--condensed">
                <div class="list-item__content">
                    File: <strong>${queueName}</strong>
                </div>
                <span class="badge badge--primary" title="Tâches en attente">${jobCount}</span>
            </li>
        `;
    });
    
    html += '</ul>';
    container.innerHTML = html;
}
    
export async function handleClearQueue(queueName) {
    if (!queueName) return;

    showConfirmModal(
        MESSAGES.clearQueueTitle,
        MESSAGES.confirmClearQueueBody(queueName),
        {
            confirmText: MESSAGES.clearButton,
            confirmClass: 'btn--danger',
            onConfirm: async () => {
                await fetchAPI(API_ENDPOINTS.queuesClear, { method: 'POST', body: { queue_name: queueName } });
                showToast(MESSAGES.queueCleared(queueName), 'success');
                await loadQueuesStatus();
            }
        }
    );
}

export async function handleSavePrompt(event) {
    event.preventDefault();
    const form = event.target;
    const promptId = form.elements.promptId.value;
    const name = form.elements.promptName.value;
    const description = form.elements.promptDescription.value;
    const systemMessage = form.elements.promptSystem.value;
    const userTemplate = form.elements.promptUser.value;

    const payload = {
        name,
        description,
        system_message: systemMessage,
        user_message_template: userTemplate
    };

    const method = promptId ? 'PUT' : 'POST';
    const endpoint = promptId ? API_ENDPOINTS.promptById(promptId) : API_ENDPOINTS.prompts;

    await fetchAPI(endpoint, { method, body: payload });
    showToast(MESSAGES.promptSaved, 'success');
    closeModal('promptEditorModal');
    await loadPrompts();
}

export function openProfileEditor(profileId = null) {
    if (profileId) {
        const profile = appState.analysisProfiles.find(p => p.id === profileId);
        if (profile) {
            console.log('Editing profile:', profile);
        }
    } else {
        console.log('Creating new profile');
    }
    openModal('profileEditorModal');
}

export function handleDownloadSelectedModel() {
    const select = document.querySelector('#available-models-select'); 
    if (select) {
        const modelName = select.value;
        downloadModel(modelName); 
    } else {
        console.error(MESSAGES.selectNotFound);
        showToast(MESSAGES.modelListNotFound, 'error');
    }
}

export async function downloadModel(modelName) {
    try {
        showDownloadProgress(modelName);
        const response = await fetchAPI(API_ENDPOINTS.ollamaPull, {
            method: 'POST',
            body: JSON.stringify({ model: modelName }),
        });
        if (response.success) {
            showToast(MESSAGES.modelDownloaded(modelName), 'success');
            await loadInstalledModels();
        } else {
            throw new Error(response.error || MESSAGES.unknownError);
        }
    } catch (error) {
        showToast(`${MESSAGES.downloadError}: ${error.message}`, 'error');
    } finally {
        hideDownloadProgress();
    }
}

export async function loadInstalledModels() {
    try {
        const response = await fetchAPI(API_ENDPOINTS.ollamaModels);
        const modelsList = document.querySelector('#installed-models-list');
        if (!modelsList) return;
        modelsList.innerHTML = response.models
            .map(
                (model) =>
                `<li>${model.name} <span class="model-size">${model.size || ''}</span></li>`
            )
            .join('');
        document.querySelector('#ollama-status-indicator')?.classList.replace('status-indicator--error', 'status-indicator--success');
        document.querySelector('#ollama-status-indicator span:last-child').textContent = 'Connecté à Ollama';
    } catch (error) {
        console.error('Erreur chargement modèles installés :', error);
        const indicator = document.querySelector('#ollama-status-indicator');
        if (indicator) {
            indicator.querySelector('span:last-child').textContent = 'Connexion échouée';
        }
    }
}


document.querySelector('#refresh-queues-btn')?.addEventListener('click', async () => {
    showToast(MESSAGES.refreshingQueuesStatus, 'info');
    await loadQueuesStatus();
});


function showDownloadProgress(modelName) {
    const progressContainer = document.querySelector('#download-progress'); 
    const statusElement = document.querySelector('#download-status'); 
    if(progressContainer && statusElement) {
        progressContainer.style.display = 'block';
        statusElement.textContent = MESSAGES.downloadingModel(modelName);
    }
}

function hideDownloadProgress() {
    const progressContainer = document.querySelector('#download-progress');
    if(progressContainer) {
        progressContainer.style.display = 'none'; 
    }
}
