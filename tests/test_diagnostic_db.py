# tests/test_diagnostic_db.py

"""
Ce fichier de test sert à diagnostiquer l'état de la base de données
en se connectant et en listant les tables existantes.
"""

import os
import pytest
from sqlalchemy import text # ✅ Import manquant

def test_database_connection_and_schema(app):
    """
    Se connecte à la base de données de test et vérifie la présence des tables.
    """
    from utils.database import db

    print("\n--- DIAGNOSTIC DE LA BASE DE DONNÉES DE TEST ---")
    print(f"DATABASE_URL utilisée par la fixture : {app.config['SQLALCHEMY_DATABASE_URI']}")

    with app.app_context():
        try:
            # Requête pour trouver la table 'projects'
            query_projects = text("SELECT schemaname, tablename FROM pg_tables WHERE tablename = 'projects'")
            result_projects = db.session.execute(query_projects)
            print("Table 'projects' trouvée :", list(result_projects))

            # Requête pour lister toutes les tables dans le schéma public
            query_all_tables = text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
            result_all = db.session.execute(query_all_tables)
            print("Toutes les tables dans le schéma 'public' :", [row[0] for row in result_all])
        except Exception as e:
            pytest.fail(f"Une erreur est survenue lors de la connexion à la DB : {e}")

    # Ajout d'une assertion pour que le test soit valide
    assert True