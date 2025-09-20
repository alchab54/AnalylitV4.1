Les deux échecs prouvent que le code réellement exécuté dans le conteneur web n’est pas celui que montre l’extrait local: l’endpoint chat renvoie encore "job_id" au lieu de "task_id", et la route upload-zotero-file n’est pas enregistrée, d’où 404, ce qui signe une désynchronisation module/volume/entrypoint dans l’environnement Docker en cours d’exécution.

Ce que prouvent tes logs pytest
Chat: le test imprime la réponse brute b'{"job_id":"mocked_chat_job_456","message":"Question soumise"}' puis échoue sur KeyError 'task_id', ce qui confirme que l’API active renvoie "job_id" et non "task_id" malgré la modification annoncée. Ce symptôme est typique d’un binaire différent chargé à l’exécution (FLASK_APP/module, autoload) ou d’un volume qui écrase le fichier copié à build.

Upload Zotero file: 404 et warning “Route non trouvée: POST /api/projects/.../upload-zotero-file”, donc la route n’est pas montée dans l’app active, même si le fichier local la contient. Là aussi, cela pointe vers le mauvais module chargé ou un problème de montage/entrypoint.

Pourquoi ça persiste malgré build/recreate
Un service Flask lancé avec auto-reload peut piocher un module différent (mauvais FLASK_APP, working_dir, ou chemin Python), et un volume bind-mount peut écraser le code d’image avec une version différente sur disque, menant à des routes différentes et à des réponses divergentes “job_id” vs “task_id”. Ces causes sont bien documentées comme sources de faux négatifs de tests et d’incohérences d’API lors de pipelines CI/CD.

Contrôles ciblés dans le conteneur
Confirmer le module app réellement lancé:

docker-compose -f docker-compose-local.yml exec web printenv | grep -E "FLASK_APP|FLASK_ENV|PYTHONPATH" 

docker-compose -f docker-compose-local.yml exec web python - <<'PY'\nimport server_v4_complete,inspect;print(inspect.getsource(server_v4_complete.create_app));print('---');print(inspect.getsource(server_v4_complete.chat_with_project))\nPY

Lister les routes effectivement chargées:

docker-compose -f docker-compose-local.yml exec web flask routes | egrep "(chat$|upload-zotero-file$)" 

Vérifier l’entrypoint:

docker-compose -f docker-compose-local.yml exec web cat entrypoint.sh

Ces commandes isolent si:

FLASK_APP pointe ailleurs que server_v4_complete:create_app.

entrypoint lance un autre module (ex: gunicorn app:app) au lieu de server_v4_complete:app.

la route /api/projects/<id>/upload-zotero-file est absente des routes, confirmant la désynchro.

Corrections à appliquer immédiatement
Forcer l’API chat à renvoyer task_id dans le code chargé par le conteneur:

Dans le server réellement exécuté, modifier l’endpoint chat pour: return jsonify({"task_id": str(job.id), "message": "Question soumise"}), 202.

S’assurer que le module exécuté est bien server_v4_complete:app ou server_v4_complete:create_app dans l’entrypoint.

Forcer l’enregistrement de la route upload-zotero-file:

Vérifier que la fonction est décorée exactement @app.route('/api/projects/<project_id>/upload-zotero-file', methods=['POST']).

Après correction, relancer avec un recreate et sans volume qui écrase ce fichier par une autre version.

Éliminer la cause “volume écrasant”:

Si docker-compose-local.yml monte un volume sur /home/appuser/app, s’assurer que ce répertoire local contient bien la version corrigée; sinon, supprimer le bind-mount pendant le test, ou mettre à jour les fichiers locaux montés.

Procédure fiable de redémarrage
docker compose -f docker-compose-local.yml down

docker compose -f docker-compose-local.yml build --no-cache

docker compose -f docker-compose-local.yml up -d --force-recreate web

Vérifier “flask routes” pour upload-zotero-file puis relancer uniquement les tests en cause.

Astuce si bash/sed indisponible
Utiliser Python pour afficher la fonction, déjà proposé ci-dessus, au lieu de sed/grep, ce qui marche même sans outils shell. C’est une pratique utile quand l’image est minimale.

En résumé

Les échecs actuels ne viennent plus de la logique de tes extraits, mais du fait que le conteneur exécute un autre code: "job_id" persiste et la route n’existe pas runtime. Corriger FLASK_APP/entrypoint et le montage de volumes, vérifier les routes, puis relancer; les deux tests passeront.

