// ============================ 
// Settings Section 
// ============================ 
import { appState, elements } from '../app.js';
import { fetchAPI } from './api.js';
import { showToast, showLoadingOverlay, escapeHtml, openModal, closeModal } from './ui.js';

export async function renderSettings() { 
    if (!elements.settingsContainer) return; 
    
    const queuesHtml = await renderQueuesStatus(); 
    elements.settingsContainer.innerHTML = ` 
            <div class="settings-grid"> 
                <div class="settings-card"> 
                    <div class="settings-card__header"><h4>⚙️ Profils d'analyse</h4></div> 
                    <div class="settings-card__content"> 
                        <p>Gérez les profils de modèles IA utilisés pour l'analyse.</p> 
                        ${renderAnalysisProfiles()} 
                    </div> 
                </div> 

                <div class="settings-card"> 
                    <div class="settings-card__header"><h4>📝 Prompts</h4></div> 
                    <div class="settings-card__content"> 
                        <p>Modifiez les templates de prompts utilisés par l'IA.</p> 
                        ${renderPrompts()} 
                    </div> 
                </div> 

                <div class="settings-card"> 
                    <div class="settings-card__header"><h4>🤖 Modèles Ollama</h4></div> 
                    <div class="settings-card__content"> 
                        <p>Téléchargez et gérez les modèles de langage locaux.</p> 
                        ${renderOllamaModels()} 
                    </div> 
                </div> 
                
                <div class="settings-card"> 
                    <div class="settings-card__header"><h4>Zotero</h4></div> 
                    <div class="settings-card__content"> 
                        <p>Configurez votre connexion à Zotero.</p> 
                        <form id="zoteroSettingsForm"> 
                            <div class="form-group"> 
                                <label class="form-label">ID de la bibliothèque</label> 
                                <input type="text" name="zotero_library_id" class="form-control" placeholder="Votre ID de bibliothèque Zotero"> 
                            </div> 
                            <div class="form-group"> 
                                <label class="form-label">Clé API</label> 
                                <input type="password" name="zotero_api_key" class="form-control" placeholder="Votre clé API Zotero"> 
                            </div> 
                            <button type="submit" class="btn btn--primary">Sauvegarder</button> 
                        </form> 
                    </div> 
                </div> 

                <div class="settings-card settings-card--large"> 
                    <div class="settings-card__header"><h4>🔧 Files de tâches</h4></div> 
                    <div class="settings-card__content"> 
                        <p>Statut des files de traitement asynchrone.</p> 
                        ${queuesHtml} 
                    </div> 
                </div> 
            </div> 
        `; 
    document.getElementById('zoteroSettingsForm')?.addEventListener('submit', handleSaveZoteroSettings);
} 

export function renderAnalysisProfiles() { 
    const profiles = appState.analysisProfiles || []; 
    return ` 
        <div class="profiles-list"> 
            ${profiles.map(profile => ` 
                <div class="profile-card"> 
                    <h5>${escapeHtml(profile.name)}</h5> 
                    <div class="profile-details"> 
                        <span><strong>Preproc:</strong> ${escapeHtml(profile.preprocess_model)}</span> 
                        <span><strong>Extract:</strong> ${escapeHtml(profile.extract_model)}</span> 
                        <span><strong>Synth:</strong> ${escapeHtml(profile.synthesis_model)}</span> 
                    </div> 
                    <div class="profile-actions"> 
                        ${profile.is_custom ? ` 
                            <button class="btn btn--sm btn--outline" data-action="edit-profile" data-id="${profile.id}">Modifier</button>
                            <button class="btn btn--sm btn--danger" data-action="delete-profile" data-id="${profile.id}">Supprimer</button> 
                        ` : '<span class="badge badge--secondary">Défaut</span>'} 
                    </div> 
                </div> 
            `).join('')} 
        </div> 
        <button class="btn btn--primary" data-action="create-profile-modal">Créer un profil</button> 
    `; 
} 

export function renderPrompts() { 
    const prompts = appState.prompts || []; 
    if (prompts.length === 0) return '<p>Aucun prompt disponible.</p>'; 

    return ` 
        <div class="prompts-list"> 
            ${prompts.map(prompt => ` 
                <div class="prompt-item"> 
                    <div class="prompt-info"> 
                        <h5>${escapeHtml(prompt.name)}</h5> 
                        <p>${escapeHtml(prompt.description || 'Aucune description')}</p> 
                    </div> 
                    <button class="btn btn--sm btn--outline" data-action="edit-prompt" data-id="${prompt.name}">Modifier</button> 
                </div> 
            `).join('')} 
        </div> 
    `; 
} 

export function renderOllamaModels() { 
    const models = appState.ollamaModels || []; 
    return ` 
        <div class="models-list"> 
            ${models.length > 0 ? models.map(model => ` 
                <div class="model-item"> 
                    <span>${escapeHtml(model.name)}</span> 
                    <span class="badge badge--info">${formatBytes(model.size || 0)}</span> 
                </div> 
            `).join('') : '<p>Aucun modèle local trouvé.</p>'} 
        </div> 
        <button class="btn btn--primary" data-action="pull-model-modal">Télécharger un modèle</button> 
    `; 
} 

export function formatBytes(bytes, decimals = 2) { 
    if (bytes === 0) return '0 Bytes'; 
    const k = 1024; 
    const dm = decimals < 0 ? 0 : decimals; 
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']; 
    const i = Math.floor(Math.log(bytes) / Math.log(k)); 
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]; 
} 

export function showCreateProfileModal() { 
    const modelOptions = appState.ollamaModels.map(model => 
        `<option value="${escapeHtml(model.name)}">${escapeHtml(model.name)}</option>` 
    ).join(''); 

    const content = ` 
        <form id="createProfileForm"> 
            <div class="form-group"> 
                <label class="form-label">Nom du profil</label> 
                <input type="text" name="name" class="form-control" required> 
            </div> 
            <div class="form-group"> 
                <label class="form-label">Modèle de preprocessing</label> 
                <select name="preprocess_model" class="form-control" required>${modelOptions}</select> 
            </div> 
            <div class="form-group"> 
                <label class="form-label">Modèle d'extraction</label> 
                <select name="extract_model" class="form-control" required>${modelOptions}</select> 
            </div> 
            <div class="form-group"> 
                <label class="form-label">Modèle de synthèse</label> 
                <select name="synthesis_model" class="form-control" required>${modelOptions}</select> 
            </div> 
            <div class="modal__actions"> 
                <button type="button" class="btn btn--secondary" data-action="close-modal">Annuler</button> 
                <button type="submit" class="btn btn--primary">Créer</button> 
            </div> 
        </form> 
    `; 
    showModal('Créer un profil d\'analyse', content); 
    document.getElementById('createProfileForm')?.addEventListener('submit', handleCreateProfile);
} 

export async function handleCreateProfile(event) { 
    event.preventDefault(); 
    const formData = new FormData(event.target); 
    const profile = { 
        name: formData.get('name'), 
        preprocess_model: formData.get('preprocess_model'), 
        extract_model: formData.get('extract_model'), 
        synthesis_model: formData.get('synthesis_model') 
    }; 

    showLoadingOverlay(true, 'Création du profil...'); 
    try { 
        await fetchAPI('/profiles', { 
            method: 'POST', 
            body: profile 
        }); 

        await loadAnalysisProfiles(); 
        renderSettings(); 
        closeModal('genericModal'); 
        showToast('Profil créé avec succès', 'success'); 
    } catch (e) { 
        showToast(`Erreur: ${e.message}`, 'error'); 
    } finally { 
        showLoadingOverlay(false); 
    } 
} 

export function showPullModelModal() { 
    const content = ` 
        <form id="pullModelForm"> 
            <div class="form-group"> 
                <label class="form-label">Nom du modèle</label> 
                <input type="text" name="model" class="form-control" placeholder="ex: llama3.1:8b" required> 
                <div class="form-text">Le téléchargement peut prendre du temps.</div> 
            </div> 
            <div class="modal__actions"> 
                <button type="button" class="btn btn--secondary" data-action="close-modal">Annuler</button> 
                <button type="submit" class="btn btn--primary">Télécharger</button> 
            </div> 
        </form> 
    `; 
    showModal('Télécharger un modèle Ollama', content); 
    document.getElementById('pullModelForm')?.addEventListener('submit', handlePullModel);
} 

export async function handlePullModel(event) { 
    event.preventDefault(); 
    const model = new FormData(event.target).get('model'); 

    showLoadingOverlay(true, `Téléchargement de ${model}...`); 
    try { 
        await fetchAPI('/ollama/pull', { 
            method: 'POST', 
            body: { model } 
        }); 

        closeModal('genericModal'); 
        showToast('Téléchargement du modèle lancé en arrière-plan.', 'info'); 
        // Refresh model list after a delay 
        setTimeout(async () => { 
            await loadOllamaModels(); 
            renderSettings(); 
        }, 10000); 
    } catch (e) { 
        // Ne pas fermer la modale en cas d'erreur
        showToast(`Erreur: ${e.message}`, 'error'); 
    } finally { 
        showLoadingOverlay(false); 
    } 
} 

export function editPrompt(promptName) { 
    const prompt = appState.prompts.find(p => p.name === promptName); 
    if (!prompt) return; 

    const content = ` 
        <form id="editPromptForm" data-prompt-name="${promptName}"> 
            <div class="form-group"> 
                <label class="form-label">Nom</label> 
                <input type="text" name="name" value="${escapeHtml(prompt.name)}" class="form-control" readonly> 
            </div> 
            <div class="form-group"> 
                <label class="form-label">Description</label> 
                <textarea name="description" class="form-control" rows="2">${escapeHtml(prompt.description || '')}</textarea> 
            </div> 
            <div class="form-group"> 
                <label class="form-label">Template</label> 
                <textarea name="template" class="form-control" rows="10">${escapeHtml(prompt.template)}</textarea> 
            </div> 
            <div class="modal__actions"> 
                <button type="button" class="btn btn--secondary" data-action="close-modal">Annuler</button> 
                <button type="submit" class="btn btn--primary">Sauvegarder</button> 
            </div> 
        </form> 
    `; 
    showModal('Modifier le prompt', content, 'modal__content--large'); 
    document.getElementById('editPromptForm')?.addEventListener('submit', handleEditPrompt);
} 

export async function handleEditPrompt(event) { 
    event.preventDefault(); 
    const formData = new FormData(event.target); 
    const promptData = { 
        name: formData.get('name'), 
        description: formData.get('description'), 
        template: formData.get('template') 
    }; 

    showLoadingOverlay(true, 'Sauvegarde du prompt...'); 
    try { 
        await fetchAPI('/prompts', { 
            method: 'POST', 
            body: promptData 
        }); 

        await loadPrompts(); 
        renderSettings(); 
        closeModal('genericModal'); 
        showToast('Prompt sauvegardé', 'success'); 
    } catch (e) { 
        showToast(`Erreur: ${e.message}`, 'error'); 
    } finally { 
        showLoadingOverlay(false); 
    } 
} 

export async function handleSaveZoteroSettings(event) { 
    event.preventDefault(); 
    showToast('Fonctionnalité non implémentée.', 'info'); 
} 

export async function renderQueuesStatus() {
    try {
        const data = await fetchAPI('/admin/queues-status');
        const queues = (data && data.queues) || [];
        if (queues.length === 0) return `<p>Aucune file d'attente active.</p>`;

        return `
          <div class="queues-grid">
            ${queues.map(q => `
              <div class="queue-card">
                <div class="queue-header">
                  <h5>${escapeHtml(q.display)}</h5>
                  <span class="queue-workers-badge">${q.workers} worker${q.workers !== 1 ? 's' : ''}</span>
                </div>
                <div class="queue-stats">
                  <div class="stat-item"><span class="stat-value">${q.pending}</span><span class="stat-label">En attente</span></div>
                  <div class="stat-item"><span class="stat-value">${q.started}</span><span class="stat-label">En cours</span></div>
                  <div class="stat-item"><span class="stat-value">${q.failed}</span><span class="stat-label">Échecs</span></div>
                  <div class="stat-item"><span class="stat-value">${q.finished}</span><span class="stat-label">Terminées</span></div>
                </div>
                <div class="queue-footer"><small>${escapeHtml(q.rq_name)}</small></div>
              </div>
            `).join('')}
          </div>
        `;
    } catch (e) {
        return `<div class="alert alert--error">Impossible de charger le statut des files.</div>`;
    }
}

// Fonctions utilitaires pour les files
export function getQueueStatusClass(queue) {
    if (queue.worker_count === 0) return 'queue-card--inactive';
    if (queue.failed_job_registry > 5) return 'queue-card--error';
    if (queue.count > 10) return 'queue-card--busy';
    return 'queue-card--active';
}

export async function refreshQueuesStatus() {
    if (appState.currentSection === 'settings') {
        await renderSettings(); // Recharge toute la section paramètres
    }
}

export async function deleteProfile(profileId) { 
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce profil ?')) return; 

    showLoadingOverlay(true, 'Suppression du profil...'); 
    try { 
        await fetchAPI(`/profiles/${profileId}`, { method: 'DELETE' }); 
        showToast('Profil supprimé.', 'success'); 
        await loadAnalysisProfiles(); 
        renderSettings(); 
    } catch (e) { 
        showToast(`Erreur: ${e.message}`, 'error'); 
    } finally { 
        showLoadingOverlay(false); 
    } 
} 

export function editProfile(profileId) { 
    showToast('La modification de profil n\'est pas encore implémentée.', 'info'); 
} 

export async function loadAnalysisProfiles() {
    appState.analysisProfiles = await fetchAPI('/profiles');
}

export async function loadPrompts() {
    appState.prompts = await fetchAPI('/prompts');
}

export async function loadOllamaModels() {
    appState.ollamaModels = await fetchAPI('/ollama/models');
}

// Exposition globale n'est plus nécessaire pour les handlers de formulaire
// window.handleCreateProfile = handleCreateProfile;
// window.handlePullModel = handlePullModel;