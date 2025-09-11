# tests/test_utils.py
import pytest
# Supposons que cette fonction soit dans server_v4_complete.py ou un fichier utils.py
from server_v4_complete import sanitize_filename

@pytest.mark.parametrize("input_string, expected_output", [
    ("Titre: avec/des caractères\\invalides?", "Titre_avec_des_caractères_invalides_"),
    ("Un nom de fichier simple", "Un_nom_de_fichier_simple"),
    ("  espaces   au début et à la fin  ", "espaces_au_début_et_à_la_fin"),
    ("NomAvecAccentséàç", "NomAvecAccentséàç"), # Vérifie que les accents sont conservés
])
def test_sanitize_filename(input_string, expected_output):
    """Teste la fonction de nettoyage des noms de fichiers avec plusieurs cas."""
    assert sanitize_filename(input_string) == expected_output