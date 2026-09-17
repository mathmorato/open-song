#!/usr/bin/env bash
# Open Song - Local Processor Launcher (Linux / macOS)

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "========================================================"
echo "       OPEN SONG - PROCESSADOR LOCAL DE AUDIO"
echo "========================================================"
echo ""

# 1. Verifica Python
PYTHON_CMD=""
if command -v python3 &>/dev/null; then
    PYTHON_CMD="python3"
elif command -v python &>/dev/null; then
    PYTHON_CMD="python"
else
    echo "[ERRO] Python 3 não foi encontrado!"
    echo "Instale o Python 3.10+ para prosseguir."
    exit 1
fi

# 2. Ambiente virtual
VENV_DIR=""
if [ -d "../.venv" ]; then
    VENV_DIR="../.venv"
elif [ -d ".venv" ]; then
    VENV_DIR=".venv"
else
    echo "[INFO] Criando ambiente virtual Python (.venv)..."
    $PYTHON_CMD -m venv ../.venv || $PYTHON_CMD -m venv .venv
    if [ -d "../.venv" ]; then
        VENV_DIR="../.venv"
    else
        VENV_DIR=".venv"
    fi
fi

# Ativação
source "$VENV_DIR/bin/activate"

# 3. Dependências
if ! python -c "import demucs" &>/dev/null; then
    echo "[INFO] Instalando dependências (requirements.txt)..."
    pip install -r requirements.txt
fi

# 4. FFmpeg check
if ! command -v ffmpeg &>/dev/null; then
    echo ""
    echo "[AVISO] FFmpeg não encontrado no PATH!"
    echo "No Ubuntu/Debian: sudo apt update && sudo apt install ffmpeg"
    echo "No macOS (Homebrew): brew install ffmpeg"
    echo ""
fi

echo ""
echo "Iniciando Open Song Local Processor..."
echo ""
echo "Servidor:"
echo "http://127.0.0.1:8765"
echo ""
echo "Mantenha este terminal aberto enquanto utilizar o Open Song."
echo ""

python server.py
