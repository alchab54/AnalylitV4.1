# AnalyLit V4.0 - Makefile pour la gestion du projet
# Utilisation: make [target]

.PHONY: help install start stop restart status logs backup clean update models shell

# Configuration
COMPOSE_FILE=docker-compose-local.yml
PROJECT_NAME=analylit-v4

# Couleurs pour l'affichage
BLUE=\033[34m
GREEN=\033[32m
YELLOW=\033[33m
RED=\033[31m
NC=\033[0m # No Color

help: ## Afficher l'aide
	@echo ""
	@echo "$(BLUE)AnalyLit V4.0 - Commandes disponibles:$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2}'
	@echo ""

install: ## Installation complète d'AnalyLit
	@echo "$(BLUE)🚀 Installation d'AnalyLit V4.0...$(NC)"
	@mkdir -p projects web
	@if [ ! -f .env ]; then cp env.example .env; echo "$(YELLOW)⚠️  Fichier .env créé à partir d'env.example$(NC)"; fi
	@docker-compose -f $(COMPOSE_FILE) build
	@docker-compose -f $(COMPOSE_FILE) up -d
	@echo "$(GREEN)✅ Installation terminée!$(NC)"
	@echo "$(BLUE)🌐 Interface web: http://localhost:8080$(NC)"

start: ## Démarrer les services
	@echo "$(BLUE)🚀 Démarrage des services...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) up -d
	@echo "$(GREEN)✅ Services démarrés$(NC)"

stop: ## Arrêter les services
	@echo "$(BLUE)🛑 Arrêt des services...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) down
	@echo "$(GREEN)✅ Services arrêtés$(NC)"

restart: stop start ## Redémarrer les services

status: ## Afficher l'état des services
	@echo "$(BLUE)📊 État des services:$(NC)"
	@docker-compose -f $(COMPOSE_FILE) ps
	@echo ""
	@echo "$(BLUE)🔧 Utilisation des ressources:$(NC)"
	@docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" | head -6

logs: ## Afficher les logs des services
	@echo "$(BLUE)📋 Logs des services:$(NC)"
	@docker-compose -f $(COMPOSE_FILE) logs --tail=50

logs-follow: ## Suivre les logs en temps réel
	@echo "$(BLUE)📋 Suivi des logs en temps réel (Ctrl+C pour arrêter):$(NC)"
	@docker-compose -f $(COMPOSE_FILE) logs -f

logs-web: ## Logs du serveur web uniquement
	@docker-compose -f $(COMPOSE_FILE) logs -f web

logs-worker: ## Logs des workers uniquement
	@docker-compose -f $(COMPOSE_FILE) logs -f worker

logs-ollama: ## Logs d'Ollama uniquement
	@docker-compose -f $(COMPOSE_FILE) logs -f ollama

backup: ## Créer une sauvegarde des données
	@echo "$(BLUE)💾 Création de la sauvegarde...$(NC)"
	@mkdir -p backups
	@tar -czf backups/analylit-backup-$$(date +%Y%m%d-%H%M%S).tar.gz projects/
	@echo "$(GREEN)✅ Sauvegarde créée dans le dossier backups/$(NC)"

models: ## Télécharger les modèles IA essentiels
	@echo "$(BLUE)🤖 Téléchargement des modèles essentiels...$(NC)"
	@echo "$(YELLOW)⏳ Attente du démarrage d'Ollama...$(NC)"
	@until curl -f http://localhost:11434/api/version >/dev/null 2>&1; do sleep 2; done
	@echo "$(BLUE)📥 Téléchargement de llama3.1:8b...$(NC)"
	@docker exec $$(docker-compose -f $(COMPOSE_FILE) ps -q ollama) ollama pull llama3.1:8b
	@echo "$(BLUE)📥 Téléchargement de phi3:mini...$(NC)"
	@docker exec $$(docker-compose -f $(COMPOSE_FILE) ps -q ollama) ollama pull phi3:mini
	@echo "$(BLUE)📥 Téléchargement de gemma:2b...$(NC)"
	@docker exec $$(docker-compose -f $(COMPOSE_FILE) ps -q ollama) ollama pull gemma:2b
	@echo "$(GREEN)✅ Modèles essentiels téléchargés$(NC)"

shell-web: ## Accéder au shell du conteneur web
	@docker-compose -f $(COMPOSE_FILE) exec web /bin/bash

shell-worker: ## Accéder au shell du conteneur worker
	@docker-compose -f $(COMPOSE_FILE) exec worker /bin/bash

shell-redis: ## Accéder au shell Redis
	@docker-compose -f $(COMPOSE_FILE) exec redis redis-cli

update: ## Mettre à jour AnalyLit
	@echo "$(BLUE)🔄 Mise à jour d'AnalyLit...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) down
	@docker-compose -f $(COMPOSE_FILE) build --no-cache
	@docker-compose -f $(COMPOSE_FILE) up -d
	@echo "$(GREEN)✅ Mise à jour terminée$(NC)"

clean: ## Nettoyer le système (⚠️ supprime les données)
	@echo "$(RED)⚠️  Cette action va supprimer tous les conteneurs et volumes$(NC)"
	@read -p "Êtes-vous sûr? (y/N): " confirm && [ "$$confirm" = "y" ] || exit 1
	@echo "$(BLUE)🧹 Nettoyage en cours...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) down -v
	@docker image prune -f
	@echo "$(GREEN)✅ Nettoyage terminé$(NC)"

dev: ## Mode développement avec rechargement automatique
	@echo "$(BLUE)🔧 Démarrage en mode développement...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) -f docker-compose.dev.yml up

test: ## Exécuter les tests
	@echo "$(BLUE)🧪 Exécution des tests...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) exec web python -m pytest tests/

health: ## Vérifier la santé des services
	@echo "$(BLUE)🏥 Vérification de la santé des services:$(NC)"
	@curl -f http://localhost:8080/api/health && echo "$(GREEN)✅ API Web: OK$(NC)" || echo "$(RED)❌ API Web: Erreur$(NC)"
	@curl -f http://localhost:11434/api/version && echo "$(GREEN)✅ Ollama: OK$(NC)" || echo "$(RED)❌ Ollama: Erreur$(NC)"

monitor: ## Surveiller les ressources en temps réel
	@echo "$(BLUE)📊 Surveillance des ressources (Ctrl+C pour arrêter):$(NC)"
	@watch -n 2 'docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"'

reset: clean install ## Reset complet (supprime tout et réinstalle)

# Commande par défaut
.DEFAULT_GOAL := help