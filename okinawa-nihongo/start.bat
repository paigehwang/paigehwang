@echo off
chcp 65001 >nul
REM Windows: 더블클릭하면 츄라톡 서버를 켜고 아이폰 연결 QR 페이지를 열어요
cd /d "%~dp0"
start "" cmd /c "timeout /t 4 >nul & start http://localhost:8787/connect.html"
where tailscale >nul 2>nul
if %errorlevel%==0 (
  node server.js --tailscale
) else if exist "C:\Program Files\Tailscale\tailscale.exe" (
  node server.js --tailscale
) else (
  node server.js
)
pause
