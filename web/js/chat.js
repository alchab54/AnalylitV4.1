// web/js/chat.js
import { escapeHtml, showToast } from './ui-improved.js';
import { API_ENDPOINTS, MESSAGES, SELECTORS } from './constants.js';
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
    const chatContainer = document.querySelector(SELECTORS.chatContainer);
    if (!chatContainer) return;

    if (!appState.currentProject?.id) {
        renderChatSection();
        return;
    }

    try {
        const messages = await fetchAPI(API_ENDPOINTS.projectChatHistory(appState.currentProject.id));
        appState.chatMessages = Array.isArray(messages) ? messages : [];
        renderChatInterface(appState.chatMessages);
    } catch (error) {
        console.error(MESSAGES.errorLoadingChatMessages, error);
        renderChatSection(null, true);
    }
}

export function renderChatInterface(messages = appState.chatMessages, error = false) {
    const chatContainer = document.querySelector(SELECTORS.chatContainer);
    if (!chatContainer) return;

    if (!appState.currentProject?.id) {
        chatContainer.innerHTML = `
            <div class="chat-empty">
                <h3>${MESSAGES.noProjectSelectedChat}</h3>
                <p>${MESSAGES.selectProjectForChat}</p>
            </div>`;
        return;
    }

    if (error) {
        chatContainer.innerHTML = `
            <div class="chat-error">
                <h3>${MESSAGES.chatError}</h3>
                <p>${MESSAGES.errorLoadingChat}</p>
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
            <div class="chat-messages" id="${SELECTORS.chatMessages.substring(1)}">
                ${messagesHtml}
            </div>

            <div class="chat-input-container">
                <div class="chat-input-group">
                    <textarea id="${SELECTORS.chatInput.substring(1)}"
                              class="chat-input"
                              placeholder="${MESSAGES.chatPlaceholder}"
                              rows="3"
                              data-action="submit-chat-on-enter"></textarea>
                    <button class="btn btn--primary chat-send-btn"
                            data-action="send-chat-message">
                        ${MESSAGES.sendButton}
                    </button>
                </div>
            </div>
        </div>`;

    // Faire défiler vers le bas
    const messagesContainer = document.querySelector(SELECTORS.chatMessages);
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

async function sendChatMessage() {
    const input = document.querySelector(SELECTORS.chatInput);
    const question = input?.value?.trim();

    if (!question || !appState.currentProject?.id) {
        showToast(MESSAGES.questionRequired, 'warning');
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
        const response = await fetchAPI(API_ENDPOINTS.projectChat(appState.currentProject.id), {
            method: 'POST',
            body: { question: question }
        });

        showToast(MESSAGES.questionSent, 'info');

    } catch (error) {
        console.error(MESSAGES.errorSendingQuestion, error);
        showToast(MESSAGES.errorSendingQuestionGeneric, 'error');

        // Retirer le message utilisateur en cas d'erreur
        appState.chatMessages.pop();
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
                <h3>${MESSAGES.chatError}</h3>
                <p>${MESSAGES.errorLoadingChat}</p>
            </div>`;
        return;
    }

    if (!project) {
        chatContainer.innerHTML = `
            <div class="chat-empty">
                <h3>${MESSAGES.noProjectSelectedChat}</h3>
                <p>${MESSAGES.selectProjectForChat}</p>
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

    showLoadingOverlay(true, MESSAGES.startingPdfIndexing);
    try {
        // The route is defined in server_v4_complete.py but not with the /api prefix in the route definition itself.
        // The fetchAPI helper adds the /api prefix. The route is `/projects/<project_id>/index-pdfs`
        const response = await fetchAPI(API_ENDPOINTS.projectIndexPdfs(appState.currentProject.id), { method: 'POST' });
        showToast(MESSAGES.pdfIndexingStarted, 'success');
        // On peut utiliser le task_id pour suivre la progression si nécessaire
        console.log('Task ID for indexing:', response.task_id);
    } catch (error) {
        showToast(`${MESSAGES.errorStartingIndexing}: ${error.message}`, 'error');
    } finally {
        showLoadingOverlay(false);
    }
}