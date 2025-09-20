# utils/file_handlers.py - Gestionnaires de fichiers
import logging
import re
from pathlib import Path
from typing import Optional

# --- NOUVELLES IMPORTATIONS POUR L'EXTRACTION ROBUSTE ---
import fitz  # PyMuPDF
import pdfplumber
try:
    from PIL import Image
    from pdf2image import convert_from_path
    import pytesseract
except ImportError:
    pytesseract = None
    Image = None
    convert_from_path = None
# --- FIN DES NOUVELLES IMPORTATIONS ---

# (Supposons que vous avez vos autres importations ici, ex: get_upload_folder)
# from config_v4 import Config 

logger = logging.getLogger(__name__)

# --- FONCTION MANQUANTE À AJOUTER ICI ---
def ensure_directory_exists(path: str | Path):
    """Crée un répertoire s'il n'existe pas."""
    if isinstance(path, str):
        path = Path(path)
    path.mkdir(parents=True, exist_ok=True)
# --- FIN DE L'AJOUT ---

def sanitize_filename(filename: str) -> str:
    """Nettoie un nom de fichier pour le système de fichiers."""
    # Remplace les caractères interdits par des underscores
    # Remplace les caractères interdits et les espaces par des underscores
    sanitized = re.sub(r'[<>:"/\\|?*\s]+', '_', filename)
    # Supprime les underscores en début/fin
    sanitized = sanitized.strip('_')
    # Limite la longueur
    if len(sanitized) > 200:
        sanitized = sanitized[:200]
    # Évite les noms vides
    if not sanitized:
        sanitized = "unnamed_file"
    
    return sanitized

# Seuil minimal de caractères pour considérer une extraction "texte" comme réussie.
# En dessous, nous soupçonnons un PDF scanné et passons à l'OCR.
MIN_TEXT_LENGTH_THRESHOLD = 250 

def _clean_text(text: str) -> str:
    """
    Nettoie le texte extrait pour le RAG.
    - Supprime les ligatures courantes mal interprétées.
    - Normalise les espaces et les sauts de ligne.
    - Supprime les en-têtes/pieds de page répétitifs (basique).
    """
    if not text:
        return ""

    # Correction des ligatures et césures courantes
    text = re.sub(r'(\w)-\s*\n\s*(\w)', r'\1\2', text) # Retrait césure
    text = re.sub(r'\s*ﬁ\s*', 'fi', text)
    text = re.sub(r'\s*ﬂ\s*', 'fl', text)
    
    # Normalisation des espaces
    text = re.sub(r'[ \t]+', ' ', text) # Espaces multiples
    text = re.sub(r'\n[ \t\n]*\n', '\n\n', text) # Lignes vides multiples -> max 2
    text = re.sub(r'(\w)\n(\w)', r'\1 \2', text) # Ligne coupée au milieu d'une phrase

    # (Optionnel - basique) Tenter de supprimer les numéros de page
    text = re.sub(r'\n\s*\d+\s*\n', '\n', text, flags=re.MULTILINE)

    return text.strip()


def _extract_text_with_pymupdf(pdf_path: Path) -> Optional[str]:
    """Méthode 1: Rapide et efficace (PyMuPDF)."""
    try:
        with fitz.open(pdf_path) as doc:
            if doc.is_encrypted:
                logger.warning(f"PDF {pdf_path.name} crypté, tentative de déverrouillage.")
                if not doc.authenticate(""):
                    logger.error(f"Échec de l'authentification pour le PDF {pdf_path.name}.")
                    return None
            
            text = ""
            for page in doc:
                text += page.get_text("text") + "\n\n"
        
        logger.info(f"PyMuPDF: Extraction réussie pour {pdf_path.name} (len: {len(text)})")
        return text
    except Exception as e:
        logger.warning(f"PyMuPDF a échoué pour {pdf_path.name}: {e}")
        return None


def _extract_text_with_pdfplumber(pdf_path: Path) -> Optional[str]:
    """Méthode 2: Plus lente, meilleure analyse de layout."""
    try:
        text = ""
        with pdfplumber.open(pdf_path) as pdf:
            if pdf.is_encrypted:
                logger.warning(f"PDFPlumber: {pdf_path.name} crypté, tentative.")
                try:
                    pdf.open(password="")
                except Exception:
                     logger.error(f"Échec de l'authentification (Plumber) pour {pdf_path.name}.")
                     return None
            
            for page in pdf.pages:
                page_text = page.extract_text(
                    x_tolerance=2, # Tolérance pour aligner les mots
                    keep_blank_chars=False,
                    use_text_flow=True, # Tente de respecter l'ordre de lecture
                    layout=True # Utilise l'analyse de layout
                )
                if page_text:
                    text += page_text + "\n\n"
        
        logger.info(f"PDFPlumber: Extraction réussie pour {pdf_path.name} (len: {len(text)})")
        return text
    except Exception as e:
        logger.warning(f"PDFPlumber a échoué pour {pdf_path.name}: {e}")
        return None


def _extract_text_with_ocr(pdf_path: Path) -> Optional[str]:
    """Méthode 3: OCR pour les PDF scannés (Tesseract)."""
    if not pytesseract or not convert_from_path:
        logger.warning("OCR non disponible (pytesseract ou pdf2image non importé).")
        return None

    logger.info(f"Passage à l'OCR Tesseract pour {pdf_path.name}...")
    try:
        # Utilise poppler-utils (dépendance système)
        images = convert_from_path(pdf_path, dpi=300)
        text = ""
        for i, img in enumerate(images):
            try:
                # Tente d'extraire en français + anglais (pour les termes techniques)
                page_text = pytesseract.image_to_string(img, lang='fra+eng')
                text += page_text + "\n\n"
                logger.debug(f"OCR: Page {i+1}/{len(images)} extraite.")
            except pytesseract.TesseractNotFoundError:
                logger.error("ERREUR CRITIQUE: Tesseract OCR n'est pas installé ou pas dans le PATH.")
                return "Erreur: Tesseract OCR non configuré sur le serveur."
            except Exception as e:
                logger.warning(f"OCR: Échec sur la page {i+1} de {pdf_path.name}: {e}")
        
        logger.info(f"OCR: Extraction terminée pour {pdf_path.name} (len: {len(text)})")
        return text
    except Exception as e:
        logger.error(f"OCR (pdf2image) a échoué pour {pdf_path.name}: {e}")
        return None


def extract_text_from_pdf(pdf_path: str) -> str:
    """
    Extrait le texte brut d'un fichier PDF en utilisant une stratégie
    de fallback robuste (PyMuPDF -> PDFPlumber -> OCR).
    """
    file_path = Path(pdf_path)
    if not file_path.exists():
        logger.error(f"Fichier PDF introuvable: {pdf_path}")
        return ""

    text = ""
    
    # --- 1. Essai avec PyMuPDF (fitz) ---
    text = _extract_text_with_pymupdf(file_path)
    
    if text and len(text) > MIN_TEXT_LENGTH_THRESHOLD:
        logger.info(f"Stratégie 1 (PyMuPDF) réussie pour {file_path.name}.")
        return _clean_text(text)
        
    logger.warning(f"PyMuPDF a renvoyé peu de texte ({len(text) if text else 0} chars). Essai avec PDFPlumber.")

    # --- 2. Essai avec PDFPlumber ---
    text = _extract_text_with_pdfplumber(file_path)
    
    if text and len(text) > MIN_TEXT_LENGTH_THRESHOLD:
        logger.info(f"Stratégie 2 (PDFPlumber) réussie pour {file_path.name}.")
        return _clean_text(text)

    logger.warning(f"PDFPlumber a aussi renvoyé peu de texte ({len(text) if text else 0} chars). Passage à l'OCR.")

    # --- 3. Essai avec OCR (Tesseract) ---
    text = _extract_text_with_ocr(file_path)
    
    if text and len(text) > 0:
        logger.info(f"Stratégie 3 (OCR) réussie pour {file_path.name}.")
        return _clean_text(text)

    logger.error(f"ÉCHEC TOTAL de l'extraction pour {file_path.name}. Aucune méthode n'a fonctionné.")
    return ""

def save_file_to_project_dir(file_storage, project_id, filename, projects_dir):
    """Sauvegarde un FileStorage dans le dossier du projet."""
    project_dir = projects_dir / project_id
    # Utiliser la fonction dédiée
    ensure_directory_exists(project_dir) 
    save_path = project_dir / filename
    file_storage.save(str(save_path))
    logger.info(f"Fichier sauvegardé : {save_path}")

# --- CORRECTION: Suppression de la fonction dupliquée ---