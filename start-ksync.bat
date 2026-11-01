@echo off
title ksync
cd /d "%~dp0"
echo Starting ksync Spotify Dock...
node "%~dp0scripts\patch-electron.js"
start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0."
