import { apiGet, apiPost } from './api-client.js';

const container = document.querySelector('#results-list');

async function load() {
    const data = await apiGet('/api/selection');
    render(data);
}

function render(items) {
    container.innerHTML = (items || []).map(it => `
        <div class="sel-item">
            <div><strong>${it.title || ''}</strong></div>
            <div class="muted">${it.journal || ''} ${it.year || ''}</div>
            <div class="actions">
                <button class="btn-include" data-id="${it.id}" ${it.included ? 'disabled' : ''}>Inclure</button>
                <button class="btn-exclude" data-id="${it.id}" ${!it.included ? 'disabled' : ''}>Exclure</button>
            </div>
        </div>
    `).join('');

    container.querySelectorAll('.btn-include').forEach(b => b.onclick = () => toggle(b.dataset.id, true));
    container.querySelectorAll('.btn-exclude').forEach(b => b.onclick = () => toggle(b.dataset.id, false));
}

async function toggle(id, included) {
    await apiPost('/api/selection/toggle', { id, included });
    await load();
}

load();
