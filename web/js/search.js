import { apiGet, apiPost } from './api-client.js';

const form = document.querySelector('#search-form');
const out = document.querySelector('#search-results');

form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    out.textContent = 'Recherche...';
    const q = new FormData(form).get('query') || '';
    try {
        const data = await apiGet('/api/search', { q }); // alignez avec vos routes actuelles
        renderResults(data);
    } catch (err) {
        out.textContent = 'Erreur recherche';
        console.error(err);
    }
});

function renderResults(items) {
    if (!Array.isArray(items) || !items.length) {
        out.textContent = 'Aucun résultat';
        return;
    }
    out.innerHTML = items.map((it, i) => `
        <div class="result-item">
            <div><strong>${it.title || 'Sans titre'}</strong></div>
            <div class="muted">${it.authors?.join(', ') || ''} ${it.year ? `(${it.year})` : ''}</div>
            <div class="chips">${(it.keywords || []).map(k => `<span class="chip">${k}</span>`).join('')}</div>
            <div class="actions">
                <button class="btn-add" data-i="${i}">Ajouter à la sélection</button>
            </div>
        </div>
    `).join('');

    out.querySelectorAll('.btn-add').forEach(b => b.addEventListener('click', async () => {
        const i = +b.dataset.i;
        const it = items[i];
        try {
            await apiPost('/api/selection/add', it);
            b.textContent = 'Ajouté';
            b.disabled = true;
        } catch (e) {
            alert('Erreur ajout');
        }
    }));
}