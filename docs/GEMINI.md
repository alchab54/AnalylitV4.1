# Automatisation Implémentation Téléchargement Modèles Ollama - AnalyLit v4.1

## Objectif
Automatiser complètement l'implémentation du téléchargement de modèles IA Ollama dans l'application AnalyLit v4.1, incluant :

- Interface utilisateur avec bouton téléchargement
- Fonctions JavaScript pour gérer le téléchargement
- API Flask backend pour déclencher et suivre les téléchargements
- Tâches asynchrones pour traitement en background
- Notifications et état d'avancement

## Prérequis
- Backend Python Flask configuré avec RQ pour tâches asynchrones
- Frontend SPA avec JS ES Modules prêt à intégrer nouveau module
- Docker et volume persistant Ollama configuré
- Commande `ollama pull <model>` fonctionnelle sur serveur

---

## 1. Interface Utilisateur (frontend/web/js/settings.js)

// Fonction pour démarrer le téléchargement d'un modèle
export async function downloadModel(modelName) {
try {
showDownloadProgress(modelName);
const response = await fetchAPI('/api/ollama/pull', {
method: 'POST',
body: JSON.stringify({ model: modelName }),
});
if (response.success) {
showToast(Modèle ${modelName} téléchargé avec succès, 'success');
await loadInstalledModels();
} else {
throw new Error(response.error || 'Erreur inconnue');
}
} catch (error) {
showToast(Erreur téléchargement : ${error.message}, 'error');
} finally {
hideDownloadProgress();
}
}

export async function loadInstalledModels() {
try {
const response = await fetchAPI('/api/ollama/models');
const modelsList = document.getElementById('installed-models-list');
modelsList.innerHTML = response.models
.map(
(model) =>
<li>${model.name} <span class="model-size">${model.size || ''}</span></li>
)
.join('');
} catch (error) {
console.error('Erreur chargement modèles :', error);
}
}

function showDownloadProgress(modelName) {
const progressContainer = document.getElementById('download-progress');
const statusElement = document.getElementById('download-status');
progressContainer.style.display = 'block';
statusElement.textContent = Téléchargement de ${modelName}...;
}

function hideDownloadProgress() {
document.getElementById('download-progress').style.display = 'none';
}

text

---

## 2. HTML Interface (frontend/web/index.html ou fichier HTML Settings)

<div id="models-management" class="settings-section"> <h3>Gestion des Modèles IA</h3> <select id="available-models-select"> <option value="llama3.1:8b">Llama 3.1 8B</option> <option value="llama3.1:70b">Llama 3.1 70B</option> <option value="phi3:mini">Phi-3 Mini</option> <option value="mistral:8x7b">Mistral 8x7B</option> </select> <button id="download-model-btn" class="btn btn-primary">Télécharger le Modèle</button> <div id="download-progress" class="progress-container" style="display:none;"> <div class="progress-bar" id="download-progress-bar"></div> <span id="download-status">Téléchargement en cours...</span> </div> <h4>Modèles Installés</h4> <ul id="installed-models-list"></ul> </div> <script> document .getElementById('download-model-btn') .addEventListener('click', async () => { const select = document.getElementById('available-models-select'); const modelName = select.value; await downloadModel(modelName); }); loadInstalledModels(); // Charger liste à l'initialisation </script>
text

---

## 3. Backend Flask (server_v4_complete.py ou equivalent)

from flask import Blueprint, jsonify, request
import rq
from worker import redis_conn
import subprocess

api_bp = Blueprint('api', name)
models_queue = rq.Queue('models', connection=redis_conn)

def pull_model_task(model_name):
# Caller la commande système pour lancer ollama pull
try:
res = subprocess.run(
['ollama', 'pull', model_name], capture_output=True, text=True, check=True
)
return {'status': 'success', 'message': res.stdout}
except subprocess.CalledProcessError as e:
return {'status': 'error', 'message': e.stderr}

@api_bp.route('/ollama/pull', methods=['POST'])
def api_pull_model():
data = request.json
model_name = data.get('model')
if not model_name:
return jsonify({'success': False, 'error': 'Model name required'}), 400
job = models_queue.enqueue(pull_model_task, model_name, job_timeout='30m')
return jsonify({'success': True, 'job_id': job.get_id(), 'message': f'Downloading {model_name}'})

@api_bp.route('/ollama/models', methods=['GET'])
def api_list_models():
# Appeler Ollama API locale pour récupérer la liste des modèles installés
import requests

text
try:
    response = requests.get('http://localhost:11434/api/tags')  # Adapter URL
    response.raise_for_status()
    return jsonify({'success': True, 'models': response.json().get('models', [])})
except requests.RequestException as e:
    return jsonify({'success': False, 'error': str(e)}), 500
text

---

## 4. Configuration Docker & Environnement

- S'assurer que docker-compose.yml expose le port 11434 pour lomlama
- Volume persistant pour ollama-data dans docker-compose
- Redis et worker RQ actifs pour la gestion des tâches asynchrones

---

## 5. Tests & Validation

- Tests unitaires pour API `ollama/pull` et `ollama/models`
- Tests d'intégration frontend/backend interaction téléchargements
- Validation UX bouton + messages et barre progression

---

## 6. Commandes Utiles

Télécharger modèles de base manuellement
make models

Lancer worker RQ si non actif
rq worker -u redis://redis:6379

Démarrer app avec docker-compose
docker-compose up -d



## Conclusion

Ce Gemini.md offre le guide complet pour automatiser le développement et l'intégration du téléchargement de modèles IA Ollama dans AnalyLit v4.1, couvrant frontend, backend, docker et tests.


inscrire dans C:\Users\alich\Downloads\exported-assets (1)\docs\README-improvements.md  les changements réalisés