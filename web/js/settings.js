// web/js/settings.js
// --- MODIFIÉ POUR LE RENDU DYNAMIQUE ---

import { fetchAPI } from './api.js';
import { appState } from './app-improved.js';
import { setQueuesStatus } from './state.js';
// MODIFIÉ: Utilisation du nouveau module UI amélioré
import { showToast, showConfirmModal } from './ui-improved.js'; 

let editors = {}; // Stocke les instances d'Ace Editor

// Types de prompts utilisés pour générer les éditeurs
const promptTypes = ['preprocess', 'extract', 'synthesis', 'discussion', 'rob', 'graph', 'stakeholder'];

/**
 * Charge les données initiales pour la page des paramètres.
 * Appelé par app.js lors de l'initialisation.
 */
export async function loadSettingsData() {
    await Promise.all([
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
        // CORRECTION : endpoint correct
        const response = await fetchAPI('/analysis-profiles');
        return response.profiles || [];
    } catch (error) {
        console.error('Erreur chargement profils:', error);
        return [];
    }
}

/**
 * Récupère les modèles de prompts depuis l'API et les stocke dans l'état.
 */
export async function loadPrompts() {
    try {
        const prompts = await fetchAPI('/prompts');
        appState.prompts = prompts || [];
    } catch (error) {
        console.error("Erreur lors du chargement des prompts:", error);
        showToast(`Erreur chargement prompts: ${error.message}`, 'error');
        appState.prompts = [];
    }
}

/**
 * Récupère les modèles Ollama locaux (via l'API backend).
 */
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

/**
 * Récupère le statut actuel des files d'attente RQ.
 */
export async function loadQueuesStatus() {
    try {
        const status = await fetchAPI('/queues/info');
        setQueuesStatus(status);
    } catch (error) {
        console.error("Erreur lors du chargement du statut des files:", error);
        setQueuesStatus({ queues: [] }); // État par défaut en cas d'erreur
    }
}

export function showEditPromptModal() {}
export function showEditProfileModal() {}
export function deleteProfile() {}
export function showPullModelModal() {}


/**
 * Fonction principale pour afficher la page des paramètres.
 * --- REFACTORISÉE POUR LE RENDU DYNAMIQUE ---
 */
export function renderSettings() {
    const container = document.getElementById('settingsContainer');
    if (!container) return;

    const profiles = appState.analysisProfiles;
    const prompts = appState.prompts;
    const models = appState.ollamaModels;
    const queueStatus = appState.queuesInfo;

    if (!profiles || !prompts || !models || !queueStatus) {
        container.innerHTML = `<div class="placeholder">Chargement des données de configuration...</div>`;
        console.warn("Les données des paramètres ne sont pas prêtes, le rendu est annulé.");
        return; 
    }

    // 1. Générer le layout HTML dynamique
    container.innerHTML = createSettingsLayout();

    // 2. Remplir les conteneurs maintenant qu'ils existent dans le DOM
    renderAnalysisProfilesList(profiles, document.getElementById('profile-list-container'));
    populateModelSelects(models);
    renderPromptTemplates(prompts, document.getElementById('prompt-templates-list'));
    renderQueueStatus(queueStatus, document.getElementById('queue-status-container'));

    // 3. Initialiser les composants interactifs
    initializeAllEditors();
    setupSettingsEventListeners(); // Attacher les écouteurs aux éléments fraîchement créés

    // 4. Sélectionner le premier profil par défaut
    const defaultProfile = profiles.find(p => p.is_default) || profiles[0];
    if (defaultProfile) {
        selectProfile(defaultProfile.id);
    }
}

/**
 * NOUVELLE FONCTION: Crée le HTML de la structure de la page des paramètres.
 * @returns {string} Le HTML de la grille des paramètres.
 */
function createSettingsLayout() {
    const prompts = appState.prompts || [];
    const promptOptions = prompts.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

    return `
        <div class="settings-col" id="settings-col-1">
            <div class="settings-card">
                <div class="settings-card__header">
                    <h3>Profils d'Analyse</h3>
                    <button id="new-profile-btn" class="btn btn--sm btn--primary">
                        <span class="icon">＋</span> Nouveau Profil
                    </button>
                </div>
                <div class="settings-card__body" id="profile-list-container">
                    </div>
            </div>
        </div>

        <div class="settings-col" id="settings-col-2">
            <form id="profile-edit-form" class="settings-card">
                <input type="hidden" id="profile-id" name="id">
                
                <div class="settings-card__header">
                    <h3>Éditer le Profil</h3>
                    <div class="form-actions">
                        <button id="delete-profile-btn" type="button" class="btn btn--sm btn--danger" disabled>
                            <span class="icon">🗑️</span> Supprimer
                        </button>
                        <button type="submit" class="btn btn--sm btn--primary">
                            <span class="icon">💾</span> Sauvegarder
                        </button>
                    </div>
                </div>

                <div class="settings-card__body">
                    <div class="form-group">
                        <label for="profile-name">Nom du Profil</label>
                        <input type="text" id="profile-name" name="name" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label for="profile-description">Description</label>
                        <textarea id="profile-description" name="description" class="form-control" rows="2"></textarea>
                    </div>
                    <div class="form-group form-group--checkbox">
                        <input type="checkbox" id="profile-is_default" name="is_default">
                        <label for="profile-is_default">Définir comme profil par défaut</label>
                    </div>
                    
                    <hr class="separator">
                    
                    <div class="form-group">
                        <label for="prompt-template-select">Appliquer un modèle de prompt :</label>
                        <div class="input-group">
                            <select id="prompt-template-select" class="form-control">
                                <option value="">Choisir un modèle...</option>
                                ${promptOptions}
                            </select>
                            <button type="button" class="btn btn--secondary" id="apply-template-btn">Appliquer</button>
                        </div>
                    </div>

                    ${createPromptEditorTabs()}
                </div>
            </form>
        </div>

        <div class="settings-col" id="settings-col-3">
            <div class="settings-card">
                <div class="settings-card__header">
                    <h3>Modèles de Prompts (Templates)</h3>
                    </div>
                <div class="settings-card__body" id="prompt-templates-list">
                    </div>
            </div>
        </div>

        <div class="settings-col" id="settings-col-4">
            <div class="settings-card">
                <div class="settings-card__header">
                    <h3>Statut des Tâches (Queues)</h3>
                    <button id="refresh-queues-btn" class="btn btn--sm btn--secondary">
                        <span class="icon">🔄</span> Rafraîchir
                    </button>
                </div>
                <div class="settings-card__body" id="queue-status-container">
                    </div>
            </div>
            
            <div class="settings-card">
                <div class="settings-card__header">
                    <h3>Gérer les Modèles Ollama</h3>
                </div>
                <div class="settings-card__body">
                    <p>Utilisez Ollama pour gérer les modèles (pull, delete, etc.).</p>
                    <button class="btn btn--secondary" data-action="show-pull-model-modal" disabled>
                        Pull un nouveau modèle (Bientôt)
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * NOUVELLE FONCTION: Crée le HTML pour les onglets des éditeurs Ace.
 * @returns {string} Le HTML des onglets et des panneaux d'éditeur.
 */
function createPromptEditorTabs() {
    // Crée les en-têtes des onglets
    const tabs = promptTypes.map((type, index) => `
        <button 
            type="button" 
            class="tab-link ${index === 0 ? 'active' : ''}" 
            data-tab="tab-prompt-${type}"
        >
            ${type.charAt(0).toUpperCase() + type.slice(1)}
        </button>
    `).join('');

    // Crée les panneaux de contenu pour chaque onglet
    const panels = promptTypes.map((type, index) => `
        <div id="tab-prompt-${type}" class="tab-content ${index === 0 ? 'active' : ''}">
            <div class="form-group">
                <label for="profile-${type}-model">Modèle LLM</label>
                <select id="profile-${type}-model" name="${type}_model" class="form-control model-select">
                    </select>
            </div>
            <div class="form-group">
                <label for="${type}-prompt-system">Prompt Système</label>
                <div id="${type}-prompt-system" class="ace-editor"></div>
            </div>
            <div class="form-group">
                <label for="${type}-prompt-user">Prompt Utilisateur (Template)</label>
                <div id="${type}-prompt-user" class="ace-editor"></div>
            </div>
        </div>
    `).join('');

    return `
        <div class="tabs">
            <div class="tab-header">
                ${tabs}
            </div>
            <div class="tab-body">
                ${panels}
            </div>
        </div>
    `;
}


/**
 * Renders the list of analysis profiles.
 * @param {Array} profiles - The list of analysis profiles.
 * @param {HTMLElement} container - The container element to render the list into.
 */
function renderAnalysisProfilesList(profiles, container) {
    if (!container) return;
    if (!profiles || profiles.length === 0) {
        container.innerHTML = '<p class="placeholder">Aucun profil d\'analyse trouvé.</p>';
        return;
    }

    // Utilisation des classes CSS du nouveau design system
    const listHtml = profiles.map(profile => `
        <div class="list-item" data-profile-id="${profile.id}">
            <div class="list-item__content">
                <h5 class="list-item__title">${profile.name} ${profile.is_default ? '<span class="badge badge--default">Défaut</span>' : ''}</h5>
                <p class="list-item__description">${profile.description || 'Pas de description.'}</p>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = `<div class="list-group">${listHtml}</div>`;
    
    // Attacher les écouteurs de clic
    container.querySelectorAll('.list-item').forEach(item => {
        item.addEventListener('click', () => selectProfile(item.dataset.profileId));
    });
}

/**
 * Configure tous les écouteurs d'événements pour la page des paramètres.
 * NOTE: Cette fonction est maintenant appelée APRÈS la création du DOM.
 */
function setupSettingsEventListeners() {
    // Écouteurs pour les boutons principaux
    document.getElementById('new-profile-btn')?.addEventListener('click', handleNewProfile);
    document.getElementById('delete-profile-btn')?.addEventListener('click', handleDeleteProfile);
    document.getElementById('apply-template-btn')?.addEventListener('click', () => {
        const select = document.getElementById('prompt-template-select');
        if (select.value) {
            applyPromptTemplate(select.value);
        }
    });
    document.getElementById('refresh-queues-btn')?.addEventListener('click', async () => {
        showToast("Rafraîchissement du statut des files...", 'info');
        await loadQueuesStatus();
        renderQueueStatus(appState.queuesInfo, document.getElementById('queue-status-container'));
    });

    // Écouteur pour le formulaire
    const profileEditForm = document.getElementById('profile-edit-form');
    if (profileEditForm) {
        profileEditForm.addEventListener('submit', handleSaveProfile);
    }
    
    // Écouteurs pour les onglets de prompts
    const tabContainer = profileEditForm.querySelector('.tabs');
    if (tabContainer) {
        const tabLinks = tabContainer.querySelectorAll('.tab-link');
        const tabContents = tabContainer.querySelectorAll('.tab-content');

        tabLinks.forEach(link => {
            link.addEventListener('click', () => {
                const tabId = link.dataset.tab;

                tabLinks.forEach(tl => tl.classList.remove('active'));
                tabContents.forEach(tc => tc.classList.remove('active'));

                link.classList.add('active');
                document.getElementById(tabId)?.classList.add('active');
            });
        });
    }
}

/**
 * Affiche la liste des modèles de prompts.
 */
function renderPromptTemplates(prompts, container) {
    if (!container) return;
    if (!prompts || prompts.length === 0) {
        container.innerHTML = '<p class="placeholder">Aucun modèle de prompt trouvé.</p>';
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
            select.innerHTML = '<option value="">Aucun modèle Ollama trouvé</option>';
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
        if (retryCount > 50) { // Limite de 5 secondes
            console.error("La bibliothèque Ace n'a pas pu être chargée.");
            return;
        }
        console.warn("Ace non chargé. Nouvel essai dans 100ms.");
        setTimeout(() => initializeAllEditors(retryCount + 1), 100);
        return;
    }

    const theme = document.body.classList.contains('dark-theme') ? "ace/theme/tomorrow_night" : "ace/theme/chrome";

    promptTypes.forEach(type => {
        try {
            const systemEditorId = `${type}-prompt-system`;
            const userEditorId = `${type}-prompt-user`;

            if (document.getElementById(systemEditorId)) {
                editors[`${type}_system`] = ace.edit(systemEditorId);
                editors[`${type}_system`].setTheme(theme);
                editors[`${type}_system`].session.setMode("ace/mode/markdown");
            }

            if (document.getElementById(userEditorId)) {
                editors[`${type}_user`] = ace.edit(userEditorId);
                editors[`${type}_user`].setTheme(theme);
                editors[`${type}_user`].session.setMode("ace/mode/markdown");
            }
        } catch (e) {
            console.warn(`Impossible d'initialiser l'éditeur Ace pour ${type}: ${e.message}.`);
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
    
    appState.selectedProfileId = profileId; // Stocker l'ID sélectionné

    // Mettre à jour la liste pour afficher la sélection
    document.querySelectorAll('#profile-list-container .list-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.profileId === profileId) {
            item.classList.add('active');
        }
    });

    // Charger les données dans le formulaire
    renderProfileForm(profile);
}

/**
 * Affiche les données d'un profil sélectionné dans les champs du formulaire et les éditeurs.
 */
function renderProfileForm(profile) {
    const form = document.getElementById('profile-edit-form');
    if (!form) return;

    form.querySelector('#profile-id').value = profile.id || '';
    form.querySelector('#profile-name').value = profile.name || '';
    form.querySelector('#profile-description').value = profile.description || '';
    form.querySelector('#profile-is_default').checked = profile.is_default || false;

    // Définir les valeurs des sélecteurs de modèles
    promptTypes.forEach(type => {
        const select = form.querySelector(`#profile-${type}-model`);
        if (select) {
            select.value = profile[`${type}_model`] || '';
        }
    });

    // Gérer le bouton de suppression
    const deleteBtn = document.getElementById('delete-profile-btn');
    if (profile.is_default || profile.id.startsWith('new_')) {
        deleteBtn.disabled = true;
        deleteBtn.title = profile.is_default ? "Impossible de supprimer le profil par défaut." : "";
    } else {
        deleteBtn.disabled = false;
        deleteBtn.title = "Supprimer ce profil";
    }

    // Charger les prompts dans les éditeurs Ace
    promptTypes.forEach(type => {
        let promptKey = (type === 'stakeholder') ? 'stakeholder_analysis_prompt' : `${type}_prompt`;
        const dbContent = profile[promptKey] || "{}";
        let promptData = { system: "", user: "" };

        try {
            const parsedData = JSON.parse(dbContent);
            promptData.system = parsedData.system || "";
            promptData.user = parsedData.user || "";
        } catch (e) {
            promptData.system = dbContent; // Ancien format texte
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

    // Trouver l'onglet actif pour deviner où appliquer le template
    const activeTab = document.querySelector('.tab-content.active');
    let targetType = null;
    if (activeTab) {
        targetType = activeTab.id.replace('tab-prompt-', '');
    }

    // Si aucun onglet n'est actif ou si on ne peut pas deviner, essayer de deviner par le nom
    if (!targetType) {
        targetType = promptTypes.find(type => template.name.toLowerCase().includes(type));
    }

    if (targetType && editors[`${targetType}_system`] && editors[`${targetType}_user`]) {
        editors[`${targetType}_system`].setValue(template.system_message || "", -1);
        editors[`${targetType}_user`].setValue(template.user_message_template || "", -1);
        showToast(`Modèle '${template.name}' appliqué aux éditeurs '${targetType}'.`, 'success');
    } else {
        showToast(`Impossible de déterminer à quel éditeur ce modèle s'applique. Veuillez sélectionner un onglet.`, 'warn');
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
    const form = document.getElementById('profile-edit-form');
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


/**
 * Gestionnaire pour la création d'un nouveau profil.
 */
function handleNewProfile() {
    const newProfile = {
        id: `new_${Date.now()}`,
        name: "Nouveau Profil",
        description: "",
        is_default: false,
    };
    
    // Remplir le formulaire avec le profil vide
    renderProfileForm(newProfile);

    // Mettre l'ID à "" pour indiquer à l'API qu'il s'agit d'un POST (Créer)
    document.getElementById('profile-id').value = "";
    
    // Désélectionner dans la liste
    document.querySelectorAll('#profile-list-container .list-item').forEach(item => {
        item.classList.remove('active');
    });
    
    document.getElementById('profile-name').focus();
}

/**
 * Gestionnaire pour la sauvegarde (POST ou PUT) d'un profil.
 */
export async function handleSaveProfile(e) {
    e.preventDefault();
    const form = e.target;
    const saveBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="icon">⌛</span> Sauvegarde...';

    try {
        const profileData = collectProfileData();
        const profileId = document.getElementById('profile-id').value;

        let url = '/api/analysis-profiles';
        let method = 'POST';

        if (profileId && !profileId.startsWith('new_')) {
            url = `/analysis-profiles/${profileId}`;
            method = 'PUT';
        } else {
            delete profileData.id;
        }

        const updatedProfile = await fetchAPI(url, {
            method: method,
            body: JSON.stringify(profileData)
        });

        showToast(`Profil '${updatedProfile.name}' sauvegardé.`, 'success');
        
        await loadAnalysisProfiles();
        renderSettings(); // Re-render complet
        
        // Resélectionner le profil qui vient d'être sauvegardé/créé
        selectProfile(updatedProfile.id);

    } catch (error) {
        console.error("Erreur lors de la sauvegarde du profil:", error);
        showToast(error.message, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalBtnText;
    }
}

/**
 * Gestionnaire pour la suppression d'un profil (après confirmation).
 * --- REFACTORISÉ AVEC showConfirmModal ---
 */
export async function handleDeleteProfile() {
    const profileId = appState.selectedProfileId;
    const profiles = appState.analysisProfiles;
    const profile = profiles.find(p => p.id === profileId);

    if (!profile || profile.is_default) {
        showToast("Impossible de supprimer ce profil (défaut ou non sélectionné).", 'warn');
        return;
    }

    // Utilisation de la nouvelle modale de confirmation
    showConfirmModal(
        'Confirmer la suppression',
        `Êtes-vous sûr de vouloir supprimer définitivement le profil "${profile.name}" ?`,
        {
            confirmText: 'Supprimer',
            confirmClass: 'btn--danger',
            onConfirm: async () => {
                try {
                    await fetchAPI(`/analysis-profiles/${profileId}`, { method: 'DELETE' });
                    showToast(`Profil "${profile.name}" supprimé.`, 'success');
                    
                    await loadAnalysisProfiles();
                    renderSettings(); // Re-render (sélectionnera le nouveau profil par défaut)

                } catch (error) {
                    console.error("Erreur lors de la suppression du profil:", error);
                    showToast(error.message, 'error');
                }
            }
        }
    );
}


/**
 * Affiche le statut des files d'attente RQ.
 */
function renderQueueStatus(status, container) {
    if (!container || !status || !status.queues) return;

    let html = '<ul class="list-group list-group--condensed">';
    Object.keys(status.queues).forEach(qName => {
        const queue = status.queues[qName];
        html += `
            <li class="list-item list-item--condensed">
                <div class="list-item__content">
                    File: <strong>${queue.display}</strong>
                </div>
                <span class="badge badge--primary" title="Tâches en attente">${queue.pending}</span>
            </li>
        `;
    });
    
    // Vérifier s'il y a des workers
    if (!status.workers || status.workers.length === 0) {
        html += `
            <li class="list-item list-item--condensed">
                <div class="list-item__content text-danger">
                    <strong>Aucun worker actif détecté.</strong>
                    <small>Les tâches ne seront pas traitées.</small>
                </div>
            </li>
        `;
    }
    
    html += '</ul>';
    
    container.innerHTML = html;
}

/**
 * Gère le vidage d'une file d'attente spécifique.
 * @param {string} queueName - Le nom de la file à vider.
 */
export async function handleClearQueue(queueName) {
    if (!queueName) return;

    showConfirmModal(
        'Vider la file d\'attente',
        `Êtes-vous sûr de vouloir vider la file "${queueName}" ? Toutes les tâches en attente seront perdues.`,
        {
            confirmText: 'Vider',
            confirmClass: 'btn--danger',
            onConfirm: async () => {
                await fetchAPI('/queues/clear', { method: 'POST', body: { queue_name: queueName } });
                showToast(`La file "${queueName}" a été vidée.`, 'success');
                await loadQueuesStatus(); // Recharger le statut
            }
        }
    );
}

/**
 * Gère le téléchargement (pull) d'un nouveau modèle Ollama.
 */
export async function handlePullModel() {
    const modelNameInput = document.getElementById('pullModelName');
    const modelName = modelNameInput ? modelNameInput.value.trim() : null;

    if (!modelName) {
        showToast('Veuillez entrer un nom de modèle valide (ex: llama3:latest).', 'warning');
        return;
    }

    closeModal('pullModelModal');
    showLoadingOverlay(true, `Téléchargement du modèle "${modelName}"...`);

    try {
        await fetchAPI('/ollama/pull', { method: 'POST', body: { model_name: modelName } });
        showToast(`Le téléchargement de "${modelName}" a commencé.`, 'info');
    } catch (error) {
        showToast(`Erreur lors du lancement du téléchargement : ${error.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}

/**
 * Gère la sauvegarde d'un modèle de prompt.
 */
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
    const endpoint = promptId ? `/prompts/${promptId}` : '/prompts';

    await fetchAPI(endpoint, { method, body: payload });
    showToast('Modèle de prompt sauvegardé.', 'success');
    closeModal('promptEditorModal');
    await loadPrompts();
}

/**
 * Ouvre la modale d'édition de profil, soit pour un nouveau profil, soit pour un profil existant.
 * @param {string|null} profileId - L'ID du profil à éditer, ou null pour un nouveau.
 */
export function openProfileEditor(profileId = null) {
    if (profileId) {
        const profile = appState.analysisProfiles.find(p => p.id === profileId);
        if (profile) {
            // Logique pour pré-remplir le formulaire avec les données du profil
            console.log('Editing profile:', profile);
        }
    } else {
        // Logique pour réinitialiser le formulaire pour un nouveau profil
        console.log('Creating new profile');
    }
    openModal('profileEditorModal'); // Assurez-vous que ce modal existe dans votre HTML
}