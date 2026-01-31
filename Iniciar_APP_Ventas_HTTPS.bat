@echo off
echo =========================================
echo Iniciando APP Ventas (DEV - Desarrollo V3)
echo =========================================

REM Ruta del proyecto
cd /d "C:\Users\usuariolocal\Desktop\Alejandro\Respaldado\APP_Ventas\Desarrollo V3\Prod"

REM Validación rápida
if not exist index.html (
  echo ❌ ERROR: No se encontró index.html en la ruta indicada
  pause
  exit /b
)

REM Abrir aplicación en el navegador
start "" "https://127.0.0.1:8080"

REM Levantar servidor HTTPS (queda en primer plano)
http-server -S -C cert.pem -K key.pem -p 8080

pause
