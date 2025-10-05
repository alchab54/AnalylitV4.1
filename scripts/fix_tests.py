#!/usr/bin/env python3
import re

# Correction 1: Ajouter l'import manquant
with open('api/projects.py', 'r') as f:
    content = f.read()

# Chercher la ligne d'import et ajouter run_synthesis_task
if 'run_synthesis_task' not in content:
    content = re.sub(
        r'(from backend\.tasks_v4_complete import \(.*?)(run_discussion_generation_task.*?\n)',
        r'\1\2    run_synthesis_task,\n',
        content,
        flags=re.DOTALL
    )
    
    with open('api/projects.py', 'w') as f:
        f.write(content)

# Correction 2: Filtrer les None dans numpy.mean
with open('backend/tasks_v4_complete.py', 'r') as f:
    content = f.read()

content = content.replace(
    "'atn_mean_score': np.mean(atn_scores) if atn_scores else 0,",
    "'atn_mean_score': np.mean([score for score in atn_scores if score is not None]) if atn_scores and any(score is not None for score in atn_scores) else 0,"
)

with open('backend/tasks_v4_complete.py', 'w') as f:
    content.write(content)

print("✅ Corrections appliquées!")
