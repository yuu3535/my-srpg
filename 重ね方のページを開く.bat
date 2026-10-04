@echo off
rem Opens debug/corridor_layers.html through a local static server (file:// cannot list folders).
rem The server runs in its own window; close that window to stop it.
rem If a server is already running on 8931, the new one just exits and the browser uses the old one.
cd /d "%~dp0"
start "srpg static server (close to stop)" py -3.12 -m http.server 8931 --bind 127.0.0.1
timeout /t 2 /nobreak >nul
start "" "http://localhost:8931/debug/corridor_layers.html"
