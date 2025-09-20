# utils/file_handlers.py - Gestionnaires de fichiers
import logging
import re
import os
from pathlib import Path
from typing import Optional
import PyPDF2
import pdfplumber
from utils.app_globals import PROJECTS_DIR

try:
    import pytesseract
    from PIL import Image
except ImportError:
    pytesseract = None

logger = logging.getLogger(__name__)

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

def extract_text_from_pdf(pdf_path: str) -> Optional[str]:
    """Extrait le texte d'un fichier PDF."""
    if not os.path.exists(pdf_path):
        logger.error(f"Fichier PDF non trouvé: {pdf_path}")
        return None
    
    full_text = ""
    try:
        # Essaye d'abord avec pdfplumber (plus robuste)
        with pdfplumber.open(pdf_path) as pdf:
            full_text = "\n".join(page.extract_text() or "" for page in pdf.pages)
                
    except Exception as e:
        logger.warning(f"Erreur pdfplumber pour {pdf_path}: {e}")
    
    if full_text.strip():
        return full_text

    # Si aucun texte n'est trouvé, essayer l'OCR comme solution de repli
    if pytesseract:
        logger.warning(f"Aucun texte extrait pour {pdf_path}. Tentative d'OCR...")
        try:
            with pdfplumber.open(pdf_path) as pdf:
                ocr_text_parts = []
                for i, page in enumerate(pdf.pages):
                    pil_image = page.to_image(resolution=300).original
                    ocr_text_parts.append(pytesseract.image_to_string(pil_image, lang='eng+fra'))
                full_text = "\n".join(filter(None, ocr_text_parts))
        except Exception as ocr_error:
            logger.error(f"Erreur OCR pour {pdf_path}: {ocr_error}")

    if full_text.strip():
        return full_text

    # Fallback avec PyPDF2
    try:
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            text_parts = []
            
            for page in pdf_reader.pages:
                page_text = page.extract_text() or ""
                if page_text:
                    text_parts.append(page_text)
            full_text_pypdf = "\n".join(text_parts)
            if full_text_pypdf.strip():
                return full_text_pypdf
                
    except Exception as e:
        logger.error(f"Erreur PyPDF2 pour {pdf_path}: {e}")
    
    logger.warning(f"Impossible d'extraire le texte de {pdf_path} après toutes les tentatives.")
    return None

def ensure_directory_exists(directory_path: str) -> bool:
    """S'assure qu'un répertoire existe, le crée si nécessaire."""
    try:
        Path(directory_path).mkdir(parents=True, exist_ok=True)
        return True
    except Exception as e:
        logger.error(f"Impossible de créer le répertoire {directory_path}: {e}")
        return False

def get_file_size(file_path: str) -> int:
    """Retourne la taille d'un fichier en bytes."""
    try:
        return os.path.getsize(file_path)
    except Exception as e:
        logger.error(f"Impossible de récupérer la taille de {file_path}: {e}")
        return 0

def is_valid_pdf(file_path: str) -> bool:
    """Vérifie si un fichier est un PDF valide."""
    try:
        with open(file_path, 'rb') as file:
            PyPDF2.PdfReader(file)
        return True
    except Exception:
        return False

def save_file_to_project_dir(file_storage, project_id, filename, projects_dir):
    """Sauvegarde un FileStorage dans le dossier du projet."""
    project_dir = projects_dir / project_id
    project_dir.mkdir(parents=True, exist_ok=True)
    save_path = project_dir / filename
    file_storage.save(str(save_path))
    logger.info(f"Fichier sauvegardé : {save_path}")

# --- CORRECTION: Suppression de la fonction dupliquée ---