@echo off
title Monitor de Usuarios - Autoricambi
echo ==============================================
echo    AUTORICAMBI - MONITOR DE USUARIOS
echo ==============================================
echo.
echo Iniciando sincronizacion automatica...
echo.
python watch_users.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Hubo un problema al iniciar el monitor. 
    echo Asegurate de tener Python y la libreria 'watchdog' instalados.
    pause
)
