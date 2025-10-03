# Guide d'Intégration PDF/Zotero pour Gemini VSCode Assist - AnalyLit v4.1

## 🎯 **Contexte et Objectif**

**Situation :** Vous avez une application AnalyLit v4.1 fonctionnelle avec un script de test ATN (`scripts/test_atn_workflow.py`) qui valide la recherche PubMed → analyse → export. Le backend possède déjà tous les endpoints nécessaires pour l'import de PDFs et Zotero, mais le script de test n'exploite pas encore ces fonctionnalités.

**Objectif :** Enrichir le workflow ATN pour intégrer vos PDFs locaux et collections Zotero, permettant une analyse complète sur texte intégral plutôt que sur résumés uniquement.

## 🏗️ **Architecture Existante Confirmée**

**Backend prêt avec ces endpoints :**
- `POST /api/projects/{id}/upload-pdfs-bulk` - Upload PDFs depuis PC
- `POST /api/projects/{id}/upload-zotero` - Import fichier JSON Zotero
- `POST /api/projects/{id}/import-zotero-pdfs` - Import direct API Zotero
- `POST /api/projects/{id}/add-manual-articles` - Ajout manuel d'articles

**Tâches asynchrones existantes :**
- `import_from_zotero_file_task()` - Traite export JSON Zotero
- `import_pdfs_from_zotero_task()` - Récupère PDFs via API Zotero
- `add_manual_articles_task()` - Ajoute articles manuels
- `index_project_pdfs_task()` - Indexe PDFs pour chat RAG

## 🚀 **Plan d'Intégration pour Gemini**

### **Étape 1 : Enrichir le script existant**

**Prompt Gemini :**
```
@workspace Dans scripts/test_atn_workflow.py, ajouter deux nouvelles méthodes :
1. upload_local_pdfs(pdf_folder_path) qui upload des PDFs via l'endpoint /upload-pdfs-bulk
2. import_from_zotero_export(zotero_json_path) qui importe via /upload-zotero
3. Modifier run_complete_atn_workflow() pour accepter des paramètres optionnels pdf_folder et zotero_export
4. Utiliser les mêmes patterns que les méthodes existantes (timeout, job_id, wait_for_task)
```

### **Étape 2 : Arguments CLI**

**Prompt Gemini :**
```
@workspace Modifier le __main__ de scripts/test_atn_workflow.py pour accepter des arguments CLI :
--pdf-folder "chemin/vers/pdfs"
--zotero-export "chemin/vers/export.json"
Utiliser argparse et passer ces paramètres au workflow
```

### **Étape 3 : Intégration dans le workflow**

**Prompt Gemini :**
```
@workspace Dans la méthode run_complete_atn_workflow(), ajouter les étapes d'import PDF/Zotero entre "Récupération résultats" et "Analyses ATN". Conditionner ces étapes aux paramètres fournis.
```

## 💡 **Exemple d'Utilisation Post-Intégration**

```bash
# Test basique (actuel)
python scripts/test_atn_workflow.py

# Avec PDFs locaux
python scripts/test_atn_workflow.py --pdf-folder "C:/Users/alich/PDFs_ATN"

# Avec export Zotero
python scripts/test_atn_workflow.py --zotero-export "C:/Users/alich/export_zotero.json"

# Workflow complet
python scripts/test_atn_workflow.py --pdf-folder "C:/PDFs_ATN" --zotero-export "C:/zotero.json"
```

## 🔧 **Code Pattern à Suivre**

**Pour Gemini - Structure des nouvelles méthodes :**

```python
def upload_local_pdfs(self, pdf_folder_path):
    """Upload PDFs locaux vers le projet."""
    # 1. Vérifier existence dossier
    # 2. Lister fichiers PDF
    # 3. Préparer multipart/form-data
    # 4. POST vers /upload-pdfs-bulk
    # 5. Attendre job_id avec wait_for_task()
    # 6. Return True/False selon succès
    
def import_from_zotero_export(self, zotero_json_path):
    """Import depuis export JSON Zotero."""
    # 1. Vérifier fichier JSON
    # 2. POST vers /upload-zotero avec file upload
    # 3. Attendre job_id avec wait_for_task()
    # 4. Return True/False selon succès
```

## 🎯 **Bénéfices Attendus**

1. **Analyse complète :** Texte intégral vs résumés seulement
2. **Intégration Zotero :** Métadonnées enrichies + annotations
3. **Validation robuste :** Script unique pour tout le pipeline
4. **Chat RAG :** PDFs indexés pour questions interactives
5. **Export complet :** Rapport final avec références aux sources complètes

## ⚠️ **Points d'Attention pour Gemini**

1. **Gestion d'erreurs :** Maintenir le même style que les méthodes existantes
2. **Timeouts :** PDFs et Zotero peuvent être longs (timeout=600s+)
3. **Logs cohérents :** Utiliser `self.log()` avec timestamps
4. **Compatibilité :** Préserver la fonctionnalité actuelle si aucun PDF fourni
5. **Dépendances :** Vérifier si `requests-toolbelt` est nécessaire pour multipart

## 🔄 **Workflow Final Intégré**

```
1. Vérification app ✓
2. Création projet ✓  
3. Recherche PubMed ✓
4. Récupération résultats ✓
5. [NOUVEAU] Import PDFs locaux (si fourni)
6. [NOUVEAU] Import Zotero (si fourni)  
7. Analyses ATN ✓ (maintenant sur texte intégral)
8. Export final ✓
```

**Cette approche vous permet d'enrichir progressivement votre workflow ATN tout en préservant la compatibilité existante et en exploitant pleinement l'infrastructure backend déjà en place.**