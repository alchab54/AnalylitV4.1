// web/js/admin.js

document.addEventListener('DOMContentLoaded', () => {
    const queueSection = document.getElementById('files-status-content');
    if (queueSection) {
        const queueManager = new QueueManager(queueSection);
        queueManager.startAutoRefresh();
    }
});

class QueueManager {
    constructor(container) {
        this.container = container;
        this.refreshInterval = null;
    }

    startAutoRefresh() {
        this.loadQueuesStats();
        this.refreshInterval = setInterval(() => this.loadQueuesStats(), 5000); // Refresh toutes les 5s
    }

    async loadQueuesStats() {
        try {
            const response = await fetch('/api/admin/queues/stats');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            this.displayQueuesStats(data);
        } catch (error) {
            this.container.innerHTML = `<div class="alert alert-danger">Erreur de chargement: ${error.message}</div>`;
        }
    }

    displayQueuesStats(data) {
        let html = `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h4>📊 État des Files d'Attente</h4>
                <button class="btn btn-danger" onclick="queueManager.clearAllQueues()">
                    🧹 Vider Toutes les Files
                </button>
            </div>
            <p><strong>Workers totaux:</strong> ${data.total_workers || 0} | <strong>Dernière MAJ:</strong> ${new Date(data.timestamp * 1000).toLocaleTimeString()}</p>
        `;

        if (data.queues) {
            data.queues.forEach(queue => {
                const hasFailed = queue.failed > 0;
                const hasPending = queue.size > 0;
                let cardClass = hasFailed ? 'border-danger' : (hasPending ? 'border-warning' : 'border-success');
                
                html += `
                    <div class="card mb-2 ${cardClass}">
                        <div class="card-body">
                            <div class="d-flex justify-content-between">
                                <h5 class="card-title">${queue.name}</h5>
                                <button class="btn btn-sm btn-outline-danger" onclick="queueManager.clearQueue('${queue.name}')">Vider</button>
                            </div>
                            <div class="d-flex justify-content-around mt-2">
                                <span class="badge bg-secondary">⏳ En attente: ${queue.size}</span>
                                <span class="badge bg-primary">🏃 En cours: ${queue.running}</span>
                                <span class="badge ${hasFailed ? 'bg-danger' : 'bg-success'}">❌ Échouées: ${queue.failed}</span>
                                <span class="badge bg-info">👩‍💻 Workers: ${queue.workers}</span>
                            </div>
                            ${queue.failed_jobs && queue.failed_jobs.length > 0 ? `<p class="text-danger small mt-2">IDs échoués: ${queue.failed_jobs.join(', ')}</p>` : ''}
                        </div>
                    </div>
                `;
            });
        }
        this.container.innerHTML = html;
        window.queueManager = this; // Rendre accessible globalement
    }

    async clearQueue(queueName) {
        if (!confirm(`Vider la file "${queueName}" ?`)) return;
        await this.performAction('/api/admin/queues/clear', { queue_name: queueName });
    }

    async clearAllQueues() {
        if (!confirm('Vider TOUTES les files ?')) return;
        await this.performAction('/api/admin/queues/clear-all', {});
    }

    async performAction(url, body) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(body)
            });
            if (response.ok) {
                this.loadQueuesStats();
            } else {
                alert('Erreur lors de l\'opération.');
            }
        } catch (error) {
            alert(`Erreur réseau: ${error.message}`);
        }
    }
}
