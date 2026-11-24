@echo off
cd /d "%~dp0public"
where python >nul 2>&1 || (echo Instala Python 3 para abrir la demo local. & pause & exit /b 1)
echo Abre http://127.0.0.1:8765/demo/index.html
echo Cierra esta ventana para detener la demo.
python -m http.server 8765 --bind 127.0.0.1
