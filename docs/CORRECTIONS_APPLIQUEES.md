# Corrections Appliquées à AnalyLit V4.1

Ce document détaille les corrections appliquées suite au diagnostic des erreurs critiques.

## 1. Correction du Gevent Monkey Patch

**Problème :** `RuntimeError: cannot release un-acquired lock` dû à `gevent.monkey.patch_all()` exécuté trop tôt, créant un conflit avec les mécanismes de threading de `pytest` et de l'application Flask/Gunicorn.

**Fichier modifié :** `server_v4_complete.py`

**Description de la correction :**
Le `gevent.monkey.patch_all()` a été déplacé du début du fichier vers le bloc `if __name__ == "__main__":`. Cela assure que le monkey patching n'est appliqué que lors de l'exécution directe du script (pour le développement local) et non lors de l'importation par Gunicorn ou Pytest, évitant ainsi les conflits de threading.

**Ancien code (extrait) :**
```python
from gevent import monkey
monkey.patch_all()
import logging
# ...
```

**Nouveau code (extrait) :**
```python
import logging
# ...
if __name__ == "__main__":
    import gevent.monkey
    gevent.monkey.patch_all()
    # ...
```

## 2. Corrections Docker Compose

**Problème :**
- Chemin incorrect pour le volume SQL dans le service `db`.
- Commande `worker` trop verbeuse et potentiellement source d'erreurs.

**Fichier modifié :** `docker-compose.yml`

**Description des corrections :**

### a. Correction du volume SQL
Le chemin du volume pour l'initialisation de la base de données a été corrigé pour pointer directement vers le fichier `init-user-db.sql` à la racine du projet, au lieu d'un sous-répertoire `database/`.

**Ancien code (extrait) :**
```yaml
    volumes:
      - postgres_data:/var/lib/postgresql/data/
      - ./database/init-user-db.sql:/docker-entrypoint-initdb.d/init-user-db.sql
```

**Nouveau code (extrait) :**
```yaml
    volumes:
      - postgres_data:/var/lib/postgresql/data/
      - ./init-user-db.sql:/docker-entrypoint-initdb.d/init-user-db.sql
```

### b. Correction de la commande Worker
La commande du service `worker` a été simplifiée pour utiliser `python -m rq worker` avec l'URL Redis directe, ce qui est plus robuste et moins sujet aux erreurs de configuration des files d'attente.

**Ancien code (extrait) :**
```yaml
  worker:
    # ...
    command: rq worker --with-scheduler --url redis://analylit_redis:6379/0 analylit_processing_v4 analylit_synthesis_v4 analylit_analysis_v4 analylit_background_v4 analylit_extension_v4
```

**Nouveau code (extrait) :**
```yaml
  worker:
    # ...
    command: python -m rq worker --url redis://redis:6379
```

---

**Prochaines étapes (à exécuter manuellement par l'utilisateur) :**

1.  **Reset Database :**
    ```bash
    docker-compose down -v
    docker system prune -a --force
    docker volume rm $(docker volume ls -q | grep analylit)
    ```
2.  **Rebuild & Test :**
    ```bash
    docker-compose up --build -d
    docker-compose logs -f tester
    ```