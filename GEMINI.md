# 🎯 MISSION : Workflow ATN 20 Articles Zotero CSL JSON

## 📊 DONNÉES SOURCE

### **20 Articles Zotero - Format CSL JSON**
Fichier: `20ATN.json` (racine projet)

**Structure CSL JSON** (Zotero export):
[
{
"id": "http://zotero.org/groups/6109700/items/B75VT3ID",
"type": "article-journal",
"title": "A dyadic approach of assessing the therapeutic alliance...",
"author": [
{"family": "Benthem", "given": "Patty", "non-dropping-particle": "van"}
],
"issued": {"date-parts": [[2025]]},
"container-title": "European Child & Adolescent Psychiatry",
"DOI": "10.1007/s00787-025-02784-9",
"abstract": "When studying therapeutic alliance...",
"note": "PMID: 40512270"
}
]

text

### **Grille ATN 30 Champs**
Fichier: `grille-ATN.json` (racine projet)

**Champs extraction**:
- ID_étude, Auteurs, Année, Titre, DOI/PMID
- Type_étude, Niveau_preuve_HAS, Pays_contexte
- Type_IA, Plateforme, Instrument_empathie
- Score_empathie_IA, Score_empathie_humain, WAI-SR_modifié
- Confiance_algorithmique, Acceptabilité_patients
- RGPD_conformité, AI_Act_risque, Transparence_algo
- ... (30 champs total)

## 🔧 PARSING ZOTERO CSL JSON

### **Extraction Métadonnées**

def parse_zotero_csl_json(json_path: Path) -> List[Dict]:
with open(json_path, 'r', encoding='utf-8') as f:
zotero_items = json.load(f)

text
for item in zotero_items:
    # Auteurs
    authors = []
    for auth in item.get("author", []):
        family = auth.get("family", "")
        given = auth.get("given", "")
        particle = auth.get("non-dropping-particle", "")
        full_name = f"{particle} {family}, {given}" if particle else f"{family}, {given}"
        authors.append(full_name)
    
    # Année
    issued = item.get("issued", {}).get("date-parts", [[]])
    year = issued if issued else 2024
    
    # PMID (depuis note)
    note = item.get("note", "")
    pmid = note.split("PMID:").split("\n").strip() if "PMID:" in note else ""[4]
    
    article = {
        "title": item.get("title", ""),
        "authors": authors,
        "year": year,
        "abstract": item.get("abstract", "")[:1000],
        "journal": item.get("container-title", ""),
        "doi": item.get("DOI", ""),
        "pmid": pmid,
        "zotero_id": item.get("id", "")
    }
text

## 📁 STRUCTURE FICHIERS PROJET

AnalylitV4.1/
├── 20ATN.json ← Export Zotero 20 articles
├── grille-ATN.json ← Grille extraction 30 champs
├── scripts/
│ └── test_atn_workflow_zotero.py ← Script principal
├── resultats_atn_20_articles/
│ ├── rapport_atn_zotero_YYYYMMDD_HHMMSS.json
│ └── ...
└── backend/
├── server_v4_complete.py
└── api/projects.py

text

## 🚀 WORKFLOW 7 ÉTAPES

1. **Vérification API** → GET `/api/health`
2. **Chargement données** → Parse `20ATN.json` + `grille-ATN.json`
3. **Création projet** → POST `/api/projects` (retourne `{"id": "uuid"}`)
4. **Ajout articles** → POST `/api/projects/{id}/add-manual-articles`
5. **Screening ATN** → POST `/api/projects/{id}/run-screening` (≥70/100)
6. **Extraction 30 champs** → POST `/api/projects/{id}/run-analysis` (type: `atn_extraction`)
7. **Synthèse PRISMA** → POST `/api/projects/{id}/run-analysis` (type: `synthesis`)

## ✅ AVANTAGES ZOTERO CSL JSON

| Avantage | Description |
|----------|-------------|
| **Métadonnées complètes** | Auteurs, abstracts, DOI, PMID déjà structurés |
| **Aucun API externe** | Pas besoin PubMed Entrez, données locales |
| **PDFs disponibles** | Certains articles O.A., chemin Zotero storage |
| **Validation thèse** | Export direct outil bibliographique standard |
| **Reproductibilité** | Fichier JSON versionnable, audit trail complet |

## 🎯 EXÉCUTION

Placement fichiers
cp ~/Downloads/20ATN.json ~/Downloads/Analylit/
cp ~/Downloads/grille-ATN.json ~/Downloads/Analylit/

Lancement
cd ~/Downloads/Analylit
python scripts/test_atn_workflow_zotero.py

text

## 📊 RÉSULTAT ATTENDU

- **20 articles** chargés depuis Zotero
- **Score ATN moyen** 65-80/100 (ATN très pertinent)
- **≥14 articles validés** automatiquement (≥70/100)
- **Grille 30 champs** complétée pour chaque article
- **PRISMA Flow** diagramme généré
- **Export Excel** 5 onglets académiques
- **Durée totale** 12-18 minutes

