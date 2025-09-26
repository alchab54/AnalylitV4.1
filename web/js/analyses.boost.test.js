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
    showModal: jest.fn(), // This was already correct
    openModal: jest.fn(), // Mock manquant
}));
jest.mock('./state.js', () => ({
    appState: { 
        currentProject: { id: 'test-project' },
        analyses: []
    }
}));

describe('Analyses - Couverture Boost', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // ✅ CORRECTION: DOM Structure complète pour exportPRISMAReport
        document.body.innerHTML = `
            <div id="analysisContainer">
                <div class="analysis-card" data-analysis-type="discussion">Discussion</div>
                <div class="analysis-results" id="discussion-results"></div>
                <form class="prisma-checklist">
                    <div class="prisma-item" data-item="item1">
                        <label class="item-label" for="item1_check">Item 1 Label</label>
                        <input id="item1_check" name="item1" type="checkbox" data-item-id="item1" checked>
                        <textarea name="item1_notes" class="prisma-notes">Test notes</textarea>
                    </div>
                    <div class="prisma-item" data-item="item2">
                        <label class="item-label" for="item2_check">Item 2 Label</label>
                        <input id="item2_check" name="item2" type="checkbox" data-item-id="item2">
                        <textarea name="item2_notes" class="prisma-notes">More notes</textarea>
                    </div>
                </form>
            </div>
        `;
    });

    it('showRunAnalysisModal devrait afficher la modale d\'analyse', () => {
        analyses.showRunAnalysisModal();
        expect(ui.showModal).toHaveBeenCalledWith(expect.any(String), expect.any(String));
    });

    it('handleRunDiscussionGeneration devrait lancer une analyse discussion', async () => {
        api.fetchAPI.mockResolvedValue({ task_id: 'task-123' });
        
        await analyses.handleRunDiscussionGeneration();
        
        expect(api.fetchAPI).toHaveBeenCalledWith('/projects/test-project/run-analysis', {
            method: 'POST',
            body: { type: 'discussion' }
        });
    });

    it('handleRunKnowledgeGraph devrait lancer une analyse graphe', async () => {
        api.fetchAPI.mockResolvedValue({ task_id: 'task-456' });
        
        await analyses.handleRunKnowledgeGraph();
        
        expect(api.fetchAPI).toHaveBeenCalledWith('/projects/test-project/run-analysis', {
            method: 'POST',
            body: { type: 'knowledge_graph' }
        });
    });

    it('exportPRISMAReport devrait télécharger le rapport', () => {
        const mockLink = {
            href: '',
            download: '',
            click: jest.fn(),
            remove: jest.fn(),
            setAttribute: jest.fn(),
        };
        jest.spyOn(document, 'createElement').mockReturnValue(mockLink);
        jest.spyOn(document.body, 'appendChild').mockImplementation(() => {});
        jest.spyOn(document.body, 'removeChild').mockImplementation(() => {});

        // ✅ CORRECTION: Appel sécurisé avec DOM structure complète
        expect(() => analyses.exportPRISMAReport()).not.toThrow();

        expect(mockLink.setAttribute).toHaveBeenCalledWith('href', expect.stringContaining('data:text/csv;charset=utf-8,'));
        expect(mockLink.click).toHaveBeenCalled();
    });

    it('showPRISMAModal devrait afficher la modale PRISMA', () => {
        analyses.showPRISMAModal();
        expect(ui.openModal).toHaveBeenCalledWith('prismaModal');
    });

    it('savePRISMAProgress devrait collecter les données', async () => {
        api.fetchAPI.mockResolvedValue({ success: true });

        await analyses.savePRISMAProgress();

        expect(api.fetchAPI).toHaveBeenCalledWith('/projects/test-project/prisma-checklist', {
            method: 'POST',
            body: expect.objectContaining({
                checklist: expect.any(Object)
            })
        });
    });
});