# =================================================================
# === ANALYLIT - MAKEFILE DE DÉPLOIEMENT "GLORY"
# =================================================================
# Fichier de contrôle unique pour le déploiement, le test et 
# l'exécution du workflow de thèse final.
# =================================================================

# --- Configuration ---
.PHONY: help glory-full-deploy glory-up stop-glory clean build-base-images run-glory-script status
COMPOSE_FILE = docker-compose.glory.yml

# --- Couleurs pour la lisibilité ---
BLUE := \033[34m
GREEN := \033[32m
YELLOW := \033[33m
RED := \033[31m
PURPLE := \033[35m
NC := \033[0m

# =================================================================
# === COMMANDES DE CONTRÔLE DU WORKFLOW "GLORY"
# =================================================================

help: ## 📋 Affiche ce message d'aide.
	@echo "$(BLUE)🚀 Console de Lancement AnalyLit - Workflow 'Glory'$(NC)"
	@echo "$(BLUE)==================================================$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "$(GREEN)%-25s$(NC) %s\n", $$1, $$2}'

glory-full-deploy: clean build-base-images glory-up ## 🚀✨ LANCE LE WORKFLOW COMPLET: Nettoie, build, déploie, attend 60s et lance le script. C'EST LA COMMANDE FINALE.
	@echo "$(PURPLE)==================================================$(NC)"
	@echo "$(PURPLE)=== ÉTAPE 4/4: DÉCLENCHEMENT DU SCRIPT 'GLORY' ===$(NC)"
	@echo "$(PURPLE)==================================================$(NC)"
	@echo "$(YELLOW)Attente de 60 secondes pour la stabilisation des services...$(NC)"
	@sleep 60
	@$(MAKE) run-glory-script

glory-up: ## 🔧 Déploie tous les services avec monitoring.
	@echo "$(PURPLE)====================================================$(NC)"
	@echo "$(PURPLE)=== ÉTAPE 3/4: DÉPLOIEMENT DE L'INFRASTRUCTURE ===$(NC)"
	@echo "$(PURPLE)====================================================$(NC)"
	@docker-compose -f $(COMPOSE_FILE) up --build -d

stop-glory: ## 🛑 Arrête tous les services et le moniteur.
	@echo "$(YELLOW)🛑 Arrêt de l'infrastructure 'Glory'...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) down --volumes
	@echo "$(GREEN)✅ Services et volumes 'Glory' arrêtés et supprimés.$(NC)"

run-glory-script: ## 🐍 Exécute le script d'orchestration Python.
	@echo "$(GREEN)Lancement du script d'orchestration atn_workflow_GLORY.py...$(NC)"
	@python atn_workflow_GLORY.py
	@echo "$(BLUE)Script terminé. Arrêt du moniteur de ressources...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) stop resource-monitor

# =================================================================
# === COMMANDES DE MAINTENANCE
# =================================================================

clean: ## 🧹 Nettoyage ultime de l'environnement Docker.
	@echo "$(RED)==================================================$(NC)"
	@echo "$(RED)=== ÉTAPE 1/4: PURGE COMPLÈTE DE L'ENVIRONNEMENT ===$(NC)"
	@echo "$(RED)==================================================$(NC)"
	@docker-compose -f $(COMPOSE_FILE) down -v --remove-orphans 2>/dev/null || true
	@docker system prune -af
	@echo "$(GREEN)✅ Environnement Docker nettoyé.$(NC)"

build-base-images: ## 🏗️ Construit les images de base CPU et GPU.
	@echo "$(PURPLE)==================================================$(NC)"
	@echo "$(PURPLE)=== ÉTAPE 2/4: CONSTRUCTION DES IMAGES DE BASE ===$(NC)"
	@echo "$(PURPLE)==================================================$(NC)"
	@docker-compose -f $(COMPOSE_FILE) build base-cpu base-gpu
	@echo "$(GREEN)✅ Images de base construites.$(NC)"

status: ## 📊 Affiche le statut des conteneurs 'Glory'.
	@echo "$(BLUE)Statut des services 'Glory':$(NC)"
	@docker-compose -f $(COMPOSE_FILE) ps

docker-compose -f docker-compose.glory.yml down -v --remove-orphans
docker system prune -af
docker compose --profile build-only build base-cpu
docker compose --profile build-only build base-gpu
docker-compose -f docker-compose.glory.yml up --build -d
sleep 60
python atn_workflow_GLORY.py
docker-compose -f docker-compose.glory.yml stop resource-monitor



