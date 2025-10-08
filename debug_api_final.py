#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DEBUG FINAL ATN - PROBLÈME DE PARSING JSON IDENTIFIÉ
"""

import requests
import json

# Test debug détaillé
def debug_api_exact():
    """Debug exact du problème de parsing."""
    url = "http://localhost:5000/api/health"

    print("🔍 TEST DEBUG DÉTAILLÉ")
    print(f"URL: {url}")
    print("")

    try:
        resp = requests.get(url, timeout=10)
        print(f"Status Code: {resp.status_code}")
        print(f"Headers: {dict(resp.headers)}")
        print(f"Raw Content: {resp.content}")
        print(f"Text: {resp.text}")

        # Test parsing JSON
        try:
            json_data = resp.json()
            print(f"JSON OK: {json_data}")
            return True
        except Exception as json_error:
            print(f"❌ ERREUR JSON: {json_error}")
            print(f"Type erreur: {type(json_error)}")
            return False

    except Exception as e:
        print(f"❌ ERREUR CONNEXION: {e}")
        return False

# Test maintenant
if __name__ == "__main__":
    debug_api_exact()
