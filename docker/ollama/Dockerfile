# Chemin du fichier : /docker/ollama/Dockerfile

# Partir de l'image officielle Ollama
FROM ollama/ollama:latest

# Copier le script d'entrée qui lance le serveur
COPY ./entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# --- LA CORRECTION DE LA VICTOIRE FINALE ---
# Pendant la construction de l'image (build), télécharger les modèles requis.
# Ils seront ainsi "cuits" dans l'image et disponibles dès le démarrage.
RUN ollama pull phi3:mini
RUN ollama pull llama3:8b

# Le point d'entrée du conteneur sera notre script personnalisé
ENTRYPOINT ["/entrypoint.sh"]

