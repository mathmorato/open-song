@echo off
chcp 65001 > nul
title Open Song - Local Processor

echo ========================================================
echo        OPEN SONG - PROCESSADOR LOCAL DE AUDIO
echo ========================================================
echo.

:: Navega para a pasta do processador se executado de fora
cd /d "%~dp0"

:: 1. Verifica se Python está instalado
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERRO] Python 3 nao foi encontrado no sistema!
    echo Por favor, instale o Python 3.10 ou superior e marque "Add to PATH".
    echo Download: https://www.python.org/downloads/
    pause
    exit /b 1
)

:: 2. Verifica ambiente virtual (.venv na raiz ou local)
if not exist "..\.venv\Scripts\activate.bat" (
    if not exist ".venv\Scripts\activate.bat" (
        echo [INFO] Criando ambiente virtual Python...
        python -m venv ..\.venv
        if %errorlevel% neq 0 (
            echo [AVISO] Falha ao criar no diretorio pai, criando localmente...
            python -m venv .venv
        )
    )
)

:: Ativa o ambiente virtual
if exist "..\.venv\Scripts\activate.bat" (
    echo [INFO] Ativando ambiente virtual (..\.venv)...
    call ..\.venv\Scripts\activate.bat
) else if exist ".venv\Scripts\activate.bat" (
    echo [INFO] Ativando ambiente virtual (.venv)...
    call .venv\Scripts\activate.bat
)

:: 3. Verifica se Demucs esta instalado no ambiente
python -c "import demucs" >nul 2>nul
if %errorlevel% neq 0 (
    echo [INFO] Dependencias do Demucs nao detectadas. Instalando requirements.txt...
    echo [INFO] Isso pode levar alguns minutos no primeiro download.
    pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo [AVISO] Ocorreu um erro durante a instalacao automatica.
        echo Voce pode tentar rodar: pip install -r requirements.txt
    )
)

:: 4. Verifica FFmpeg
where ffmpeg >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [AVISO] FFmpeg nao foi encontrado no PATH do Windows!
    echo O Demucs necessita do FFmpeg para converter arquivos de audio.
    echo Para instalar rapidamente via winget:
    echo    winget install Gyan.FFmpeg
    echo Ou baixe em: https://ffmpeg.org/download.html
    echo.
)

echo.
echo Iniciando Open Song Local Processor...
echo.
echo Servidor:
echo http://127.0.0.1:8765
echo.
echo Mantenha esta janela aberta enquanto utilizar o Open Song.
echo.

python server.py

pause
