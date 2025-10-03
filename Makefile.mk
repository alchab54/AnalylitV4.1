# AnalyLit V4.0 - Makefile pour la gestion du projet
# Utilisation: make [target]

.PHONY: help install start stop restart status logs backup clean update models shell

# --- Configuration & Détection automatique de Docker Compose ---
COMPOSE_FILE ?= docker-compose.yml

# Détecte si 'docker compose' (v2) ou 'docker-compose' (v1) doit être utilisé.
COMPOSE := docker-compose
ifneq (, $(shell docker compose version 2>/dev/null))
	COMPOSE := docker compose
endif
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

build-base: ## Construit les images de base (cpu puis gpu) dans le bon ordre
	@echo "$(BLUE)🛠️  Construction de l'image de base CPU...$(NC)"
	@$(COMPOSE) -f $(COMPOSE_FILE) build base-cpu
	@echo "$(BLUE)🛠️  Construction de l'image de base GPU...$(NC)"
	@$(COMPOSE) -f $(COMPOSE_FILE) build base-gpu
	@echo "$(GREEN)✅ Images de base construites avec succès.$(NC)"

install: ## Installation complète d'AnalyLit
	@echo "$(BLUE)🚀 Installation d'AnalyLit V4.0...$(NC)"
	@mkdir -p projects web
	@if [ ! -f .env ]; then cp env.example .env; echo "$(YELLOW)⚠️  Fichier .env créé à partir d'env.example$(NC)"; fi
	@$(MAKE) build-base
	@echo "$(BLUE)🚀 Démarrage des services en mode production...$(NC)"
	@$(COMPOSE) -f $(COMPOSE_FILE) up -d --build
	@echo "$(GREEN)✅ Installation terminée!$(NC)"
	@echo "$(BLUE)🌐 Interface web: http://localhost:5000$(NC)"

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

dev: ## Mode développement (sans rebuild). Utiliser 'make build' avant si nécessaire.
	@echo "$(BLUE)🔧 Démarrage en mode développement...$(NC)"
	@echo "$(YELLOW)Les fichiers locaux seront synchronisés avec les conteneurs.$(NC)"
	@$(COMPOSE) -f $(COMPOSE_FILE) -f docker-compose.dev.yml --profile default --profile gpu up -d
	@echo "$(GREEN)✅ Mode développement démarré. Interface web: http://localhost:5000$(NC)"

build: build-base build-app ## Construit toutes les images nécessaires

build-app: ## Construit les images applicatives (web, workers)
	@echo "$(BLUE)🛠️  Construction des images applicatives (web, workers)...$(NC)"
	@$(COMPOSE) -f $(COMPOSE_FILE) build web worker-fast worker-default worker-ai
	@echo "$(GREEN)✅ Images applicatives construites.$(NC)"

rebuild: ## Force la reconstruction de toutes les images (sans cache)
	@echo "$(YELLOW)⚠️  Forçage de la reconstruction de toutes les images sans cache...$(NC)"
	@$(COMPOSE) -f $(COMPOSE_FILE) build --no-cache

test: ## Exécuter les tests
	@echo "$(BLUE)🧪 Exécution des tests...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) run --rm web pytest -v tests/ > logs/pytest_results.log 2>&1
	@mkdir -p logs

test-workflow: ## Exécuter le test de workflow ATN de bout en bout
	@echo "$(BLUE)🧪 Exécution du test de workflow ATN...$(NC)"
	@echo "$(YELLOW)Assurez-vous que les services sont démarrés avec 'make start'$(NC)"
	@python scripts/test_atn_workflow.py
	@echo "$(GREEN)✅ Test de workflow terminé.$(NC)"

seed-project: ## Crée un projet de test dans l'environnement de production
	@echo "$(BLUE)🌱 Création d'un projet de démonstration dans la base de données de production...$(NC)"
	@echo "$(YELLOW)Assurez-vous que les services sont démarrés avec 'make start' ou 'make install'$(NC)"
	@echo "$(YELLOW)Cette opération peut prendre plusieurs minutes...$(NC)"
	# ✅ CORRECTION: On passe les variables d'environnement pour que le script
	# sache qu'il doit communiquer avec le service 'web' sur son port interne.
	@docker-compose exec -e API_HOST=web -e API_PORT=5000 web python scripts/test_atn_workflow.py
	@echo "$(GREEN)✅ Projet de démonstration créé avec succès !$(NC)"
	@echo "$(BLUE)➡️  Rafraîchissez votre navigateur pour voir le projet 'Test ATN'.$(NC)"

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