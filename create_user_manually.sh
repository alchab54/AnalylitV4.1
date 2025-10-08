#!/bin/bash
# CRÉATION MANUELLE UTILISATEUR POSTGRESQL

echo "🔧 CRÉATION MANUELLE UTILISATEUR ANALYLITUSER"
echo "============================================="

echo "🔄 Étape 1: Connexion en tant que superuser système..."
docker-compose -f docker-compose.dev.yml exec test-db createuser -s analylituser 2>/dev/null || echo "Utilisateur existe déjà ou erreur"

echo "🔄 Étape 2: Création base de données..."  
docker-compose -f docker-compose.dev.yml exec test-db createdb -O analylituser analylittestdb 2>/dev/null || echo "Base existe déjà ou erreur"

echo "🔄 Étape 3: Test connexion finale..."
docker-compose -f docker-compose.dev.yml exec test-db psql -U analylituser -d analylittestdb -c "
-- Création de l'utilisateur avec mot de passe si nécessaire
CREATE USER analylituser WITH SUPERUSER PASSWORD 'strongpassword';
-- Ou modification si existe
ALTER USER analylituser WITH SUPERUSER PASSWORD 'strongpassword';
"

echo ""
echo "🔄 Étape 4: Validation utilisateur créé..."
docker-compose -f docker-compose.dev.yml exec test-db psql -U analylituser -d analylittestdb -c "SELECT current_user, version();"

echo ""
echo "✅ UTILISATEUR MANUALLY CRÉÉ"
echo "🚀 Tenter ensuite: bash migration_finale_atn.sh"
