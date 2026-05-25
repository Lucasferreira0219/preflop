@echo off
cd /d "%~dp0"

where python >nul 2>&1
if errorlevel 1 (
    echo Python nao encontrado. Instale Python 3 e tente novamente.
    pause
    exit /b 1
)

python -c "import webview" >nul 2>&1
if errorlevel 1 (
    echo Instalando dependencias...
    pip install pywebview
)

python launcher.py
