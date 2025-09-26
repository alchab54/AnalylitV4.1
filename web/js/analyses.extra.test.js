/**
 * @jest-environment jsdom
 */

import * as analyses from './analyses.js';
import * as api from './api.js';
import * as ui from './ui-improved.js';
import * as state from './state.js';

jest.mock('./api.js');
jest.mock('./ui-improved.js', () => ({
    showToast: jest.fn(),
    showLoadingOverlay: jest.fn(),
    showConfirmModal: jest.fn()
}));
jest.mock('./state.js', () => ({
    appState: { currentProject: { id: 'test-project' } }
}));

describe('Analyses - Coverage Boost', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = `
            <div id="analysisContainer">
                <button data-action="run-analysis" data-analysis-type="discussion">Run Discussion</button>
                <button data-action="run-analysis" data-analysis-type="knowledge_graph">Run Graph</button>
                <button data-action="export-analyses">Export</button>
                <form class="prisma-checklist">
                    <input type="checkbox" name="item1" checked>
                    <textarea name="item1_notes">Notes 1</textarea>
                    <input type="checkbox" name="item2">
                    <textarea name="item2_notes">Notes 2</textarea>
                </form>
                <div class="analysis-results" id="discussion-results"></div>
                <div class="analysis-results" id="knowledge-graph-results"></div>
            </div>
        `;
    });

    it('runProjectAnalysis devrait lancer une analyse de discussion', async () => {
        api.fetchAPI.mockResolvedValue({ 
            task_id: 'task-123',
            status: 'running',
            analysis_type: 'discussion'
        });

        await analyses.runProjectAnalysis('discussion');

        expect(api.fetchAPI).toHaveBeenCalledWith('/projects/test-project/run-analysis', {
            method: 'POST',
            body: { type: 'discussion' }
        });
        expect(ui.showToast).toHaveBeenCalledWith('Tâche de génération du brouillon de discussion lancée', 'success');
    });

    it('runProjectAnalysis devrait lancer une analyse de graphe de connaissances', async () => {
        api.fetchAPI.mockResolvedValue({
            task_id: 'task-456', 
            status: 'running',
            analysis_type: 'knowledge_graph'
        });

        await analyses.runProjectAnalysis('knowledge_graph');

        expect(api.fetchAPI).toHaveBeenCalledWith('/projects/test-project/run-analysis', {
            method: 'POST', 
            body: { type: 'knowledge_graph' }
        });
        expect(ui.showToast).toHaveBeenCalledWith('Tâche de génération du graphe de connaissances lancée', 'success');
    });

    it('runProjectAnalysis devrait gérer les erreurs API', async () => {
        api.fetchAPI.mockRejectedValue(new Error('API Error'));

        await analyses.runProjectAnalysis('discussion');

        expect(ui.showToast).toHaveBeenCalledWith('Erreur lors du lancement de l\'analyse: API Error', 'error');
    });

    it('savePRISMAProgress devrait collecter et sauvegarder les données de checklist', async () => {
        api.fetchAPI.mockResolvedValue({ success: true });

        await analyses.savePRISMAProgress();

        expect(api.fetchAPI).toHaveBeenCalledWith('/projects/test-project/prisma-checklist', {
            method: 'POST',
            body: {
                checklist: {
                    items: [ { id: 'item1', checked: true, notes: 'Notes 1' }, { id: 'item2', checked: false, notes: 'Notes 2' } ]
                }
            }
        });
        expect(ui.showToast).toHaveBeenCalledWith('Progression PRISMA sauvegardée', 'success');
    });

    it('savePRISMAProgress devrait gérer les erreurs de sauvegarde', async () => {
        api.fetchAPI.mockRejectedValue(new Error('Save failed'));

        await analyses.savePRISMAProgress();

        expect(ui.showToast).toHaveBeenCalledWith('Erreur: Save failed', 'error');
    });

    it('exportPRISMAReport devrait créer un lien de téléchargement', () => {
        // Mock pour document.createElement et les méthodes de téléchargement
        const mockLink = {
            href: '',
            download: '',
            click: jest.fn(),
            remove: jest.fn()
        };
        
        jest.spyOn(document, 'createElement').mockReturnValue(mockLink);
        jest.spyOn(document.body, 'appendChild').mockImplementation(() => {});

        analyses.exportPRISMAReport();

        expect(document.createElement).toHaveBeenCalledWith("a");
        expect(mockLink.href).toContain('data:text/csv;charset=utf-8,');
        expect(mockLink.download).toBe('export_prisma_test-project.csv');
        expect(mockLink.click).toHaveBeenCalled();
    });

    it('handleDeleteAnalysis devrait appeler showConfirmModal', () => {
        const mockEvent = {
            target: { getAttribute: () => 'discussion' }
        };

        analyses.handleDeleteAnalysis(mockEvent);

        expect(window.confirm).toHaveBeenCalledWith("Êtes-vous sûr de vouloir supprimer les résultats de l'analyse discussion pour ce projet ?");
    });

    it('exportAnalyses devrait télécharger toutes les analyses', async () => {
        const mockLink = {
            href: '',
            download: '',
            click: jest.fn()
        };
        
        jest.spyOn(document, 'createElement').mockReturnValue(mockLink);

        await analyses.exportAnalyses();

        expect(window.open).toHaveBeenCalledWith('/api/projects/test-project/export/analyses', '_blank');
        expect(mockLink.click).toHaveBeenCalled();
    });
});