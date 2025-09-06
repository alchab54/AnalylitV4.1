# utils/file_handlers.py - Gestionnaires de fichiers
import logging
import re
import os
from pathlib import Path
from typing import Optional
import PyPDF2
import pdfplumber

logger = logging.getLogger(__name__)

def sanitize_filename(filename: str) -> str:
    """Nettoie un nom de fichier pour le système de fichiers."""
    # Remplace les caractères interdits par des underscores
    sanitized = re.sub(r'[<>:"/\\|?*]', '_', filename)
    # Supprime les espaces en début/fin
    sanitized = sanitized.strip()
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
    
    try:
        # Essaye d'abord avec pdfplumber (plus robuste)
        with pdfplumber.open(pdf_path) as pdf:
            text_parts = []
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
            
            full_text = "\n".join(text_parts)
            if full_text.strip():
                return full_text
                
    except Exception as e:
        logger.warning(f"Erreur pdfplumber pour {pdf_path}: {e}")
    
    try:
        # Fallback avec PyPDF2
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            text_parts = []
            
            for page in pdf_reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
            
            full_text = "\n".join(text_parts)
            if full_text.strip():
                return full_text
                
    except Exception as e:
        logger.error(f"Erreur PyPDF2 pour {pdf_path}: {e}")
    
    logger.error(f"Impossible d'extraire le texte de {pdf_path}")
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