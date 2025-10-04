# Makefile - Version Finale Corrigée

# --- Variables ---
COMPOSE_FILE = docker-compose.yml

# --- Commandes Principales ---

.PHONY: install
install:
	@echo "\033[34m🚀 Installation d'AnalyLit V4.1...\033[0m"
	@docker-compose -f $(COMPOSE_FILE) down --volumes --remove-orphans
	@docker-compose -f $(COMPOSE_FILE) build --no-cache
	@docker-compose -f $(COMPOSE_FILE) up -d
	@echo "\033[32m✅ Installation terminée !\033[0m"
	@echo "\033[34m🌐 Interface web: http://localhost:8080\033[0m"

.PHONY: dev
dev:
	@echo "\033[34m🚀 Démarrage en mode développement...\033[0m"
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
	@echo "\033[32m✅ Mode développement démarré. Interface web: http://localhost:8080\033[0m"

.PHONY: stop
stop:
	@echo "\033[34m🛑 Arrêt des services...\033[0m"
	@docker-compose -f $(COMPOSE_FILE) down

.PHONY: logs
logs:
	@echo "\033[34m📋 Logs des services:\033[0m"
	@docker-compose -f $(COMPOSE_FILE) logs -f

.PHONY: logs-web
logs-web:
	@echo "\033[34m📋 Logs du service web:\033[0m"
	@docker-compose -f $(COMPOSE_FILE) logs -f web

.PHONY: test
test:
	@echo "\033[34m🧪 Lancement des tests...\033[0m"
	@docker-compose -f $(COMPOSE_FILE) exec web pytest

.PHONY: clean
clean:
	@echo "\033[34m🧹 Nettoyage complet de l'environnement Docker...\033[0m"
	@docker-compose -f $(COMPOSE_FILE) down --volumes --remove-orphans
	@docker system prune -af
	@echo "\033[32m✅ Environnement nettoyé.\033[0m"

