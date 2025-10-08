#!/bin/bash
# ================================================================
# 🔍 MONITORING WORKFLOW DYNAMIQUE - TIMESTAMP RÉEL
# ================================================================

echo "🔍 MONITORING WORKFLOW MASSIF ATN"
echo "================================="
echo ""

echo "📊 STATUS CONTAINERS :"
docker-compose -f docker-compose.dev.yml ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" | grep -v "^NAME"

echo ""
echo "🎯 QUEUE STATUS :"
# Note: Nécessite Python dans le PATH système
python3 -c "
import redis, datetime
try:
    r = redis.Redis(host='localhost', port=6380, db=0)
    queues = ['import_queue', 'screening_queue', 'extraction_queue', 'analysis_queue', 'synthesis_queue']
    for q in queues:
        count = r.llen(q)
        print(f'  {q}: {count} tâches')
except Exception as e:
    print(f'  ⚠️ Redis non accessible: {str(e)[:50]}')
"

echo ""
echo "💾 GPU MEMORY (si nvidia-smi disponible) :"
nvidia-smi --query-gpu=memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits 2>/dev/null || echo "GPU non accessible"

echo ""
echo "⏰ TEMPS ÉCOULÉ :"
# ✅ CORRECTION: Utiliser heure actuelle système
start_time=$(date '+%Y-%m-%d %H:%M:%S')
echo "Heure actuelle: $start_time"

echo ""
echo "🎉 MONITORING DYNAMIQUE - TOUT EST SUIVI !"
echo "Prochaine vérification recommandée : dans 2-3h"
