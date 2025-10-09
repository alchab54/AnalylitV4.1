#!/bin/sh
echo "🚀 Starting Ollama server in background..."
ollama serve &
pid=$!

echo "⏳ Waiting for Ollama server to be ready..."
until curl -s http://127.0.0.1:11434/ > /dev/null; do
  sleep 2
done

echo "✅ Ollama server is ready. Checking models..."

# Vérifier si les modèles existent déjà
if ollama list | grep -q "phi3:mini"; then
  echo "   ✅ phi3:mini already available."
else
  echo "   📥 Downloading phi3:mini..."
  ollama pull phi3:mini
fi

if ollama list | grep -q "llama3:8b"; then
  echo "   ✅ llama3:8b already available."
else
  echo "   📥 Downloading llama3:8b..."
  ollama pull llama3:8b
fi

echo "🎯 Ollama is fully configured and ready for ATN analysis!"
wait $pid
