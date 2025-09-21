#!/bin/sh

# Attend que la base de données soit accessible
./wait-for-it.sh db:5432 -t 60

# Exécute la création des tables.
# 'flask db init' et 'flask db migrate/upgrade' seraient mieux,
# mais pour l'instant, un simple script Python suffit.
echo "Initialisation de la base de données..."
python -c "from utils.database import init_database; init_database()"
echo "Initialisation terminée."