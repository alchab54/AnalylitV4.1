# Fichiers JS CORRIGÉS - AnalyLit V4.1

## 🔧 CORRECTION COMPLÈTE DES EXPORTS ESM

Voici les corrections pour tous les fichiers manquant d'exports:

### 1. web/js/validation.js

```javascript
// web/js/validation.js
import { appState, elements } from '../app.js';
import { fetchAPI } from './api.js';
import { showLoadingOverlay, showToast, escapeHtml } from './ui.js';
import { loadProjectGrids } from './grids.js';
import { setCurrentValidations } from './state.js';

// CORRIGÉ: Ajout des exports manquants
export async function handleValidateExtraction(extractionId, decision) {
    if (!appState.currentProject?.id || !extractionId) return;
    
    try {
        await fetchAPI(`/projects/${appState.currentProject.id}/extractions/${extractionId}/decision`, {
            method: 'PUT',
            body: { decision: decision, evaluator: 'evaluator1' }
        });
        
        await loadValidationSection();
        showToast('Décision mise à jour.', 'success');
    } catch (error) {
        showToast(`Erreur de validation : ${error.message}`, 'error');
    }
}

export async function resetValidationStatus(extractionId) {
    await handleValidateExtraction(extractionId, '');
}

export function filterValidationList(status, target) {
    // Retirer la classe active de tous les boutons de filtre
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('filter-btn--active');
    });
    
    // Ajouter la classe active au bouton cliqué
    target.classList.add('filter-btn--active');
    
    // Filtrer les éléments
    const items = document.querySelectorAll('.validation-item');
    items.forEach(item => {
        const itemStatus = item.dataset.status;
        if (status === 'all' || itemStatus === status) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

export async function loadValidationSection() {
    if (!appState.currentProject) {
        const validationContainer = document.getElementById('validationContainer');
        if (validationContainer) {
            validationContainer.innerHTML = `
                <div class="section-empty">
                    <h3>Aucun projet sélectionné</h3>
                    <p>Sélectionnez un projet pour voir les données de validation.</p>
                </div>`;
        }
        return;
    }
    
    await loadProjectExtractions(appState.currentProject.id);
}

async function loadProjectExtractions(projectId) {
    if (!appState.currentProject) return;
    
    const extractions = await fetchAPI(`/projects/${projectId}/extractions`);
    setCurrentValidations(extractions);
}

export async function renderValidationSection(project) {
    const container = document.getElementById('validationContainer');
    if (!container || !project) {
        if(container) container.innerHTML = `
            <div class="section-empty">
                <h3>Aucun projet sélectionné</h3>
                <p>Sélectionnez un projet pour voir la validation.</p>
            </div>`;
        return;
    }

    showLoadingOverlay(true, 'Chargement des validations...');

    try {
        const extractions = appState.currentValidations || [];
        const included = extractions.filter(e => e.user_validation_status === 'include');
        const excluded = extractions.filter(e => e.user_validation_status === 'exclude');
        const pending = extractions.filter(e => !e.user_validation_status);

        const grids = appState.currentProjectGrids || [];
        const gridOptions = grids.map(g => 
            `<option value="${g.id}">${escapeHtml(g.name)}</option>`
        ).join('');

        container.innerHTML = `
            <div class="validation-section">
                <div class="validation-header">
                    <h2>Validation Inter-Évaluateurs</h2>
                    <div class="validation-stats">
                        <div class="stat-item stat-item--included">
                            <span class="stat-value">${included.length}</span>
                            <span class="stat-label">Inclus</span>
                        </div>
                        <div class="stat-item stat-item--excluded">
                            <span class="stat-value">${excluded.length}</span>
                            <span class="stat-label">Exclus</span>
                        </div>
                        <div class="stat-item stat-item--pending">
                            <span class="stat-value">${pending.length}</span>
                            <span class="stat-label">En attente</span>
                        </div>
                    </div>
                </div>

                <div class="validation-filters">
                    <button class="filter-btn filter-btn--active" data-action="filter-validations" data-status="all">
                        Tous
                    </button>
                    <button class="filter-btn" data-action="filter-validations" data-status="include">
                        Inclus (${included.length})
                    </button>
                    <button class="filter-btn" data-action="filter-validations" data-status="exclude">  
                        Exclus (${excluded.length})
                    </button>
                    <button class="filter-btn" data-action="filter-validations" data-status="pending">
                        En attente (${pending.length})
                    </button>
                </div>

                ${included.length > 0 ? `
                    <div class="extraction-launch">
                        <h4>Lancer l'extraction complète</h4>
                        <p>Lancez une extraction détaillée sur les <strong>${included.length} article(s)</strong> que vous avez inclus.</p>
                        <button class="btn btn--primary" data-action="run-extraction-modal">
                            Lancer l'extraction
                        </button>
                    </div>
                ` : ''}

                <div class="validation-list">
                    ${extractions.map(extraction => renderValidationItem(extraction)).join('')}
                </div>
            </div>`;
    } catch (e) {
        container.innerHTML = `
            <div class="error-state">
                <h3>Erreur</h3>
                <p>Erreur lors de l'affichage de la section de validation.</p>
            </div>`;
    } finally {
        showLoadingOverlay(false);
    }
}

function renderValidationItem(extraction) {
    const article = appState.searchResults.find(art => art.article_id === extraction.pmid);
    const title = article?.title || extraction.title || 'Titre non disponible';
    
    const statusClass = extraction.user_validation_status === 'include' ? 'included' : 
                       extraction.user_validation_status === 'exclude' ? 'excluded' : 'pending';
    
    return `
        <div class="validation-item" data-status="${extraction.user_validation_status || 'pending'}">
            <div class="validation-item__header">
                <h4 class="validation-item__title">${escapeHtml(title)}</h4>
                <div class="validation-item__score">
                    Score IA: ${extraction.relevance_score != null ? extraction.relevance_score.toFixed(1) : 'N/A'}/10
                </div>
            </div>
            
            <div class="validation-item__content">
                <p class="validation-item__justification">
                    <strong>Justification:</strong> ${escapeHtml(extraction.relevance_justification || 'Aucune')}
                </p>
                
                <div class="validation-item__actions">
                    <button class="btn btn--sm btn--success" 
                            data-action="validate-extraction" 
                            data-id="${extraction.id}" 
                            data-decision="include">
                        Inclure
                    </button>
                    <button class="btn btn--sm btn--danger" 
                            data-action="validate-extraction" 
                            data-id="${extraction.id}" 
                            data-decision="exclude">
                        Exclure
                    </button>
                    <button class="btn btn--sm btn--secondary" 
                            data-action="reset-validation" 
                            data-id="${extraction.id}">
                        Réinitialiser
                    </button>
                </div>
            </div>
        </div>`;
}
```

### 2. web/js/chat.js

```javascript
// web/js/chat.js
import { escapeHtml, showToast } from './ui.js';
import { appState } from '../app.js';
import { fetchAPI } from './api.js';

function formatMessageContent(content) {
    if (!content) return '';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    
    let safeContent = escapeHtml(content);
    safeContent = safeContent.replace(/\n/g, '<br>');
    safeContent = safeContent.replace(urlRegex, '<a href="$1" target="_blank">$1</a>');
    
    return safeContent;
}

export async function loadChatMessages() {
    const chatContainer = document.getElementById('chatContainer');
    if (!chatContainer) return;

    if (!appState.currentProject?.id) {
        renderChatSection();
        return;
    }

    try {
        const messages = await fetchAPI(`/projects/${appState.currentProject.id}/chat-messages`);
        appState.chatMessages = Array.isArray(messages) ? messages : [];
        renderChatInterface(appState.chatMessages);
    } catch (e) {
        console.error('Erreur chargement chat:', e);
        renderChatSection(null, true);
    }
}

export function renderChatInterface(messages = appState.chatMessages, error = false) {
    const chatContainer = document.getElementById('chatContainer');
    if (!chatContainer) return;

    if (!appState.currentProject?.id) {
        chatContainer.innerHTML = `
            <div class="chat-empty">
                <h3>Aucun projet sélectionné</h3>
                <p>Sélectionnez un projet pour accéder au chat RAG.</p>
            </div>`;
        return;
    }

    if (error) {
        chatContainer.innerHTML = `
            <div class="chat-error">
                <h3>Erreur</h3>
                <p>Erreur lors du chargement du chat.</p>
            </div>`;
        return;
    }

    const messagesHtml = messages.map(msg => `
        <div class="chat-message chat-message--${msg.sender}">
            <div class="chat-message__content">
                ${formatMessageContent(msg.content)}
            </div>
            <div class="chat-message__timestamp">
                ${new Date(msg.timestamp).toLocaleString()}
            </div>
        </div>
    `).join('');

    chatContainer.innerHTML = `
        <div class="chat-interface">
            <div class="chat-messages" id="chatMessages">
                ${messagesHtml}
            </div>
            
            <div class="chat-input-container">
                <div class="chat-input-group">
                    <textarea id="chatInput" 
                              class="chat-input" 
                              placeholder="Posez votre question sur les PDFs indexés..."
                              rows="3"
                              data-action="submit-chat-on-enter"></textarea>
                    <button class="btn btn--primary chat-send-btn" 
                            data-action="send-chat-message">
                        Envoyer
                    </button>
                </div>
            </div>
        </div>`;

    // Faire défiler vers le bas
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

export async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const question = input?.value?.trim();
    
    if (!question || !appState.currentProject?.id) {
        showToast('Veuillez saisir une question', 'warning');
        return;
    }

    // Ajouter le message utilisateur immédiatement
    const userMessage = {
        sender: 'user',
        content: question,
        timestamp: new Date().toISOString()
    };
    
    appState.chatMessages.push(userMessage);
    renderChatInterface(appState.chatMessages);
    
    // Vider l'input
    input.value = '';

    try {
        // Envoyer la question à l'API
        const response = await fetchAPI(`/projects/${appState.currentProject.id}/chat`, {
            method: 'POST',
            body: { question: question }
        });

        showToast('Question envoyée. Réponse en cours...', 'info');
        
    } catch (error) {
        console.error('Erreur lors de l\'envoi de la question:', error);
        showToast('Erreur lors de l\'envoi de la question', 'error');
        
        // Retirer le message utilisateur en cas d'erreur
        appState.chatMessages.pop();
        renderChatInterface(appState.chatMessages);
    }
}

function renderChatSection(project = null, error = false) {
    const chatContainer = document.getElementById('chatContainer');
    if (!chatContainer) return;

    if (error) {
        chatContainer.innerHTML = `
            <div class="chat-error">
                <h3>Erreur</h3>
                <p>Erreur lors du chargement du chat.</p>
            </div>`;
        return;
    }

    if (!project) {
        chatContainer.innerHTML = `
            <div class="chat-empty">
                <h3>Aucun projet sélectionné</h3>
                <p>Sélectionnez un projet pour accéder au chat RAG.</p>
            </div>`;
        return;
    }
}
```

### 3. web/js/notifications.js

```javascript
// web/js/notifications.js
import { appState } from '../app.js';
import { showToast } from './ui.js';

export function updateNotificationIndicator() {
    const indicator = document.querySelector('.notification-indicator');
    if (!indicator) return;

    const countEl = indicator.querySelector('span:last-child');
    if (appState.unreadNotifications > 0) {
        indicator.style.display = 'flex';
        if(countEl) countEl.textContent = `Notifications (${appState.unreadNotifications})`;
    } else {
        indicator.style.display = 'none';
    }
}

export function clearNotifications() {
    appState.unreadNotifications = 0;
    appState.notifications = [];
    updateNotificationIndicator();
}

export function handleWebSocketNotification(data) {
    showToast(data.message, data.type || 'info');
    appState.unreadNotifications++;
    updateNotificationIndicator();
}
```

**Instructions d'application:**

1. **Remplacez le contenu** de chaque fichier dans `web/js/` avec les versions corrigées
2. **Vérifiez que tous les imports** pointent vers les bons chemins relatifs
3. **Testez module par module** en vérifiant la console pour les erreurs d'import
4. **Supprimez ou ignorez** complètement le dossier `/js/` (legacy)

**Vérification rapide:**
```bash
# Dans la console du navigateur
console.log(Object.keys(window)); // Ne devrait pas voir de modules globaux
```