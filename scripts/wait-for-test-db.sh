#!/bin/bash
echo "🔍 Attente de la base de données sur test-db:5432..."
while ! pg_isready -h test-db -p 5432 -U analylit_user -d analylit_test_db; do
    echo "   Base de données indisponible - nouvelle tentative dans 2s..."
    sleep 2
done
echo "✅ Base de données prête !"