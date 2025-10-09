#!/bin/sh

# Lance le serveur Ollama en arrière-plan pour que le script puisse continuer
echo "Starting Ollama server in background..."
ollama serve &

# Capture le PID (Process ID) du serveur pour le gérer plus tard
pid=$!

# Boucle d'attente : le script attend que le serveur soit réellement prêt
echo "Waiting for Ollama server to be ready..."
until curl -s http://127.0.0.1:11434/ > /dev/null; do
  echo "Ollama server is not ready yet, waiting 1 second..."
  sleep 1
done
echo "✅ Ollama server is ready."

# Maintenant que le serveur est prêt, on télécharge les modèles
echo "Pulling required models (phi3:mini and llama3:8b)..."
ollama pull phi3:mini
ollama pull llama3:8b
echo "✅ Models are ready."

# Ramène le processus du serveur au premier plan.
# Le conteneur restera en vie tant que le serveur tournera.
echo "Ollama is fully configured. Server is running."
wait $pid
