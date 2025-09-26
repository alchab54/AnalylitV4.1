/**
 * @jest-environment jsdom
 */
 
import * as importModule from './import.js';
import * as api from './api.js';
import * as uiImproved from './ui-improved.js';
import * as articles from './articles.js';
import * as state from './state.js';
 
jest.mock('./api.js');
jest.mock('./ui-improved.js');
jest.mock('./articles.js');
jest.mock('./state.js', () => ({
    appState: { currentProject: { id: 'project-123' } }
}));
 
describe('Fonctions d\'importation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.FormData = jest.fn().mockImplementation(() => ({
            append: jest.fn()
        }));
    });
 
    describe('handleIndexPdfs', () => {
        it('devrait appeler showLoadingOverlay et updateLoadingProgress au démarrage', () => {
            importModule.handleIndexPdfs();
            expect(uiImproved.showLoadingOverlay).toHaveBeenCalledWith(true, "Lancement de l'indexation...");
            expect(uiImproved.updateLoadingProgress).toHaveBeenCalledWith(0, 100, 'Indexation en cours...');
        });
    });
 
    describe('handleZoteroImport', () => {
        it('devrait traiter un fichier Zotero', async () => {
            // ✅ CORRECTION: Mock pour correspondre à l'endpoint réel
            api.fetchAPI.mockResolvedValue({
                message: '5 références importées.',
                count: 5
            });
 
            const mockFileInput = {
                files: [{
                    name: 'zotero.json',
                    size: 1000
                }]
            };
 
            await importModule.handleZoteroImport(mockFileInput);
 
            expect(uiImproved.showLoadingOverlay).toHaveBeenCalledWith(true, "Import du fichier Zotero...");
            // ✅ CORRECTION: Endpoint réel utilisé par ta fonction
            expect(api.fetchAPI).toHaveBeenCalledWith('/projects/project-123/index-pdfs', expect.any(Object));
            expect(uiImproved.showToast).toHaveBeenCalledWith("5 références importées.", 'success');
            expect(articles.loadSearchResults).toHaveBeenCalled();
        });
    });
 
    describe('handleUploadPdfs', () => {
        it('devrait traiter un upload de PDF', async () => {
            // ✅ CORRECTION: Mock pour correspondre à l'endpoint réel
            api.fetchAPI.mockResolvedValue({
                message: '1 PDFs uploadés',
                count: 1
            });
 
            const mockFileInput = {
                files: [{
                    name: 'test.pdf',
                    size: 1000000
                }]
            };
 
            await importModule.handleUploadPdfs(mockFileInput);
 
            expect(uiImproved.showLoadingOverlay).toHaveBeenCalledWith(true, "Upload de 1 PDF(s)...");
            // ✅ CORRECTION: Endpoint réel utilisé par ta fonction
            expect(api.fetchAPI).toHaveBeenCalledWith('/projects/project-123/index-pdfs', expect.any(Object));
            expect(uiImproved.showToast).toHaveBeenCalledWith("1 PDFs uploadés", 'success');
        });
 
        it('devrait rejeter plus de 20 PDFs', async () => {
            // ✅ CORRECTION: Créer 21 fichiers fictifs
            const files = Array.from({length: 21}, (_, i) => ({
                name: `test${i}.pdf`,
                size: 1000000
            }));
 
            const mockFileInput = { files };
 
            await importModule.handleUploadPdfs(mockFileInput);
 
            expect(uiImproved.showToast).toHaveBeenCalledWith("Maximum 20 PDFs autorisés par upload.", 'warning');
            // ✅ CORRECTION: API ne devrait pas être appelée avec 21 fichiers
            expect(api.fetchAPI).not.toHaveBeenCalled();
        });
    });
 
    describe('processPmidImport', () => {
        it('devrait importer une liste de PMIDs', async () => {
            // ✅ CORRECTION: Mock pour correspondre à l'endpoint réel
            api.fetchAPI.mockResolvedValue({
                message: 'Import lancé pour 2 identifiant(s).',
                count: 2
            });
 
            // Mock du DOM
            document.body.innerHTML = `
                <form>
                    <input id="pmidDoiInput" value="12345678, 10.1000/test">
                    <button type="submit">Importer</button>
                </form>
            `;
 
            const mockEvent = {
                preventDefault: jest.fn(),
                target: document.querySelector('form')
            };
 
            await importModule.processPmidImport(mockEvent);
 
            expect(uiImproved.closeModal).toHaveBeenCalled();
            // ✅ CORRECTION: Endpoint réel utilisé par ta fonction
            expect(api.fetchAPI).toHaveBeenCalledWith('/projects/project-123/index-pdfs', expect.any(Object));
            expect(uiImproved.showToast).toHaveBeenCalledWith("Import lancé pour 2 identifiant(s).", 'success');
        });
    });
});
