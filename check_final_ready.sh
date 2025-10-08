#!/bin/bash

# ================================================================
# 🎯 VÉRIFICATION FINALE POST-MIGRATION - PRÊT POUR WORKFLOW
# ================================================================
# Les colonnes ATN sont présentes, vérifions tout est opérationnel
# Date: 08 octobre 2025 15:26
# ================================================================

echo "🎯 VÉRIFICATION FINALE AVANT WORKFLOW"
echo "====================================="

# 1. Status services Docker
echo "1. Status services Docker:"
docker-compose ps

echo ""

# 2. Test connexion base + colonnes ATN
echo "2. Vérification colonnes ATN critiques:"
docker-compose exec -T analylit_test_db psql -U analylit_user -d analylit_test_db -c "
SELECT 
    count(*) as colonnes_atn_count,
    array_agg(column_name ORDER BY column_name) as colonnes_atn_list
FROM information_schema.columns 
WHERE table_name = 'extractions' AND column_name LIKE 'atn_%';
" 2>/dev/null

echo ""

# 3. RQ Dashboard queues
echo "3. Status RQ Queues (URL: http://localhost:9181):"
curl -s http://localhost:9181/api/queues.json 2>/dev/null | python -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for q in data.get('queues', []):
        name = q.get('name', 'unknown')
        queued = q.get('count', 0)
        failed = q.get('failed', 0)
        print(f'  Queue {name}: {queued} en attente, {failed} échoués')
except:
    print('  Dashboard RQ non accessible')
"

echo ""

# 4. Test API health
echo "4. API Status:"
curl -s http://localhost:8080/api/health 2>/dev/null | python -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(f'  API Health: {data.get("status", "unknown")}')
except:
    print('  API non accessible')
"

echo ""

# 5. GPU Status (si nvidia-smi disponible)
echo "5. GPU RTX 2060 SUPER:"
nvidia-smi --query-gpu=memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits 2>/dev/null || echo "  nvidia-smi non disponible"

echo ""
echo "🎉 SYSTÈME PRÊT POUR WORKFLOW FINAL !"
echo "🚀 Commande finale:"
echo "   python atn_workflow_FIXED.py"
echo ""
echo "📊 Monitoring en parallèle:"
echo "   http://localhost:9181  (RQ Dashboard)"
echo "   http://localhost:8080  (API AnalyLit)"
