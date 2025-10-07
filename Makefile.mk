# ================================================================
# ANALYLIT V4.2 - MAKEFILE HAUTE PERFORMANCE
# ================================================================
# Architecture 15 services + GPU RTX 2060 SUPER
# ================================================================

# Couleurs 
BLUE = \033[34m
GREEN = \033[32m
YELLOW = \033[33m
RED = \033[31m
PURPLE = \033[35m
CYAN = \033[36m
NC = \033[0m

# Configuration
COMPOSE_FILE = docker-compose.dev.yml
PROJECT_NAME = analylit

.PHONY: help dev stop clean test status health models setup-profiles

# ================================================================
# === COMMANDES PRINCIPALES
# ================================================================

help: ## 📋 Afficher toutes les commandes
	@echo "$(BLUE)🚀 ANALYLIT V4.2 - GPU RTX 2060 SUPER$(NC)"
	@echo "$(BLUE)=====================================$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "$(GREEN)%-20s$(NC) %s\n", $$1, $$2}'

quick-start: ## ⚡ Démarrage ultra-rapide (recommandé)
	@echo "$(PURPLE)⚡ DÉMARRAGE ULTRA-RAPIDE$(NC)"
	@docker-compose -f $(COMPOSE_FILE) up -d --no-deps test-db redis ollama rq-dashboard
	@sleep 60
	@docker-compose -f $(COMPOSE_FILE) up migrate
	@docker-compose -f $(COMPOSE_FILE) up -d --no-deps web
	@docker-compose -f $(COMPOSE_FILE) up -d --no-deps worker-import-1 worker-extraction-1 worker-screening-1
	@echo "$(GREEN)✅ Services essentiels démarrés !$(NC)"

dev: ## 🔧 Démarrage développement complet (15 services)
	@echo "$(BLUE)🔧 ARCHITECTURE COMPLÈTE - 15 SERVICES$(NC)"
	@docker-compose -f $(COMPOSE_FILE) down --remove-orphans
	@echo "$(YELLOW)🏗️ Infrastructure de base...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) up -d test-db redis rq-dashboard
	@sleep 30
	@echo "$(YELLOW)🤖 Ollama GPU RTX 2060...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) up -d ollama
	@sleep 90
	@echo "$(YELLOW)📦 Migration...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) up migrate
	@echo "$(YELLOW)🌐 Service Web...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) up -d --no-deps web test-runner
	@echo "$(YELLOW)👷 13 Workers spécialisés...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) up -d --no-deps \
		worker-import-1 worker-import-2 \
		worker-screening-1 worker-screening-2 worker-screening-3 \
		worker-extraction-1 worker-extraction-2 worker-extraction-3 worker-extraction-4 \
		worker-analysis-1 worker-analysis-2 \
		worker-synthesis-1 worker-synthesis-2 \
		worker-discussion
	@echo "$(GREEN)✅ Architecture complète active !$(NC)"
	@$(MAKE) setup-profiles
	@$(MAKE) status

stop: ## 🛑 Arrêter tous les services
	@echo "$(YELLOW)🛑 Arrêt services AnalyLit...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) down
	@echo "$(GREEN)✅ Services arrêtés$(NC)"

restart: ## 🔄 Redémarrage intelligent
	@echo "$(BLUE)🔄 Redémarrage AnalyLit...$(NC)"
	@$(MAKE) stop
	@sleep 3
	@$(MAKE) quick-start

# ================================================================
# === CONFIGURATION & SETUP
# ================================================================

setup-profiles: ## ⚙️ Installer profils d'analyse (requis une fois)
	@echo "$(BLUE)⚙️ Installation profils d'analyse...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) exec web python scripts/setup_profiles.py
	
models-essential: ## 🤖 Modèles essentiels (phi3:mini + llama3:8b)
	@echo "$(BLUE)🤖 Vérification modèles essentiels...$(NC)"
	@docker exec analylit_ollama_dev ollama list | grep -q phi3:mini && echo "$(GREEN)✅ phi3:mini: Installé$(NC)" || docker exec analylit_ollama_dev ollama pull phi3:mini
	@docker exec analylit_ollama_dev ollama list | grep -q llama3:8b && echo "$(GREEN)✅ llama3:8b: Installé$(NC)" || docker exec analylit_ollama_dev ollama pull llama3:8b
	@echo "$(GREEN)✅ Modèles essentiels prêts !$(NC)"

models-gpu: ## 🔥 Modèles GPU haute performance
	@echo "$(PURPLE)🔥 Installation modèles GPU...$(NC)"
	@docker exec analylit_ollama_dev ollama pull llama3:70b
	@docker exec analylit_ollama_dev ollama pull mixtral:8x7b
	@echo "$(GREEN)✅ Modèles GPU installés$(NC)"

models-list: ## 📋 Liste des modèles installés
	@echo "$(BLUE)📋 Modèles Ollama RTX 2060:$(NC)"
	@docker exec analylit_ollama_dev ollama list

# ================================================================
# === MONITORING & DIAGNOSTICS
# ================================================================

status: ## 📊 État complet système (recommandé)
	@echo "$(BLUE)📊 ÉTAT SYSTÈME ANALYLIT V4.2$(NC)"
	@echo "$(BLUE)===============================$(NC)"
	@echo "$(CYAN)Services (15 attendus):$(NC)"
	@docker-compose -f $(COMPOSE_FILE) ps --format table
	@echo ""
	@echo "$(CYAN)Workers actifs:$(NC)"
	@docker ps --format "table {{.Names}}\t{{.Status}}" | grep worker | wc -l | xargs echo "Nombre de workers:"
	@echo ""
	@echo "$(CYAN)Tests connectivité:$(NC)"
	@curl -s http://localhost:8080/api/health >/dev/null && echo "$(GREEN)✅ API Web: FONCTIONNELLE$(NC)" || echo "$(RED)❌ API Web: ERREUR$(NC)"
	@curl -s http://localhost:11434/api/version >/dev/null && echo "$(GREEN)✅ Ollama GPU: ACTIF$(NC)" || echo "$(RED)❌ Ollama: ERREUR$(NC)"
	@curl -s http://localhost:9181 >/dev/null && echo "$(GREEN)✅ RQ Dashboard: OK$(NC)" || echo "$(RED)❌ RQ Dashboard: OFFLINE$(NC)"
	@echo ""
	@echo "$(CYAN)URLs importantes:$(NC)"
	@echo "🌐 AnalyLit: http://localhost:8080"
	@echo "📊 RQ Dashboard: http://localhost:9181"

health: ## 🏥 Diagnostic santé détaillé
	@echo "$(BLUE)🏥 DIAGNOSTIC SANTÉ COMPLET$(NC)"
	@echo "$(BLUE)=============================$(NC)"
	@docker exec analylit_redis_dev redis-cli ping && echo "$(GREEN)✅ Redis: PONG$(NC)" || echo "$(RED)❌ Redis: ERREUR$(NC)"
	@docker exec analylit_test_db pg_isready -U analylit_user && echo "$(GREEN)✅ PostgreSQL: Ready$(NC)" || echo "$(RED)❌ PostgreSQL: ERREUR$(NC)"
	@curl -s http://localhost:8080/api/projects >/dev/null && echo "$(GREEN)✅ API Projects: OK$(NC)" || echo "$(RED)❌ API Projects: ERREUR - VÉRIFIER LOGS$(NC)"
	@echo "$(CYAN)État GPU:$(NC)"
	@docker exec analylit_ollama_dev nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total --format=csv,noheader 2>/dev/null || echo "Mode CPU"

gpu-status: ## 🔥 État GPU RTX 2060 détaillé
	@echo "$(PURPLE)🔥 ÉTAT GPU RTX 2060 SUPER$(NC)"
	@echo "$(PURPLE)============================$(NC)"
	@docker exec analylit_ollama_dev nvidia-smi 2>/dev/null || echo "GPU non disponible"
	@echo "$(CYAN)Configuration Ollama:$(NC)"
	@docker logs analylit_ollama_dev 2>/dev/null | grep "GeForce RTX" || echo "Logs GPU non trouvés"

# ================================================================
# === WORKFLOWS ATN
# ================================================================

test-atn: ## 🎯 Test workflow ATN (5 articles)
	@echo "$(PURPLE)🎯 TEST WORKFLOW ATN SÉQUENTIEL$(NC)"
	@docker exec analylit_redis_dev redis-cli FLUSHALL
	@docker-compose -f $(COMPOSE_FILE) exec web python scripts/test_atn_5_articles.py --no-cleanup
	@echo "$(GREEN)✅ Test ATN terminé !$(NC)"

demo-atn: ## 🎭 Démonstration ATN complète
	@echo "$(PURPLE)🎭 DÉMONSTRATION ATN$(NC)"
	@$(MAKE) setup-profiles
	@$(MAKE) models-essential
	@$(MAKE) test-atn

queue-status: ## 📊 État des queues de travail
	@echo "$(BLUE)📊 État des queues RQ:$(NC)"
	@curl -s http://localhost:9181 | grep -o "queue.*[0-9]" || echo "RQ Dashboard requis"
	@docker exec analylit_redis_dev redis-cli info keyspace

queue-clear: ## 🧹 Vider toutes les queues
	@echo "$(YELLOW)🧹 Vidage des queues...$(NC)"
	@docker exec analylit_redis_dev redis-cli FLUSHALL
	@echo "$(GREEN)✅ Queues vidées$(NC)"

# ================================================================
# === LOGS & DEBUG
# ================================================================

logs: ## 📋 Logs temps réel tous services
	@docker-compose -f $(COMPOSE_FILE) logs -f

logs-web: ## 🌐 Logs service web (debug API)
	@docker-compose -f $(COMPOSE_FILE) logs -f web

logs-workers: ## 👷 Logs workers spécialisés
	@docker-compose -f $(COMPOSE_FILE) logs -f worker-import-1 worker-extraction-1 worker-screening-1

logs-ollama: ## 🤖 Logs Ollama GPU
	@docker-compose -f $(COMPOSE_FILE) logs -f ollama

logs-errors: ## ❌ Filtrer uniquement les erreurs
	@docker-compose -f $(COMPOSE_FILE) logs --no-color | grep -i error

debug-api: ## 🐛 Debug API spécifique
	@echo "$(YELLOW)🐛 DEBUG API - Tests endpoints$(NC)"
	@curl -v http://localhost:8080/api/health
	@curl -v http://localhost:8080/api/projects
	@docker-compose -f $(COMPOSE_FILE) exec web python -c "import requests; print('API interne:', requests.get('http://localhost:5000/api/health').text)"

# ================================================================
# === MAINTENANCE
# ================================================================

clean: ## 🧹 Nettoyage complet
	@echo "$(RED)⚠️  NETTOYAGE COMPLET$(NC)"
	@read -p "Supprimer toutes les données ? (oui/non): " confirm && [ "$$confirm" = "oui" ]
	@docker-compose -f $(COMPOSE_FILE) down --volumes --remove-orphans
	@docker system prune -af
	@echo "$(GREEN)✅ Système nettoyé$(NC)"

backup: ## 💾 Sauvegarde complète
	@echo "$(BLUE)💾 Sauvegarde AnalyLit...$(NC)"
	@mkdir -p backups
	@docker exec analylit_test_db pg_dump -U analylit_user analylit_test_db > backups/db-backup-$$(date +%Y%m%d-%H%M%S).sql
	@tar -czf backups/projects-backup-$$(date +%Y%m%d-%H%M%S).tar.gz projects/ 2>/dev/null || echo "Projets: Aucun à sauvegarder"
	@echo "$(GREEN)✅ Sauvegarde dans backups/$(NC)"

update: ## 🔄 Mise à jour depuis GitHub
	@echo "$(BLUE)🔄 Mise à jour depuis GitHub...$(NC)"
	@git pull origin main
	@docker-compose -f $(COMPOSE_FILE) build --no-cache
	@$(MAKE) restart

# ================================================================
# === PERFORMANCE & BENCHMARKS
# ================================================================

benchmark: ## ⚡ Test performance GPU
	@echo "$(PURPLE)⚡ BENCHMARK RTX 2060 SUPER$(NC)"
	@echo "$(YELLOW)Test phi3:mini (screening)...$(NC)"
	@time docker exec analylit_ollama_dev ollama run phi3:mini "Résume: L'IA améliore les diagnostics médicaux" > /dev/null
	@echo "$(YELLOW)Test llama3:8b (extraction)...$(NC)"  
	@time docker exec analylit_ollama_dev ollama run llama3:8b "Analyse cette étude médicale en 100 mots" > /dev/null
	@echo "$(GREEN)✅ Benchmark terminé$(NC)"

performance: ## 📈 Analyse performances système
	@echo "$(PURPLE)📈 ANALYSE PERFORMANCES$(NC)"
	@echo "$(CYAN)Workers actifs:$(NC) $$(docker ps | grep worker | wc -l)/13"
	@echo "$(CYAN)Utilisation mémoire:$(NC)"
	@docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}" | head -8
	@echo "$(CYAN)État GPU:$(NC)"
	@docker exec analylit_ollama_dev nvidia-smi --query-gpu=utilization.gpu,memory.used --format=csv,noheader,nounits 2>/dev/null || echo "Mode CPU"

monitor: ## 📊 Surveillance temps réel
	@echo "$(BLUE)📊 MONITORING TEMPS RÉEL (Ctrl+C pour arrêter)$(NC)"
	@watch -n 3 'echo "=== SERVICES ==="; docker-compose -f docker-compose.dev.yml ps --format table | head -10; echo "=== GPU ==="; docker exec analylit_ollama_dev nvidia-smi --query-gpu=utilization.gpu,memory.used --format=csv,noheader 2>/dev/null || echo "CPU Mode"; echo "=== API ==="; curl -s http://localhost:8080/api/health && echo "✅" || echo "❌"'

# ================================================================
# === TESTS SPÉCIALISÉS
# ================================================================

test: ## 🧪 Tests complets pytest
	@echo "$(BLUE)🧪 Tests AnalyLit complets$(NC)"
	@docker-compose -f $(COMPOSE_FILE) exec test-runner pytest tests/ -v --tb=short

test-quick: ## ⚡ Tests rapides essentiels
	@echo "$(YELLOW)⚡ Tests rapides$(NC)"
	@docker-compose -f $(COMPOSE_FILE) exec test-runner pytest tests/test_server_endpoints.py -v -k "test_create_project or test_health"

test-integration: ## 🔗 Tests d'intégration E2E
	@echo "$(BLUE)🔗 Tests d'intégration$(NC)"
	@docker-compose -f $(COMPOSE_FILE) exec test-runner pytest tests/test_integration.py -v

test-workers: ## 👷 Tests des workers
	@echo "$(BLUE)👷 Tests des workers$(NC)"
	@docker exec analylit_redis_dev redis-cli FLUSHALL
	@docker-compose -f $(COMPOSE_FILE) exec test-runner python -c "from rq import Queue; from redis import Redis; r = Redis.from_url('redis://redis:6379/0'); q = Queue('analysis_queue', connection=r); print(f'Queue analysis: {len(q)} jobs')"

# ================================================================
# === SHORTCUTS UTILES
# ================================================================

up: quick-start ## 🚀 Alias démarrage rapide

down: stop ## 🛑 Alias arrêt

ps: status ## 📊 Alias état

open: ## 🌐 Ouvrir interfaces dans navigateur
	@echo "$(CYAN)🌐 Ouverture interfaces...$(NC)"
	@start http://localhost:8080 2>/dev/null || open http://localhost:8080 2>/dev/null || echo "Ouvrir: http://localhost:8080"
	@start http://localhost:9181 2>/dev/null || open http://localhost:9181 2>/dev/null || echo "RQ Dashboard: http://localhost:9181"

fix-api: ## 🔧 Corriger problème API
	@echo "$(YELLOW)🔧 Redémarrage service Web...$(NC)"
	@docker-compose -f $(COMPOSE_FILE) restart web
	@sleep 10
	@curl http://localhost:8080/api/health && echo "$(GREEN)✅ API corrigée$(NC)" || echo "$(RED)❌ API toujours problématique$(NC)"

# ================================================================
# === AIDE SYSTÈME
# ================================================================

doctor: ## 🩺 Diagnostic système complet
	@echo "$(BLUE)🩺 DIAGNOSTIC SYSTÈME$(NC)"
	@echo "$(CYAN)Version Docker:$(NC) $$(docker --version)"
	@echo "$(CYAN)Images AnalyLit:$(NC)"
	@docker images | grep analylit | wc -l | xargs echo "Nombre d'images:"
	@echo "$(CYAN)Volumes:$(NC)"
	@docker volume ls | grep analylit
	@echo "$(CYAN)Réseaux:$(NC)"
	@docker network ls | grep analylit
	@$(MAKE) health

info: ## ℹ️ Informations système
	@echo "$(BLUE)ℹ️  ANALYLIT V4.2 - INFORMATIONS$(NC)"
	@echo "$(BLUE)================================$(NC)"
	@echo "$(GREEN)✅ Architecture: 15 services haute performance$(NC)"
	@echo "$(GREEN)✅ GPU: RTX 2060 SUPER (8 Go VRAM)$(NC)"
	@echo "$(GREEN)✅ IA: Ollama + phi3:mini + llama3:8b$(NC)"
	@echo "$(GREEN)✅ Workers: 13 spécialisés ATN$(NC)"
	@echo "$(GREEN)✅ Pipeline: Séquentiel optimisé$(NC)"
	@echo ""
	@echo "$(CYAN)Commandes principales:$(NC)"
	@echo "$(YELLOW)make dev$(NC)        - Démarrage complet"
	@echo "$(YELLOW)make status$(NC)     - État système"
	@echo "$(YELLOW)make test-atn$(NC)   - Test workflow ATN"
	@echo "$(YELLOW)make monitor$(NC)    - Surveillance temps réel"
