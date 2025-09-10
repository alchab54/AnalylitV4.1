// ============================ 
// Settings Section 
// ============================ 

async function renderSettings() { 
    if (!elements.settingsContainer) return; 
    
    showLoadingOverlay(true, 'Chargement des paramètres...'); 
    try { 
        // Fetch data required for settings page 
        await Promise.all([ 
            loadAnalysisProfiles(), 
            loadPrompts(), 
            loadOllamaModels() 
        ]); 

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
                        <form onsubmit="handleSaveZoteroSettings(event)"> 
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
    } catch (e) { 
        elements.settingsContainer.innerHTML = `<div class="alert alert--error">Erreur de chargement des paramètres.</div>`; 
        console.error(e); 
    } finally { 
        showLoadingOverlay(false); 
    } 
} 

function renderAnalysisProfiles() { 
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
                            <button class="btn btn--sm btn--outline" onclick="editProfile('${profile.id}')">Modifier</button> 
                            <button class="btn btn--sm btn--danger" onclick="deleteProfile('${profile.id}')">Supprimer</button> 
                        ` : '<span class="badge badge--secondary">Défaut</span>'} 
                    </div> 
                </div> 
            `).join('')} 
        </div> 
        <button class="btn btn--primary" onclick="showCreateProfileModal()">Créer un profil</button> 
    `; 
} 

function renderPrompts() { 
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
                    <button class="btn btn--sm btn--outline" onclick="editPrompt('${prompt.name}')">Modifier</button> 
                </div> 
            `).join('')} 
        </div> 
    `; 
} 

function renderOllamaModels() { 
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
        <button class="btn btn--primary" onclick="showPullModelModal()">Télécharger un modèle</button> 
    `; 
} 

function formatBytes(bytes, decimals = 2) { 
    if (bytes === 0) return '0 Bytes'; 
    const k = 1024; 
    const dm = decimals < 0 ? 0 : decimals; 
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']; 
    const i = Math.floor(Math.log(bytes) / Math.log(k)); 
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]; 
} 

function showCreateProfileModal() { 
    const modelOptions = appState.ollamaModels.map(model => 
        `<option value="${escapeHtml(model.name)}">${escapeHtml(model.name)}</option>` 
    ).join(''); 

    const content = ` 
        <form onsubmit="handleCreateProfile(event)"> 
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
                <button type="button" class="btn btn--secondary" onclick="closeModal('genericModal')">Annuler</button> 
                <button type="submit" class="btn btn--primary">Créer</button> 
            </div> 
        </form> 
    `; 
    showModal('Créer un profil d\'analyse', content); 
} 

async function handleCreateProfile(event) { 
    event.preventDefault(); 
    const formData = new FormData(event.target); 
    const profile = { 
        name: formData.get('name'), 
        preprocess_model: formData.get('preprocess_model'), 
        extract_model: formData.get('extract_model'), 
        synthesis_model: formData.get('synthesis_model') 
    }; 

    try { 
        closeModal('genericModal'); 
        showLoadingOverlay(true, 'Création du profil...'); 
        
        await fetchAPI('/profiles', { 
            method: 'POST', 
            body: profile 
        }); 

        await loadAnalysisProfiles(); 
        renderSettings(); 
        showToast('Profil créé avec succès', 'success'); 
    } catch (e) { 
        showToast(`Erreur: ${e.message}`, 'error'); 
    } finally { 
        showLoadingOverlay(false); 
    } 
} 

function showPullModelModal() { 
    const content = ` 
        <form onsubmit="handlePullModel(event)"> 
            <div class="form-group"> 
                <label class="form-label">Nom du modèle</label> 
                <input type="text" name="model" class="form-control" placeholder="ex: llama3.1:8b" required> 
                <div class="form-text">Le téléchargement peut prendre du temps.</div> 
            </div> 
            <div class="modal__actions"> 
                <button type="button" class="btn btn--secondary" onclick="closeModal('genericModal')">Annuler</button> 
                <button type="submit" class="btn btn--primary">Télécharger</button> 
            </div> 
        </form> 
    `; 
    showModal('Télécharger un modèle Ollama', content); 
} 

async function handlePullModel(event) { 
    event.preventDefault(); 
    const model = new FormData(event.target).get('model'); 

    try { 
        closeModal('genericModal'); 
        showLoadingOverlay(true, `Téléchargement de ${model}...`); 
        
        await fetchAPI('/ollama/pull', { 
            method: 'POST', 
            body: { model } 
        }); 

        showToast('Téléchargement du modèle lancé en arrière-plan.', 'info'); 
        // Refresh model list after a delay 
        setTimeout(async () => { 
            await loadOllamaModels(); 
            renderSettings(); 
        }, 10000); 
    } catch (e) { 
        showToast(`Erreur: ${e.message}`, 'error'); 
    } finally { 
        showLoadingOverlay(false); 
    } 
} 

function editPrompt(promptName) { 
    const prompt = appState.prompts.find(p => p.name === promptName); 
    if (!prompt) return; 

    const content = ` 
        <form onsubmit="handleEditPrompt(event, '${promptName}')"> 
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
                <button type="button" class="btn btn--secondary" onclick="closeModal('genericModal')">Annuler</button> 
                <button type="submit" class="btn btn--primary">Sauvegarder</button> 
            </div> 
        </form> 
    `; 
    showModal('Modifier le prompt', content, 'modal__content--large'); 
} 

async function handleEditPrompt(event, promptName) { 
    event.preventDefault(); 
    const formData = new FormData(event.target); 
    const promptData = { 
        name: formData.get('name'), 
        description: formData.get('description'), 
        template: formData.get('template') 
    }; 

    try { 
        closeModal('genericModal'); 
        showLoadingOverlay(true, 'Sauvegarde du prompt...'); 
        
        await fetchAPI('/prompts', { 
            method: 'POST', 
            body: promptData 
        }); 

        await loadPrompts(); 
        renderSettings(); 
        showToast('Prompt sauvegardé', 'success'); 
    } catch (e) { 
        showToast(`Erreur: ${e.message}`, 'error'); 
    } finally { 
        showLoadingOverlay(false); 
    } 
} 

async function handleSaveZoteroSettings(event) { 
    event.preventDefault(); 
    showToast('Fonctionnalité non implémentée.', 'info'); 
} 

async function renderQueuesStatus() {
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
function getQueueStatusClass(queue) {
    if (queue.worker_count === 0) return 'queue-card--inactive';
    if (queue.failed_job_registry > 5) return 'queue-card--error';
    if (queue.count > 10) return 'queue-card--busy';
    return 'queue-card--active';
}

async function refreshQueuesStatus() {
    if (appState.currentSection === 'settings') {
        await renderSettings(); // Recharge toute la section paramètres
    }
} 

async function deleteProfile(profileId) { 
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

function editProfile(profileId) { 
    showToast('La modification de profil n\'est pas encore implémentée.', 'info'); 
} 
