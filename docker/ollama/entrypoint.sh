#!/bin/sh
# Lancer le serveur Ollama en arrière-plan
ollama serve &
# Capturer le PID du processus serveur
pid=$!
# Garder le conteneur en vie en attendant la fin du processus
wait $pid
