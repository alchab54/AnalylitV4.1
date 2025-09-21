# AnalyLit V4.0 - Makefile pour la gestion du projet
# Utilisation: make [target]

.PHONY: help install start stop restart status logs backup clean update models shell

# Configuration
COMPOSE_FILE=docker-compose-local.yml
PROJECT_NAME=analylit-v4
 # Les couleurs sont supprimées pour la compatibilité Windows

help: ## Afficher l'aide
	@echo ""
	@echo "AnalyLit V4.0 - Commandes disponibles:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2}'
	@echo ""

install: ## Installation complète d'AnalyLit
	@echo "Installation d'AnalyLit V4.0..."
	@mkdir -p projects web
	@if [ ! -f .env ]; then cp env.example .env; echo "Fichier .env créé à partir d'env.example"; fi
	@docker-compose -f $(COMPOSE_FILE) build
	@docker-compose -f $(COMPOSE_FILE) up -d
	@echo "Installation terminée!"
	@echo "Interface web: http://localhost:8080"

start: ## Démarrer les services
	@echo "Démarrage des services..."
	@docker-compose -f $(COMPOSE_FILE) up -d
	@echo "Services démarrés"

stop: ## Arrêter les services
	@echo "Arrêt des services..."
	@docker-compose -f $(COMPOSE_FILE) down
	@echo "Services arrêtés"

restart: stop start ## Redémarrer les services

status: ## Afficher l'état des services
	@echo "État des services:"
	@docker-compose -f $(COMPOSE_FILE) ps
	@echo ""
	@echo "Utilisation des ressources:"
	@docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" | head -6

logs: ## Afficher les logs des services
	@echo "Logs des services:"
	@docker-compose -f $(COMPOSE_FILE) logs --tail=50

logs-follow: ## Suivre les logs en temps réel
	@echo "Suivi des logs en temps réel (Ctrl+C pour arrêter):"
	@docker-compose -f $(COMPOSE_FILE) logs -f

logs-web: ## Logs du serveur web uniquement
	@docker-compose -f $(COMPOSE_FILE) logs -f web

logs-worker: ## Logs des workers uniquement
	@docker-compose -f $(COMPOSE_FILE) logs -f worker

logs-ollama: ## Logs d'Ollama uniquement
	@docker-compose -f $(COMPOSE_FILE) logs -f ollama

backup: ## Créer une sauvegarde des données
	@echo "Création de la sauvegarde..."
	@mkdir -p backups
	@tar -czf backups/analylit-backup-$$(date +%Y%m%d-%H%M%S).tar.gz projects/
	@echo "Sauvegarde créée dans le dossier backups/"

models: ## Télécharger les modèles IA essentiels
	@echo "Téléchargement des modèles essentiels..."
	@echo "Attente du démarrage d'Ollama..."
	@until curl -f http://localhost:11434/api/version >/dev/null 2>&1; do sleep 2; done
	@echo "Téléchargement de llama3.1:8b..."
	@docker exec $$(docker-compose -f $(COMPOSE_FILE) ps -q ollama) ollama pull llama3.1:8b
	@echo "Téléchargement de phi3:mini..."
	@docker exec $$(docker-compose -f $(COMPOSE_FILE) ps -q ollama) ollama pull phi3:mini
	@echo "Téléchargement de gemma:2b..."
	@docker exec $$(docker-compose -f $(COMPOSE_FILE) ps -q ollama) ollama pull gemma:2b
	@echo "Modèles essentiels téléchargés"

shell-web: ## Accéder au shell du conteneur web
	@docker-compose -f $(COMPOSE_FILE) exec web /bin/bash

shell-worker: ## Accéder au shell du conteneur worker
	@docker-compose -f $(COMPOSE_FILE) exec worker /bin/bash

shell-redis: ## Accéder au shell Redis
	@docker-compose -f $(COMPOSE_FILE) exec redis redis-cli

update: ## Mettre à jour AnalyLit
	@echo "Mise à jour d'AnalyLit..."
	@docker-compose -f $(COMPOSE_FILE) down
	@docker-compose -f $(COMPOSE_FILE) build --no-cache
	@docker-compose -f $(COMPOSE_FILE) up -d
	@echo "Mise à jour terminée"

clean: ## Nettoyer le système (⚠️ supprime les données)
	@echo "ATTENTION: Cette action va supprimer tous les conteneurs et volumes"
	@read -p "Êtes-vous sûr? (y/N): " confirm && [ "$$confirm" = "y" ] || exit 1
	@echo "Nettoyage en cours..."
	@docker-compose -f $(COMPOSE_FILE) down -v
	@docker image prune -f
	@echo "Nettoyage terminé"

dev: ## Mode développement avec rechargement automatique
	@echo "Démarrage en mode développement..."
	@docker-compose -f $(COMPOSE_FILE) -f docker-compose.dev.yml up

test: ## Exécuter les tests
	@echo "Exécution des tests..."
	@docker-compose -f $(COMPOSE_FILE) exec web python -m pytest tests/

health: ## Vérifier la santé des services
	@echo "Vérification de la santé des services:"
	@curl -f http://localhost:8080/api/health && echo "API Web: OK" || echo "API Web: Erreur"
	@curl -f http://localhost:11434/api/version && echo "Ollama: OK" || echo "Ollama: Erreur"

monitor: ## Surveiller les ressources en temps réel
	@echo "Surveillance des ressources (Ctrl+C pour arrêter):"
	@watch -n 2 'docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"'

reset: clean install ## Reset complet (supprime tout et réinstalle)

# Commande par défaut
.DEFAULT_GOAL := help