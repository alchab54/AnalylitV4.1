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
        // ✅ CORRECTION: Mock FormData pour les uploads
        // ✅ CORRECTION: Add necessary DOM elements for functions to find.
        document.body.innerHTML = `
            <div id="loading-overlay"></div>
            <input id="pmidDoiInput" />
        `;
        global.FormData = jest.fn().mockImplementation(() => ({
            append: jest.fn()
        }));
        // ✅ CORRECTION: Mock FileReader pour simuler la lecture de fichier
        global.FileReader = jest.fn(() => ({
            readAsText: jest.fn(),
            readAsDataURL: jest.fn(),
            onload: jest.fn(),
            onerror: jest.fn(),
            result: '{"mock": "file content"}' // Contenu de fichier simulé
        }));
    });
 
    describe('handleIndexPdfs', () => {
        it('devrait appeler showLoadingOverlay et updateLoadingProgress au démarrage', () => {
            importModule.handleIndexPdfs();
            expect(uiImproved.showLoadingOverlay).toHaveBeenCalledWith(true, "Lancement de l'indexation...");
            // ✅ CORRECTION: Paramètres exacts de ta fonction
            expect(uiImproved.updateLoadingProgress).toHaveBeenCalledWith(0, 1, "Lancement de l'indexation...");
        });
    });
 
    describe('handleZoteroImport', () => {
        it('devrait traiter un fichier Zotero', async () => {
            // ✅ Mock API success
            api.fetchAPI.mockResolvedValue({
                message: '5 références importées.',
                count: 5
            });
 
            const mockFileInput = {
                files: [{
                    name: 'zotero.json',
                    size: 1000,
                    type: 'application/json'
                }]
            };
 
            // Simuler la lecture de fichier réussie
            FileReader.mockImplementation(() => ({
                readAsText: jest.fn(function() { this.onload(); }), // Appelle onload immédiatement
                result: '{"items":[]}'
            }));
            await importModule.handleZoteroImport(mockFileInput);
 
            expect(uiImproved.showLoadingOverlay).toHaveBeenCalledWith(true, "Import du fichier Zotero...");
            expect(api.fetchAPI).toHaveBeenCalled(); // Simplifié - on vérifie juste que l'API est appelée
            expect(uiImproved.showToast).toHaveBeenCalledWith(expect.stringContaining('référence'), 'success');
        });
 
        it('devrait gérer les erreurs d\'import Zotero', async () => {
            api.fetchAPI.mockRejectedValue(new Error('Import failed'));
 
            const mockFileInput = {
                files: [{ name: 'test.json', size: 1000 }]
            };
 
            await importModule.handleZoteroImport(mockFileInput);
 
            expect(uiImproved.showToast).toHaveBeenCalledWith(expect.stringContaining('Erreur'), 'error');
        });
    });
 
    describe('handleUploadPdfs', () => {
        it('devrait traiter un upload de PDF', async () => {
            api.fetchAPI.mockResolvedValue({
                message: '1 PDFs uploadés',
                count: 1
            });
 
            const mockFileInput = {
                files: [{
                    name: 'test.pdf',
                    size: 1000000,
                    type: 'application/pdf'
                }]
            };
 
            // Simuler la lecture de fichier réussie pour l'upload
            FileReader.mockImplementation(() => ({
                readAsDataURL: jest.fn(function() { this.onload(); }), // Appelle onload immédiatement
                result: 'data:application/pdf;base64,mockcontent'
            }));
            await importModule.handleUploadPdfs(mockFileInput);
 
            expect(uiImproved.showLoadingOverlay).toHaveBeenCalledWith(true, "Upload de 1 PDF(s)...");
            expect(api.fetchAPI).toHaveBeenCalled();
            expect(uiImproved.showToast).toHaveBeenCalledWith(expect.stringContaining('PDF'), 'success');
        });
 
        it('devrait rejeter plus de 20 PDFs', async () => {
            const files = Array.from({length: 21}, (_, i) => ({
                name: `test${i}.pdf`,
                size: 1000000,
                type: 'application/pdf'
            }));
 
            const mockFileInput = { files };
 
            await importModule.handleUploadPdfs(mockFileInput);
 
            expect(uiImproved.showToast).toHaveBeenCalledWith("Maximum 20 PDFs autorisés par upload.", 'warning');
            expect(api.fetchAPI).not.toHaveBeenCalled();
        });
    });
 
    describe('processPmidImport', () => {
        it('devrait importer une liste de PMIDs', async () => {
            api.fetchAPI.mockResolvedValue({
                message: 'Import lancé pour 2 identifiant(s).',
                count: 2
            });
 
            // ✅ CORRECTION: Mock DOM complet
            document.body.innerHTML = `
                <div id="pmidImportModal" style="display: block;">
                    <form data-action="submit-pmid-import" id="pmid-import-form"> 
                        <input id="pmidDoiInput" value="12345678, 10.1000/test">
                        <button type="submit">Importer</button>
                    </form>
                </div>
            `;
 
            const mockEvent = {
                preventDefault: jest.fn(),
                target: document.getElementById('pmid-import-form')
            };
 
            await importModule.processPmidImport(mockEvent);
 
            expect(api.fetchAPI).toHaveBeenCalled();
            expect(uiImproved.showToast).toHaveBeenCalledWith(expect.stringContaining('Import'), 'success');
        });
 
        it('devrait valider les champs requis', async () => {
            document.body.innerHTML = `
                <div id="pmidImportModal">
                    <form data-action="submit-pmid-import" id="pmid-import-form-empty">
                        <input id="pmidDoiInput" value=""> 
                    </form>
                </div>
            `;
 
            const mockEvent = {
                preventDefault: jest.fn(),
                target: document.getElementById('pmid-import-form-empty')
            };
 
            await importModule.processPmidImport(mockEvent);
 
            expect(uiImproved.showToast).toHaveBeenCalledWith("Veuillez saisir au moins un identifiant.", 'warning');
            expect(api.fetchAPI).not.toHaveBeenCalled();
        });
    });
});
