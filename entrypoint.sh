#!/bin/bash
set -e

echo "🔍 Waiting for database..."
until pg_isready -h db -p 5432 -U ${POSTGRES_USER:-postgres}; do
  echo "Database is unavailable - sleeping"
  sleep 2
done

echo "✅ Database is ready!"

echo "🔄 Running database migrations..."
export FLASK_APP=app
python -m flask db upgrade

echo "🚀 Starting Gunicorn server..."
exec gunicorn --bind 0.0.0.0:5000 --workers 2 --threads 2 "app:create_app()"