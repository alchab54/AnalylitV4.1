import { jest } from '@jest/globals';

// Mock des dépendances
const mockFetchAPI = jest.fn();
const mockAppState = {
    currentProject: { id: 'test-project-id', name: 'Test Project' }
};

jest.mock('../../web/js/api.js', () => ({
    fetchAPI: mockFetchAPI
}));

jest.mock('../../web/js/app-improved.js', () => ({
    appState: mockAppState
}));

import ATNAnalyzer from '../../web/js/atn-analyzer.js';

describe('ATNAnalyzer', () => {
    let atnAnalyzer;
    let mockContainer;

    beforeEach(() => {
        // Setup DOM mock
        document.body.innerHTML = '<div id="atn-analysis-container"></div>';
        mockContainer = document.getElementById('atn-analysis-container');
        
        // Reset mocks
        mockFetchAPI.mockClear();
        
        atnAnalyzer = new ATNAnalyzer();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('devrait initialiser les 29 champs ATN spécialisés', () => {
        const fields = atnAnalyzer.atnFields;
        
        expect(fields).toHaveProperty('foundational');
        expect(fields).toHaveProperty('empathy');
        expect(fields).toHaveProperty('clinical');
        expect(fields).toHaveProperty('technological');
        expect(fields).toHaveProperty('methodological');
        expect(fields).toHaveProperty('barriers');
        expect(fields).toHaveProperty('ethical');
        
        // Vérifier quelques champs spécifiques
        expect(fields.foundational).toContain('alliance_therapeutique_numerique');
        expect(fields.empathy).toContain('empathie_ia_detectee');
        expect(fields.clinical).toContain('efficacite_clinique_atn');
    });

    it('devrait créer l\'interface ATN complète', () => {
        expect(mockContainer.querySelector('.atn-header')).toBeTruthy();
        expect(mockContainer.querySelector('.atn-navigation')).toBeTruthy();
        expect(mockContainer.querySelectorAll('.atn-tab')).toHaveLength(4);
        expect(mockContainer.querySelectorAll('.atn-panel')).toHaveLength(4);
    });

    it('devrait permettre de switcher entre les onglets', () => {
        atnAnalyzer.switchATNTab('empathy');
        
        const activeTab = mockContainer.querySelector('.atn-tab.active');
        const activePanel = mockContainer.querySelector('.atn-panel.active');
        
        expect(activeTab.dataset.tab).toBe('empathy');
        expect(activePanel.id).toBe('atn-empathy');
    });

    it('devrait lancer une extraction ATN', async () => {
        mockFetchAPI.mockResolvedValue({ task_id: 'test-task-123' });
        
        // Simuler la sélection de champs
        document.body.innerHTML += `
            <div class="field-item">
                <input type="checkbox" id="field-alliance_therapeutique_numerique" checked>
            </div>
        `;
        
        await atnAnalyzer.launchATNExtraction();
        
        expect(mockFetchAPI).toHaveBeenCalledWith(
            expect.stringContaining('/run-analysis'),
            expect.objectContaining({
                method: 'POST',
                body: expect.objectContaining({
                    type: 'atn_specialized_extraction',
                    fields: expect.arrayContaining(['alliance_therapeutique_numerique']),
                    include_empathy_analysis: true
                })
            })
        );
    });

    it('devrait analyser l\'empathie IA vs humain', async () => {
        mockFetchAPI.mockResolvedValue({ task_id: 'empathy-task-456' });
        
        await atnAnalyzer.analyzeEmpathy();
        
        expect(mockFetchAPI).toHaveBeenCalledWith(
            expect.stringContaining('/run-analysis'),
            expect.objectContaining({
                method: 'POST',
                body: expect.objectContaining({
                    type: 'empathy_comparative_analysis'
                })
            })
        );
    });

    it('devrait obtenir le bon label pour les catégories', () => {
        expect(atnAnalyzer.getCategoryLabel('foundational')).toBe('🏗️ Fondations ATN');
        expect(atnAnalyzer.getCategoryLabel('empathy')).toBe('💙 Empathie');
        expect(atnAnalyzer.getCategoryLabel('clinical')).toBe('🏥 Clinique');
    });

    it('devrait obtenir le bon label pour les champs', () => {
        expect(atnAnalyzer.getFieldLabel('alliance_therapeutique_numerique'))
            .toBe('Alliance Thérapeutique Numérique');
        expect(atnAnalyzer.getFieldLabel('empathie_ia_detectee'))
            .toBe('Empathie IA Détectée');
    });
});
