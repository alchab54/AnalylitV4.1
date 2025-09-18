import { appState, elements } from './app-improved.js'; 
import { fetchAPI } from './api.js';
import { showToast, showLoadingOverlay, escapeHtml } from './ui-improved.js'; 

export async function renderReportingSection(elements) {
    if (!appState.currentProject) {
        elements.reportingContainer.innerHTML = '<p>Veuillez sélectionner un projet pour accéder aux rapports.</p>';
        return;
    }

    elements.reportingContainer.innerHTML = `
        <div class="report-section">
            <h3>Générateur de Bibliographie</h3>
            <div class="form-group">
                <label for="bibliographyStyle">Style de citation:</label>
                <select id="bibliographyStyle" class="form-control">
                    <option value="apa" selected>APA 7</option>
                    <option value="vancouver">Vancouver</option>
                    <option value="mla">MLA</option>
                </select>
                <button data-action="generate-bibliography" class="btn btn-primary mt-2">Générer Bibliographie</button>
            </div>
            <div id="bibliographyOutput" class="output-box mt-3"></div>
        </div>

        <div class="report-section mt-4">
            <h3>Tableau de Synthèse des Études Incluses</h3>
            <button data-action="generate-summary-table" class="btn btn-primary">Générer Tableau</button>
            <button data-action="export-summary-excel" class="btn btn-success ml-2">Exporter en Excel</button>
            <div id="summaryTableOutput" class="output-box mt-3"></div>
        </div>

        <div class="report-section mt-4">
            <h3>Checklist PRISMA-ScR Interactive</h3>
            <div id="prismaChecklistOutput" class="output-box mt-3"></div>
            <button data-action="save-prisma-checklist" class="btn btn-primary mt-2">Sauvegarder Checklist</button>
        </div>
    `;

    // Initial load of PRISMA checklist
    await loadPrismaChecklist();
}
export async function generateBibliography() {
    showLoadingOverlay(true, 'Génération de la bibliographie...', elements);
    try {
        const style = document.getElementById('bibliographyStyle').value;
        const bibliography = await fetchAPI(`/projects/${appState.currentProject.id}/reports/bibliography?style=${style}`);
        const outputDiv = document.getElementById('bibliographyOutput');
        outputDiv.innerHTML = bibliography.map(item => `<p>${item}</p>`).join('');
        showToast('Bibliographie générée avec succès.', 'success', elements);
    } catch (error) {
        console.error('Erreur lors de la génération de la bibliographie:', error);
        showToast('Erreur lors de la génération de la bibliographie.', 'error', elements);
    } finally {
        showLoadingOverlay(false, '', elements);
    }
}

export async function generateSummaryTable() {
    showLoadingOverlay(true, 'Génération du tableau de synthèse...', elements);
    try {
        const data = await fetchAPI(`/projects/${appState.currentProject.id}/reports/summary-table`);
        const outputDiv = document.getElementById('summaryTableOutput');
        if (data.length === 0) {
            outputDiv.innerHTML = '<p>Aucune donnée disponible pour le tableau de synthèse.</p>';
            return;
        }

        // Create table header
        let tableHtml = '<table class="table table-striped table-bordered"><thead><tr>';
        const allKeys = new Set();
        data.forEach(row => {
            Object.keys(row).forEach(key => allKeys.add(key));
        });
        allKeys.forEach(key => {
            tableHtml += `<th>${key}</th>`;
        });
        tableHtml += '</tr></thead><tbody>';

        // Create table rows
        data.forEach(row => {
            tableHtml += '<tr>';
            allKeys.forEach(key => {
                let cellValue = row[key];
                if (key === 'extracted_data' && typeof cellValue === 'string') {
                    try {
                        const parsedData = JSON.parse(cellValue);
                        cellValue = JSON.stringify(parsedData, null, 2); // Pretty print JSON
                    } catch (e) {
                        // Keep as is if not valid JSON
                    }
                }
                tableHtml += `<td><pre>${cellValue !== undefined ? cellValue : ''}</pre></td>`;
            });
            tableHtml += '</tr>';
        });
        tableHtml += '</tbody></table>';
        outputDiv.innerHTML = tableHtml;
        showToast('Tableau de synthèse généré avec succès.', 'success', elements);
    } catch (error) {
        console.error('Erreur lors de la génération du tableau de synthèse:', error);
        showToast('Erreur lors de la génération du tableau de synthèse.', 'error', elements);
    } finally {
        showLoadingOverlay(false, '', elements);
    }
}

export async function exportSummaryTableExcel() {
    showLoadingOverlay(true, 'Exportation du tableau en Excel...', elements);
    try {
        const response = await fetchAPI(`/projects/${appState.currentProject.id}/reports/summary-table/export/excel`, { rawResponse: true });
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tableau_synthese_${appState.currentProject.id}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        showToast('Tableau exporté en Excel avec succès.', 'success', elements);
    } catch (error) {
        console.error('Erreur lors de l\'exportation du tableau en Excel:', error);
        showToast('Erreur lors de l\'exportation du tableau en Excel.', 'error', elements);
    } finally {
        showLoadingOverlay(false, '', elements);
    }
}

async function loadPrismaChecklist() {
    showLoadingOverlay(true, 'Chargement de la checklist PRISMA-ScR...', elements);
    try {
        const checklist = await fetchAPI(`/projects/${appState.currentProject.id}/prisma-checklist`);
        appState.prismaChecklist = checklist;
        renderPrismaChecklist();
        showToast('Checklist PRISMA-ScR chargée.', 'success', elements);
    } catch (error) {
        console.error('Erreur lors du chargement de la checklist PRISMA-ScR:', error);
        showToast('Erreur lors du chargement de la checklist PRISMA-ScR.', 'error', elements);
    } finally {
        showLoadingOverlay(false, '', elements);
    }
}

function renderPrismaChecklist() {
    const outputDiv = document.getElementById('prismaChecklistOutput');
    if (!appState.prismaChecklist) {
        outputDiv.innerHTML = '<p>Checklist PRISMA-ScR non disponible.</p>';
        return;
    }

    let html = `<h3>${appState.prismaChecklist.title}</h3>`;
    appState.prismaChecklist.sections.forEach(section => {
        html += `<h4>${section.title}</h4><ul>`;
        section.items.forEach(item => {
            const checked = item.checked ? 'checked' : '';
            const status = item.status ? `(${item.status})` : '';
            html += `
                <li>
                    <input type="checkbox" id="prisma-${item.id}" data-item-id="${item.id}" ${checked}>
                    <label for="prisma-${item.id}">${item.text} ${status}</label>
                    <textarea class="form-control mt-1" data-item-id="${item.id}" placeholder="Notes">${item.notes || ''}</textarea>
                </li>
            `;
        });
        html += '</ul>';
    });
    outputDiv.innerHTML = html;

    // Add event listeners for checkboxes and textareas
    outputDiv.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', (event) => {
            const itemId = event.target.dataset.itemId;
            updatePrismaChecklistItem(itemId, 'checked', event.target.checked);
        });
    });
    outputDiv.querySelectorAll('textarea').forEach(textarea => {
        textarea.addEventListener('input', (event) => {
            const itemId = event.target.dataset.itemId;
            updatePrismaChecklistItem(itemId, 'notes', event.target.value);
        });
    });
}

export function updatePrismaChecklistItem(itemId, field, value) {
    if (!appState.prismaChecklist) return;
    appState.prismaChecklist.sections.forEach(section => {
        section.items.forEach(item => {
            if (item.id === itemId) {
                item[field] = value;
            }
        });
    });
}

export async function savePrismaChecklist() {
    showLoadingOverlay(true, 'Sauvegarde de la checklist PRISMA-ScR...', elements);
    try {
        const payload = { checklist: appState.prismaChecklist };
        await fetchAPI(`/projects/${appState.currentProject.id}/prisma-checklist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        showToast('Checklist PRISMA-ScR sauvegardée avec succès.', 'success', elements);
    } catch (error) {
        console.error('Erreur lors de la sauvegarde de la checklist PRISMA-ScR:', error);
        showToast('Erreur lors de la sauvegarde de la checklist PRISMA-ScR.', 'error', elements);
    } finally {
        showLoadingOverlay(false, '', elements);
    }
}