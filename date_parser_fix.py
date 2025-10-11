# date_parser_fix.py
import re
from dateutil import parser as date_parser

def improved_date_parsing(date_string):
    """
    Parser amélioré pour gérer les formats de dates non-standards de Zotero
    """
    if not date_string:
        return None
    
    date_string = str(date_string).strip()
    
    # Patterns de dates problématiques spécifiques
    patterns = [
        # Format: "2022 Jun-Jul 01" -> "2022 Jun 01"
        (r'(\d{4})\s+(\w+)-\w+\s+(\d+)', r'\1 \2 \3'),
        # Format: "Jun-Jul 2022" -> "Jun 2022"
        (r'(\w+)-\w+\s+(\d{4})', r'\1 \2'),
        # Format: "2022 Jun-Jul" -> "2022 Jun"
        (r'(\d{4})\s+(\w+)-\w+', r'\1 \2'),
    ]
    
    # Appliquer les corrections
    for pattern, replacement in patterns:
        date_string = re.sub(pattern, replacement, date_string)
    
    try:
        # Essayer le parsing standard
        parsed_date = date_parser.parse(date_string, fuzzy=True)
        return parsed_date.year
    except:
        # Extraction brutale de l'année si tout échoue
        year_match = re.search(r'\b(19|20)\d{2}\b', date_string)
        if year_match:
            return int(year_match.group())
        
        return None
