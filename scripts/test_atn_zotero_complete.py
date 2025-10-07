#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script ATN Complet - Import et Traitement Articles Zotero
Architecture AnalyLit v4.2 RTX 2060 SUPER
"""

import os
import sys
import json
import csv
import requests
import time
import shutil
from pathlib import Path
from urllib.parse import urlparse
import logging
from datetime import datetime

# Configuration
ZOTERO_STORAGE_PATH = r"C:\Users\alich\Zotero\storage"
API_BASE = "http://localhost:8080"
GRILLE_ATN_PATH = "grille-ATN.json"

# Articles Zotero fournis
ARTICLES_ZOTERO = [
    {
        "key": "NQNKTNHL",
        "title": "Clinicians' Attitudes Toward Telepsychology in Addiction and Mental Health Services, and Prediction of Postpandemic Telepsychology Uptake",
        "authors": "Zentner, Kristen; Gaine, Graham; Ethridge, Paige; Surood, Shireen; Abba-Aji, Adam",
        "year": 2022,
        "doi": "10.2196/35535",
        "pmid": "35559793",
        "journal": "JMIR formative research",
        "abstract": "BACKGROUND: The COVID-19 pandemic has resulted in unprecedented uptake of telepsychology services...",
        "pdf_path": "MR3X42KU",
        "url": "http://www.ncbi.nlm.nih.gov/pubmed/35559793",
        "tags": ["mental health", "therapeutic alliance", "clinician attitude", "telepsychology", "unified theory of acceptance and use of technology"]
    },
    {
        "key": "IQ7RGLVV", 
        "title": "Perceptions of Telemental Health Care Delivery During COVID-19: A Cross-Sectional Study With Providers, February-March 2021",
        "authors": "Wilczewski, Hattie; Paige, Samantha R.; Ong, Triton; Barrera, Janelle F.; Soni, Hiral; Welch, Brandon M.; Bunnell, Brian E.",
        "year": 2022,
        "doi": "10.3389/fpsyt.2022.855138",
        "pmid": "35444579",
        "journal": "Frontiers in Psychiatry",
        "abstract": "The COVID-19 pandemic accelerated adoption of telemental health (TMH)...",
        "pdf_path": "U5E6KKUA",
        "url": "http://www.ncbi.nlm.nih.gov/pubmed/35444579",
        "tags": ["mental health", "COVID-19", "quality of care", "telemedicine", "telemental health"]
    },
    {
        "key": "BAZAU2AM",
        "title": "Examining the Impact of Digital Components Across Different Phases of Treatment in a Blended Care Cognitive Behavioral Therapy Intervention for Depression and Anxiety",
        "authors": "Wu, Monica S.; Wickham, Robert E.; Chen, Shih-Yin; Chen, Connie; Lungu, Anita",
        "year": 2021,
        "doi": "10.2196/33452", 
        "pmid": "34927591",
        "journal": "JMIR formative research",
        "abstract": "BACKGROUND: Depression and anxiety incur significant personal and societal costs...",
        "pdf_path": "CPGZYEKW",
        "url": "http://www.ncbi.nlm.nih.gov/pubmed/34927591",
        "tags": ["mental health", "depression", "digital health", "anxiety", "blended care", "cognitive-behavioral therapy", "digital", "digital therapy", "phase"]
    },
    {
        "key": "QJTQKZYG",
        "title": "Communicating With Parents and Preschool Children: A Qualitative Exploration of Dental Professional-Parent-Child Interactions During Paediatric Dental Consultations to Prevent Early Childhood Caries",
        "authors": "Yuan, Siyang; Humphris, Gerry; MacPherson, Lorna M. D.; Ross, Alistair L.; Freeman, Ruth",
        "year": 2021,
        "doi": "10.3389/fpubh.2021.669395",
        "pmid": "34055728",
        "journal": "Frontiers in Public Health",
        "abstract": "The aim of this study was to explore communication interactions...",
        "pdf_path": "P4KVG8HN",
        "url": "http://www.ncbi.nlm.nih.gov/pubmed/34055728", 
        "tags": ["communication", "Parent-Child Relations", "Dental Cares", "paedodontics", "conversational analysis approach"]
    },
    {
        "key": "GPF6TB99",
        "title": "Dental care of patients exposed to sexual abuse: Need for alliance between staff and patients",
        "authors": "Wolf, Eva; Grinneby, David; Nilsson, Petra; Priebe, Gisela",
        "year": 2021,
        "doi": "10.1111/eos.12782",
        "pmid": "33760322",
        "journal": "European Journal of Oral Sciences",
        "abstract": "The aim was to explore the experiences of sexually abused individuals as dental patients...",
        "pdf_path": "3GDRUN6M",
        "url": "http://www.ncbi.nlm.nih.gov/pubmed/33760322",
        "tags": ["dental fear", "dissociation", "patient-centered", "power", "sexual abuse disclosure"]
    }
]

class ATNZoteroProcessor:
    def __init__(self):
        self.logger = self.setup_logging()
        self.grille_atn = self.load_grille_atn()
        self.session = requests.Session()
        self.session.timeout = 30
        
    def setup_logging(self):
        """Configuration du logging"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.StreamHandler(),
                logging.FileHandler(f'atn_zotero_processing_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log')
            ]
        )
        return logging.getLogger(__name__)
    
    def load_grille_atn(self):
        """Charger la grille d'extraction ATN"""
        try:
            with open(GRILLE_ATN_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            self.logger.error(f"Grille ATN non trouvée: {GRILLE_ATN_PATH}")
            return {"name": "Grille ATN", "fields": []}
    
    def create_atn_project(self):
        """Créer un projet ATN spécialisé"""
        project_data = {
            "name": f"ATN Zotero Import - {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            "description": "Import et analyse automatisé d'articles Zotero avec grille ATN - RTX 2060 SUPER",
            "analysis_profile": "atn-specialized",
            "search_query": "Alliance Thérapeutique Numérique digital health therapeutic alliance",
            "databases_used": ["pubmed", "zotero_import"]
        }
        
        try:
            response = self.session.post(f"{API_BASE}/api/projects", json=project_data)
            if response.status_code == 201:
                project = response.json()
                self.logger.info(f"Projet ATN créé: {project.get('id')}")
                return project.get('id')
            else:
                self.logger.error(f"Erreur création projet: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            self.logger.error(f"Erreur connexion API: {e}")
            return None
    
    def find_pdf_file(self, article):
        """Chercher le fichier PDF dans le storage Zotero"""
        pdf_folder = Path(ZOTERO_STORAGE_PATH) / article["pdf_path"]
        
        if not pdf_folder.exists():
            self.logger.warning(f"Dossier Zotero non trouvé: {pdf_folder}")
            return None
            
        # Chercher fichiers PDF
        pdf_files = list(pdf_folder.glob("*.pdf"))
        if pdf_files:
            return str(pdf_files[0])
        
        self.logger.warning(f"Aucun PDF trouvé dans {pdf_folder}")
        return None
    
    def download_pdf_from_url(self, article, output_dir):
        """Télécharger PDF depuis URL si disponible"""
        try:
            # Essayer différentes URLs
            urls_to_try = []
            
            if article.get("pmid"):
                urls_to_try.extend([
                    f"https://www.ncbi.nlm.nih.gov/pmc/articles/PMC{article['pmid']}/pdf/",
                    f"https://europepmc.org/articles/PMC{article['pmid']}?pdf=render",
                ])
                
            if article.get("doi"):
                urls_to_try.append(f"https://doi.org/{article['doi']}")
            
            if article.get("url"):
                urls_to_try.append(article["url"])
            
            for url in urls_to_try:
                try:
                    self.logger.info(f"Tentative téléchargement: {url}")
                    response = self.session.get(url, headers={
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    })
                    
                    if response.status_code == 200 and 'pdf' in response.headers.get('content-type', '').lower():
                        filename = f"{article['key']}_{article['year']}.pdf"
                        filepath = Path(output_dir) / filename
                        
                        with open(filepath, 'wb') as f:
                            f.write(response.content)
                        
                        self.logger.info(f"PDF téléchargé: {filepath}")
                        return str(filepath)
                        
                except Exception as e:
                    self.logger.debug(f"Échec téléchargement {url}: {e}")
                    continue
            
            return None
            
        except Exception as e:
            self.logger.error(f"Erreur téléchargement PDF: {e}")
            return None
    
    def calculate_atn_relevance_score(self, article):
        """Calculer score de pertinence ATN spécialisé"""
        score = 0
        max_score = 100
        
        # Mots-clés ATN prioritaires
        atn_keywords = [
            "therapeutic alliance", "alliance thérapeutique", "digital health",
            "digital therapeutic", "digital therapy", "telemedicine", "telehealth", 
            "patient-centered", "empathy", "trust", "acceptance", "technology acceptance",
            "human-computer interaction", "AI healthcare", "therapeutic relationship",
            "digital intervention", "blended care", "hybrid care"
        ]
        
        # Analyse titre (30 points)
        title_lower = article.get("title", "").lower()
        for keyword in atn_keywords:
            if keyword in title_lower:
                score += 5
                
        # Analyse abstract (40 points) 
        abstract_lower = article.get("abstract", "").lower()
        for keyword in atn_keywords:
            if keyword in abstract_lower:
                score += 3
                
        # Analyse tags (20 points)
        tags_text = " ".join(article.get("tags", [])).lower()
        for keyword in atn_keywords:
            if keyword in tags_text:
                score += 2
        
        # Année récente (10 points)
        year = article.get("year", 2000)
        if year >= 2020:
            score += 10
        elif year >= 2018:
            score += 5
            
        # Normaliser sur 100
        final_score = min(100, score)
        
        # Catégories ATN
        if final_score >= 70:
            category = "Très pertinent ATN"
        elif final_score >= 50:
            category = "Pertinent ATN"
        elif final_score >= 30:
            category = "Modérément pertinent"
        else:
            category = "Peu pertinent ATN"
            
        return {
            "score": final_score,
            "category": category,
            "keywords_found": score
        }
    
    def extract_atn_fields(self, article, pdf_path=None):
        """Extraction selon grille ATN JSON"""
        extraction = {}
        
        # Champs de base
        extraction["ID_étude"] = article.get("key", "")
        extraction["Auteurs"] = article.get("authors", "")
        extraction["Année"] = article.get("year", "")
        extraction["Titre"] = article.get("title", "")
        extraction["DOI/PMID"] = f"{article.get('doi', '')}/{article.get('pmid', '')}"
        extraction["Type_étude"] = "Non défini"  # Nécessite analyse IA
        extraction["Pays_contexte"] = "Non défini"  # Nécessite analyse IA
        extraction["Population_cible"] = "Non définie"  # Nécessite analyse IA
        
        # Analyse ATN spécialisée
        tags_text = " ".join(article.get("tags", [])).lower()
        abstract_text = article.get("abstract", "").lower()
        
        # Type IA détecté
        if any(term in abstract_text for term in ["ai", "artificial intelligence", "machine learning"]):
            extraction["Type_IA"] = "IA détectée"
        elif any(term in abstract_text for term in ["digital", "telemedicine", "telehealth"]):
            extraction["Type_IA"] = "Santé numérique"
        else:
            extraction["Type_IA"] = "Non défini"
            
        # Plateforme détectée
        if any(term in abstract_text for term in ["app", "mobile", "platform", "web"]):
            extraction["Plateforme"] = "Plateforme numérique"
        else:
            extraction["Plateforme"] = "Non définie"
            
        # Alliance thérapeutique
        if "therapeutic alliance" in abstract_text or "alliance" in tags_text:
            extraction["WAI-SR_modifié"] = "Alliance thérapeutique mentionnée"
        else:
            extraction["WAI-SR_modifié"] = "Non mentionné"
            
        # Acceptabilité patients
        if any(term in abstract_text for term in ["patient acceptance", "patient satisfaction", "acceptability"]):
            extraction["Acceptabilité_patients"] = "Mentionnée"
        else:
            extraction["Acceptabilité_patients"] = "Non mentionnée"
            
        # Considérations éthiques
        if any(term in abstract_text for term in ["ethical", "privacy", "confidentiality", "consent"]):
            extraction["Considération_éthique"] = "Mentionnées"
        else:
            extraction["Considération_éthique"] = "Non mentionnées"
            
        # PDF disponible
        extraction["PDF_disponible"] = "Oui" if pdf_path else "Non"
        extraction["Source_PDF"] = pdf_path if pdf_path else "Indisponible"
        
        return extraction
    
    def save_results(self, project_id, articles_data):
        """Sauvegarder résultats ATN"""
        results = {
            "project_id": project_id,
            "timestamp": datetime.now().isoformat(),
            "grille_atn_version": self.grille_atn.get("name", "ATN v1.0"),
            "articles_traites": len(articles_data),
            "articles": articles_data
        }
        
        filename = f"resultats_atn_zotero_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
            
        self.logger.info(f"Résultats sauvegardés: {filename}")
        return filename
    
    def process_all_articles(self):
        """Traitement complet des articles ATN"""
        self.logger.info("🚀 DÉMARRAGE TRAITEMENT ATN ZOTERO - RTX 2060 SUPER")
        
        # 1. Créer projet ATN
        project_id = self.create_atn_project()
        if not project_id:
            self.logger.error("❌ Impossible de créer le projet ATN")
            return False
            
        # 2. Créer dossier de sortie
        output_dir = Path(f"atn_articles_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
        output_dir.mkdir(exist_ok=True)
        
        articles_data = []
        
        # 3. Traiter chaque article
        for idx, article in enumerate(ARTICLES_ZOTERO, 1):
            self.logger.info(f"\n📄 Article {idx}/{len(ARTICLES_ZOTERO)}: {article['key']}")
            
            # Chercher PDF local
            pdf_path = self.find_pdf_file(article)
            
            # Sinon télécharger
            if not pdf_path:
                pdf_path = self.download_pdf_from_url(article, output_dir)
            
            # Calculer score ATN
            relevance = self.calculate_atn_relevance_score(article)
            self.logger.info(f"Score ATN: {relevance['score']}/100 - {relevance['category']}")
            
            # Extraction ATN
            extraction_atn = self.extract_atn_fields(article, pdf_path)
            
            # Consolidation données
            article_data = {
                "metadata": article,
                "relevance_atn": relevance,
                "extraction_atn": extraction_atn,
                "pdf_path": pdf_path,
                "processed_at": datetime.now().isoformat()
            }
            
            articles_data.append(article_data)
            
            # Pause entre articles
            time.sleep(2)
            
        # 4. Sauvegarde résultats
        results_file = self.save_results(project_id, articles_data)
        
        # 5. Résumé final
        self.logger.info("\n🎊 TRAITEMENT ATN TERMINÉ!")
        self.logger.info(f"Articles traités: {len(articles_data)}")
        self.logger.info(f"Projet AnalyLit: {project_id}")
        self.logger.info(f"Résultats: {results_file}")
        
        # Statistiques ATN
        scores = [a["relevance_atn"]["score"] for a in articles_data]
        avg_score = sum(scores) / len(scores) if scores else 0
        
        pertinents = [a for a in articles_data if a["relevance_atn"]["score"] >= 50]
        
        self.logger.info(f"Score ATN moyen: {avg_score:.1f}/100")
        self.logger.info(f"Articles pertinents ATN: {len(pertinents)}/{len(articles_data)}")
        
        return True

def main():
    """Fonction principale"""
    processor = ATNZoteroProcessor()
    
    try:
        success = processor.process_all_articles()
        sys.exit(0 if success else 1)
        
    except KeyboardInterrupt:
        print("\n⏹️  Traitement interrompu par l'utilisateur")
        sys.exit(1)
        
    except Exception as e:
        print(f"❌ Erreur inattendue: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
