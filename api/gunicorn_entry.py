# CRITICAL: Perform monkey-patching before any other modules are imported.
# This is the earliest possible point and resolves the MonkeyPatchWarning.
import gevent.monkey
gevent.monkey.patch_all()

print("=== DIAGNOSTIC GUNICORN DÉTAILLÉ ===")

try:
    print("1. Import de create_app...")
    from backend.server_v4_complete import create_app
    print("✅ Import réussi")
    
    print("2. Vérification si create_app est callable...")
    print(f"create_app type: {type(create_app)}")
    print(f"create_app callable: {callable(create_app)}")
    
    print("3. Appel de create_app()...")
    app = create_app()
    print(f"✅ Résultat create_app(): {type(app)} = {app}")
    
    if app is None:
        print("❌ PROBLÈME: create_app() retourne None")
        print("4. Test de create_app avec gestion d'exception...")
        
        # Test avec gestion d'exception explicite
        try:
            app = create_app()
            print("✅ Pas d'exception, mais app est None")
        except Exception as e:
            print(f"❌ Exception dans create_app(): {e}")
            import traceback
            traceback.print_exc()
        
        # Arrêter ici pour éviter la boucle infinie
        import sys
        sys.exit(1)
    else:
        print("✅ Application créée avec succès!")
        
except Exception as e:
    print(f"❌ Erreur fatale: {e}")
    import traceback
    traceback.print_exc()
    import sys
    sys.exit(1)

print("=== FIN DIAGNOSTIC ===")