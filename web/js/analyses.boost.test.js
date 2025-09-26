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
    showModal: jest.fn(),
    openModal: jest.fn(), // Ajout du mock manquant pour showPRISMAModal
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
        document.body.innerHTML = `
            <div id="analysisContainer">
                <div class="analysis-card" data-analysis-type="discussion">Discussion</div>
                <div class="analysis-results" id="discussion-results"></div>
                <div id="prisma-checklist-content">
                    <div class="prisma-item">
                        <label><input type="checkbox" checked> Test Item</label>
                        <textarea>Test notes</textarea>
                    </div>
                </div>
            </div>
        `;
    });

    it('showRunAnalysisModal devrait afficher la modale d\'analyse', () => {
        analyses.showRunAnalysisModal();
        expect(ui.showModal).toHaveBeenCalledWith('Lancer une Analyse Avancée', expect.any(String));
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

        analyses.exportPRISMAReport();

        expect(mockLink.setAttribute).toHaveBeenCalledWith('href', expect.stringContaining('data:text/csv;charset=utf-8,'));
        expect(mockLink.click).toHaveBeenCalled();
    });

    it('showPRISMAModal devrait afficher la modale PRISMA', () => {
        analyses.showPRISMAModal();
        expect(ui.openModal).toHaveBeenCalledWith('prismaModal');
    });
});