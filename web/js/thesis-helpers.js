// Helpers spécifiques pour rédaction de thèse
import { fetchAPI } from './api.js';
import { API_ENDPOINTS } from './constants.js';
import { appState } from './app-improved.js';

// Export PRISMA pour thèse
export async function exportPRISMAForThesis() {
    if (!appState.currentProject?.id) return;
    
    try {
        const response = await fetch(API_ENDPOINTS.projectExportThesis(appState.currentProject.id));
        const blob = await response.blob();
        
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `prisma_${appState.currentProject.name}.docx`;
        a.click();
        
        return true;
    } catch (error) {
        console.error('Erreur export PRISMA:', error);
        return false;
    }
}

// Calcul statistiques pour thèse
export async function calculateThesisStats() {
    if (!appState.currentProject?.id) return null;
    
    try {
        const articles = await fetchAPI(API_ENDPOINTS.projectArticles(appState.currentProject.id));
        const extractions = await fetchAPI(API_ENDPOINTS.projectExtractions(appState.currentProject.id));
        
        return {
            totalArticles: articles.length,
            includedArticles: extractions.filter(e => e.user_validation_status === 'include').length,
            excludedArticles: extractions.filter(e => e.user_validation_status === 'exclude').length,
            pendingArticles: extractions.filter(e => !e.user_validation_status).length,
            averageRelevanceScore: extractions.reduce((sum, e) => sum + (e.relevance_score || 0), 0) / extractions.length
        };
    } catch (error) {
        console.error('Erreur calcul stats:', error);
        return null;
    }
}

// Export complet pour thèse
export async function exportCompleteThesisData() {
    if (!appState.currentProject?.id) return;
    
    try {
        const stats = await calculateThesisStats();
        const analyses = await fetchAPI(API_ENDPOINTS.projectAnalyses(appState.currentProject.id));
        
        const thesisData = {
            project: appState.currentProject,
            statistics: stats,
            analyses: analyses,
            exportDate: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(thesisData, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `thesis_data_${appState.currentProject.name}.json`;
        a.click();
        
        return true;
    } catch (error) {
        console.error('Erreur export thèse:', error);
        return false;
    }
}