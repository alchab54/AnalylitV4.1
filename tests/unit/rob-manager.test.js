import { jest } from '@jest/globals';

// Mocks
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

import RiskOfBiasManager from '../../web/js/rob-manager.js';

describe('RiskOfBiasManager', () => {
    let robManager;
    let mockContainer;

    beforeEach(() => {
        document.body.innerHTML = '<div id="robContainer"></div>';
        mockContainer = document.getElementById('robContainer');
        
        mockFetchAPI.mockClear();
        robManager = new RiskOfBiasManager();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('devrait initialiser les 7 domaines Cochrane', () => {
        const domains = robManager.robDomains;
        
        expect(Object.keys(domains)).toHaveLength(7);
        expect(domains).toHaveProperty('random_sequence_generation');
        expect(domains).toHaveProperty('allocation_concealment');
        expect(domains).toHaveProperty('blinding_participants');
        expect(domains).toHaveProperty('blinding_outcome');
        expect(domains).toHaveProperty('incomplete_outcome_data');
        expect(domains).toHaveProperty('selective_reporting');
        expect(domains).toHaveProperty('other_bias');
    });

    it('devrait créer l\'interface RoB Cochrane', () => {
        expect(mockContainer.querySelector('.rob-header')).toBeTruthy();
        expect(mockContainer.querySelector('.rob-navigation')).toBeTruthy();
        expect(mockContainer.querySelectorAll('.rob-tab')).toHaveLength(4);
        expect(mockContainer.querySelectorAll('.rob-panel')).toHaveLength(4);
    });

    it('devrait charger les articles pour évaluation RoB', async () => {
        const mockExtractions = [
            { id: '1', title: 'Article 1', user_validation_status: 'include' },
            { id: '2', title: 'Article 2', user_validation_status: 'include' }
        ];
        
        mockFetchAPI.mockResolvedValue(mockExtractions);
        
        await robManager.loadRoBArticles();
        
        expect(mockFetchAPI).toHaveBeenCalledWith(
            expect.stringContaining('/extractions')
        );
        expect(robManager.currentArticles).toEqual(mockExtractions);
    });

    it('devrait créer un formulaire d\'évaluation avec tous les domaines', () => {
        const mockArticle = { id: '1', title: 'Test Article', authors: 'Test Authors' };
        
        robManager.renderAssessmentForm(mockArticle);
        
        const form = document.getElementById('rob-form-1');
        expect(form).toBeTruthy();
        expect(form.querySelectorAll('.rob-domain')).toHaveLength(7);
        
        // Vérifier qu\'on a les 3 options de risque pour chaque domaine
        const riskOptions = form.querySelectorAll('input[type="radio"]');
        expect(riskOptions.length).toBe(21); // 7 domaines × 3 options
    });

    it('devrait sauvegarder une évaluation RoB', async () => {
        const mockArticle = { id: '1', title: 'Test Article' };
        robManager.renderAssessmentForm(mockArticle);
        
        // Simuler la sélection d\'options
        const form = document.getElementById('rob-form-1');
        const firstRadio = form.querySelector('input[type="radio"]');
        firstRadio.checked = true;
        
        mockFetchAPI.mockResolvedValue({ success: true });
        
        await robManager.saveAssessment('1');
        
        expect(mockFetchAPI).toHaveBeenCalledWith(
            expect.stringContaining('/risk-of-bias/1'),
            expect.objectContaining({
                method: 'POST',
                body: expect.objectContaining({
                    rob_assessment: expect.any(Object),
                    article_id: '1'
                })
            })
        );
    });

    it('devrait obtenir les bons labels de risque', () => {
        expect(robManager.getRiskLabel('low')).toBe('Faible risque');
        expect(robManager.getRiskLabel('high')).toBe('Risque élevé');
        expect(robManager.getRiskLabel('unclear')).toBe('Risque incertain');
    });
});