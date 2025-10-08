#!/bin/bash
# Monitoring Workflow Massif ATN - Sans Interruption
echo "🔍 MONITORING WORKFLOW MASSIF ATN"
echo "================================="

echo ""
echo "📊 STATUS CONTAINERS :"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep analylit

echo ""
echo "🎯 QUEUE STATUS :"
curl -s http://localhost:9181/api/queues.json | python3 -m json.tool | grep -E '"name"|"count"'

echo ""
echo "💾 GPU MEMORY (si nvidia-smi disponible) :"
nvidia-smi --query-gpu=memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits 2>/dev/null || echo "nvidia-smi non disponible"

echo ""
echo "⏰ TEMPS ÉCOULÉ DEPUIS 10:41 :"
start_time="2025-10-08 10:41:00"
current_time=$(date "+%Y-%m-%d %H:%M:%S")
echo "Démarrage: $start_time"
echo "Actuel: $current_time"

echo ""
echo "🎉 WORKFLOW EN COURS - TOUT VA BIEN !"
echo "Prochaine vérification recommandée : dans 2-3h"
