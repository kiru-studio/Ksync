@echo off
title ksync
cd /d "%~dp0\.."
echo Starting ksync Spotify Dock...
set ELECTRON_RUN_AS_NODE=
taskkill /F /IM electron.exe >nul 2>&1
node "%~dp0patch-electron.js"
start "" "%~dp0..\node_modules\electron\dist\electron.exe" "%~dp0\.."
