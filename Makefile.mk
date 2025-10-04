# Makefile - Version FINALE avec toutes les corrections

.PHONY: install dev stop clean test logs logs-web build-base build-app

# --- Mode Production ---
install:
	@echo "\033[34m🚀 Installation d'AnalyLit V4.1 (Production)...\033[0m"
	@docker-compose down --volumes --remove-orphans
	@docker-compose build --no-cache
	@docker-compose --profile default up -d
	@echo "\033[32m✅ Installation terminée !\033[0m"
	@echo "\033[34m🌐 Interface web: http://localhost:8080\033[0m"

# --- Mode Développement ---
dev:
	@echo "\033[34m🔧 Démarrage en mode développement...\033[0m"
	@echo "\033[33mLes fichiers locaux seront synchronisés avec les conteneurs.\033[0m"
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml down --remove-orphans
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml build --no-cache web
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml --profile default up -d
	@echo "\033[32m✅ Mode développement démarré. Interface web: http://localhost:8080\033[0m"

# --- Construction des images de base ---
build-base:
	@echo "\033[34m🛠️ Construction de l'image de base CPU...\033[0m"
	@docker-compose build base-cpu
	@echo "\033[34m🛠️ Construction de l'image de base GPU...\033[0m"
	@docker-compose build base-gpu
	@echo "\033[32m✅ Images de base construites avec succès.\033[0m"

# --- Construction des images applicatives ---
build-app:
	@echo "\033[34m🛠️ Construction des images applicatives (web, workers)...\033[0m"
	@docker-compose build web worker-fast worker-default worker-ai migrate
	@echo "\033[32m✅ Images applicatives construites.\033[0m"

# --- Gestion des services ---
stop:
	@echo "\033[34m🛑 Arrêt des services...\033[0m"
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml down

clean:
	@echo "\033[34m🧹 Nettoyage complet de l'environnement Docker...\033[0m"
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml down --volumes --remove-orphans
	@docker system prune -af
	@echo "\033[32m✅ Environnement nettoyé.\033[0m"

# --- Tests et Logs ---
test:
	@echo "\033[34m🧪 Lancement des tests...\033[0m"
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml exec web pytest -v

logs:
	@echo "\033[34m📋 Logs des services:\033[0m"
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f

logs-web:
	@echo "\033[34m📋 Logs du service web:\033[0m"
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f web
