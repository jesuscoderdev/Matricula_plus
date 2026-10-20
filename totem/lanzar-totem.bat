@echo off
rem ============================================================
rem  Matricula+ - lanzador del totem (Windows)
rem  1. Levanta el build estatico en http://localhost:4173
rem  2. Abre Chrome en modo kiosco, pantalla completa
rem
rem  Uso:  lanzar-totem.bat            (tactil: ?modo=stand)
rem        lanzar-totem.bat auto       (sin interaccion: ?modo=auto)
rem  Para salir del kiosco: Alt+F4
rem ============================================================
setlocal
set MODO=%1
if "%MODO%"=="" set MODO=stand
set URL=http://localhost:4173/?modo=%MODO%
set RAIZ=%~dp0..

rem --- Servidor local (requiere haber corrido "npm run build" en web\) ---
if not exist "%RAIZ%\web\dist\index.html" (
  echo No existe web\dist. Corre primero:  cd web ^&^& npm install ^&^& npm run build
  pause
  exit /b 1
)
start "Matricula+ servidor" /min cmd /c "cd /d "%RAIZ%\web" && npm run preview"

rem Espera a que el servidor responda
:esperar
timeout /t 1 /nobreak >nul
powershell -NoProfile -Command "try { Invoke-WebRequest http://localhost:4173/ -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 goto esperar

rem --- Chrome en kiosco ---
set CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" set CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" set CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" (
  echo No se encontro Chrome. Abre manualmente: %URL%
  pause
  exit /b 1
)

rem Perfil propio para el totem (no mezcla sesiones y conserva la cache offline)
"%CHROME%" --kiosk --app=%URL% ^
  --user-data-dir="%RAIZ%\totem\perfil-chrome" ^
  --no-first-run --noerrdialogs --disable-infobars ^
  --disable-session-crashed-bubble --disable-features=Translate,TouchpadOverscrollHistoryNavigation ^
  --overscroll-history-navigation=0 --disable-pinch --check-for-update-interval=31536000
endlocal
