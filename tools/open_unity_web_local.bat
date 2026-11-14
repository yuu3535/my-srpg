@echo off
rem Unity版（WebGL）を手元で開く。ダブルクリックで、静的サーバー（ポート 8931）を動かしてブラウザを開く。
rem サーバーがもう動いていれば、ブラウザだけ開く。サーバーの黒い窓を閉じると止まる。
cd /d "%~dp0.."
netstat -ano | findstr /r /c:"127.0.0.1:8931 .*LISTENING" >nul
if errorlevel 1 (
  start "srpg-static 8931" /min py -3.12 -m http.server 8931 --bind 127.0.0.1
  timeout /t 2 /nobreak >nul
)
start "" "http://localhost:8931/unity-prototype/Builds/WebGL/index.html"
