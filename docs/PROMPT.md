# PROMPT.md - Instructions Détaillées Gemini VSCode

## MISSION PRINCIPALE

Finaliser l'application AnalyLit v4.1 en réactivant intelligemment les fonctionnalités frontend désactivées par erreur, tout en respectant l'architecture existante.

## DIAGNOSTIC INITIAL REQUIS

### Étape 1 : Scanner le Frontend
```bash
# Identifier toutes les fonctions commentées avec TODO
find web/js -name "*.js" -exec grep -l "// TODO:" {} \;
grep -rn "// TODO:" web/js/

# Lister les exports manquants
grep -rn "export function" web/js/ | head -20
```

### Étape 2 : Vérifier la Correspondance Backend
Pour chaque fonction commentée, vérifier si le backend l'implémente :

```bash
# Exemple pour articles.js
grep -n "batch.*delete\|delete.*batch" server_v4_complete.py
grep -n "upload.*pdfs\|pdfs.*upload" server_v4_complete.py  
grep -n "export.*thesis" server_v4_complete.py
```

## PLAN D'ACTION SÉQUENTIEL

### PHASE 1 : Réactivation Sélective

#### 1.1 Articles (articles.js)
**À RÉACTIVER** - Backend vérifié présent :

```javascript
// ✅ Suppression par lot - Route backend trouvée
export function handleDeleteSelectedArticles() {
    if (!appState.currentProject || !appState.selectedSearchResults.size) {
        showToast('Aucun article sélectionné', 'warning');
        return;
    }
    
    const articleIds = Array.from(appState.selectedSearchResults);
    
    fetchAPI(`/projects/${appState.currentProject.id}/articles/batch-delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_ids: articleIds })
    }).then(() => {
        showToast(`${articleIds.length} articles supprimés`);
        appState.selectedSearchResults.clear();
        refreshCurrentSection();
    }).catch(error => {
        showToast('Erreur lors de la suppression', 'error');
        console.error('Delete error:', error);
    });
}

export function showBatchProcessModal() {
    if (!appState.selectedSearchResults.size) {
        showToast('Sélectionnez des articles à traiter', 'warning');
        return;
    }
    openModal('batchProcessModal');
}
```

#### 1.2 Import/PDF (import.js)  
**À RÉACTIVER** - Backend vérifié présent :

```javascript
// ✅ Upload PDFs en masse - Route backend présente
export function handleUploadPdfs() {
    const fileInput = document.getElementById('pdfFiles');
    if (!fileInput?.files.length) {
        showToast('Sélectionnez des fichiers PDF', 'warning');
        return;
    }

    const formData = new FormData();
    Array.from(fileInput.files).forEach(file => {
        if (file.type === 'application/pdf') {
            formData.append('files', file);
        }
    });

    if (!formData.has('files')) {
        showToast('Aucun fichier PDF valide sélectionné', 'error');
        return;
    }

    showLoadingOverlay();
    
    fetchAPI(`/projects/${appState.currentProject.id}/upload-pdfs-bulk`, {
        method: 'POST',
        body: formData
    }).then(response => {
        showToast(`${response.successful_uploads?.length || 0} PDFs uploadés`);
        fileInput.value = '';
    }).finally(() => {
        closeLoadingOverlay();
    });
}

// ✅ Indexation PDFs - Tâche backend présente
export function handleIndexPdfs() {
    if (!appState.currentProject) return;
    
    showLoadingOverlay('Indexation des PDFs en cours...');
    
    fetchAPI(`/projects/${appState.currentProject.id}/index-pdfs`, {
        method: 'POST'
    }).then(() => {
        showToast('Indexation des PDFs démarrée');
    });
}
```

#### 1.3 Rapports (reporting.js)
**À RÉACTIVER** - Backend complet :

```javascript
// ✅ Export thèse complet - Route backend implémentée
export function exportForThesis() {
    if (!appState.currentProject) {
        showToast('Aucun projet sélectionné', 'warning');
        return;
    }

    showLoadingOverlay('Génération de l\'export thèse...');
    
    // Utiliser window.open pour télécharger le ZIP
    const exportUrl = `/api/projects/${appState.currentProject.id}/export/thesis`;
    
    fetch(exportUrl)
        .then(response => {
            if (!response.ok) throw new Error('Export failed');
            return response.blob();
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `export_these_${appState.currentProject.id}.zip`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            showToast('Export thèse téléchargé');
        })
        .catch(error => {
            console.error('Export error:', error);
            showToast('Erreur lors de l\'export', 'error');
        })
        .finally(() => {
            closeLoadingOverlay();
        });
}

// ✅ Génération bibliographie - Implémentation backend
export function generateBibliography() {
    if (!appState.currentProject) return;
    
    fetchAPI(`/projects/${appState.currentProject.id}/bibliography`)
        .then(biblio => {
            // Afficher dans une modale
            openModal('bibliographyModal');
            document.getElementById('bibliographyContent').textContent = biblio.formatted_bibliography;
        });
}
```

#### 1.4 Grilles (grids.js)
**À RÉACTIVER** - Routes backend complètes :

```javascript
// ✅ Suppression grille - Route DELETE backend présente
export function handleDeleteGrid(gridId) {
    if (!confirm('Supprimer cette grille d\'extraction ?')) return;
    
    fetchAPI(`/projects/${appState.currentProject.id}/grids/${gridId}`, {
        method: 'DELETE'
    }).then(() => {
        showToast('Grille supprimée');
        loadProjectGrids();
    });
}

// ✅ Formulaire grille - Routes POST/PUT backend présentes  
export function showGridFormModal(gridId = null) {
    const modal = document.getElementById('gridFormModal');
    const form = document.getElementById('gridForm');
    
    if (gridId) {
        // Mode édition
        const grid = appState.currentProjectGrids.find(g => g.id === gridId);
        if (grid) {
            document.getElementById('gridName').value = grid.name;
            // Remplir les champs existants
            const fields = JSON.parse(grid.fields);
            populateGridFields(fields);
        }
    } else {
        // Mode création
        form.reset();
        initializeEmptyGrid();
    }
    
    openModal('gridFormModal');
}
```

### PHASE 2 : Intégrations Critiques

#### 2.1 Chat RAG (chat.js)
```javascript
// ✅ Réactiver - Backend RAG complet
export function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message || !appState.currentProject) return;
    
    // Ajouter message utilisateur immédiatement
    addChatMessage('user', message);
    input.value = '';
    
    // Envoyer au backend
    fetchAPI(`/projects/${appState.currentProject.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: message })
    }).then(response => {
        // La réponse arrivera via WebSocket
        showToast('Question envoyée à l\'IA');
    }).catch(error => {
        addChatMessage('assistant', 'Erreur lors du traitement de votre question.');
        console.error('Chat error:', error);
    });
}
```

#### 2.2 Analyses ROB (rob.js)
```javascript
// ✅ Réactiver - Route backend présente
export function handleRunRobAnalysis() {
    if (!appState.selectedSearchResults.size) {
        showToast('Sélectionnez des articles pour l\'analyse RoB', 'warning');
        return;
    }
    
    const articleIds = Array.from(appState.selectedSearchResults);
    
    fetchAPI(`/projects/${appState.currentProject.id}/run-rob-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_ids: articleIds })
    }).then(response => {
        showToast(`Analyse RoB démarrée pour ${articleIds.length} articles`);
        // Les résultats arriveront via WebSocket
    });
}
```

### PHASE 3 : Interface et Expérience

#### 3.1 Améliorer les Feedbacks
```javascript
// Dans ui.js - Améliorer les notifications
export function showToast(message, type = 'info', duration = 5000) {
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
        <div class="toast__content">
            <span class="toast__icon">${getToastIcon(type)}</span>
            <span class="toast__message">${escapeHtml(message)}</span>
            <button class="toast__close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    document.getElementById('toastContainer').appendChild(toast);
    
    // Auto-remove
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, duration);
}
```

#### 3.2 États de Chargement
```javascript
// Améliorer les overlays de chargement
export function showLoadingOverlay(message = 'Chargement...') {
    const overlay = document.getElementById('loadingOverlay');
    const messageEl = overlay.querySelector('.loading-message');
    if (messageEl) messageEl.textContent = message;
    overlay.classList.add('loading-overlay--show');
}
```

### PHASE 4 : Tests et Validation

#### 4.1 Tests Fonctionnels
```bash
# Vérifier que l'application démarre sans erreur
docker-compose -f docker-compose-local.yml up -d --build

# Tester les endpoints critiques
curl -X GET http://localhost:8080/api/health
curl -X GET http://localhost:8080/api/projects/

# Accéder à l'interface
open http://localhost:8080
```

#### 4.2 Checklist de Validation
- [ ] ✅ Navigation fluide entre sections
- [ ] ✅ Création de projet fonctionnelle  
- [ ] ✅ Recherche multi-bases opérationnelle
- [ ] ✅ Upload PDFs et indexation
- [ ] ✅ Chat IA avec documents
- [ ] ✅ Export thèse complet
- [ ] ✅ WebSocket notifications temps réel
- [ ] ✅ 0 erreur console au chargement

## CONTRAINTES ABSOLUES

### ❌ INTERDICTIONS
- **NE PAS modifier** `server_v4_complete.py` 
- **NE PAS modifier** `tasks_v4_complete.py`
- **NE PAS casser** l'architecture ES6 Modules existante
- **NE PAS changer** le système de délégation d'événements

### ✅ AUTORISATIONS  
- **Réactiver** les fonctions frontend avec backend correspondant
- **Corriger** les bugs d'intégration
- **Améliorer** l'interface utilisateur
- **Ajouter** des feedbacks et états de chargement

## RÉSULTAT FINAL ATTENDU

Une application AnalyLit v4.1 **100% fonctionnelle** permettant :

1. **Gestion complète des projets ATN**
2. **Recherche et screening automatisés**  
3. **Extraction de données personnalisées**
4. **Chat IA avec corpus de documents**
5. **Analyses statistiques avancées** 
6. **Export complet pour manuscrit de thèse**

**Prête à être utilisée immédiatement pour finaliser une thèse sur l'Alliance Thérapeutique Numérique.**