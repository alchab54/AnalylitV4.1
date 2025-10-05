# analylit.ps1 - Script PowerShell pour AnalyLit V4.1 
param([string]$action = "help")

$COMPOSE_FILE = "docker-compose-local.yml"
$WORKER_COUNT = 3

function Show-Help {
    Write-Host ""
    Write-Host "AnalyLit V4.1 - Gestionnaire de services" -ForegroundColor Blue
    Write-Host ""
    Write-Host "  install     " -ForegroundColor Green -NoNewline; Write-Host "Installation complète"
    Write-Host "  start       " -ForegroundColor Green -NoNewline; Write-Host "Démarrer les services"
    Write-Host "  stop        " -ForegroundColor Green -NoNewline; Write-Host "Arrêter les services"
    Write-Host "  status      " -ForegroundColor Green -NoNewline; Write-Host "État des services"
    Write-Host "  logs        " -ForegroundColor Green -NoNewline; Write-Host "Voir les logs"
    Write-Host "  models      " -ForegroundColor Green -NoNewline; Write-Host "Télécharger les modèles IA"
    Write-Host "  clean       " -ForegroundColor Green -NoNewline; Write-Host "Arrête et supprime les conteneurs, réseaux et volumes."
    Write-Host ""
}

function Install-AnalyLit {
    Write-Host "🚀 Installation d'AnalyLit V4.1..." -ForegroundColor Blue
    
    # Créer les dossiers
    New-Item -ItemType Directory -Force -Path "projects" | Out-Null
    New-Item -ItemType Directory -Force -Path "web" | Out-Null
    
    # Vérifier .env
    if (-not (Test-Path ".env")) {
        Copy-Item "env.example" ".env"
        Write-Host "⚠️  Fichier .env créé. Pensez à le remplir !" -ForegroundColor Yellow
    }
    
    # Construction et démarrage
    docker-compose -f $COMPOSE_FILE up -d --build --scale worker=$WORKER_COUNT
    
    Write-Host "✅ Installation terminée!" -ForegroundColor Green
    Write-Host "🌐 Interface web: http://localhost:8080" -ForegroundColor Blue
}

function Start-Services {
    Write-Host "🚀 Démarrage des services (avec $WORKER_COUNT workers)..." -ForegroundColor Blue
    docker-compose -f $COMPOSE_FILE up -d --scale worker=$WORKER_COUNT
    Write-Host "✅ Services démarrés" -ForegroundColor Green
}

function Stop-Services {
    Write-Host "🛑 Arrêt des services..." -ForegroundColor Blue
    docker-compose -f $COMPOSE_FILE down
    Write-Host "✅ Services arrêtés" -ForegroundColor Green
}

function Show-Status {
    Write-Host "📊 État des services:" -ForegroundColor Blue
    docker-compose -f $COMPOSE_FILE ps
}

function Show-Logs {
    Write-Host "📋 Logs des services:" -ForegroundColor Blue
    docker-compose -f $COMPOSE_FILE logs -f --tail=100
}

function Invoke-ModelDownload {
    Write-Host "🤖 Téléchargement des modèles essentiels..." -ForegroundColor Blue
    
    # Attendre Ollama
    do {
        Start-Sleep -Seconds 2
        $response = try { Invoke-WebRequest -Uri "http://localhost:11434/api/version" -TimeoutSec 5 } catch { $null }
    } while (-not $response)
    
    # Télécharger les modèles
    $container = docker-compose -f $COMPOSE_FILE ps -q ollama
    docker exec $container ollama pull llama3.1:8b
    docker exec $container ollama pull phi3:mini
    docker exec $container ollama pull gemma:2b
    
    Write-Host "✅ Modèles téléchargés" -ForegroundColor Green
}

function Clear-Environment {
    Write-Host "🧹 Nettoyage complet de l'environnement (conteneurs, réseaux, volumes)..." -ForegroundColor Yellow
    docker-compose -f $COMPOSE_FILE down -v
    Write-Host "✅ Environnement nettoyé." -ForegroundColor Green
}

# Dispatcher des actions
switch ($action) {
    "install" { Install-AnalyLit }
    "start" { Start-Services }
    "stop" { Stop-Services }
    "status" { Show-Status }
    "logs" { Show-Logs }
    "models" { Invoke-ModelDownload }
    "clean" { Clear-Environment }
    default { Show-Help }
}