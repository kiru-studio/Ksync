@echo off
title ksync
cd /d "%~dp0\.."
echo Starting ksync Spotify Dock...
node "%~dp0patch-electron.js"
start "" "%~dp0..\node_modules\electron\dist\electron.exe" "%~dp0\.."
