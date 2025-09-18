// web/js/chat.js
import { escapeHtml, showToast } from './ui-improved.js';
import { appState } from './app-improved.js';
import { fetchAPI } from './api.js';

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
    const chatContainer = document.getElementById('chatContainer');
    if (!chatContainer) return;

    if (!appState.currentProject?.id) {
        renderChatSection();
        return;
    }

    try {
        const messages = await fetchAPI(`/api/projects/${appState.currentProject.id}/chat-messages`);
        appState.chatMessages = Array.isArray(messages) ? messages : [];
        renderChatInterface(appState.chatMessages);
    } catch (error) {
        console.error('Erreur lors du chargement des messages de chat:', error);
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