#!/bin/bash
# ===================================================================
# == SCRIPT BUILD OPTIMISÉ ANALYLIT V4.2
# ===================================================================

set -e

echo "🏗️  Build optimisé AnalyLit V4.2..."

# Détection des changements
if [ -f "requirements-base.txt" ] && [ "requirements-base.txt" -nt ".last-base-build" ]; then
    echo "🔥 REBUILDING BASE (dépendances lourdes changées)"
    BUILD_ARG="--no-cache"
    touch .last-base-build
elif [ -f "requirements-common.txt" ] && [ "requirements-common.txt" -nt ".last-common-build" ]; then
    echo "🔄 REBUILDING COMMON (dépendances moyennes changées)"
    BUILD_ARG="--no-cache-filter=requirements-common"
    touch .last-common-build
else
    echo "⚡ BUILD INCRÉMENTAL (seules les couches supérieures)"
    BUILD_ARG=""
fi

# Build selon le type
if command -v nvidia-smi &> /dev/null; then
    echo "🚀 Build GPU détecté (RTX 2060 SUPER)"
    docker build -f docker/Dockerfile.base-gpu -t analylit-base:gpu $BUILD_ARG .
else
    echo "💻 Build CPU"
    docker build -f docker/Dockerfile.base-cpu -t analylit-base:cpu $BUILD_ARG .
fi

echo "✅ Build terminé"
