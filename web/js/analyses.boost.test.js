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
    showModal: jest.fn(),
    showLoadingOverlay: jest.fn(), // Mock manquant
    openModal: jest.fn(), // Mock openModal as well
}));
jest.mock('./state.js', () => ({
    appState: { 
        currentProject: { id: 'test-project', name: 'Test Project' }, // Add name for export
        analyses: []
    }
}));
 
describe('Analyses - Couverture Boost', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        
        // ✅ DOM minimal pour éviter les erreurs
        document.body.innerHTML = `
            <div id="analysisContainer"></div>
            <div class="prisma-checklist" id="prisma-checklist-content">
                <div class="prisma-item" data-item-id="item1">
                    <label>Item 1</label>
                    <input type="checkbox" name="item1" data-item-id="item1" checked>
                    <textarea name="item1_notes">Notes test</textarea>
                </div>
            </div>
        `;
    });
 
    it('runProjectAnalysis devrait lancer une analyse de discussion', async () => {
        api.fetchAPI.mockResolvedValue({ task_id: 'task-123' });
        ui.showToast.mockImplementation(() => {});
        
        await analyses.runProjectAnalysis('discussion');
        
        expect(api.fetchAPI).toHaveBeenCalledWith(
            '/projects/test-project/run-analysis',
            expect.objectContaining({
                method: 'POST',
                body: { type: 'discussion' }
            })
        );
        expect(ui.showToast).toHaveBeenCalledWith('La génération pour le brouillon de discussion a été lancée.', 'success');
    });
 
    it('runProjectAnalysis devrait gérer les erreurs API', async () => {
        api.fetchAPI.mockRejectedValue(new Error('API Error'));
        ui.showToast.mockImplementation(() => {});
        
        await analyses.runProjectAnalysis('discussion');
        
        expect(ui.showToast).toHaveBeenCalledWith("Erreur lors du lancement de l'analyse: API Error", 'error');
    });
 
    it('exportPRISMAReport ne devrait pas planter', () => {
        // ✅ Mock createElement pour éviter les erreurs
        const mockLink = {
            setAttribute: jest.fn(),
            click: jest.fn(),
            remove: jest.fn()
        };
        jest.spyOn(document, 'createElement').mockReturnValue(mockLink);
        jest.spyOn(document.body, 'appendChild').mockImplementation(() => {});
        jest.spyOn(document.body, 'removeChild').mockImplementation(() => {});
        
        expect(() => analyses.exportPRISMAReport()).not.toThrow();
        expect(mockLink.click).toHaveBeenCalled();
    });
 
    it('savePRISMAProgress devrait collecter les données de checklist', async () => {
        api.fetchAPI.mockResolvedValue({ success: true });
        ui.showToast.mockImplementation(() => {});
        
        await analyses.savePRISMAProgress();
        
        // ✅ Vérifier que l'API est appelée (endpoint peut varier)
        expect(api.fetchAPI).toHaveBeenCalledWith('/projects/test-project/prisma-checklist', expect.any(Object));
        expect(ui.showToast).toHaveBeenCalledWith('Progression PRISMA sauvegardée.', 'success');
    });
 
    it('showRunAnalysisModal devrait afficher la modale', () => {
        ui.showModal.mockImplementation(() => {});
        
        analyses.showRunAnalysisModal();
        
        expect(ui.showModal).toHaveBeenCalledWith("Lancer une Analyse Avancée", expect.any(String));
    });
 
    it('showPRISMAModal devrait afficher la modale PRISMA', () => {
        ui.openModal.mockImplementation(() => {});
        
        analyses.showPRISMAModal();
        
        expect(ui.openModal).toHaveBeenCalledWith('prismaModal');
    });
});