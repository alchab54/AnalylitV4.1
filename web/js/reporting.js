// web/js/reporting.js

function renderReportingSection(projectId) {
    if (!projectId) {
        document.getElementById('reportingContainer').innerHTML = '<p>Veuillez d\'abord sélectionner un projet.</p>';
        return;
    }

    const container = document.getElementById('reportingContainer');
    container.innerHTML = `
        <!-- 1. Tableau de synthèse -->
        <div class="report-card">
            <h4>Tableau de Synthèse des Études</h4>
            <p>Générez un fichier Excel (.xlsx) contenant les données extraites des articles inclus.</p>
            <button id="generateSummaryTableBtn" class="button button--primary">Générer et Télécharger</button>
        </div>

        <!-- 2. Bibliographie -->
        <div class="report-card">
            <h4>Générateur de Bibliographie</h4>
            <p>Générez la bibliographie des articles inclus dans le format de votre choix.</p>
            <div class="form-group">
                <label for="citationStyle">Style de citation :</label>
                <select id="citationStyle" class="form-select">
                    <option value="apa">APA</option>
                    <option value="vancouver">Vancouver</option>
                </select>
            </div>
            <button id="generateBibliographyBtn" class="button button--primary">Générer</button>
            <textarea id="bibliographyOutput" class="form-control" readonly placeholder="La bibliographie apparaîtra ici..."></textarea>
        </div>

        <!-- 3. Checklist PRISMA-ScR -->
        <div class="report-card">
            <h4>Checklist PRISMA-ScR</h4>
            <p>Suivez et complétez la checklist pour assurer la conformité de votre revue.</p>
            <div id="prismaChecklistContainer" class="prisma-checklist-container">
                <!-- La checklist sera chargée ici -->
            </div>
            <div class="flex-container" style="justify-content: space-between; align-items: center; margin-top: 1rem;">
                 <button id="savePrismaBtn" class="button button--primary">Sauvegarder la Checklist</button>
                 <span id="prismaCompletionRate"></span>
            </div>
        </div>
    `;

    // Ajout des écouteurs d'événements
    document.getElementById('generateSummaryTableBtn').addEventListener('click', () => handleGenerateSummaryTable(projectId));
    document.getElementById('generateBibliographyBtn').addEventListener('click', () => handleGenerateBibliography(projectId));
    document.getElementById('savePrismaBtn').addEventListener('click', () => savePrismaChecklist(projectId));

    // Charger la checklist PRISMA
    loadPrismaChecklist(projectId);
}

async function handleGenerateSummaryTable(projectId) {
    showToast('Génération du tableau de synthèse en cours...');
    try {
        const response = await fetch(`/api/projects/${projectId}/reports/summary-table`);
        if (!response.ok) throw new Error('Erreur réseau ou serveur.');
        
        const data = await response.json();
        if (!data || data.length === 0) {
            showToast('Aucune donnée à exporter pour les articles inclus.', 'warning');
            return;
        }

        // Utiliser SheetJS pour créer le fichier Excel
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Synthèse des études');
        
        // Lancer le téléchargement
        XLSX.writeFile(workbook, `synthese_etudes_${projectId}.xlsx`);
        showToast('Tableau de synthèse téléchargé.', 'success');

    } catch (error) {
        console.error('Erreur lors de la génération du tableau:', error);
        showToast('Erreur lors de la génération du tableau.', 'error');
    }
}

async function handleGenerateBibliography(projectId) {
    const style = document.getElementById('citationStyle').value;
    const outputArea = document.getElementById('bibliographyOutput');
    outputArea.value = 'Génération en cours...';

    try {
        const response = await fetch(`/api/projects/${projectId}/reports/bibliography?style=${style}`);
        if (!response.ok) throw new Error('Erreur réseau ou serveur.');

        const bibliography = await response.json();
        if (!bibliography || bibliography.length === 0) {
            outputArea.value = 'Aucune bibliographie à générer pour les articles inclus.';
            return;
        }

        outputArea.value = bibliography.join('\n\n');
        showToast('Bibliographie générée.', 'success');

    } catch (error) {
        console.error('Erreur lors de la génération de la bibliographie:', error);
        outputArea.value = 'Erreur lors de la génération.';
        showToast('Erreur lors de la génération de la bibliographie.', 'error');
    }
}

async function loadPrismaChecklist(projectId) {
    const container = document.getElementById('prismaChecklistContainer');
    container.innerHTML = 'Chargement de la checklist...';

    try {
        const response = await fetch(`/api/projects/${projectId}/prisma-checklist`);
        if (!response.ok) throw new Error('Erreur réseau ou serveur.');

        const { checklist, completion_rate } = await response.json();
        
        let html = '<ul>';
        for (const section of checklist) {
            html += `<li><strong>${section.section}</strong><ul>`;
            for (const item of section.items) {
                html += `
                    <li>
                        <input type="checkbox" id="prisma-${item.id}" ${item.checked ? 'checked' : ''}>
                        <label for="prisma-${item.id}">${item.id}: ${item.description}</label>
                    </li>
                `;
            }
            html += '</ul></li>';
        }
        html += '</ul>';
        
        container.innerHTML = html;
        document.getElementById('prismaCompletionRate').textContent = `Complétion : ${completion_rate}%`;

    } catch (error) {
        console.error('Erreur chargement PRISMA:', error);
        container.innerHTML = '<p>Erreur de chargement de la checklist.</p>';
    }
}

async function savePrismaChecklist(projectId) {
    const checklistContainer = document.getElementById('prismaChecklistContainer');
    const inputs = checklistContainer.querySelectorAll('input[type="checkbox"]');
    
    // Reconstruire la structure de la checklist à partir de l'état actuel du DOM
    // C'est un peu fragile, une meilleure approche serait de garder les données en mémoire
    let currentChecklistData = [];
    const sections = checklistContainer.querySelectorAll('ul > li > strong');
    
    // Cette reconstruction est simplifiée. On va juste envoyer les IDs cochés.
    // Pour une reconstruction complète, il faudrait stocker la structure initiale.
    // L'API est conçue pour recevoir la structure complète, donc on va la reconstruire.
    
    // On triche un peu en rechargeant la structure pour la modifier
     const response = await fetch(`/api/projects/${projectId}/prisma-checklist`);
     const { checklist } = await response.json();

    for (const section of checklist) {
        for (const item of section.items) {
            const checkbox = document.getElementById(`prisma-${item.id}`);
            if (checkbox) {
                item.checked = checkbox.checked;
            }
        }
    }

    try {
        const saveResponse = await fetch(`/api/projects/${projectId}/prisma-checklist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ checklist: checklist })
        });

        if (!saveResponse.ok) throw new Error('Erreur lors de la sauvegarde.');

        showToast('Checklist PRISMA sauvegardée.', 'success');
        // Mettre à jour le taux de complétion
        loadPrismaChecklist(projectId);

    } catch (error) {
        console.error('Erreur sauvegarde PRISMA:', error);
        showToast('Erreur lors de la sauvegarde de la checklist.', 'error');
    }
}


// Exposer les fonctions nécessaires
window.renderReportingSection = renderReportingSection;
