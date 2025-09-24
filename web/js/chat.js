// web/js/chat.js
import { escapeHtml } from './ui-improved.js';
import { showToast } from './ui-improved.js';
import { appState } from './app-improved.js'; // Read from state
import { fetchAPI } from './api.js';
import { API_ENDPOINTS, MESSAGES, SELECTORS } from './constants.js';

function formatMessageContent(content) {
    if (!content) return '';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    
    let safeContent = escapeHtml(content);
    safeContent = safeContent.replace(/\n/g, '<br>');
    safeContent = safeContent.replace(urlRegex, '<a href="$1" target="_blank">$1</a>');
    
    return safeContent;
}

/**
 * Charge et affiche l'historique des messages du chat pour le projet en cours.
 */
export async function loadChatMessages() {
    const chatContainer = document.querySelector(SELECTORS.chatContainer);
    if (!chatContainer) return;

    if (!appState.currentProject?.id) {
        renderChatSection();
        return;
    }

    try {
        const messages = await fetchAPI(API_ENDPOINTS.projectChatHistory(appState.currentProject.id));
        setChatMessages(Array.isArray(messages) ? messages : []); // Update state via setChatMessages
        renderChatInterface(appState.chatMessages);
    } catch (error) {
        console.error('Erreur lors du chargement des messages de chat:', error);
        renderChatSection(null, true);
    }
}

export function renderChatInterface(messages = appState.chatMessages, error = false) {
    const chatContainer = document.querySelector(SELECTORS.chatContainer);
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

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const question = input?.value?.trim();
    
    if (!question || !appState.currentProject?.id) {
        showToast(MESSAGES.enterQuestion, 'warning');
        return;
    }

    // Ajouter le message utilisateur immédiatement
    const userMessage = {
        sender: 'user',
        content: question,
        timestamp: new Date().toISOString()
    };
    
    appState.chatMessages.push(userMessage); // Direct modification, but then re-rendered
    renderChatInterface(appState.chatMessages);
    
    // Vider l'input
    input.value = '';

    try {
        // Envoyer la question à l'API
        const response = await fetchAPI(API_ENDPOINTS.projectChat(appState.currentProject.id), {
            method: 'POST',
            body: { question: question }
        });

        showToast(MESSAGES.questionSent, 'info');
        
    } catch (error) {
        console.error('Erreur lors de l\'envoi de la question:', error);
        showToast(MESSAGES.errorSendingQuestion, 'error');
        
        // Retirer le message utilisateur en cas d'erreur
        appState.chatMessages.pop(); // Direct modification, but then re-rendered
        renderChatInterface(appState.chatMessages);
    }
}

export { sendChatMessage };

function renderChatSection(project = null, error = false) {
    const chatContainer = document.querySelector(SELECTORS.chatContainer);
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


/**
 * Gère le lancement de l'indexation des PDFs pour le chat RAG.
 */
export async function handleStartIndexing() {
    if (!appState.currentProject) {
        showToast(MESSAGES.selectProjectForIndexing, 'warning');
        return;
    }

    showLoadingOverlay(true, MESSAGES.startingIndexing);
    try {
        // The route is defined in server_v4_complete.py but not with the /api prefix in the route definition itself.
        // The fetchAPI helper adds the /api prefix. The route is `/projects/<project_id>/index-pdfs`
        const response = await fetchAPI(API_ENDPOINTS.projectIndexPdfs(appState.currentProject.id), { method: 'POST' });
        showToast(MESSAGES.indexingStarted, 'success');
        // On peut utiliser le task_id pour suivre la progression si nécessaire
        console.log('Task ID for indexing:', response.task_id);
    } catch (error) {
        showToast(`${MESSAGES.errorStartingIndexing}: ${error.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}
