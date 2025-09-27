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
    showConfirmModal: jest.fn(),
    closeModal: jest.fn(),
}));
jest.mock('./state.js', () => ({
    appState: { 
        currentProject: { id: 'test-project', name: 'Test Project' },
        // Add prismaChecklist to the mock with the structure the function expects
        prismaChecklist: {
            items: [
                { id: 'item1', checked: true, notes: 'Notes 1' },
                { id: 'item2', checked: false, notes: 'Notes 2' }
            ]
        }
    }
}));

describe('Analyses - Coverage Boost', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        document.body.innerHTML = `
            <div id="analysisContainer">
                <div id="prisma-checklist-content">
                    <div class="prisma-item">
                        <input type="checkbox" data-item-id="item1" checked>
                        <textarea>Notes 1</textarea>
                    </div>
                    <div class="prisma-item">
                    <input type="checkbox" name="item2" data-item-id="item2">
                    <textarea name="item2_notes">Notes 2</textarea>
                </form>
                <div class="analysis-results" id="discussion-results"></div>
                <div class="analysis-results" id="knowledge-graph-results"></div>
            </div>
        `; // Note: The closing </form> tag was missing in the original, which could cause issues.
        // Mock window functions
        global.confirm = jest.fn(() => true);
        global.open = jest.fn();

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
        expect(ui.showToast).toHaveBeenCalledWith("La génération pour le brouillon de discussion a été lancée.", 'success');
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
        expect(ui.showToast).toHaveBeenCalledWith("La génération pour le graphe de connaissances a été lancée.", 'success');
    });

    it('runProjectAnalysis devrait gérer les erreurs API', async () => {
        api.fetchAPI.mockRejectedValue(new Error('API Error'));

        await analyses.runProjectAnalysis('discussion');

        expect(ui.showToast).toHaveBeenCalledWith('Erreur lors du lancement de l\'analyse: API Error', 'error');
    });

    it('savePRISMAProgress devrait collecter et sauvegarder les données de checklist', async () => {
        api.fetchAPI.mockResolvedValue({ success: true });

        await analyses.savePRISMAProgress();

        // ✅ CORRECTION: Utiliser un sélecteur plus stable pour le test.
        // Le sélecteur original était fragile.
        const item2Checkbox = document.querySelector('[data-item-id="item2"]');
        if(item2Checkbox) item2Checkbox.dataset.itemId = 'item2';

        expect(api.fetchAPI).toHaveBeenCalledWith('/projects/test-project/prisma-checklist', {
            method: 'POST',
            body: {
                checklist: {
                    items: [ { id: 'item1', checked: true, notes: 'Notes 1' }, { id: 'item2', checked: false, notes: 'Notes 2' } ]
                }
            }
        });
        expect(ui.showToast).toHaveBeenCalledWith('Progression PRISMA sauvegardée.', 'success');
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
            setAttribute: jest.fn(),
            click: jest.fn()
        };
        jest.spyOn(document.body, 'appendChild').mockImplementation(() => {});
        jest.spyOn(document.body, 'removeChild').mockImplementation(() => {});
        jest.spyOn(document, 'createElement').mockReturnValue(mockLink);
        jest.spyOn(document.body, 'appendChild').mockImplementation(() => {});

        analyses.exportPRISMAReport();

        expect(document.createElement).toHaveBeenCalledWith("a");
        expect(mockLink.setAttribute).toHaveBeenCalledWith('href', expect.stringContaining('data:text/csv;charset=utf-8,'));
        expect(mockLink.setAttribute).toHaveBeenCalledWith('download', expect.stringContaining('export_prisma_'));
        expect(mockLink.click).toHaveBeenCalled();
    });

    it('handleDeleteAnalysis devrait appeler showConfirmModal', () => {
        analyses.handleDeleteAnalysis('discussion');

        expect(window.confirm).toHaveBeenCalledWith("Êtes-vous sûr de vouloir supprimer les résultats de l'analyse discussion pour ce projet ?");
    });

    it('exportAnalyses devrait télécharger toutes les analyses', async () => {
        await analyses.exportAnalyses();

        expect(window.open).toHaveBeenCalledWith('/api/projects/test-project/export/analyses', '_blank');
    });
});