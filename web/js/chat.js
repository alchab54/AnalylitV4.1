// ============================
// Chat Section
// ============================

async function loadChatMessages() {
    if (!elements.chatContainer) return; 
    
    if (!appState.currentProject?.id) {
        renderChatSection(); // Render empty state
        return;
    }

    try {
        const messages = await fetchAPI(`/projects/${appState.currentProject.id}/chat-messages`);
        appState.chatMessages = Array.isArray(messages) ? messages : [];
        renderChatSection(appState.chatMessages);
    } catch (e) {
        console.error('Erreur chargement chat:', e);
        renderChatSection(null, true); // Render error state
    }
}

function renderChatMessages(messages = []) {
    if (!messages || messages.length === 0) {
        return `<div class="empty-state"><p>Aucun message.</p></div>`;
    }
    // Ligne manquante ajoutée ici pour corriger l'erreur de syntaxe
    const urlRegex = /(https?:\/\/[^\s]+)/g; 
    
    return messages.map(message => {
        // La ligne ci-dessous utilise maintenant une variable définie
        const formattedContent = escapeHtml(message.content).replace(urlRegex, '<a href="$&" target="_blank">$&</a>');
        
        return `
        <div class="chat-message chat-message--${message.role}">
            <div class="chat-message__header">
                <span class="chat-message__role">${message.role === 'user' ? 'Vous' : 'Assistant IA'}</span>
                <span class="chat-message__time">${new Date(message.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="chat-message__content">
                ${formattedContent}
            </div>
            ${message.sources && message.sources.length > 0 ? `
                <div class="chat-message__sources">
                    <strong>Sources:</strong>
                    <ul>
                        ${JSON.parse(message.sources).map(source => `<li>${escapeHtml(source)}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
        </div>
    `;
    }).join('');
}

function renderChatSection(messages, error = false) {
    if (!elements.chatContainer) return;

    if (!appState.currentProject?.id) {
        elements.chatContainer.innerHTML = `
            <div class="empty-state">
                <p>Sélectionnez un projet pour accéder au chat RAG.</p>
            </div>`;
        return;
    }
    
    if (error) {
        elements.chatContainer.innerHTML = `
            <div class="error-state">
                <p>Erreur lors du chargement du chat.</p>
            </div>`;
        return;
    }

    const messagesHtml = (messages || []).map(msg => `
        <div class="chat-message chat-message--${msg.role}">
            <div class="chat-message-content">
                const urlRegex = /(https?:\[\/\/\S+)/g;
                const formattedContent = escapeHtml(msg.content).replace(urlRegex, '<a href="<div class="chat-message-content">
                ${escapeHtml(msg.content).replace(/
/g, '<br>')}
            </div>" target="_blank"><div class="chat-message-content">
                ${escapeHtml(msg.content).replace(/
/g, '<br>')}
            </div></a>').replace(/\n/g, '<br>');
                formattedContent
            </div>
            <div class="chat-message-meta">
                <span>${new Date(msg.timestamp).toLocaleString()}</span>
            </div>
        </div>
    `).join('');

    elements.chatContainer.innerHTML = `
        <div class="chat-interface">
            <div class="chat-messages">
                ${messagesHtml || '<p class="empty-state">Posez une question pour commencer.</p>'}
            </div>
            <div class="chat-input-container">
                <textarea 
                    id="chatInput" 
                    placeholder="Posez une question sur les documents du projet..." 
                    class="chat-input-field"
                    onkeydown="if(event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendChatMessage(); }"></textarea>
                <button class="btn btn--primary" onclick="sendChatMessage()">Envoyer</button>
            </div>
        </div>
    `;
    
    // Scroll to bottom
    const messagesContainer = elements.chatContainer.querySelector('.chat-messages');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    if (!input) return;
    
    const message = input.value.trim();
    if (!message || !appState.currentProject?.id) return;

    const tempId = `temp_${Date.now()}`;
    const userMessage = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
        id: tempId
    };

    // Add user message to UI immediately
    appState.chatMessages.push(userMessage);
    renderChatSection(appState.chatMessages);
    
    input.value = '';
    input.disabled = true;

    try {
        const response = await fetchAPI(`/projects/${appState.currentProject.id}/chat`, {
            method: 'POST',
            body: { message }
        });
        
        await loadChatMessages();

    } catch (e) {
        showToast(`Erreur: ${e.message}`, 'error');
        appState.chatMessages = appState.chatMessages.filter(m => m.id !== tempId);
        renderChatSection(appState.chatMessages);
        input.value = message;
    } finally {
        input.disabled = false;
        input.focus();
    }
}
