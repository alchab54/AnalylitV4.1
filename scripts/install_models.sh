#!/bin/bash
# Installation optimisée pour RTX 2060 SUPER

echo "🚀 Installation des modèles AnalyLit v4.1..."

# Modèles essentiels (rapides)
docker exec analylit_ollama ollama pull llama3.2:3b        # ~2GB
docker exec analylit_ollama ollama pull tinyllama:1.1b     # ~637MB
docker exec analylit_ollama ollama pull mistral:7b-instruct # ~4.1GB

# Modèle principal (déjà dans .env)
docker exec analylit_ollama ollama pull llama3:8b          # ~4.7GB

# Modèles quantifiés haute performance
docker exec analylit_ollama ollama pull llama3.1:8b-instruct-q4_0  # ~4.6GB
docker exec analylit_ollama ollama pull qwen2:7b           # ~4.4GB

echo "✅ Installation terminée ! 6 modèles disponibles"
echo "🎯 Modèle par défaut: llama3:8b (configuré dans .env)"

# Tester le modèle principal
docker exec analylit_ollama ollama run llama3:8b "Bonjour, peux-tu résumer un article scientifique ?"