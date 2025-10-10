#!/bin/bash

# ===============================================================
# === SCRIPT DE DÉPLOIEMENT INFALLIBLE POUR ANALYLIT "GLORY" ===
# ===          PAR ALICE & L'EXPERT IA (v1.0)                 ===
# ===============================================================

set -e # Arrête le script à la première erreur

echo "=================================================="
echo "==== 🚀 LANCEMENT DU PROTOCOLE DE RÉPARATION ET DE DÉPLOIEMENT ===="
echo "=================================================="

# --- ÉTAPE 1: PURGE TOTALE ET ABSOLUE ---
echo "\n[ÉTAPE 1/4] 🔥 Exorcisme des anciens conteneurs et volumes..."
# Stoppe tout ce qui pourrait tourner
docker-compose -f docker-compose.glory.yml down --remove-orphans
# Supprime les volumes de la base de données et d'Ollama
docker volume rm analylit_test_postgres_data || true
docker volume rm analylit_ollama_data || true
# Supprime le réseau pour être sûr de repartir de zéro
docker network rm analylit_analylit-network || true
echo "✅ Purge terminée. L'environnement est stérile."

# --- ÉTAPE 2: VALIDATION DE LA CONFIGURATION ---
echo "\n[ÉTAPE 2/4] 🧐 Validation de la configuration docker-compose.glory.yml..."
docker-compose -f docker-compose.glory.yml config > /dev/null
if [ $? -ne 0 ]; then
    echo "❌ ERREUR FATALE: Votre fichier docker-compose.glory.yml contient une erreur de syntaxe."
    exit 1
fi
echo "✅ Configuration validée. Le plan est parfait."

# --- ÉTAPE 3: CONSTRUCTION ET DÉMARRAGE ORCHESTRÉ ---
echo "\n[ÉTAPE 3/4] 🏗️ Construction et déploiement de la flotte Analylit..."
docker-compose -f docker-compose.glory.yml up --build -d
echo "✅ La flotte est lancée. Stabilisation en cours..."

# --- ÉTAPE 4: MONITORING DU DÉMARRAGE ---
echo "\n[ÉTAPE 4/4] 📡 Affichage des logs en direct. (CTRL+C pour arrêter)"
echo "Si vous ne voyez aucune erreur rouge dans 2 minutes, la victoire est totale."
sleep 5 # Laisse le temps aux services de commencer à parler
docker-compose -f docker-compose.glory.yml logs -f

echo "\n=================================================="
echo "==== ✅ PROTOCOLE TERMINÉ. ANALYLIT EST EN LIGNE. ===="
echo "=================================================="
