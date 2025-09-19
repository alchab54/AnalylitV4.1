# GEMINI.md - Agent Complet AnalyLit v4.1

## CONTEXTE MISSION

L'analyse du repository GitHub `alchab54/AnalylitV4.1` révèle une application **presque fonctionnelle** avec :
- **✅ Backend solide** : Python/Flask robuste avec routes API complètes
- **❌ Frontend partiellement implémenté** : VSCode Assist a commenté des fonctionnalités "en attente"
- **🎯 Objectif** : Compléter l'implémentation pour une application 100% opérationnelle

## ANALYSE DE L'ÉTAT ACTUEL

### Backend - COMPLET ✅
**server_v4_complete.py** : 75 routes API entièrement implémentées
- Gestion projets, recherche multi-bases, extractions, analyses
- WebSocket temps réel, gestion Zotero, export thèse  
- Architecture robuste avec Redis/RQ pour tâches asynchrones

**tasks_v4_complete.py** : Toutes les tâches backend opérationnelles
- Traitement articles, synthèses IA, analyses ATN
- RAG/Chat, imports Zotero, méta-analyses PRISMA

### Frontend - PARTIELLEMENT IMPLÉMENTÉ ⚠️
**VSCode Assist a désactivé des fonctionnalités** qui SONT implémentées dans le backend :

#### Fonctionnalités commentées à tort :
1. **Suppression par lot d'articles** - `articles.js` (Route backend : `DELETE /api/projects/<id>/extractions`)
2. **Téléchargement en masse de PDFs** - `import.js` (Route backend : `POST /api/projects/<id>/upload-pdfs-bulk`)  
3. **Indexation de PDFs** - `chat.js` (Tâche backend : `index_project_pdfs_task`)
4. **Rapports complets** - `reporting.js` (Route backend : `GET /api/projects/<id>/export/thesis`)
5. **Gestion des grilles** - `grids.js` (Routes backend : `/api/projects/<id>/grids/*`)
6. **Analyse risque de biais** - `rob.js` (Route backend : `POST /api/projects/<id>/run-rob-analysis`)

## INSTRUCTIONS POUR GEMINI AGENT

### PHASE 1 : Diagnostic Précis
1. **Scanner tous les fichiers frontend** dans `/web/js/`
2. **Identifier les fonctions commentées** avec `// TODO:` 
3. **Vérifier la correspondance backend** pour chaque fonction commentée
4. **Détecter les vrais manques** vs les implémentations existantes

### PHASE 2 : Réactivation Intelligente
Pour chaque fonction commentée, **vérifier d'abord si le backend l'implémente** :

```bash
# Exemple pour suppression par lot
grep -r "delete.*articles" server_v4_complete.py
# Si trouvé → réactiver la fonction frontend
# Si absent → garder commenté avec note explicative
```

### PHASE 3 : Complétion Frontend
**Réactiver UNIQUEMENT les fonctions avec backend correspondant** :

#### articles.js - À réactiver
```javascript
// ✅ RÉACTIVER - Backend implémenté
export function handleDeleteSelectedArticles() {
    const selected = Array.from(appState.selectedSearchResults);
    if (!selected.length) return;
    
    fetchAPI(`/projects/${appState.currentProject.id}/articles/batch-delete`, {
        method: 'DELETE',
        body: JSON.stringify({ article_ids: selected })
    }).then(() => {
        showToast('Articles supprimés');
        refreshCurrentSection();
    });
}
```

#### import.js - À réactiver  
```javascript
// ✅ RÉACTIVER - Backend implémenté
export function handleUploadPdfs() {
    const formData = new FormData();
    const files = document.getElementById('pdfFiles').files;
    
    Array.from(files).forEach(file => formData.append('files', file));
    
    fetchAPI(`/projects/${appState.currentProject.id}/upload-pdfs-bulk`, {
        method: 'POST',
        body: formData
    }).then(() => showToast('PDFs uploadés'));
}
```

#### reporting.js - À réactiver
```javascript
// ✅ RÉACTIVER - Backend implémenté  
export function exportForThesis() {
    window.open(`/api/projects/${appState.currentProject.id}/export/thesis`);
    showToast('Export thèse généré');
}
```

### PHASE 4 : Interface Moderne
1. **Vérifier index.html** - structure sémantique présente ✅
2. **Améliorer CSS** - design system avec variables CSS
3. **Optimiser UX** - feedback utilisateur, états de chargement

### PHASE 5 : Tests de Cohérence
```bash
# Validation des routes
curl -X GET http://localhost:8080/api/health
curl -X GET http://localhost:8080/api/projects/

# Test interface
open http://localhost:8080
# Vérifier : 0 erreur console, navigation fluide
```

## CONTRAINTES CRITIQUES

### ❌ NE PAS TOUCHER
- **server_v4_complete.py** - Backend parfaitement fonctionnel
- **tasks_v4_complete.py** - Toutes les tâches implémentées
- **Architecture ES6 Modules** - Délégation d'événements via core.js

### ✅ ACTIONS AUTORISÉES
- **Réactiver** les fonctions frontend avec backend correspondant
- **Compléter** les fonctions frontend manquantes  
- **Améliorer** l'interface et l'expérience utilisateur
- **Corriger** les bugs d'intégration frontend/backend

## MÉTHODOLOGIE DE VALIDATION

### Pour chaque fonction commentée :
1. **Rechercher la route backend correspondante**
2. **Si trouvée** : Réactiver avec implémentation correcte
3. **Si absente** : Laisser commentée avec explication claire
4. **Tester** l'intégration frontend/backend

### Exemple de validation :
```bash
# Fonction : handleDeleteGrid() commentée
grep -r "grids.*DELETE" server_v4_complete.py
# Résultat : Route trouvée ligne 234
# Action : Réactiver la fonction avec bonne URL
```

## RÉSULTAT ATTENDU

### Application 100% Fonctionnelle
- **✅ Navigation fluide** entre toutes les sections
- **✅ Toutes les fonctionnalités** backend accessibles via frontend  
- **✅ Interface moderne** et responsive
- **✅ 0 erreur console** au chargement
- **✅ WebSocket opérationnel** pour notifications temps réel

### Fonctionnalités Critiques Opérationnelles
1. **Gestion complète des projets ATN**
2. **Recherche multi-bases** (PubMed, arXiv, CrossRef)  
3. **Screening IA** avec extraction personnalisée
4. **Chat RAG** avec PDFs indexés
5. **Analyses avancées** (PRISMA, méta-analyses, ATN)
6. **Export thèse** complet (Excel + bibliographie)

## PRIORITÉ ABSOLUE

**Rendre l'application immédiatement utilisable** pour finaliser une thèse sur l'Alliance Thérapeutique Numérique, en réactivant intelligemment les fonctionnalités déjà implémentées côté backend mais désactivées côté frontend par erreur.