#!/bin/sh

# Fichier de sortie pour les statistiques
OUTPUT_FILE="/output/performance_log_$(date +%Y%m%d_%H%M%S).csv"

# Écrire l'en-tête du fichier CSV
echo "timestamp,container_name,cpu_percent,mem_usage_mb,gpu_percent,gpu_mem_percent" > $OUTPUT_FILE

echo "✅ Démarrage du monitoring des ressources. Logs enregistrés dans $OUTPUT_FILE"
echo "Appuyez sur [CTRL+C] pour arrêter."

# Boucle infinie pour enregistrer les statistiques toutes les 5 secondes
while true; do
  # Obtenir les statistiques CPU et RAM de tous les conteneurs
  docker stats --no-stream --format "{{.Name}},{{.CPUPerc}},{{.MemUsage}}" | while read -r line; do
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo "$TIMESTAMP,$line,N/A,N/A" >> $OUTPUT_FILE
  done

  # Obtenir les statistiques GPU avec nvidia-smi
  # Ceci s'exécute sur l'hôte mais est enregistré comme une statistique globale
  GPU_STATS=$(nvidia-smi --query-gpu=utilization.gpu,utilization.memory --format=csv,noheader,nounits | sed 's/ //g')
  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  echo "$TIMESTAMP,nvidia_gpu,N/A,N/A,$GPU_STATS" >> $OUTPUT_FILE

  sleep 5
done
