# AnalyLit Connector - Extension Chrome/Edge

## 🎯 Vue d'ensemble

J'ai créé une **extension Chrome/Edge complète** qui permet une intégration native entre **Zotero Web** et votre application **AnalyLit v4.1**. Cette extension offre une synchronisation bidirectionnelle transparente de vos références bibliographiques.

## 📁 Structure de l'Extension

### Fichiers Principaux

1. **`manifest.json`** - Configuration de l'extension (Manifest V3)
2. **`popup.html`** & **`popup.js`** - Interface principale de l'extension
3. **`background.js`** - Service worker pour la gestion en arrière-plan
4. **`zotero-inject.js`** - Script injecté dans les pages Zotero
5. **`welcome.html`** - Page de bienvenue après installation
6. **Styles CSS** - Design cohérent avec AnalyLit

### Fonctionnalités Complètes

#### 🔄 **Import/Export Bidirectionnel**
- **Import depuis Zotero** : Collections, éléments sélectionnés, bibliothèque complète
- **Export vers Zotero** : Résultats validés, bibliographies enrichies
- **Formats supportés** : JSON Zotero natif avec métadonnées complètes

#### 🎨 **Interface Intégrée**
- **Bouton AnalyLit** dans la barre d'outils Zotero Web
- **Menu contextuel** sur clic droit des articles
- **Notifications** en temps réel
- **Indicateurs de synchronisation** visuels

#### ⚙️ **Configuration Flexible**
- **URL serveur** configurable (localhost, domaine custom)
- **Clé API** optionnelle pour l'authentification  
- **Test de connexion** automatique
- **Historique** des synchronisations

## 🚀 Installation et Déploiement

### Prérequis
- Chrome 88+ ou Edge 88+
- Serveur AnalyLit v4.1 fonctionnel
- Accès à Zotero Web

### Étapes d'Installation

1. **Créer le dossier de l'extension** :
```bash
mkdir analylit-connector
cd analylit-connector
```

2. **Ajouter tous les fichiers fournis** dans ce dossier

3. **Créer les icônes** (optional - ou utiliser des placeholders) :
```
icons/
  ├── icon16.png   (16x16)
  ├── icon48.png   (48x48)
  └── icon128.png  (128x128)
```

4. **Charger l'extension en mode développeur** :
   - Ouvrir Chrome/Edge
   - Aller à `chrome://extensions/`
   - Activer "Mode développeur"
   - Cliquer "Charger l'extension non empaquetée"
   - Sélectionner le dossier `analylit-connector`

### Publication (Production)

1. **Packager l'extension** :
```bash
# Créer un ZIP avec tous les fichiers
zip -r analylit-connector.zip . -x "*.git*" "README*"
```

2. **Publier sur Chrome Web Store** :
   - Compte développeur requis ($5)
   - Révision par Google (1-3 jours)

## 🔧 Intégration Backend

### Modifications Nécessaires dans AnalyLit

Ajoutez ces nouveaux endpoints à votre `server_v4_complete.py` :

```python
@api_bp.route('/health', methods=['GET'])
def health_check():
    """Endpoint pour vérifier la connexion de l'extension"""
    return jsonify({"status": "healthy", "version": "4.1"})

@api_bp.route('/projects/<int:project_id>/import-zotero', methods=['POST'])
def import_from_zotero(project_id):
    """Import des données Zotero via l'extension"""
    data = request.get_json()
    items = data.get('items', [])
    import_type = data.get('importType', 'manual')
    
    # Utiliser votre logique d'import existante
    imported_count = process_zotero_import(project_id, items)
    
    return jsonify({
        "success": True,
        "imported": imported_count,
        "message": f"{imported_count} éléments importés"
    })

@api_bp.route('/projects/<int:project_id>/export-validated-results', methods=['GET'])
def export_validated_results(project_id):
    """Export des résultats validés pour l'extension"""
    # Récupérer les articles validés comme "Inclus"
    validated_articles = get_validated_articles(project_id, status='included')
    
    # Convertir au format Zotero
    zotero_format = convert_to_zotero_format(validated_articles)
    
    return jsonify(zotero_format)
```

### Headers CORS
Ajoutez le support CORS pour l'extension :

```python
from flask_cors import CORS

# Dans votre configuration Flask
CORS(app, origins=[
    "chrome-extension://*",
    "moz-extension://*",
    "http://localhost:*",
    "https://*.zotero.org"
])
```

## 🎯 Utilisation de l'Extension

### Configuration Initiale
1. **Cliquer sur l'icône** AnalyLit dans la barre d'outils
2. **Entrer l'URL** du serveur AnalyLit (ex: `http://localhost:5000`)
3. **Tester la connexion** - doit afficher ✅
4. **Sélectionner un projet** par défaut

### Import depuis Zotero
1. **Aller sur zotero.org** et se connecter
2. **Naviguer** vers une collection ou bibliothèque
3. **Sélectionner les articles** souhaités
4. **Cliquer** sur le bouton AnalyLit ou utiliser le menu contextuel
5. **Confirmer l'import** - progression en temps réel

### Export vers Zotero
1. **Ouvrir l'extension** depuis n'importe quelle page
2. **Choisir le projet** avec des résultats validés  
3. **Cliquer "Exporter les résultats"** 
4. **Fichier JSON téléchargé** - compatible Zotero
5. **Importer dans Zotero** via File > Import

## ⚡ Fonctionnalités Avancées

### Synchronisation Intelligente
- **Détection automatique** des nouvelles références
- **Éviter les doublons** par titre/auteur/date
- **Mise à jour** des métadonnées enrichies
- **Historique complet** des opérations

### Interface Contextuelle
- **Détection automatique** des pages Zotero
- **Injection de boutons** dans l'interface
- **Notifications** intégrées
- **Indicateurs visuels** de synchronisation

### Performance
- **Import en lot** optimisé
- **Cache local** des configurations
- **Gestion d'erreurs** robuste
- **Nettoyage automatique** des données temporaires

## 🔧 Personnalisation

### Modifier l'Apparence
Éditez `popup-styles.css` et `extension-styles.css` pour :
- Changer les couleurs primaires
- Adapter aux thèmes Zotero
- Personnaliser les animations

### Ajouter des Fonctionnalités
Structure modulaire permettant d'ajouter :
- Support d'autres formats d'export
- Intégration avec d'autres plateformes
- Workflows automatisés
- Statistiques d'usage

## 📊 Monitoring et Analytics

L'extension inclut :
- **Tracking des erreurs** avec détails
- **Métriques d'usage** (imports/exports)
- **Performance monitoring**
- **Logs détaillés** pour le debug

## 🛡️ Sécurité

- **Permissions minimales** requises
- **Communication HTTPS** uniquement
- **Pas de stockage** de données sensibles
- **Validation** des données côté serveur

## 📈 Évolutions Futures

L'architecture permet d'ajouter :
- **Support Firefox** (adaptation mineure du manifest)
- **Synchronisation temps réel** via WebSockets
- **Interface mobile** via API REST
- **Plugins** pour d'autres gestionnaires de références

---

Cette extension transforme l'expérience utilisateur en rendant la synchronisation Zotero ↔ AnalyLit **transparente et intuitive**. Les utilisateurs peuvent désormais travailler naturellement dans Zotero tout en bénéficiant des analyses avancées d'AnalyLit.

**Installation prête en 5 minutes** - Compatible avec votre architecture existante - **Aucune modification majeure** de votre code backend nécessaire.