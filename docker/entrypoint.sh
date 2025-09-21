#!/bin/bash
set -e

echo "🔍 [AnalyLit] Attente de la base de données..."

# Attendre que PostgreSQL soit prêt
max_attempts=30
attempt=1

while [ $attempt -le $max_attempts ]; do
    if pg_isready -h db -p 5432 -U ${POSTGRES_USER:-postgres} >/dev/null 2>&1; then
        echo "✅ [AnalyLit] Base de données prête !"
        break
    fi
    
    if [ $attempt -eq $max_attempts ]; then
        echo "❌ [AnalyLit] Timeout - Base de données inaccessible"
        exit 1
    fi
    
    echo "⏳ [AnalyLit] Tentative $attempt/$max_attempts - Attente..."
    sleep 2
    attempt=$((attempt + 1))
done

# Configurer Flask
export FLASK_APP=app

echo "🔄 [AnalyLit] Application des migrations..."
if ! python -m flask db upgrade; then
    echo "⚠️ [AnalyLit] Échec des migrations - Tentative d'initialisation..."
    python -m flask db init || echo "Base déjà initialisée"
    python -m flask db migrate -m "Initial migration" || echo "Migration déjà présente"
    python -m flask db upgrade
fi

echo "✅ [AnalyLit] Migrations terminées"

echo "🚀 [AnalyLit] Démarrage du serveur Gunicorn..."
exec gunicorn \
    --bind 0.0.0.0:5000 \
    --workers 2 \
    --threads 4 \
    --worker-class gevent \
    --worker-connections 1000 \
    --timeout 120 \
    --keepalive 5 \
    --max-requests 1000 \
    --max-requests-jitter 50 \
    --log-level info \
    "app:create_app()"
