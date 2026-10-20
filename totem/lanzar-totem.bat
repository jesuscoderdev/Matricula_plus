@echo off
rem ============================================================
rem  Matricula+ - lanzador del totem (Windows)
rem  Abre web\demo-offline.html (un solo archivo con todo adentro)
rem  en Chrome en modo kiosco. No necesita servidor ni internet.
rem
rem  Uso:  lanzar-totem.bat            (tactil: ?modo=stand)
rem        lanzar-totem.bat auto       (sin interaccion: ?modo=auto)
rem  Para salir del kiosco: Alt+F4
rem  Reinicio oculto del demo: mantener presionado el logo 3 s
rem ============================================================
setlocal
set MODO=%1
if "%MODO%"=="" set MODO=stand
set RAIZ=%~dp0..
set DEMO=%RAIZ%\web\demo-offline.html

if not exist "%DEMO%" (
  echo No existe web\demo-offline.html. Generalo con:  cd web ^&^& npm install ^&^& npm run build:archivo
  pause
  exit /b 1
)

rem Ruta del archivo como URL file:/// (barras normales)
set URL=file:///%DEMO:\=/%?modo=%MODO%

set CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" set CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" set CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" (
  echo No se encontro Chrome. Abre manualmente: %URL%
  pause
  exit /b 1
)

rem Perfil propio para el totem (no mezcla sesiones del usuario)
"%CHROME%" --kiosk --app="%URL%" ^
  --user-data-dir="%RAIZ%\totem\perfil-chrome" ^
  --no-first-run --noerrdialogs --disable-infobars ^
  --disable-session-crashed-bubble --disable-features=Translate,TouchpadOverscrollHistoryNavigation ^
  --overscroll-history-navigation=0 --disable-pinch --check-for-update-interval=31536000
endlocal
